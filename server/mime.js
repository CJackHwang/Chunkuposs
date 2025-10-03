const map = {
  'txt': 'text/plain; charset=utf-8',
  'json': 'application/json',
  'html': 'text/html; charset=utf-8',
  'css': 'text/css',
  'js': 'application/javascript',
  'mjs': 'application/javascript',
  'ts': 'application/typescript',
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'svg': 'image/svg+xml',
  'webp': 'image/webp',
  'mp4': 'video/mp4',
  'mov': 'video/quicktime',
  'webm': 'video/webm',
  'pdf': 'application/pdf',
  'zip': 'application/zip',
  '7z': 'application/x-7z-compressed',
  'rar': 'application/vnd.rar',
  'gz': 'application/gzip',
  'bz2': 'application/x-bzip2',
  // audio
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'm4a': 'audio/mp4',
  'aac': 'audio/aac',
  'ogg': 'audio/ogg',
  'opus': 'audio/ogg; codecs=opus',
  'flac': 'audio/flac',
}

export function contentTypeByName(name){
  const idx = name.lastIndexOf('.')
  if (idx === -1) return 'application/octet-stream'
  const ext = name.slice(idx+1).toLowerCase()
  return map[ext] || 'application/octet-stream'
}
