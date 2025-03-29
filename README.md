# FlowChunkFlex - Stream Chunked Upload Tool (v5.3+)

[![GitHub License](https://img.shields.io/badge/License-GPL%203.0-blue.svg?style=flat)](https://www.gnu.org/licenses/gpl-3.0.html)
[![Vue 3](https://img.shields.io/badge/Vue.js-3.5%2B-brightgreen?logo=vue.js)](https://vuejs.org/)
[![Vercel Deployment](https://img.shields.io/badge/Deploy%20on-Vercel-black?logo=vercel)](https://vercel.com)
**中文版本**: [README_CN.md](./README_CN.md)

> A chunked upload tool designed to bypass large file limitations on CodeMao, ensuring reliable file transfer (v5.3+)

---

## 🚀 Core Features (v5.3+)

### Technical Enhancements
- **Full Migration to Material Design 3 (M3) Theming System**:
    - Built upon CSS Custom Properties (Variables) for dynamic switching.
    - Provides refined Light and Dark theme modes.
- **Smart Chunking Strategy**:
  - Dynamic chunk calculation (1MB min / 15MB max)
  - Auto-disable chunking for small files (≤1MB)
  - Buffer streaming segmentation (Uint8Array optimized)
- **Advanced Concurrency Control**:
  - Parallel upload limit (2 concurrent requests max)
  - Dynamic request rate control (≤5 requests/sec)
- **Reliability Optimization**:
  - Chunk retry with dynamic timeout (10s~300s, calculated based on chunk size)
  - Three-level retry mechanism (exponential backoff: 1s/2s/4s)
  - Real-time concurrency counter (`activeUploads` tracking)
- **Local Persistence**:
  - Operation logs with pagination support (1000 entries max, though pagination UI isn't implemented)
  - Upload history deduplication (link hash-based)

### UX Improvements
- **Fixed Toast Notification Animations**: Restored native slide/fade effects from Toastify.js by resolving CSS transition conflicts.
- **Enhanced Status Monitoring**:
  - Real-time chunk progress (e.g., `Uploading... (x/y chunks complete)`)
  - ETA calculation (based on historical speeds)
- **Component Refactoring**:
  - Independent debug logger component (clear/export support)
  - History table styled according to M3 Light/Dark themes
  - Theme transition animations optimized (smooth CSS variable transitions)

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
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/CJackHwang/FlowChunkFlex)

### Workflow
1. **File Selection**: Drag & drop area with hover feedback (30MB max recommended, though larger might work)
2. **Mode Toggle**: Smart chunking toggle (auto-enabled for files >1MB)
3. **Upload Monitoring**:
   - Real-time chunk progress status
   - Server response time metrics (visible in debug logs)
4. **Result Handling**:
   - Smart URL parsing (supports `[filename]chunk1,chunk2,...` format)
   - Browser stream merging for download (auto CDN path assembly)

---

## ⚙️ Core Configurations

### Network Layer (MainContent.vue)
```javascript
const UPLOAD_URL = 'https://api.pgaot.com/user/up_cat_file'; // Upload endpoint
const REQUEST_RATE_LIMIT = 5;  // Max requests per second
const CONCURRENT_LIMIT = 2;    // Parallel upload threads
const MAX_CHUNK_SIZE = 15 * 1024 * 1024; // Max chunk size 15MB
const MIN_CHUNK_SIZE = 1 * 1024 * 1024;  // Min chunk size 1MB
```

### Chunking Strategy (MainContent.vue)
```javascript
// Dynamic timeout calculation (based on chunk size, in ms, range: 10s - 5min)
const sizeMB = chunk.size / (1024 * 1024);
const calculatedTimeout = 10000 + sizeMB * 6000; // 10s base + 6s per MB
const dynamicTimeout = Math.min(Math.max(calculatedTimeout, 10000), 300000);

// Buffer management
let buffer = new Uint8Array(CHUNK_SIZE);
let bufferPos = 0; // Current buffer write position
```

---

## 📊 System Architecture (v5.3+)

```mermaid
graph TD
    A[File Input] --> B{Chunk Detection}
    B -->|Single File Mode| C[FormData Direct Submit]
    B -->|Chunked Mode| D[Streams API Segmentation]
    D --> E[Uint8Array Buffer Chunking]
    E --> F[Concurrency & Rate Limit Queue]
    F --> G[Three-level Retry (w/ Dynamic Timeout)]
    G --> H[CDN URL Aggregation]
    H --> I[URL Encoded Filename (encodeURIComponent)]
    I --> J[Local History Storage (localStorage)]
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

## 🧩 Components (v5.3+)

| Component           | Features                                                                 |
|---------------------|--------------------------------------------------------------------------|
| `DebugLogger.vue`   | Real-time log display (timestamp + separators), supports export/clear.   |
| `UploadHistory.vue` | Displays history in a table, supports M3 themes, allows clicking to fill link. |
| `MainContent.vue`   | Core business logic (file handling, upload, download, state management). |
| `ThemeToggle.vue`   | M3 theme switching button (detects system preference, allows manual override). |

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