<!-- src/components/UploadHistory.vue -->
<template>
    <div class="upload-history">
        <h3>历史文件</h3>
        <div class="table-container">
            <table class="upload-history-table">
                <thead>
                    <tr>
                        <th>上传时间</th>
                        <th>文件链接 (点击填入)</th> <!-- Indicate clickability -->
                    </tr>
                </thead>
                <tbody>
                    <!-- Add @click handler and a class for styling -->
                    <tr v-for="entry in history"
                        :key="entry.time"
                        @click="selectHistoryItem(entry.link)"
                        class="history-row">
                        <td>{{ entry.time }}</td>
                        <td class="link-cell">{{ entry.link }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="history-actions">
            <button @click="handleClear">清空记录</button>
            <button @click="handleExport">导出历史</button>
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
const emit = defineEmits(['clear-history', 'export-history', 'select-item']);

const handleClear = () => {
    emit('clear-history');
};

const handleExport = () => {
    emit('export-history');
};

// Function to handle row click and emit the selected link
function selectHistoryItem(link) {
    emit('select-item', link);
}
</script>