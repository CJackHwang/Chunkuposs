# ChunkUpOSS - 双OSS分块上传工具 (v5.4+)

[![GitHub License](https://img.shields.io/badge/License-GPL%203.0-blue.svg?style=flat)](https://www.gnu.org/licenses/gpl-3.0.html)
[![Vue 3](https://img.shields.io/badge/Vue.js-3.5%2B-brightgreen?logo=vue.js)](https://vuejs.org/)
[![Vercel Deployment](https://img.shields.io/badge/Deploy%20on-Vercel-black?logo=vercel)](https://vercel.com)
**中文版本 (Chinese Version)**: [README_CN.md](./README_CN.md)

> A versatile chunked upload tool supporting both CodeMao and DangBei OSS, designed to bypass large file limitations and enhance reliability (v5.4+)

---

## 🚀 Core Features (v5.4+)

### Technical Enhancements & New Features
- **Dual OSS Support**: Choose between **CodeMao OSS** and **DangBei OSS** for uploads.
- **DangBei OSS Integration**:
    - Direct file upload leveraging `@aws-sdk/client-s3` (via `DangBeiOSS.js` service).
    - Progress tracking during upload.
- **CodeMao OSS Enhancements**:
    - **Smart Chunking Strategy**: Dynamic calculation (1MB min / 15MB max), auto-disable for small files (≤1MB), buffer streaming segmentation.
    - **Mandatory Chunking**: Automatically enforces and locks chunked upload for files > 30MB.
    - **Advanced Concurrency & Rate Control**: Parallel limit (2), rate limit (≤5/sec).
    - **Reliability Optimization**: Chunk retry with dynamic timeout (10s-300s), exponential backoff (1s/2s/4s).
- **Enhanced Sharing**: Generate shareable links (`?url=...`) that pre-fill the download URL for recipients.
- **M3 Theming System**: Full Material Design 3 integration with dynamic Light/Dark modes via CSS variables.
- **Local Persistence**: Operation logs and upload history stored in `localStorage`.

### UX Improvements
- **Unified Interface**: Seamlessly switch between CodeMao and DangBei modes.
- **Clear Status Monitoring**: Real-time progress for both OSS types (chunk progress for CodeMao, percentage for DangBei), ETA calculation.
- **History Integration**: Select past links (CodeMao or DangBei) from history to pre-fill the download input.
- **Toast Notifications**: Clear feedback for actions, errors, and forced settings (e.g., >30MB chunking).
- **Component Structure**: Refactored components (`DebugLogger`, `UploadHistory`, `ThemeToggle`) for clarity.

---

## 🛠️ Tech Stack

| Module              | Implementation Details                                                                 |
|---------------------|----------------------------------------------------------------------------------------|
| **UI & Styling**    | Material Design 3 (M3), CSS Custom Properties (Variables), Toastify.js                |
| **Network Layer**   | `AbortController` + Dynamic timeout strategy (chunk size-based)                       |
| **File Handling**   | Streams API + Blob merging (browser memory optimized)                                 |
| **State Management**| Vue Reactivity System (`ref`, `computed`) + `localStorage` (auto JSON serialization) |
| **Error Handling**  | Three-layer error catching (network/business/user)                                    |
| **Build Optimization**| Vite (assumed) + Smart chunk splitting (vendor auto-separation)                       |

---

## 🖥️ Quick Start

### Deployment
```bash
# Local development (hot-reload)
npm install
npm run dev

# Production build (PWA support)
npm run build
```

### Vercel One-Click Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/CJackHwang/Chunkuposs)

### Workflow
1. **Select Mode**: Choose "当贝OSS" (DangBei) or "编程猫OSS" (CodeMao).
2. **Select File**: Drag & drop or click to select.
    - *CodeMao Mode*: Chunking toggle auto-managed (>1MB enabled, >30MB forced & locked).
3. **Upload**: Click "上传文件".
4. **Monitor**: Observe real-time status updates and progress.
5. **Get Link**: Upon success, the shareable link (CodeMao chunked format or DangBei direct URL) appears.
6. **Download (Optional)**: Paste a link (CodeMao or standard URL) and click "下载文件".
7. **Share (Optional)**: Click "分享文件" to copy a URL containing the current link for easy sharing.

---

## ⚙️ Core Configurations & Logic

### CodeMao Network (MainContent.vue)
```javascript
const UPLOAD_URL = 'https://api.pgaot.com/user/up_cat_file'; // Codemao upload endpoint
const REQUEST_RATE_LIMIT = 5;  // Max requests/sec
const CONCURRENT_LIMIT = 2;    // Parallel chunks
const MAX_CHUNK_SIZE = 15 * 1024 * 1024; // 15MB max chunk
const MIN_CHUNK_SIZE = 1 * 1024 * 1024;  // 1MB min chunk (below this, single upload)
const THIRTY_MB_THRESHOLD = 30 * 1024 * 1024; // Files > this force chunking
```

### DangBei Network (services/DangBeiOSS.js)
- Uses `@aws-sdk/client-s3` for communication.
- Credentials (region, bucket, keys) are expected to be configured within the service or environment. *(Note: Actual credential handling might vary based on deployment)*

### Key Logic Snippets (MainContent.vue)
```javascript
// Force chunking > 30MB (in updateFileInfo & watch uploadMode)
if (uploadMode.value === 'codemao' && fileSize > THIRTY_MB_THRESHOLD) {
    isLargeFileSupport.value = true; // Force enable
    isChunkCheckboxDisabled.value = true; // Disable checkbox
}

// Share Link Generation (in handleShare)
const currentUrl = new URL(window.location.href);
currentUrl.search = ''; // Clear existing params
currentUrl.searchParams.set('url', encodeURIComponent(sjurl.value));
const shareUrl = currentUrl.toString();
helpers.copyToClipboard(shareUrl, ...);
```

---

## 📊 System Architecture (v5.4+)

```mermaid
flowchart TD
    %% Input & Mode Selection
    subgraph "Input & Mode Selection"
        A[File Input]
        M[Mode Select: CodeMao / DangBei]
    end

    A --> P{File Size Check}
    M --> P

    %% CodeMao OSS Path
    subgraph "CodeMao OSS Path"
        P -->|CodeMao & Size > 1MB| B{Chunk Detection}
        B -->|> 30MB| B_Force[Force Chunking ON] --> D
        B -->|1MB < Size <= 30MB & Chunking ON| D[Streams API Segmentation]
        B -->|Size <= 1MB OR Chunking OFF| C[Single FormData Submit]

        D --> E[Uint8Array Buffer Chunking]
        E --> F["Concurrency x2 & 5/sec Rate Queue"]
        F --> G[Chunk Upload with Retry & Dynamic Timeout]
        G --> H[URL Aggregation]
        H --> I["Format Link: Filename_chunk1, ..."]
        C --> I_Single[Get Single File URL] --> J_CodeMao[Display/Store URL]
        I --> J_CodeMao
    end

    %% DangBei OSS Path
    subgraph "DangBei OSS Path"
        P -->|DangBei| K[Call DangBeiOSS Service]
        K --> L[S3 Upload with Progress Display]
        L --> J_DangBei[Display/Store Direct URL] --> J_Final[Unified Display/Store URL]
    end

    %% Merge CodeMao path into final display
    J_CodeMao --> J_Final

    %% Download & Share
    subgraph "Download & Share"
        J_Final --> DL_Input[Paste Link into Input Box]
        DL_Input --> DL_Check{Link Type?}
        DL_Check -->|CodeMao Link| Merge[Fetch All Chunks & Merge Blobs] --> Save[Trigger Browser Download]
        DL_Check -->|Standard URL| Open[Open in New Tab]
        J_Final --> Share[Share Button Clicked] --> ShareLink[Generate Shareable ?url=... Link] --> Clipboard[Copy to Clipboard]
    end

    J_Final --> Store[Store URL in localStorage]

```

---

## 🔒 Compliance & Security

1. **Data Privacy**:
   - All operation logs and history are stored solely in the browser's `localStorage`.
   - No third-party tracking or analytics SDKs are embedded (pure frontend implementation).
2. **Content Moderation**:
   - Uploaded file results are subject to CodeMao CDN's content moderation policies.
   - Potential blocking of illicit content is handled server-side by the CDN provider.
3. **Licensing**:
   - The project codebase is licensed under GPL-3.0.
   - Commercial use of this tool, especially leveraging CodeMao's non-public APIs, is prohibited.

---

## 🧩 Components (v5.4+)

| Component             | Features                                                                    |
|-----------------------|-----------------------------------------------------------------------------|
| `MainContent.vue`     | Core logic: Mode switching, file handling, upload/download orchestration.   |
| `DangBeiOSS.js` (Service) | Handles DangBei S3 uploads, progress reporting.                         |
| `DebugLogger.vue`     | Real-time log display (timestamped), export/clear functionality.            |
| `UploadHistory.vue`   | Displays history table (M3 themed), allows selecting links to fill input. |
| `ThemeToggle.vue`     | M3 theme switching button (system preference detection, manual override).   |
| `toast.js` (Service)  | Provides user feedback via Toastify.js notifications.                       |
| `helpers.js` (Utils)  | Utility functions (clipboard copy, file download trigger, reset).           |
| `storageHelper.js` (Utils)| Manages `localStorage` for logs and history.                            |

---

## 🤝 Contribution Guide

1. **Coding Standards**:
   - Adhere to Vue3 `<script setup>` syntax conventions.
   - Use `ref`/`computed` for reactive state management.
   - Employ clear function naming and appropriate comments.
2. **Testing Requirements**:
   - Test chunking logic with various file sizes (including >100MB).
   - Simulate slow network conditions and network errors using browser dev tools.
3. **Documentation**:
   - Update the README if core configurations are modified or new features are added.
   - Add new components to the "Components" section.

---

**Developer Info**
CJackHwang · [GitHub](https://github.com/CJackHwang) · [Tech Blog](http://www.cjack.cfd)

> Important Note: This tool is intended for technical research and convenient file sharing. Before uploading any file, ensure you have the necessary rights or authorization and comply with relevant laws, regulations, and platform policies.
