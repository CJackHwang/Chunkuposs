# FlowChunkFlex - 双 OSS 分块上传工具 (v5.4+)

[![GitHub License](https://img.shields.io/badge/License-GPL%203.0-blue.svg?style=flat)](https://www.gnu.org/licenses/gpl-3.0.html)
[![Vue 3](https://img.shields.io/badge/Vue.js-3.5%2B-brightgreen?logo=vue.js)](https://vuejs.org/)
[![Vercel Deployment](https://img.shields.io/badge/Deploy%20on-Vercel-black?logo=vercel)](https://vercel.com)
**英文版本 (English Version)**: [README.md](./README.md)

> 一款支持编程猫和当贝双 OSS 的多功能分块上传工具，旨在绕过大文件限制并提升传输可靠性 (v5.4+)

---

## 🚀 核心功能升级（v5.4+）

### 技术增强与新特性
- **双 OSS 支持**: 可在 **编程猫 OSS** 和 **当贝 OSS** 之间自由选择上传目标。
- **当贝 OSS 集成**:
    - 通过 `DangBeiOSS.js` 服务，利用 `@aws-sdk/client-s3` 实现文件直接上传。
    - 支持上传过程中的进度追踪。
- **编程猫 OSS 增强**:
    - **智能分块策略**: 动态计算块大小 (最小1MB/最大15MB)，小文件 (≤1MB) 自动禁用分块，流式缓冲区切割。
    - **强制分块**: 对大于 30MB 的文件自动强制启用并锁定分块上传选项。
    - **高级并发与速率控制**: 并行限制 (2)，速率限制 (≤5次/秒)。
    - **可靠性优化**: 分块重传机制（动态超时10s-300s），指数退避策略 (1s/2s/4s)。
- **增强分享**: 可生成包含目标链接的分享 URL (`?url=...`)，方便接收者直接加载。
- **M3 主题系统**: 全面集成 Material Design 3，通过 CSS 变量实现动态亮/暗模式切换。
- **本地持久化**: 操作日志和上传历史记录存储于 `localStorage`。

### 交互改进
- **统一界面**: 在编程猫和当贝模式间无缝切换。
- **清晰状态监控**: 为两种 OSS 提供实时进度显示（编程猫显示块进度，当贝显示百分比），支持 ETA 计算。
- **历史记录整合**: 可从历史记录中选择过去的链接（编程猫或当贝）来填充下载输入框。
- **Toast 通知**: 对操作、错误及强制设定（如 >30MB 强制分块）提供清晰反馈。
- **组件化结构**: 重构了 `DebugLogger`, `UploadHistory`, `ThemeToggle` 等组件，提升代码清晰度。

---

## 🛠️ 技术栈升级

| 模块                | 实现细节                                                                 |
|---------------------|--------------------------------------------------------------------------|
| **UI & 样式**       | Material Design 3 (M3) 规范, CSS 自定义属性 (变量), Toastify.js         |
| **网络层**          | `AbortController` 信号中断 + 动态超时策略（基于分块大小）               |
| **文件处理**        | Streams API + Blob分段合并（浏览器内存优化）                            |
| **状态管理**        | Vue响应式系统 (`ref`, `computed`) + localStorage持久化（自动JSON序列化） |
| **错误处理**        | 三级错误捕获（网络层/业务层/用户层）                                    |
| **构建优化**        | Vite (假设) + 智能分包策略（vendor包自动分离）                           |

---

## 🖥️ 快速使用指南

### 部署方式
```bash
# 本地开发（热重载支持）
npm install
npm run dev

# 生产构建（PWA支持）
npm run build
```

### Vercel 一键部署
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/CJackHwang/FlowChunkFlex)

### 工作流程
1. **选择模式**: 选择 "当贝OSS" 或 "编程猫OSS"。
2. **选择文件**: 拖放或点击选择文件。
    - *编程猫模式*: 分块开关自动管理 (>1MB 启用, >30MB 强制启用并锁定)。
3. **上传**: 点击 "上传文件"。
4. **监控**: 观察实时状态更新和进度。
5. **获取链接**: 成功后，生成可分享的链接（编程猫分块格式或当贝直链）。
6. **下载 (可选)**: 粘贴链接 (编程猫或标准 URL) 并点击 "下载文件"。
7. **分享 (可选)**: 点击 "分享文件" 复制包含当前链接的 URL，便于分享。

---

## ⚙️ 核心配置与逻辑

### 编程猫网络配置 (MainContent.vue)
```javascript
const UPLOAD_URL = 'https://api.pgaot.com/user/up_cat_file'; // 编程猫上传端点
const REQUEST_RATE_LIMIT = 5;  // 每秒最大请求数
const CONCURRENT_LIMIT = 2;    // 并行分块数
const MAX_CHUNK_SIZE = 15 * 1024 * 1024; // 最大分块 15MB
const MIN_CHUNK_SIZE = 1 * 1024 * 1024;  // 最小分块 1MB (小于此值则单文件上传)
const THIRTY_MB_THRESHOLD = 30 * 1024 * 1024; // 文件大于此阈值强制分块
```

### 当贝网络配置 (services/DangBeiOSS.js)
- 使用 `@aws-sdk/client-s3` 进行通信。
- 凭证信息 (区域, Bucket, Key ID/Secret) 应在服务内部或环境变量中配置。*(注意: 实际凭证处理方式可能因部署环境而异)*

### 关键逻辑片段 (MainContent.vue)
```javascript
// 大于 30MB 强制分块 (位于 updateFileInfo 及 watch uploadMode 中)
if (uploadMode.value === 'codemao' && fileSize > THIRTY_MB_THRESHOLD) {
    isLargeFileSupport.value = true; // 强制启用
    isChunkCheckboxDisabled.value = true; // 禁用复选框
}

// 生成分享链接 (位于 handleShare 中)
const currentUrl = new URL(window.location.href);
currentUrl.search = ''; // 清除现有参数
currentUrl.searchParams.set('url', encodeURIComponent(sjurl.value));
const shareUrl = currentUrl.toString();
helpers.copyToClipboard(shareUrl, ...);
```

---

## 📊 系统架构（v5.4+）

```mermaid
flowchart TD
    subgraph "输入与模式选择"
        A[文件输入]
        M[模式选择: 编程猫/当贝]
    end

    A --> P{文件大小检查}
    M --> P

    subgraph "编程猫 OSS 路径"
        P -->|编程猫 & 大于1MB| B{分块检测}
        B -->|> 30MB| B_Force[强制分块开启] --> D
        B -->|1MB < 大小 <= 30MB & 分块开启| D[Streams API 切割]
        B -->|大小 <= 1MB 或 分块关闭| C[单文件 FormData 提交]

        D --> E[Uint8Array 缓冲区分块]
        E --> F[并发(2) & 速率(5/s)控制队列]
        F --> G[分块上传含重试与动态超时]
        G --> H[URL 聚合]
        H --> I[格式化链接: [文件名]块1,...]
        C --> I_Single[获取单文件 URL] --> J
        I --> J[显示/存储链接]
    end

    subgraph "当贝 OSS 路径"
        P -->|当贝| K[调用 DangBeiOSS 服务]
        K --> L[S3 客户端上传含进度]
        L --> J_DB[显示/存储直链] --> J
    end

    subgraph "下载与分享"
        J --> DL_Input[输入框粘贴链接]
        DL_Input --> DL_Check{链接类型?}
        DL_Check -->|编程猫链接| Merge[获取全部分块并合并] --> Save[触发浏览器下载]
        DL_Check -->|标准 URL| Open[window.open(url)]
        J --> Share[分享按钮] --> ShareLink[生成 ?url=... 链接] --> Clipboard[复制到剪贴板]
    end

    J --> Store[存储到 localStorage]

```

---

## 🔒 合规与安全

1. **数据隐私**：
   - 所有操作记录仅存储于浏览器 `localStorage`
   - 无第三方跟踪或分析 SDK 嵌入（纯前端实现）
2. **内容审查**：
   - 文件上传结果遵循编程猫 CDN 的内容审查策略
   - 潜在的违法内容屏蔽由服务器端处理
3. **许可协议**：
   - 项目代码基于 GPL-3.0 开源协议
   - 禁止将此工具及其使用的编程猫非公开 API 用于商业闭源项目

---

## 🧩 组件说明（v5.4+）

| 组件/服务             | 功能特性                                                                    |
|-----------------------|-----------------------------------------------------------------------------|
| `MainContent.vue`     | 核心逻辑: 模式切换, 文件处理, 上传/下载流程编排。                           |
| `DangBeiOSS.js` (服务) | 处理当贝 S3 上传, 进度报告。                                                |
| `DebugLogger.vue`     | 实时日志显示 (带时间戳), 导出/清除功能。                                    |
| `UploadHistory.vue`   | 显示历史记录表格 (M3 主题), 支持点击链接填充输入框。                        |
| `ThemeToggle.vue`     | M3 主题切换按钮 (检测系统偏好, 手动覆盖)。                                  |
| `toast.js` (服务)     | 通过 Toastify.js 提供用户反馈通知。                                         |
| `helpers.js` (工具)   | 实用函数 (剪贴板复制, 文件下载触发, 重置页面)。                             |
| `storageHelper.js` (工具)| 管理 `localStorage` 中的日志和历史记录。                                  |

---

## 🤝 贡献指南

1. **代码规范**：
   - 遵循 Vue3 `<script setup>` 语法约定
   - 响应式状态优先使用 `ref`/`computed`
   - 清晰的函数命名和适当的注释
2. **测试要求**：
   - 分块逻辑需通过不同大小文件（包括 >100MB）测试
   - 使用浏览器开发者工具模拟慢速网络和网络错误
3. **文档更新**：
   - 修改核心配置或添加新功能需同步更新 README
   - 新增组件需在“组件说明”部分添加条目

---

**开发者信息**
CJackHwang · [GitHub](https://github.com/CJackHwang) · [技术博客](http://www.cjack.cfd)

> 重要提示：本工具旨在技术研究和便利文件分享。上传任何文件前，请确保您拥有必要的权利或授权，并遵守相关法律法规及平台规定。
