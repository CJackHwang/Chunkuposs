<template>
    <button class="theme-toggle" @click="toggleTheme" :aria-label="isDarkMode ? '切换到浅色模式' : '切换到深色模式'">
        <img :src="iconPath" :alt="isDarkMode ? '浅色模式图标' : '深色模式图标'" class="theme-icon">
    </button>
</template>

<script>
export default {
    name: 'ThemeToggle',
    data() {
        return {
            isDarkMode: false
        }
    },
    computed: {
        iconPath() {
            return this.isDarkMode
                ? '/Sun.svg'  // 浅色模式图标
                : '/Moon.svg' // 深色模式图标
        }
    },
    mounted() {
        const savedTheme = localStorage.getItem('theme')
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        this.isDarkMode = savedTheme ? savedTheme === 'dark' : systemDark
        this.applyTheme()
    },
    methods: {
        toggleTheme() {
            this.isDarkMode = !this.isDarkMode
            this.applyTheme()
            localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light')
        },
        applyTheme() {
            document.documentElement.classList.toggle('dark-theme', this.isDarkMode)
        }
    }
}
</script>

<style scoped>
.theme-toggle {
    background: none;
    border: none;
    padding: 8px;
    color: var(--text-primary);
    transition: all 0.3s var(--ease-standard);
    border-radius: var(--border-radius-md);
    cursor: pointer;
    transition:
        background 0.3s var(--ease-standard),
        transform 0.15s var(--ease-standard) !important;
}

.theme-toggle:hover {
    background: rgba(255, 255, 255, 0.08);
}

.theme-toggle:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
}

.theme-icon {
    width: 24px;
    height: 24px;
    transition: 
        opacity 0.3s var(--ease-standard),
        transform 0.3s var(--ease-standard);
}

.theme-toggle:active .theme-icon {
    transform: scale(0.9);
}
</style>