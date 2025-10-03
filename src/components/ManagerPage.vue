<template>
  <section class="manager">
    <header class="manager-header">
      <h3>文件管理</h3>
      <div class="actions">
        <button @click="startAdd()" :disabled="editId !== null || adding">新增</button>
        <button @click="$emit('back')">返回</button>
      </div>
    </header>

    <div class="table-container">
      <table class="upload-history-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>链接</th>
            <th>备注</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="adding">
            <td><input v-model="editTime" class="row-input text-field" /></td>
            <td class="link-cell"><input v-model="editLink" class="row-input text-field" /></td>
            <td class="note-cell"><input v-model="editNote" class="row-input text-field" /></td>
            <td class="ops-cell">
              <button @click="saveAdd" class="row-btn">保存</button>
              <button @click="cancel" class="row-btn">取消</button>
            </td>
          </tr>
          <tr v-for="entry in history" :key="entry.time">
            <td>
              <template v-if="editId===entry.time">
                <input v-model="editTime" class="row-input text-field" />
              </template>
              <template v-else>
                {{ entry.time }}
              </template>
            </td>
            <td class="link-cell">
              <template v-if="editId===entry.time">
                <input v-model="editLink" class="row-input text-field" />
              </template>
              <template v-else>
                {{ entry.link }}
              </template>
            </td>
            <td class="note-cell">
              <template v-if="editId===entry.time">
                <input v-model="editNote" class="row-input text-field" />
              </template>
              <template v-else>
                {{ entry.note || '' }}
              </template>
            </td>
            <td class="ops-cell">
              <template v-if="editId===entry.time">
                <button @click="save(entry)" class="row-btn">保存</button>
                <button @click="cancel()" class="row-btn">取消</button>
              </template>
              <template v-else>
                <button @click="startEdit(entry)" class="row-btn" :disabled="adding || editId !== null">编辑</button>
                <button @click="handleRemove(entry.link)" class="row-btn" :disabled="adding || editId !== null">删除</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { confirmDanger } from '@/utils/helpers'
type HistoryEntry = { time: string; link: string; note?: string };
defineProps<{ history: HistoryEntry[] }>();
const emit = defineEmits(['back', 'update', 'remove', 'add']);

const editId = ref<string|null>(null)
const editTime = ref('')
const editLink = ref('')
const editNote = ref('')
const adding = ref(false)

function startEdit(entry: HistoryEntry){
  if (adding.value || editId.value !== null) return
  editId.value = entry.time
  editTime.value = entry.time
  editLink.value = entry.link
  editNote.value = entry.note || ''
}

function cancel(){
  editId.value = null
  editTime.value = ''
  editLink.value = ''
  editNote.value = ''
  adding.value = false
}

function save(entry: HistoryEntry){
  // 如果有变化才保存
  const changed = (editTime.value !== entry.time) || (editLink.value !== entry.link) || (editNote.value !== (entry.note || ''))
  if (changed) {
    emit('update', { originalTime: entry.time, time: editTime.value, link: editLink.value, note: editNote.value })
  }
  cancel()
}

function startAdd(){
  if (editId.value !== null || adding.value) return
  adding.value = true
  editId.value = null
  const now = new Date().toLocaleString()
  editTime.value = now
  editLink.value = ''
  editNote.value = ''
}

function saveAdd(){
  const time = (editTime.value || '').trim()
  const link = (editLink.value || '').trim()
  const note = (editNote.value || '').trim()
  if (!time) { alert('时间不能为空'); return }
  const linkValid = /^(https?:\/\/)/i.test(link) || /^\[(.*?)\]((.+)?)$/.test(link)
  if (!linkValid) { alert('链接格式不合法，应为 https://... 或 [文件名]块1,块2,...'); return }
  emit('add', { time, link, note })
  // 触发上层新增并同步后，退出新增模式
  cancel()
}

function handleRemove(link: string){
  if (!confirmDanger('确定要删除该记录吗？此操作不可撤销')) return
  emit('remove', link)
}
</script>

<style scoped>
.manager-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-2, 12px);
}
.actions button { margin-left: 8px; }
.row-btn { margin: 8px; }
.row-input { margin: 8px; width: 100%; box-sizing: border-box; }
/* Manager page: allow flexible row height for easier editing */
.manager .upload-history-table td { height: auto; }
/* Ensure ops column shows buttons fully without ellipsis */
.upload-history-table td.ops-cell {
  white-space: normal;
  overflow: visible;
  text-overflow: initial;
}

/* Dim non-editing rows while adding/editing to indicate disabled state */
tbody tr:not(:has(.row-btn:disabled)) button:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
