<template>
  <section class="ui-card dav-container">
    <header class="dav-header">
      <h3>WebDAV 管理器</h3>
      <div class="dav-actions button-group">
        <button class="ui-btn" @click="refresh">刷新</button>
        <button class="ui-btn" @click="goParent" :disabled="currentPath==='/'">上一级</button>
        <label>
          路径：
          <input class="ui-input" v-model="currentPath" @keyup.enter="refresh" placeholder="/" />
        </label>
      </div>
    </header>
    <div class="dav-toolbar button-group">
      <button class="ui-btn" @click="mkcolPrompt">新建目录</button>
      <button class="ui-btn" :disabled="selectedSet.size===0" @click="openMoveDialog">移动到…</button>
      <button class="ui-btn" @click="triggerUpload">上传文件</button>
      <button class="ui-btn ui-btn--danger" :disabled="selectedSet.size===0" @click="removeBatch">删除</button>
      <input ref="fileInput" type="file" style="display:none" @change="onUpload" />
      <div v-if="isUploading" style="display:flex;align-items:center;gap:8px;">
        <progress :value="uploadProgress" max="100"></progress>
        <span>{{ uploadProgress }}%</span>
      </div>
    </div>
    <div class="dav-content">
      <DavList :items="items" :selected="selectedItem" :selected-set="selectedSet" @select="select" @open="open" @toggle="toggle" />
    </div>

    <!-- 调试面板隐藏：如需调试可取消注释 -->
    <!--
    <details class="dav-debug" style="margin-top:12px;">
      <summary>调试：PROPFIND 原始响应（{{ lastCount }} 项）</summary>
      <pre style="max-height:30vh;overflow:auto;white-space:pre-wrap;word-break:break-all;">{{ lastXml }}</pre>
      <small>如果为空，说明解析失败或服务端未返回 &lt;multistatus&gt;。</small>
    </details>
    -->

    <!-- 目录选择对话框 -->
    <div v-if="showMove" class="ui-modal">
      <div class="ui-modal__card">
        <h4>选择目标目录</h4>
        <div class="dir-list">
          <button class="dir-item" v-for="d in dirList" :key="d" @click="targetDir=d" :class="{ active: targetDir===d }">{{ d }}</button>
        </div>
        <div class="ui-modal__actions">
          <button class="ui-btn" @click="confirmMove" :disabled="!targetDir">确定</button>
          <button class="ui-btn" @click="closeMove">取消</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { showToast } from '../services/toast'
import { addHistoryDirect, removeHistoryDirect } from '../utils/storageHelper'
import { getDavBasePath, getDavToken } from '@/utils/env'
// Remove unused types
import DavList from './DavList.vue'

type DavItem = { href: string; displayname: string; type: string; size: string; mtime: string; isCollection: boolean }

const BASE: string = getDavBasePath()
const DAV_TOKEN: string = getDavToken()
const items = ref<DavItem[]>([])
const selectedItem = ref<DavItem | undefined>(undefined)
const selectedSet = ref<Set<string>>(new Set<string>())
const showMove = ref<boolean>(false)
const dirList = ref<string[]>([])
const targetDir = ref<string>('')
const fileInput = ref<HTMLInputElement|null>(null)
const currentPath = ref<string>('/')
const isUploading = ref(false)
const uploadProgress = ref(0)

function goParent(){ currentPath.value = parentPath(currentPath.value); refresh() }
function select(i: DavItem){
  selectedItem.value = i
  try { window.dispatchEvent(new CustomEvent('fcf:dav-selected', { detail: i })) } catch {}
}
function toggle(i: DavItem){
  const set = selectedSet.value
  if (set.has(i.href)) set.delete(i.href); else set.add(i.href)
}

function openMoveDialog(){
  showMove.value = true
  targetDir.value = ''
  // 聚合现有目录：从根开始 BFS，限制最大深度 3
  gatherDirs('/').then(list => { dirList.value = list })
}
function closeMove(){ showMove.value = false }
async function confirmMove(){
  if (!targetDir.value) return
  const base = targetDir.value.endsWith('/') ? targetDir.value : (targetDir.value + '/')
  for (const href of Array.from(selectedSet.value)){
    const name = decodeURIComponent(href.split('/').pop() || '')
    const dest = BASE + base + encodeURIComponent(name)
  const headers: HeadersInit = { 'Destination': dest, ...(DAV_TOKEN ? { Authorization: `Bearer ${DAV_TOKEN}` } : {}) }
  const r = await fetch(href, { method: 'MOVE', headers })
    if (r.status !== 201) { alert('移动失败: ' + r.status); break }
  }
  selectedSet.value.clear()
  showMove.value = false
  refresh()
}
function toPath(p: string){
  if (!p.startsWith('/')) p = '/' + p
  // collapse duplicate slashes and ensure leading slash only
  p = p.replace(/\/+/, '/')
  return p
}

const lastXml = ref<string>('')
const lastCount = ref<number>(0)

async function refresh(){
  const p = toPath(currentPath.value)
  const url = BASE + p
  const headers: HeadersInit = { Depth: '1', ...(DAV_TOKEN ? { Authorization: `Bearer ${DAV_TOKEN}` } : {}) }
  const res = await fetch(url, { method: 'PROPFIND', headers })
  if (res.status !== 207) { console.warn('PROPFIND 非 207 状态:', res.status); alert('PROPFIND 失败: ' + res.status); return }
  const text = await res.text()
  try {
    lastXml.value = text
    const parsed = parseMultistatus(text, p)
    items.value = parsed
    lastCount.value = parsed.length
    console.debug('PROPFIND 项目数:', parsed.length)
    // 解析后清理已不存在的选中项
    const set = selectedSet.value
    for (const href of Array.from(set)) { if (!parsed.find((x: DavItem) => x.href === href)) set.delete(href) }
  } catch (e) {
    console.error('解析 PROPFIND 响应失败:', e)
    alert('目录解析失败，请检查后端响应')
  }
}

function parseMultistatus(xmlText: string, basePath: string): DavItem[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('XML 解析错误')
  // 通用匹配：所有元素中过滤 tagName 以 :response 结尾或等于 response
  const all = Array.from(doc.getElementsByTagName('*'))
  const responses = all.filter(el => /(^|:)response$/i.test(el.tagName))
  const list: DavItem[] = []
  for (const r of responses){
    const find = (n: string) => (r.getElementsByTagName(n)[0] as Element | undefined) || (r.querySelector(n) as Element | null)
    const hrefNode = find('D:href') || find('href')
    const propNode = find('D:prop') || find('prop')
    const nameNode = propNode && ((propNode as Element).getElementsByTagName('D:displayname')[0] || (propNode as Element).getElementsByTagName('displayname')[0])
    const rtNode = propNode && ((propNode as Element).getElementsByTagName('D:resourcetype')[0] || (propNode as Element).getElementsByTagName('resourcetype')[0])
    const collNode = rtNode && ((rtNode as Element).getElementsByTagName('D:collection')[0] || (rtNode as Element).getElementsByTagName('collection')[0])
    const sizeNode = propNode && ((propNode as Element).getElementsByTagName('D:getcontentlength')[0] || (propNode as Element).getElementsByTagName('getcontentlength')[0])
    const mtimeNode = propNode && ((propNode as Element).getElementsByTagName('D:getlastmodified')[0] || (propNode as Element).getElementsByTagName('getlastmodified')[0])
    let href: string = (hrefNode && (hrefNode as Element).textContent) || ''
    // 兼容绝对 URL：提取 pathname
    try { if (href.startsWith('http')) href = new URL(href).pathname } catch {}
    const name = (nameNode && nameNode.textContent) || ''
    const isCollection = !!collNode
    const size = (sizeNode && sizeNode.textContent) || '0'
    const mtime = (mtimeNode && mtimeNode.textContent) || ''
    const type = isCollection ? '目录' : '文件'
    const hrefNormalized = decodeURIComponent(href)
    const selfHref = BASE + basePath
    if (hrefNormalized === selfHref || hrefNormalized === selfHref + '/') continue
    list.push({ href: hrefNormalized, displayname: (name || hrefNormalized.split('/').pop() || ''), type, size, mtime, isCollection })
  }
  return list.sort((a,b)=> (a.isCollection===b.isCollection ? a.displayname.localeCompare(b.displayname) : (a.isCollection? -1:1)))
}

// 递归收集目录（最多 3 层），返回以 DAV 基础路径去前缀的相对路径（以 / 开头，以 / 结尾）
async function gatherDirs(start: string){
  const seen = new Set<string>()
  const dirs: string[] = []
  async function visit(p: string, depth: number){
    if (depth > 3) return
    const url = BASE + p
    const headers: Record<string, string> = { Depth: '1', ...(DAV_TOKEN ? { Authorization: `Bearer ${DAV_TOKEN}` } : {}) }
    const res = await fetch(url, { method: 'PROPFIND', headers })
    if (res.status !== 207) return
    const text = await res.text()
    const list = parseMultistatus(text, p)
    for (const it of list){
      if (it.isCollection){
        const rel = it.href.replace(BASE, '')
        if (!seen.has(rel)){
          seen.add(rel)
          dirs.push(rel)
          await visit(rel, depth+1)
        }
      }
    }
  }
  // 根目录必须包含
  seen.add('/')
  dirs.push('/');
  await visit(start, 0)
  // 去重排序
  return Array.from(new Set(dirs)).sort()
}

function parentPath(p: string){
  if (p === '/') return '/'
  const parts = p.split('/').filter(Boolean)
  parts.pop()
  if (parts.length === 0) return '/'
  return '/' + parts.join('/') + '/'
}

function open(item: DavItem){
  if (item.isCollection){
    // 进入目录
    const href = item.href.replace(BASE, '')
    currentPath.value = href
    refresh()
  } else {
    // 下载文件
    window.open(item.href, '_blank')
  }
}

// 预览已迁移到外部 DavPreview 组件

async function mkcolPrompt(){
  const name = prompt('新目录名称')
  if (!name) return
  const p = toPath(currentPath.value)
  const url = BASE + (p.endsWith('/')? p : p + '/') + encodeURIComponent(name) + '/'
  const res = await fetch(url, { method: 'MKCOL', headers: (DAV_TOKEN ? ({ Authorization: `Bearer ${DAV_TOKEN}` } as HeadersInit) : ({} as HeadersInit)) })
  if (res.status === 201) refresh(); else alert('MKCOL 失败: ' + res.status)
}

// 已移除未使用的重命名与单项删除方法（保留批量删除及移动功能）

async function removeBatch(){
  if (selectedSet.value.size === 0) return
  if (!confirm(`确认删除选中的 ${selectedSet.value.size} 项？`)) return
  for (const href of Array.from(selectedSet.value)) {
    const res = await fetch(href, { method: 'DELETE', headers: (DAV_TOKEN ? ({ Authorization: `Bearer ${DAV_TOKEN}` } as HeadersInit) : ({} as HeadersInit)) })
    if (res.status !== 200 && res.status !== 204) { alert('批量删除失败: ' + res.status); break }
    // 精准反向移除：读取服务端返回的 link（manifest/single）
    if (res.status === 200 && href.startsWith(BASE + '/myupload/')) {
      try {
        const data = await res.json()
        if (data?.link) removeHistoryDirect(data.link)
      } catch { /* ignore */ }
    } else if (href.startsWith(BASE + '/myupload/')) {
      const name = decodeURIComponent(href.split('/').pop() || '')
      removeHistoryByFilename(name)
    }
  }
  selectedSet.value.clear()
  refresh()
}

function removeHistoryByFilename(fileName: string) {
  try {
    const raw = localStorage.getItem('uploadHistory') || '[]'
    const history: Array<{ link?: string }> = JSON.parse(raw)
    if (!Array.isArray(history)) return
    const enc = encodeURIComponent(fileName)
    const next = history.filter((e) => {
      if (typeof e?.link !== 'string') return true
      // 清单格式以 [filename] 开头，匹配则移除
      if (e.link.startsWith(`[${enc}]`)) return false
      return true
    })
    if (next.length !== history.length) {
      localStorage.setItem('uploadHistory', JSON.stringify(next))
      window.dispatchEvent(new CustomEvent('fcf:history-updated'))
    }
  } catch { /* ignore */ }
}

async function onUpload(e: Event){
  const target = e.target as HTMLInputElement | null
  const file = target && target.files ? target.files[0] : undefined
  if (!file) return
  // 同名文件覆盖确认
  if (items.value.find((it: DavItem) => !it.isCollection && it.displayname === file.name)) {
    const ok = confirm('检测到同名文件，继续将覆盖现有文件。是否继续？')
    if (!ok) return
  }
  const p = toPath(currentPath.value)
  const url = BASE + (p.endsWith('/')? p : p + '/') + encodeURIComponent(file.name)
  isUploading.value = true
  uploadProgress.value = 0
  showToast(`开始上传：${file.name}`)
  const xhr = new XMLHttpRequest()
  xhr.open('PUT', url)
  if (DAV_TOKEN) xhr.setRequestHeader('Authorization', `Bearer ${DAV_TOKEN}`)
  xhr.upload.onprogress = (evt: ProgressEvent) => {
    if (evt.lengthComputable) {
      uploadProgress.value = Math.round((evt.loaded / evt.total) * 100)
    }
  }
  xhr.onreadystatechange = async () => {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      const status = xhr.status
      if (status === 201) {
        showToast('上传成功')
        let linkToRecord: string | undefined
        try {
          const resp = JSON.parse(xhr.responseText || '{}') as { manifest?: string; singleUrl?: string; name?: string; kind?: string }
          linkToRecord = resp.manifest || resp.singleUrl
        } catch { /* ignore */ }
        // 仅当在 /myupload 目录下且拿到清单/链接时写入首页历史
        if (currentPath.value.startsWith('/myupload') && linkToRecord) {
          addHistoryDirect(linkToRecord, '来源：管理器上传')
        }
        await refresh()
        // 高亮新上传的文件
        const uploaded = items.value.find(it => !it.isCollection && it.displayname === file.name)
        if (uploaded) selectedItem.value = uploaded
      } else {
        showToast(`上传失败：${status}`)
        alert('PUT 失败: ' + status)
      }
      isUploading.value = false
    }
  }
  xhr.onerror = () => { showToast('上传出错'); isUploading.value = false }
  xhr.send(file)
  const t = e.target as HTMLInputElement | null
  if (t) t.value = ''
}

function triggerUpload(){
  const el = fileInput.value as HTMLInputElement | null
  if (el) { el.value = ''; el.click(); }
}

// 监听 hash 导航：#/dav -> 管理器
function syncFromHash(){
  const h = (window.location.hash || '').slice(1)
  const m = h.match(/^dav(\/(.*))?$/)
  if (m){
    currentPath.value = '/' + (m[2] || '')
    refresh()
  }
}

onMounted(() => {
  syncFromHash()
  if (!items.value.length) refresh()
  window.addEventListener('hashchange', syncFromHash)
})

onUnmounted(() => {
  window.removeEventListener('hashchange', syncFromHash)
})
</script>

<style src="@/assets/webdav.css"></style>
