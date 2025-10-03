/// <reference types="vite/client" />
// Use ESM-style imports instead of triple-slash path refs for shims/vendor
import './src/types/shims.d.ts'
import './src/types/vendor.d.ts'

declare module '@/utils/env' {
  export function getDavBasePath(): string;
  export function getDavToken(): string;
}
