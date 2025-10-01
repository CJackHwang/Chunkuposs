// 存储提供者通用接口（为后续多渠道与 WebDAV 网关做准备）
// 仅定义接口与类型，不改动现有实现；目前未在组件中引用。

export type UploadResult = {
  url: string;
};

export type ChunkUploadOptions = {
  path: string;
  timeoutMs?: number;
};

export type ProviderCapabilities = {
  chunkUpload: boolean;
  singleUpload: boolean;
};

export interface StorageProvider {
  /** 提供者名称 */
  name: string;
  /** 能力声明 */
  capabilities: ProviderCapabilities;

  /** 单文件上传（≤1MB 或选择不分块） */
  uploadSingle(file: File, options: ChunkUploadOptions): Promise<UploadResult>;

  /** 分块上传单块 */
  uploadChunk(chunk: Blob, index: number, options: ChunkUploadOptions): Promise<UploadResult>;

  /** 生成分块清单链接（例如：[filename]chunk1,chunk2,...） */
  buildChunkManifest(filename: string, chunkUrls: string[]): string;
}

