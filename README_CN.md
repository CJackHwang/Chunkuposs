# FlowChunkFlex - 流式分块上传工具 (v5.3+)

[![GitHub License](https://img.shields.io/badge/License-GPL%203.0-blue.svg?style=flat)](https://www.gnu.org/licenses/gpl-3.0.html)
[![Vue 3](https://img.shields.io/badge/Vue.js-3.5%2B-brightgreen?logo=vue.js)](https://vuejs.org/)
[![Vercel Deployment](https://img.shields.io/badge/Deploy%20on-Vercel-black?logo=vercel)](https://vercel.com)
**English Version**: [README.md](./README.md)

> 专为绕过编程猫大文件限制设计的分块上传工具，保障文件传输可靠性（v5.3+）

---

## 🚀 核心功能升级（v5.3+）

### 技术增强
- **全面迁移至 Material Design 3 (M3) 主题系统**：
  - 基于 CSS 自定义属性 (变量) 构建，支持动态切换。
  - 提供精细的亮色 (Light) 与暗色 (Dark) 主题模式。
- **智能分块策略**：
  - 动态分块计算（最小1MB/最大15MB）
  - 小文件自动禁用分块（≤1MB）
  - 缓冲区流式切割（Uint8Array优化）
- **增强型并发控制**：
  - 并行上传限制（最大2个并发请求）
  - 动态请求频率控制（每秒≤5次）
- **可靠性优化**：
  - 分块超时重传（动态超时：10s~300s，基于块大小计算）
  - 三级重试机制（指数退避策略：1s/2s/4s）
  - 实时并发计数器（`activeUploads`状态追踪）
- **本地持久化**：
  - 操作日志支持分页存储（最大1000条）
  - 上传历史自动去重（基于链接哈希）

### 交互改进
- **修复 Toast 通知动画**：通过优化 CSS 过渡规则，恢复了 Toastify.js 的原生滑入/淡入效果。
- **状态监控增强**：
  - 分块进度实时显示（已提交块数/总块数）
  - 预估完成时间计算（基于历史上传速度）
- **组件化重构**：
  - 独立调试日志模块（支持清除/导出）
  - 历史记录表格支持 M3 明暗主题样式
  - 主题切换动画优化（CSS 变量平滑过渡）

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
1. **文件选择**：拖放区域支持Hover状态反馈（最大30MB）
2. **模式切换**：智能分块开关（文件>1MB自动启用）
3. **上传监控**：
   - 实时分块进度（`上传中... (x/y 块完成)`）
   - 服务器响应耗时统计（调试日志可见）
4. **结果处理**：
   - 链接智能解析（兼容`[文件名]块1,块2,...`格式）
   - 浏览器流式合并下载（自动拼接CDN路径）

---

## ⚙️ 核心配置参数

### 网络层配置（MainContent.vue）
```javascript
const UPLOAD_URL = 'https://api.pgaot.com/user/up_cat_file'; // 上传端点
const REQUEST_RATE_LIMIT = 5;  // 每秒最大请求数
const CONCURRENT_LIMIT = 2;    // 并行上传数
const MAX_CHUNK_SIZE = 15 * 1024 * 1024; // 最大分块15MB
const MIN_CHUNK_SIZE = 1 * 1024 * 1024;  // 最小分块1MB
```

### 分块策略（MainContent.vue）
```javascript
// 动态超时计算（基于分块大小, 单位: ms, 范围: 10秒 - 5分钟）
const sizeMB = chunk.size / (1024 * 1024);
const calculatedTimeout = 10000 + sizeMB * 6000; // 10s 基础 + 6s 每 MB
const dynamicTimeout = Math.min(Math.max(calculatedTimeout, 10000), 300000);

// 缓冲区管理
let buffer = new Uint8Array(CHUNK_SIZE);
let bufferPos = 0; // 当前缓冲区写入位置
```

---

## 📊 系统架构（v5.3+）

```mermaid
graph TD
    A[文件输入] --> B{分块检测}
    B -->|单文件模式| C[FormData直接提交]
    B -->|分块模式| D[Streams API切割]
    D --> E[Uint8Array 缓冲区分块]
    E --> F[并发与速率控制队列]
    F --> G[三级重试机制 (含动态超时)]
    G --> H[CDN URL 聚合]
    H --> I[URL编码文件名 (encodeURIComponent)]
    I --> J[本地历史存储 (localStorage)]
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

## 🧩 组件说明（v5.3+）

| 组件                | 功能特性                                           |
|---------------------|---------------------------------------------------|
| `DebugLogger.vue`   | 实时日志显示（时间戳+分隔符），支持导出/清除       |
| `UploadHistory.vue` | 表格展示历史记录，支持 M3 主题，支持点击填充链接   |
| `MainContent.vue`   | 核心业务逻辑（文件处理、上传、下载、状态管理）     |
| `ThemeToggle.vue`   | M3 主题切换按钮（自动检测系统偏好，手动切换）      |

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