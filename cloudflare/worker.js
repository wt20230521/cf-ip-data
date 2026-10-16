/**
 * PrismTun 订阅托管 · Cloudflare Worker（单文件，KV 存储）
 *
 * 接口一览（base = 你的 Worker 地址，例如 https://sub.你的域名.com）
 *   GET    /ct                      取订阅内容（纯文本，客户端直接订阅这个地址）
 *   GET    /cmcc  /cu  /任意key      同上（若设置了 READ_TOKEN，需带 ?token=xxx）
 *   POST   /api?token=xx&key=ct     上传/更新（body = 订阅内容纯文本，base64 也行）
 *   GET    /api?token=xx&action=list     列出已上传的 key
 *   DELETE /api?token=xx&key=ct     删除
 *
 * 安全：写操作（POST/DELETE/list）必须带 UPLOAD_TOKEN。
 *       读订阅默认公开（客户端要能匿名拉）；
 *       如果你想让订阅链接也保密，额外设置一个机密 READ_TOKEN，
 *       读取就变成必须带 ?token=xxx —— 上传接口返回的 url 会自动带上它，直接复制即可。
 *       两个 token 都放面板「变量与机密」里加密存储，别写死在代码里。
 *
 * 部署：Workers 和 Pages → 创建 Worker → 创建 KV 命名空间并绑定变量名 SUB_KV
 *      → 设置机密 UPLOAD_TOKEN → 粘贴本文件 → 部署 → 建议绑定自己的域名。
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function subUrl(url, key, readTok) {
  const u = new URL('/' + key, url.origin);
  if (readTok) { u.searchParams.set('token', readTok); }
  return u.href;
}

function text(str, status = 200, extra = {}) {
  return new Response(str, {
    status,
    headers: { ...CORS, 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const seg = url.pathname.replace(/^\/+|\/+$/g, '');

    // 预检（App 内 WebView 跨域上传会先发 OPTIONS）
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    // ---- 1) 读取订阅：GET /<key>（设了 READ_TOKEN 就要带 ?token=）----
    if (request.method === 'GET' && seg && seg !== 'api') {
      if (env.READ_TOKEN && (url.searchParams.get('token') || '') !== env.READ_TOKEN) {
        return text('forbidden', 403);
      }
      const val = await env.SUB_KV.get(seg);
      if (val === null) {
        return text('not found: ' + seg, 404);
      }
      const meta = await env.SUB_KV.get(seg + ':meta');
      let updated = '';
      try { updated = meta ? new Date(JSON.parse(meta).time).toISOString() : ''; } catch (e) { /* 忽略 */ }
      return text(val, 200, {
        'x-sub-updated': updated,
        // 部分客户端会认这个头显示流量/到期，纯文本订阅用不上，留个占位
        'subscription-userinfo': 'upload=0; download=0; total=0; expire=0',
      });
    }

    // ---- 2) 管理 API：/api ----
    if (seg === 'api') {
      const token = url.searchParams.get('token') || '';
      if (!env.UPLOAD_TOKEN || token !== env.UPLOAD_TOKEN) {
        return json({ ok: false, error: 'bad token' }, 401);
      }
      const act = (url.searchParams.get('action') || 'put').toLowerCase();
      const key = (url.searchParams.get('key') || '').trim();

      if (act === 'list') {
        const list = await env.SUB_KV.list();
        const items = [];
        for (const it of list.keys) {
          if (it.name.endsWith(':meta')) { continue; }
          const meta = await env.SUB_KV.get(it.name + ':meta');
          const body = (await env.SUB_KV.get(it.name)) || '';
          let time = null;
          try { time = meta ? JSON.parse(meta).time : null; } catch (e) { /* 忽略 */ }
          items.push({
            key: it.name, size: body.length, updated: time,
            url: subUrl(url, it.name, env.READ_TOKEN || ''),
          });
        }
        return json({ ok: true, items });
      }

      // 【2026-10-16 A 方案】放宽 key 规则允许点号（ct.yaml 风格）。
      // 兼容性说明：App 实际用的 yaml key 是 ct-yaml（连字符），新旧 Worker 都认；
      // 这里放开点号是给「以后想用带扩展名 key」的用户留路，不影响存量部署。
      if (!/^[A-Za-z0-9._-]{1,32}$/.test(key)) {
        return json({ ok: false, error: 'invalid key' }, 400);
      }

      if (act === 'put') {
        const body = await request.text();
        if (!body) { return json({ ok: false, error: 'empty body' }, 400); }
        if (body.length > 1024 * 1024) { return json({ ok: false, error: 'too large (max 1MB)' }, 413); }
        await env.SUB_KV.put(key, body);
        await env.SUB_KV.put(key + ':meta', JSON.stringify({ time: Date.now(), size: body.length }));
        return json({
          ok: true, key, size: body.length,
          url: subUrl(url, key, env.READ_TOKEN || ''),
        });
      }

      if (act === 'delete') {
        await env.SUB_KV.delete(key);
        await env.SUB_KV.delete(key + ':meta');
        return json({ ok: true, key });
      }

      return json({ ok: false, error: 'unknown action' }, 400);
    }

    // ---- 3) 首页：简单自检说明 ----
    return text([
      'PrismTun 订阅托管 · 运行中',
      '',
      '取订阅 : GET  ' + url.origin + '/ct',
      '上传   : POST ' + url.origin + '/api?token=<TOKEN>&key=ct   (body=订阅内容)',
      '列表   : GET  ' + url.origin + '/api?token=<TOKEN>&action=list',
      '删除   : DELETE ' + url.origin + '/api?token=<TOKEN>&key=ct',
      '',
      'Clash YAML（FLClash 等）: key=ct-yaml，上传后 GET ' + url.origin + '/ct-yaml',
      '',
      '读保护 : ' + (env.READ_TOKEN ? '开启（取值需带 ?token=）' : '关闭（任何人可读）'),
    ].join('\n'));
  },
};
