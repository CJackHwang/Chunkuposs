<template>
  <div class="dav-list-container">
    <table class="ui-table" v-if="items.length">
      <thead>
        <tr>
          <th style="width:36px;"></th>
          <th>名称</th>
          <th>类型</th>
          <th>大小</th>
          <th>修改时间</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.href" :class="{ selected: selected && selected.href===item.href }" @dblclick="$emit('open', item)">
          <td>
            <!-- 复用首页自定义复选框样式：chunk-toggle + toggle-input + custom-checkbox -->
            <label class="chunk-toggle" style="margin:0;">
              <input class="toggle-input" type="checkbox" :checked="isChecked(item)" @change="$emit('toggle', item)" />
              <span class="custom-checkbox"></span>
            </label>
          </td>
          <td @click="$emit('select', item)" class="name-cell">{{ item.displayname }}</td>
          <td>
            <span v-if="item.isCollection">目录</span>
            <span v-else>文件</span>
          </td>
          <td>
            <span v-if="item.isCollection">-</span>
            <span v-else>{{ formatSize(item.size) }}</span>
          </td>
          <td>{{ item.mtime }}</td>
        </tr>
      </tbody>
    </table>
    <div v-else class="dav-empty ui-card">当前目录为空或加载中</div>
  </div>
</template>

<script setup>
const props = defineProps({ items: { type: Array, default: () => [] }, selected: { type: Object }, selectedSet: { type: Object } })
defineEmits(['select','open','toggle'])

function isChecked(item){
  return props.selectedSet && props.selectedSet.has && props.selectedSet.has(item.href)
}

function formatSize(s){
  const n = Number(s)
  if (!isFinite(n) || n <= 0) return '0'
  if (n < 1024) return `${n} B`
  if (n < 1024*1024) return `${(n/1024).toFixed(1)} KB`
  if (n < 1024*1024*1024) return `${(n/1024/1024).toFixed(1)} MB`
  return `${(n/1024/1024/1024).toFixed(1)} GB`
}
</script>

<style scoped>
.dav-list-container { max-height: 60vh; overflow: auto; }
tr { cursor: default; }
tr:hover { background: var(--md-sys-color-surface-variant, #f5f7fb); }
.name-cell { cursor: pointer; }
</style>
