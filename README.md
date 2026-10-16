# PrismTun（原 IP测评）

> CF 优选节点测评 + 一键云端托管 + 多客户端订阅生成。
> 本仓库是 **文档与部署配置仓**——包含项目说明、Cloudflare Worker 托管源码与图标设计资源。
> 完整 App 工程与已签名安装包由本地构建发布，不在本仓库内。

---

## 这是什么

PrismTun 把一个 Clash/Clash.Meta 节点筛选工具，做成了**手机端一键测评 → 自动汇聚 → 上传云端 → 客户端扫码即用**的闭环。

四页心智模型（数据流：②管进、①管产、③管存、④管包）：

| 页 | 作用 | 一句话 |
|---|---|---|
| ① PrismTun | 本地测评 | 选候选、逐个测速、按地区/延迟/端口筛选 |
| ② 测评设置 | 数据源 | 内置列表 / 优选 API / 自定义数据，三源可同时勾选 |
| ③ 接口管理 | 云端托管 | 三网订阅一键上传到自己的云端 |
| ④ 参数设置 | 订阅模板 | 超时、每地区保留条数、节点模板（uuid/sni 等） |

---

## 当前版本能力（v1.4 M1）

- ✅ **双格式订阅**（2026-10-16）：每个网络上传后自动生成两个文件
  - `ct.yaml` · Clash 配置 → 给 **FLClash / Clash for Android / Clash Verge / Stash**
  - `ct.txt` · base64 清单 → 给 **v2rayN / v2rayNG / Karing**
- ✅ **📱 二维码**（2026-10-16）：接口管理页点「📱二维码」弹窗，两个格式各一个码，扫码直接添加订阅
- ✅ 实测优先口径（实测延迟不会被快照占位顶掉）、重启不丢节点、无双重 base64 编码
- ✅ 主题双板（亮/暗），不强制暗色

> FLClash 接不上？九成是填错了地址——它**只认 Clash YAML**，填 `Clash 配置` 那个，别填 v2rayN 列表。详见使用说明 FAQ。

> 测速别贪多：实测节点 = (IPv4+IPv6 地址数) × 勾选端口数；**每网只保留 8000 条**、三网快照合计约 20000 条会撑爆本地存储。端口勾 1~2 个、单网 ≤ 6000 最稳。详见 `PrismTun_v1.4_使用说明.txt` 第八节。

---

## 目录结构

```
/
├── README.md                     # 本文件（项目总览）
├── 改造实施清单.md                # 历轮改造任务记录
├── 真机冒烟卡.md                  # 真机验收步骤（装新包后必跑）
├── PrismTun_v1.4_使用说明.txt     # 给最终用户的 App 使用说明
├── release_gate_report.txt       # 最近一次发布门禁报告（8 关全绿存档）
├── cloudflare/                   # 可选的自定义 API（Cloudflare Worker）源码
│   ├── worker.js                 #   订阅托管服务（KV 存储，token 保护上传）
│   ├── wrangler.toml             #   命令行部署配置（面板部署可忽略）
│   └── README.md                 #   Worker 部署说明
└── icon_src/                     # App 图标设计资源
    ├── res/drawable/prism_icon.xml   # 矢量图标源（克莱因蓝 L+ 进度弧）
    ├── AndroidManifest.xml           # adaptive-icon 声明参考
    ├── icon.flata                    # 图标资源包（构建中间产物）
    └── icon_out.apk                  # 图标打包产物（构建中间产物）

（PrismTun/ 目录为 App 运行时自动上传订阅数据所创建，非手工维护。）
```

---

## 订阅托管部署（Cloudflare Worker，推荐）

不用 GitHub 也能托管订阅——部署自己的 Worker：

1. **面板部署**（最简单）：Cloudflare Dashboard → Workers → 创建 → 粘贴 `cloudflare/worker.js` 全文 → 绑定一个 KV 命名空间（变量名必须叫 `SUB_KV`）→ 添加机密 `UPLOAD_TOKEN`（自定义口令）
2. **命令行部署**：改好 `cloudflare/wrangler.toml` 里的 KV id，然后
   ```bash
   npx wrangler deploy
   npx wrangler secret put UPLOAD_TOKEN
   ```
3. App「③接口管理」选自定义 API，填 `https://你的worker域名`，token 填你设的 `UPLOAD_TOKEN`

> 取订阅不需要 token；上传/删除需要。App 上传后自动生成 `ct.yaml`（Clash 系）+ `ct.txt`（v2rayN 系）双格式，key 分别为 `ct` / `ct-yaml`（三网同理 `cmcc`/`cmcc-yaml`、`cu`/`cu-yaml`）。

---

## 文档导航

| 文档 | 给谁看 | 内容 |
|---|---|---|
| **README.md**（本文件） | 访客 / 部署者 | 项目总览、Worker 部署 |
| `改造实施清单.md` | 维护者 | 历轮改造任务记录 |
| `真机冒烟卡.md` | 每次装新包的人 | 真机验收 9 步 |
| `PrismTun_v1.4_使用说明.txt` | 最终用户 | 安装、页面导览、FAQ |
| `release_gate_report.txt` | 维护者 | 发布门禁质量档案样例 |

---

*PrismTun · 自构建自签名 · 仅供个人学习研究使用。*
