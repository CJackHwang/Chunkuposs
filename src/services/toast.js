import Toastify from 'toastify-js'

export function showToast(message) {
    Toastify({
        text: message,
        duration: 5000,
        gravity: "bottom",
        position: 'right',
        style: {
            background: "linear-gradient(to right, #FF4C4C, #FFB2B2)",
            borderRadius: "10px",
            padding: "20px",
            color: "#fff"
        }
    }).showToast();
}