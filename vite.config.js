import { randomBytes } from 'node:crypto'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import { DEVICE_TOKEN_PATH } from './src/features/device-auth/api/deviceTokenApi.js'
import { DEVICE_ACTIVATION_PATH } from './src/features/device-setup/api/deviceActivationApi.js'
import { MENU_CATEGORIES_PATH } from './src/features/menu-categories/api/menuCategoriesApi.js'
import { VISIT_SESSION_START_PATH } from './src/features/visit-session/api/visitSessionApi.js'

const localHost = '127.0.0.1'

export default defineConfig(({ mode }) => {
  const { TERAID_PAY_API_TARGET: target } = loadEnv(mode, process.cwd(), 'TERAID_PAY_')
  const proxy = Object.fromEntries([
    '^' + DEVICE_ACTIVATION_PATH + '$',
    '^' + DEVICE_TOKEN_PATH + '$',
    '^' + VISIT_SESSION_START_PATH + '$',
    '^' + MENU_CATEGORIES_PATH + '(?:\\?.*)?$',
    '^' + MENU_CATEGORIES_PATH + '/[^/?]+/items(?:\\?.*)?$',
  ].map((route) => [route, { target, changeOrigin: true }]))

  return {
    plugins: [
      vue(),
      {
        name: 'local-dev-csp',
        apply: 'serve',
        transformIndexHtml(html, { server }) {
          const address = server?.httpServer?.address()
          if (!address || typeof address === 'string') return

          const nonce = randomBytes(16).toString('base64')
          const connectSrc = `connect-src 'self' ws://${localHost}:${address.port} ws://localhost:${address.port};`
          const styleSrc = "style-src 'self' 'nonce-" + nonce + "';"

          return {
            html: html.replace("connect-src 'self';", connectSrc).replace("style-src 'self';", styleSrc),
            // Vite reads this nonce when attaching styles during development.
            tags: [{ tag: 'meta', attrs: { property: 'csp-nonce', nonce }, injectTo: 'head' }],
          }
        },
      },
    ],
    server: {
      host: localHost,
      cors: false,
      proxy,
    },
    preview: {
      host: localHost,
      proxy,
    },
    build: {
      assetsInlineLimit: 0,
    },
  }
})
