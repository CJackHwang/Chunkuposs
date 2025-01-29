import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

import { VitePWA } from 'vite-plugin-pwa';
const mode = 'production';
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      mode: 'development',
      base: '/',
      manifest: {
        name: 'FlowChunkFlex',
        short_name: 'FCF微云盘',
        theme_color: '#1A1C23',
        description: '流式分块上传工具，使用编程猫七牛云对象存储接口开发的微云盘',
        icons: [
          {
            src: '/app.png',
            sizes: '1024x1024',
            type: 'image/png',
          },
        ],
      },
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff2,ttf}'],
        runtimeCaching: [
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
        navigateFallback: 'index.html'
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})