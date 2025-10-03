declare module 'toastify-js' {
  type Options = {
    text: string;
    duration?: number;
    gravity?: 'top' | 'bottom';
    position?: 'left' | 'center' | 'right';
    className?: string;
    escapeMarkup?: boolean;
  };
  export default function Toastify(opts: Options): { showToast(): void };
}

// Re-export actual modules to satisfy TS plugin with alias `@/...`
declare module '@/services/toast' {
  export { showToast } from '../services/toast';
}

declare module '@/utils/storageHelper' {
  export * from '../utils/storageHelper';
}

declare module '@/services/uploadService' {
  export * from '../services/uploadService';
}

declare module '@/services/downloadService' {
  export * from '../services/downloadService';
}

declare module '@/services/chunkUploadService' {
  export * from '../services/chunkUploadService';
}

// For constants, rely on env.d.ts typed declaration to avoid JS re-export issues

// Explicit ambient module declarations to satisfy TS plugin for alias imports
declare module '@/utils/storageHelper' {
  export const STORAGE_KEYS: { UPLOAD_LOG: string; UPLOAD_HISTORY: string };
  export type VueRef<T> = { value: T };
  export type HistoryEntry = { time: string; link: string; note?: string };
  export function addDebugOutput(message: string, debugOutputRef: VueRef<string>): void;
  export function saveUploadHistory(sjurl: string, uploadHistoryRef: VueRef<HistoryEntry[]>): void;
  export function loadUploadHistory(uploadHistoryRef: VueRef<HistoryEntry[]>): void;
  export function clearLog(debugOutputRef: VueRef<string>): void;
  export function clearHistory(uploadHistoryRef: VueRef<HistoryEntry[]>): void;
  export function updateLatestHistoryNote(note: string, uploadHistoryRef: VueRef<HistoryEntry[]>): void;
  export function removeHistoryItem(link: string, uploadHistoryRef: VueRef<HistoryEntry[]>): void;
  export function addHistoryEntry(time: string, link: string, uploadHistoryRef: VueRef<HistoryEntry[]>, note?: string): void;
  export function updateHistoryEntry(originalTime: string, newTime: string, newLink: string, uploadHistoryRef: VueRef<HistoryEntry[]>, newNote?: string): void;
  export function addHistoryDirect(link: string, note?: string): void;
  export function removeHistoryDirect(link: string): void;
}

declare module '@/services/uploadService' {
  import type { Ref } from 'vue';
  import type { HistoryEntry, VueRef } from '@/utils/storageHelper';
  export function uploadSingleFile(
    file: File,
    sjurlRef: Ref<string>,
    statusRef: Ref<string>,
    uploadHistoryRef: VueRef<HistoryEntry[]>,
    debugOutputRef: Ref<string>
  ): Promise<void>;
}

declare module '@/services/downloadService' {
  import type { Ref } from 'vue';
  export function downloadFiles(args: {
    sjurlRef: Ref<string>;
    statusRef: Ref<string>;
    isUploadingRef: Ref<boolean>;
    debugOutputRef: Ref<string>;
    downloadProgressRef: Ref<number>;
  }): Promise<void>;
}

declare module '@/services/chunkUploadService' {
  import type { Ref } from 'vue';
  import type { HistoryEntry, VueRef } from '@/utils/storageHelper';
  export function uploadChunks(args: {
    file: File;
    CHUNK_SIZE: number;
    totalChunks: number;
    debugOutputRef: Ref<string>;
    statusRef: Ref<string>;
    sjurlRef: Ref<string>;
    uploadHistoryRef: VueRef<HistoryEntry[]>;
    updateEstimatedCompletionTimeAfterUpload: (start: number, urls: (string|null)[], total: number) => void;
    resetEstimatedCompletionTime: () => void;
  }): Promise<void>;
}

declare module '@/utils/helpers' {
  export function copyToClipboard(text: string, successCallback?: () => void, errorCallback?: (err: unknown) => void): Promise<void>;
  export function resetAll(confirmationMessage?: string): void;
  export function downloadFile(filename: string, content: BlobPart | BlobPart[], mimeType?: string): boolean;
  export function confirmDanger(message?: string): boolean;
}

declare module '@/services/timeEstimationService' {
  export function useTimeEstimation(): {
    estimatedCompletionTime: import('vue').Ref<string>;
    updateEstimatedCompletionTimeAfterUpload: (startTime: number, urlsArray: (string | null)[], totalChunks: number) => void;
    resetEstimatedCompletionTime: () => void;
  };
}
