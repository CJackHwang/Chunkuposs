<template>
  <div id="app">
    <header>
      <!-- 将标题和版本号分组 -->
      <div class="header-main">
        <h2>Chunkuposs微云盘</h2>
        <!-- 版本号使用 span，并添加 class -->
        <span class="version-tag">Ver: 6.1.0</span>
      </div>
      <!-- 为描述添加 class -->
      <div class="description">
        <p>
          基于Vue3+Vite6；流式读取文件，分块并发提交至【编程猫七牛云对象存储】以解决大小限制；支持中断自动重传，默认单块最大15MB，并发上传数2。
        </p>
        <p>
          请注意：该项目接口来源于互联网，仅供学习开发测试，请勿滥用和进行任何商业行为，不当使用造成的所有后果自负，本项目开发及贡献人员不承担任何法律责任，如继续使用本工具则默认您知晓并已同意该条款。
        </p>
      </div>
    </header>

    <MainContent v-if="view==='home'"/>
    <ManagerPage v-else :history="uploadHistory" @back="goHome" @update="updateItem" @remove="removeItem" />

    <footer>
      <!-- 版权信息 -->
      <p class="copyright">
        © CJackHwang. 保留所有权利.
      </p>
      <!-- 项目链接 -->
      <p class="project-link">
        <a href="https://github.com/CJackHwang/Chunkuposs" target="_blank">项目仓库：Chunkuposs</a>
      </p>
      <!-- 徽章链接 -->
      <p class="badges">
        <a href="https://github.com/CJackHwang" aria-label="CJackHwang GitHub Profile" target="_blank"
          rel="noopener noreferrer">
          <img src="https://img.shields.io/badge/GitHub-CJackHwang-100000?style=flat&logo=github&logoColor=white"
            alt="GitHub Badge: CJackHwang"> <!-- 稍作修改的 alt 文本 -->
        </a>
        <a href="https://www.gnu.org/licenses/gpl-3.0.html" aria-label="GPL 3.0 License" target="_blank"
          rel="noopener noreferrer">
          <img src="https://img.shields.io/badge/License-GPL%203.0-blue.svg?style=flat" alt="GPL-3.0 License Badge">
        </a>
      </p>
    </footer>
  </div>
</template>

<style scoped>
/* 如果需要，可以在这里添加针对新 class 的特定样式 */
/* 例如，让版本号在标题旁边显示 */
.header-main {
  display: flex;
  align-items: baseline;
  /* 基线对齐 */
  gap: var(--spacing-2);
  /* 使用 CSS 变量添加间距 */
  flex-wrap: wrap;
  /* 允许换行 */
}

.version-tag {
  font-size: 0.8em;
  /* 让版本号小一点 */
  color: var(--md-sys-color-on-surface-variant);
  /* 使用次要文本颜色 */
  /* 如果主题切换，这里可能需要适配暗色模式 */
  /* 可以考虑使用 var(--text-secondary) 或类似的变量 */
}

.description {
  font-size: 0.9em;
  color: var(--md-sys-color-on-surface-variant);
  margin-top: var(--spacing-1);
  /* 调整与标题组的间距 */
}

/* 确保外部链接的安全性 */
a[target="_blank"] {
  position: relative;
  /* Needed if you add pseudo-elements */
}

/* Optional: Add rel="noopener noreferrer" automatically via CSS (less common, JS/template better) */
/* a[target="_blank"]:not([rel]) { */
/* This is a reminder, better to add rel in HTML */
/* } */
</style>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import MainContent from './components/MainContent.vue'
import ManagerPage from './components/ManagerPage.vue'
import { loadUploadHistory, removeHistoryItem } from '@/utils/storageHelper'
import { updateHistoryEntry } from '@/utils/storageHelper'

const view = ref('home')
const uploadHistory = ref([])
// Hold history-updated handler without TS assertions
let historyUpdatedHandler = null

function goHome(){ view.value = 'home' }
function goManager(){ view.value = 'manager' }
function fillLink(link){ goHome(); setTimeout(() => window.dispatchEvent(new CustomEvent('fcf:fill-link', { detail: { link } })), 0) }
function removeItem(link){ removeHistoryItem(link, uploadHistory) }
function updateItem(payload){
  // 简单格式校验：时间非空，链接为 http(s) 或符合分块格式；备注可选
  const timeValid = typeof payload.time === 'string' && payload.time.trim().length > 0
  const linkValid = /^(https?:\/\/)/i.test(payload.link) || /^\[(.*?)\]((.+)?)$/.test(payload.link)
  const noteValid = payload.note === undefined || typeof payload.note === 'string'
  if (!timeValid) { alert('时间不能为空'); return }
  if (!linkValid) { alert('链接格式不合法，应为 https://... 或 [文件名]块1,块2,...'); return }
  if (!noteValid) { alert('备注应为文本'); return }
  updateHistoryEntry(payload.originalTime, payload.time, payload.link, uploadHistory, payload.note)
}

function onOpenManager(){ view.value = 'manager' }
window.addEventListener('fcf:open-manager', onOpenManager)

onMounted(() => {
  loadUploadHistory(uploadHistory)
  // Listen for global history updates so ManagerPage stays in sync
  historyUpdatedHandler = () => loadUploadHistory(uploadHistory)
  window.addEventListener('fcf:history-updated', historyUpdatedHandler)
})
onUnmounted(() => {
  window.removeEventListener('fcf:open-manager', onOpenManager)
  if (historyUpdatedHandler) {
    window.removeEventListener('fcf:history-updated', historyUpdatedHandler)
    historyUpdatedHandler = null
  }
})
</script>
