<!-- src/components/DebugLogger.vue -->
<template>
    <div class="debug-module">
        <h3>操作日志</h3>
        <!-- Add ref="logContainer" -->
        <div class="debug-output" ref="logContainer">
            <pre>{{ debugOutput }}</pre>
        </div>
        <div class="debug-buttons">
            <button @click="handleClearLog">清空</button>
            <button @click="handleExportLog">导出</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

const props = defineProps({
    debugOutput: {
        type: String,
        default: ''
    }
});

const emit = defineEmits(['clear-log', 'export-log']);
const logContainer = ref<HTMLDivElement | null>(null); // Ref for the scrollable container

// Watch for changes in debugOutput and scroll down
watch(() => props.debugOutput, async () => {
    await nextTick(); // Wait for DOM update
    if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
});

const handleClearLog = () => {
    emit('clear-log');
};

const handleExportLog = () => {
    emit('export-log');
};
</script>
