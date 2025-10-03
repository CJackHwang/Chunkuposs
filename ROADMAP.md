# Chunkuposs Roadmap & Progress

Goal: Build a pluggable, provider‑driven chunk upload and sharing app, evolving toward a deployable WebDAV gateway (manage links/manifests, do not store files directly).

中文 | English below

## 愿景与目标 (CN)
- 前端：纯浏览器应用，支持分块上传、分享、分块下载合并、历史与日志。
- Provider 适配层：抽象不同上游渠道，统一上传协议与清单格式。
- WebDAV 网关（规划）：将 DAV 操作映射到分块/清单管理，形成轻量网关。
- 合规与安全：不存储内容，遵守上游策略；强调开源与非商业研究用途。

## 架构原则 (CN)
- 组件瘦身：组件只做 UI/状态，逻辑在服务层。
- 模块：`services/*`、`providers/*`、`config/constants` + `.env`。
- 可插拔：服务层支持 Provider 注入与扩展。
- 可靠性：并发、限流、动态超时、重试、日志观测。

## 版本里程碑 (CN)
- v5.x：Vue3+Vite6；分块上传/分享/下载合并；历史与日志；下载并发限制；ETA 修复；移除 DangBei。
- v6.1.2（当前）：Provider 注入式服务层（默认 Codemao）；核心服务 TS 化；组件瘦身；文档同步；WebDAV PoC（PROPFIND/PUT/GET/HEAD）；Range/HEAD 修复；统一清单格式；外置预览容器。
- v7.0（PoC）：WebDAV 原型（Node+Koa/Express+SQLite）；映射 DAV 操作；鉴权与限流；前端 `/manager` 管理页。
- v7.x+：Provider Registry；断点续传；性能/兼容优化；模块测试。

## 当前进度 (CN)
- 常量集中与 `.env` 覆盖；下载并发限制（默认 4）。
- 服务层：上传/分块/下载/ETA 修复；Provider 全量接入；单链/分块清单统一格式。
- WebDAV PoC：实现 PROPFIND/PUT/GET/HEAD；GET 支持 Range；HEAD 预估 `Content-Length`；清单大小计算支持 `.chunk--1` 扩展名恢复。
- 管理器：外置 `DavPreview` 容器置于管理器下方，不受列表滚动影响；忽略 `server/*.db*` 防止提交本地数据库。
- 组件瘦身：MainContent 仅做状态与调用；下载进度条；历史/日志统一。

## 下一阶段 (CN)
1. WebDAV PoC：完善 DAV 映射与错误处理；鉴权与限流配置化。
2. 管理页：批量/重命名/移动交互完善；清单/单链元信息展示优化。
3. Provider 扩展：鉴权/签名与更多上游；Provider 选择与注册。
4. 测试与质量：分块/下载/ETA/限流模块测试；端到端预览/Range 测试；统一错误码与日志。
5. 文档：部署与使用完善；与 README/ROADMAP 同步更新。

## 风险与决策 (CN)
- Provider 可用性与合规；避免硬编码与不合规使用。
- 网关边界清晰；避免过度耦合与状态持久化。
- TS 化节奏渐进；优先核心服务与 Provider。
- 浏览器内存/并发策略与多端兼容测试。

---

## Vision & Goals (EN)
- Frontend: pure browser app with chunked upload, sharing, chunked download merge, history and logs.
- Provider layer: abstracts storage channels; unified upload protocol and manifest format.
- WebDAV gateway (future): map DAV ops to chunking/manifest; lightweight deployable gateway.
- Compliance & safety: do not store content; follow upstream policies; open‑source, non‑commercial.

## Architecture Principles (EN)
- Thin components: UI/state only; logic in services.
- Modules: `services/*`, `providers/*`, `config/constants` + `.env`.
- Pluggable: service layer supports provider injection/extension.
- Reliability: concurrency, rate‑limit, dynamic timeouts, retry, logs.

## Milestones (EN)
- v5.x: Vue3+Vite6; chunk upload/share/download merge; history/logs; download concurrency; ETA fix; remove DangBei.
- v6.0 (current): provider‑injected services (default Codemao); TS services; component slimming; docs sync.
- v7.0 (PoC): WebDAV prototype (Node+Koa/Express+SQLite); map DAV ops; auth/rate‑limit; `/manager` frontend.
- v7.x+: provider registry; resume; perf/compat optimizations; module tests.

## Current Progress (EN)
- Centralized constants and `.env` overrides; download concurrency (default 4).
- Services: upload/chunk/download/ETA fix; full provider integration; unified single/chunk manifest format.
- WebDAV PoC: PROPFIND/PUT/GET/HEAD implemented; GET supports Range; HEAD preflights `Content-Length`; manifest size calc supports `.chunk--1` extension recovery.
- Manager: external `DavPreview` container rendered below manager; ignore `server/*.db*` to avoid committing local DB.
- Components: MainContent handles UI/state and calls; download progress; unified history/logs.

## Next Phase (EN)
1. WebDAV PoC: improve DAV mapping/error handling; configurable auth/rate‑limit.
2. Manager page: refine bulk/rename/move interactions; show manifest/single metadata.
3. Provider expansion: auth/signature/more upstreams; selection/registry.
4. Tests & quality: module tests for chunk/download/ETA/rate‑limit; end‑to‑end preview/Range tests; unify error codes/logs.
5. Docs: deployment/usage; keep README/ROADMAP in sync.

### Link Format (Unified)
- Single: `[filename]ID.chunk--1` → replace `.chunk--1` with the filename extension; prepend `downloadBase`.
- Chunked: `[filename]ID0,ID1,...` → stream in order for non‑range; map ranges across chunks.

## Risks & Decisions (EN)
- Provider availability/compliance; avoid hard‑coded creds and misuse.
- Clear gateway scope; avoid tight coupling and state persistence.
- Gradual TS adoption; prioritize core services/providers.
- Browser memory/concurrency strategies; multi‑device compatibility tests.

---

## Why TypeScript
- Types clarify contracts between services/providers; catch errors earlier.
- Maintainability and refactoring safety with IDE support.
- Testability: explicit inputs/outputs; easier provider mocking.
- Gradual strategy: prioritize `services/*` and `providers/*`; components later.
