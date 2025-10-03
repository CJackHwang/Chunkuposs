// Centralized, typed access to Vite envs used across the app
// Non-breaking: preserves defaults currently inlined around the codebase
type ViteEnv = { VITE_DAV_BASE_PATH?: string; VITE_DAV_TOKEN?: string };
function safeEnv(): ViteEnv {
  const m = import.meta as unknown as { env?: ViteEnv };
  return m.env ?? {};
}

export function getDavBasePath(): string {
  const base = safeEnv().VITE_DAV_BASE_PATH || '/dav';
  return base;
}

export function getDavToken(): string {
  return safeEnv().VITE_DAV_TOKEN || '';
}
