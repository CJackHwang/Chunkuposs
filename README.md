# Chunkuposs — Chunked Upload & Sharing (v6.x)

[![GitHub License](https://img.shields.io/badge/License-GPL%203.0-blue.svg?style=flat)](https://www.gnu.org/licenses/gpl-3.0.html)
[![Vue 3](https://img.shields.io/badge/Vue.js-3.5%2B-brightgreen?logo=vue.js)](https://vuejs.org/)
[![Vercel Deployment](https://img.shields.io/badge/Deploy%20on-Vercel-black?logo=vercel)](https://vercel.com)
English | 中文: [README_CN.md](README_CN.md)

Chunkuposs is a browser-based chunked uploader and sharer built on a Provider architecture (default: CodeMao). Core services are implemented in TypeScript. DangBei integration has been removed.

## Core Features
- Provider architecture: `StorageProvider` + `CodemaoProvider` default.
- TS service layer: `uploadService.ts`, `chunkUploadService.ts`, `downloadService.ts`, `toast.ts`, `storageHelper.ts`.
- Smart chunking: 1–15 MB dynamic; >30 MB forced chunking; streaming segmentation.
- Concurrency & rate limits: upload concurrency 2 and ≤5 req/s; download concurrency 4 with a progress bar.
- Reliability: dynamic timeouts, retries, ETA improvements.
- Sharing & history: `?url=...` share link, unified local history and logs.

## Tech Stack
- UI & styling: Vue 3, CSS variables, Toastify.js, Material Design 3 theme.
- Network: `fetch` + `AbortController`; provider-driven endpoints.
- File handling: Streams API + Blob merging (optimized for browser memory).
- State: Vue reactivity (`ref`, `computed`) + `localStorage` persistence.
- Build: Vite 6 + PWA plugin, vendor chunk splitting.

## Quick Start
- Dev: `npm install`, `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`

Environment variables (`.env`/`.env.local`):
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

Vercel one‑click deploy:
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/CJackHwang/Chunkuposs)

## Usage Workflow
- Select file → Upload
- Monitor progress (chunked or single link)
- Get link: chunked format `[filename]chunk1,chunk2,...` or single URL
- Download: paste chunked link or standard URL
- Share: copy `?url=...` link

## Config & Provider
- Core constants: upload URL, rate/conc limits, chunk thresholds, base download URL, form upload path.
- Provider layer:
  - `src/providers/StorageProvider.ts`: `uploadSingle`, `uploadChunk`, `buildChunkManifest`, `getDownloadBase`
  - `src/providers/CodemaoProvider.ts`: default CodeMao implementation

Key logic snippets (MainContent.vue):
```
// Force chunking > 30MB
if (uploadMode.value === 'codemao' && fileSize > THIRTY_MB_THRESHOLD) {
  isLargeFileSupport.value = true;
  isChunkCheckboxDisabled.value = true;
}

// Share link generation
const currentUrl = new URL(window.location.href);
currentUrl.search = '';
currentUrl.searchParams.set('url', encodeURIComponent(sjurl.value));
const shareUrl = currentUrl.toString();
```

## Architecture
```mermaid
flowchart TD
  subgraph "Input & Mode"
    A[File Input]
    M[Provider: CodeMao]
  end
  A --> P{File Size}
  M --> P
  subgraph "CodeMao OSS"
    P -->|>1MB| B{Chunk?}
    B -->|>30MB| BF[Force Chunk] --> D
    B -->|1MB<<=30MB & Chunk ON| D[Streams Segmentation]
    B -->|<=1MB or OFF| C[Single FormData]
    D --> E[Uint8Array Buffer]
    E --> F[Concurrency x2 + 5/s]
    F --> G[Provider Upload + Retry]
    G --> H[URL Aggregate]
    H --> I[Manifest: [filename]chunk1,...]
    C --> S[Single URL] --> J[Display/Store]
    I --> J
  end
  J --> DL[Download]
  DL --> T{Type?}
  T -->|Chunked| MZ[Fetch all + Merge] --> SV[Save]
  T -->|Standard| OP[Open in new tab]
  J --> SH[Share] --> L[?url=...] --> CB[Clipboard]
  J --> LS[localStorage]
```

## Security & License
- Data privacy: logs and history are stored only in browser `localStorage`.
- Provider policies: uploads follow upstream provider rules.
- License: GPL‑3.0; commercial use with non‑public APIs is prohibited.

## Components & Services
- Components: `MainContent.vue`, `DebugLogger.vue`, `UploadHistory.vue`, `ThemeToggle.vue`.
- Services (TS): `uploadService.ts`, `chunkUploadService.ts`, `downloadService.ts`, `toast.ts`.
- Utils: `helpers.js`, `storageHelper.ts`.
- Providers: `StorageProvider.ts`, `CodemaoProvider.ts`, `providers/index.ts`.

## Contribution
- Follow Vue 3 `<script setup>` conventions; use `ref`/`computed`.
- Test with various sizes (incl. >100MB); simulate slow networks.
- Keep docs updated when configs/features change.

## Roadmap
- See `ROADMAP.md` for bilingual roadmap and progress.

**Developer Info**
CJackHwang · [GitHub](https://github.com/CJackHwang) · [Tech Blog](http://www.cjack.cfd)

> Important Note: This tool is intended for technical research and convenient file sharing. Before uploading any file, ensure you have the necessary rights or authorization and comply with relevant laws, regulations, and platform policies.
