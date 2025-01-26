<!-- src/components/UploadHistory.vue -->
<!-- UploadHistory.vue -->
<template>
    <div class="upload-history">
        <h3>历史文件</h3>
        <div class="table-container">
            <table class="upload-history-table">
                <thead>
                    <tr>
                        <th>上传时间</th>
                        <th>文件链接</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="entry in history" :key="entry.time">
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

const emit = defineEmits(['clear-history', 'export-history']);

const handleClear = () => {
    emit('clear-history');
};

const handleExport = () => {
    emit('export-history');
};
</script>
