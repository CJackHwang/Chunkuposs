<!-- src/components/DebugLogger.vue -->
<template>
    <div class="debug-module">
        <h3>操作日志</h3>
        <div class="debug-output">
            <pre>{{ debugOutput }}</pre>
        </div>
        <div class="debug-buttons">
            <button @click="handleClearLog">清除日志</button>
            <button @click="handleExportLog">导出日志</button>
        </div>
    </div>
</template>

<script setup>
const props = defineProps({
    debugOutput: {
        type: String,
        default: ''
    }
});

const emit = defineEmits(['clear-log', 'export-log']);

const handleClearLog = () => {
    emit('clear-log');
};

const handleExportLog = () => {
    emit('export-log');
};
</script>