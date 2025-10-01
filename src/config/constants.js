// 集中配置常量（可通过 Vite 环境变量覆盖）
const MB = 1024 * 1024;

export const UPLOAD_URL = import.meta.env.VITE_UPLOAD_URL || 'https://api.pgaot.com/user/up_cat_file';

export const REQUEST_RATE_LIMIT = Number(import.meta.env.VITE_REQUEST_RATE_LIMIT) || 5; // 每秒最大请求数
export const CONCURRENT_LIMIT = Number(import.meta.env.VITE_CONCURRENT_LIMIT) || 2; // 并发分块数

export const MAX_CHUNK_SIZE = (Number(import.meta.env.VITE_MAX_CHUNK_MB) || 15) * MB; // 15MB
export const MIN_CHUNK_SIZE = (Number(import.meta.env.VITE_MIN_CHUNK_MB) || 1) * MB;  // 1MB
export const THIRTY_MB_THRESHOLD = (Number(import.meta.env.VITE_FORCE_CHUNK_MB) || 30) * MB; // 30MB

export const BASE_DOWNLOAD_URL = (import.meta.env.VITE_BASE_DOWNLOAD_URL || 'https://static.codemao.cn/Chunkuposs/');
export const FORM_UPLOAD_PATH = import.meta.env.VITE_FORM_UPLOAD_PATH || 'Chunkuposs';

