// Minimal configuration for WebDAV PoC
export const PORT = Number(process.env.DAV_PORT || 8080);
export const BASE_PATH = process.env.DAV_BASE_PATH || "/dav"; // mount prefix
export const AUTH_TOKEN = process.env.DAV_TOKEN || ""; // optional bearer token
export const RATE_RPS = Number(process.env.DAV_RATE_RPS || 20); // requests per second per ip
export const DATA_DIR = new URL("./data/", import.meta.url);

