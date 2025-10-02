<template>
  <section class="manager">
    <header class="manager-header">
      <h3>文件管理</h3>
      <div class="actions">
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
                <button @click="startEdit(entry)" class="row-btn">编辑</button>
                <button @click="$emit('remove', entry.link)" class="row-btn">删除</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
defineProps({ history: { type: Array, required: true } });
const emit = defineEmits(['back', 'update', 'remove']);

const editId = ref(null)
const editTime = ref('')
const editLink = ref('')
const editNote = ref('')

function startEdit(entry){
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
}

function save(entry){
  // 如果有变化才保存
  const changed = (editTime.value !== entry.time) || (editLink.value !== entry.link) || (editNote.value !== (entry.note || ''))
  if (changed) {
    emit('update', { originalTime: entry.time, time: editTime.value, link: editLink.value, note: editNote.value })
  }
  cancel()
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
</style>
