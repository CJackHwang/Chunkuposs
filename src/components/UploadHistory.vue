<!-- src/components/UploadHistory.vue -->
<template>
    <div class="upload-history">
        <h3>历史文件</h3>
        <div class="table-container">
            <table class="upload-history-table">
                <thead>
                    <tr>
                        <th>上传时间（由新到旧）</th>
                        <th>文件链接</th>
                        <th>备注</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="entry in history" :key="entry.time" class="history-row" @click="selectHistoryItem(entry.link)">
                        <td class="time-cell">{{ entry.time }}</td>
                        <td class="link-cell">{{ entry.link }}</td>
                        <td class="note-cell">{{ entry.note || '' }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="history-actions">
            <button @click="handleClear">清空</button>
            <button @click="handleExport" class="spaced-btn">导出</button>
            <button @click="openManager" class="spaced-btn">管理</button>
        </div>
    </div>
</template>

<script setup>
const props = defineProps({
    history: {
        type: Array,
        required: true
    }
});

// Add 'select-item' to the list of emitted events
const emit = defineEmits(['clear-history', 'export-history', 'select-item', 'open-manager']);

const handleClear = () => {
    emit('clear-history');
};

const handleExport = () => {
    emit('export-history');
};

// Function to handle row click and emit the selected link
function selectHistoryItem(link) { emit('select-item', link); }

function openManager(){ emit('open-manager') }
</script>
