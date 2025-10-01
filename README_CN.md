
# Chunkuposs — 分块上传与分享 (v6.x)

[![GitHub License](https://img.shields.io/badge/License-GPL%203.0-blue.svg?style=flat)](https://www.gnu.org/licenses/gpl-3.0.html)
[![Vue 3](https://img.shields.io/badge/Vue.js-3.5%2B-brightgreen?logo=vue.js)](https://vuejs.org/)
[![Vercel Deployment](https://img.shields.io/badge/Deploy%20on-Vercel-black?logo=vercel)](https://vercel.com)
中文 | English: README.md

Chunkuposs 采用 Provider 架构（默认编程猫 CodeMao），核心服务使用 TypeScript 实现。DangBei 集成已移除。

## 核心功能
- Provider 架构：`StorageProvider` 接口 + 默认 `CodemaoProvider`。
- TS 服务层：`uploadService.ts`、`chunkUploadService.ts`、`downloadService.ts`、`toast.ts`、`storageHelper.ts`。
- 智能分块：1–15 MB 动态；>30 MB 强制分块；流式切割。
- 并发与限流：上传并发 2 + ≤5 次/秒；下载并发 4（带进度条）。
- 可靠性：动态超时、重试、ETA 优化。
- 分享与历史：`?url=...` 分享链接，本地历史与日志统一。

## 技术栈
- UI 与样式：Vue 3、CSS 变量、Toastify.js、Material Design 3。
- 网络：`fetch` + `AbortController`；Provider 驱动端点。
- 文件处理：Streams API + Blob 合并（浏览器内存优化）。
- 状态：Vue 响应式（`ref`、`computed`）+ `localStorage` 持久化。
- 构建：Vite 6 + PWA 插件，vendor 拆分。

## 快速开始
- 开发：`npm install`，`npm run dev`
- 构建：`npm run build`
- 预览：`npm run preview`

环境变量（`.env`/`.env.local`）：
```
VITE_UPLOAD_URL=https://api.pgaot.com/user/up_cat_file
VITE_REQUEST_RATE_LIMIT=5
VITE_CONCURRENT_LIMIT=2
VITE_MAX_CHUNK_MB=15
VITE_MIN_CHUNK_MB=1
VITE_FORCE_CHUNK_MB=30
VITE_BASE_DOWNLOAD_URL=https://static.codemao.cn/Chunkuposs/
VITE_FORM_UPLOAD_PATH=Chunkuposs
VITE_DOWNLOAD_CONCURRENT_LIMIT=4
```

Vercel 一键部署：
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/CJackHwang/Chunkuposs)

## 使用流程
- 选择文件 → 上传
- 监控进度（分块或单链接）
- 获取链接：分块格式 `[文件名]块1,块2,...` 或单链接 URL
- 下载：粘贴分块链接或标准 URL
- 分享：复制 `?url=...` 链接

## 配置与 Provider
- 核心常量：上传 URL、限速/并发、分块阈值、下载基础 URL、表单上传路径。
- Provider 层：
  - `src/providers/StorageProvider.ts`：`uploadSingle`、`uploadChunk`、`buildChunkManifest`、`getDownloadBase`
  - `src/providers/CodemaoProvider.ts`：默认编程猫实现

关键逻辑片段（MainContent.vue）：
```
// >30MB 强制分块
if (uploadMode.value === 'codemao' && fileSize > THIRTY_MB_THRESHOLD) {
  isLargeFileSupport.value = true;
  isChunkCheckboxDisabled.value = true;
}

// 分享链接生成
const currentUrl = new URL(window.location.href);
currentUrl.search = '';
currentUrl.searchParams.set('url', encodeURIComponent(sjurl.value));
const shareUrl = currentUrl.toString();
```

## 架构
```mermaid
flowchart TD
  subgraph 输入与模式
    A[文件输入]
    M[Provider：编程猫]
  end
  A --> P{文件大小}
  M --> P
  subgraph 编程猫 OSS
    P -->|>1MB| B{分块?}
    B -->|>30MB| BF[强制分块] --> D
    B -->|1MB<<=30MB 且分块| D[流式切割]
    B -->|<=1MB 或关闭| C[单次 FormData]
    D --> E[Uint8Array 缓冲]
    E --> F[并发2 + 5/s]
    F --> G[Provider 上传 + 重试]
    G --> H[URL 聚合]
    H --> I[清单: [filename]chunk1,...]
    C --> S[单链接] --> J[展示/存储]
    I --> J
  end
  J --> DL[下载]
  DL --> T{类型?}
  T -->|分块| MZ[并发获取+合并] --> SV[保存]
  T -->|标准| OP[新标签打开]
  J --> SH[分享] --> L[?url=...] --> CB[剪贴板]
  J --> LS[localStorage]
```

## 安全与许可
- 数据隐私：日志与历史仅存储在浏览器 `localStorage`。
- 服务策略：上传遵循上游存储服务规则。
- 许可协议：GPL‑3.0；禁止将非公开 API 用于商业用途。

## 组件与服务
- 组件：`MainContent.vue`、`DebugLogger.vue`、`UploadHistory.vue`、`ThemeToggle.vue`。
- 服务（TS）：`uploadService.ts`、`chunkUploadService.ts`、`downloadService.ts`、`toast.ts`。
- 工具：`helpers.js`、`storageHelper.ts`。
- Provider：`StorageProvider.ts`、`CodemaoProvider.ts`、`providers/index.ts`。

## 贡献
- 遵循 Vue 3 `<script setup>` 约定；使用 `ref`/`computed`。
- 以不同文件大小测试（含 >100MB）；模拟慢网与错误。
- 配置或功能变更时同步更新文档。

## 路线图
- 见 `ROADMAP.md`（中英文同步）。
