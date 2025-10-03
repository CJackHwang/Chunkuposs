// Shared DAV DTO types for front/back coordination

export type DavKind = 'single' | 'manifest' | 'unknown'

export interface DavUploadResponse {
  name: string
  size: number
  manifest?: string
  singleUrl?: string
  kind: DavKind
}

export interface DavDeleteResponse {
  name: string
  link?: string
  kind: DavKind
}

