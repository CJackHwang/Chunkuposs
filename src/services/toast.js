// toast.js
import Toastify from 'toastify-js';

const M3_STYLES = {
    background: '#7F67BE',
    borderRadius: '16px',
    padding: '16px 24px',         // M3标准内边距
    color: '#FEF7FF',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.12)', // elevation2
    font: '400 14px/20px Roboto', // M3 body-medium样式
    margin: '0 16px 16px 0'       // 保持右下定位
};

export function showToast(message) {
    Toastify({
        text: message,
        duration: 5000,
        gravity: "bottom",
        position: 'right',
        style: M3_STYLES,
        className: 'm3-toast'
    }).showToast();
}