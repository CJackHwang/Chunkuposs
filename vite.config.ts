import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa';

// Derived via process.env.NODE_ENV in PWA plugin; keep this unused var removed
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue({
      // 显式配置 Vue 3 编译器选项
      template: {
        compilerOptions: {
          // 确保使用 Vue 3 的模块系统
          whitespace: 'condense',
          compatConfig: { MODE: 3 }
        }
      }
    }),
    VitePWA({
      // Keep dev SW enabled but derive mode from Vite env
      mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
      base: '/',
      manifest: {
        name: 'Chunkuposs',
        short_name: 'Chunkuposs',
        theme_color: '#0F1514',
        description: '流式分块上传工具，使用编程猫七牛云对象存储接口开发的微云盘',
        icons: [
          {
            src: '/App.png',
            sizes: '1024x1024',
            type: 'image/png',
          },
          {
            src: '/App-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/App-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ],
        "display": "standalone",
        "orientation": "portrait"
      },
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff2,ttf}'],
        runtimeCaching: [
          // Ensure WebDAV API calls are never cached or intercepted by SW
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/dav'),
            handler: 'NetworkOnly',
            options: { }
          },
          // 配置自定义运行时缓存
          {
            urlPattern: ({ url }) =>
              url.origin === 'https://ik.imagekit.io',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'cdn-styles-fonts',
              expiration: {
                maxEntries: 30, // 最多缓存30个文件
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30天
              },
              cacheableResponse: { statuses: [200] }
            }
          },
          {
            urlPattern: /\.(?:js|css|html|json|ico|png|jpg|jpeg|svg|woff2|ttf)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-assets',
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] }
            }
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
        navigateFallbackAllowlist: [/^\/index.html/], // 只允许/index.html触发回退
        suppressWarnings: true // 隐藏警告
      },
    }),
  ],
  server: {
    // Proxy WebDAV PoC for same-origin during dev
    proxy: {
      '/dav': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  },
  optimizeDeps: {
    // 显式包含 Vue 3 依赖链
    include: [
      'vue',
      '@vue/runtime-core',
      '@vue/runtime-dom',
      '@vue/shared',
      '@vue/reactivity'
    ],
    // 排除可能引起冲突的库
    exclude: ['vue-demi', 'vue-hot-reload-api']
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
    rollupOptions: {
      output: {
        // 防止 chunk 循环引用
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        }
      }
    }
  }
})
