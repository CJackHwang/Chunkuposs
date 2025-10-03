<template>
  <section v-if="item && !item.isCollection" class="ui-card dav-preview">
    <strong>链接信息</strong>
    <div class="dav-preview__meta">
      <div>本地链接：<code>{{ item.href }}</code></div>
      <small>提示：此为 WebDAV 本地路径，双击或复制可直接加载/下载。</small>
    </div>
    <div class="dav-preview__content">
      <template v-if="isImage(item.displayname)">
        <img :src="item.href" alt="预览" class="dav-preview__image" />
      </template>
      <template v-else-if="isAudio(item.displayname)">
        <audio :src="item.href" controls class="dav-preview__media"></audio>
      </template>
      <template v-else-if="isVideo(item.displayname)">
        <video :src="item.href" controls class="dav-preview__media" style="max-height:50vh"></video>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
type DavItem = { href: string; displayname: string; isCollection: boolean };
const item = ref<DavItem | null>(null)

function extOf(name: string){
  const i = (name || '').lastIndexOf('.')
  return i >= 0 ? name.slice(i+1).toLowerCase() : ''
}
function isImage(name: string){ return ['png','jpg','jpeg','gif','svg','webp'].includes(extOf(name)) }
function isAudio(name: string){ return ['mp3','m4a','aac','wav','ogg','opus','flac'].includes(extOf(name)) }
function isVideo(name: string){ return ['mp4','mov','webm'].includes(extOf(name)) }

function onSelected(e: Event){ const ce = e as CustomEvent<DavItem>; item.value = ce.detail }
onMounted(() => window.addEventListener('fcf:dav-selected', onSelected as EventListener))
onUnmounted(() => window.removeEventListener('fcf:dav-selected', onSelected as EventListener))
</script>

<style scoped>
.dav-preview { margin-top: 12px; }
.dav-preview__meta { margin-top: 8px; }
.dav-preview__content { margin-top: 12px; }
.dav-preview__image { max-width: 100%; border-radius: 8px; border: 1px solid var(--outline-variant); }
.dav-preview__media { width: 100%; }
</style>
