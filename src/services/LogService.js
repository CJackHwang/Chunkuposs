import { ref } from 'vue';

export const useLogService = () => {
  const debugOutput = ref('');

  const addDebugOutput = (message) => {
    // 处理添加日志的逻辑
  };

  const clearLog = () => {
    // 处理清除日志的逻辑
  };

  const exportLog = () => {
    // 处理导出日志的逻辑
  };

  return {
    addDebugOutput,
    clearLog,
    exportLog,
  };
};