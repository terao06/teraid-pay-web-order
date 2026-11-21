import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const localHost = '127.0.0.1'

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'local-dev-csp',
      apply: 'serve',
      transformIndexHtml(html, { server }) {
        const address = server?.httpServer?.address()
        if (!address || typeof address === 'string') return

        const connectSrc = 'connect-src ws://' + localHost + ':' + address.port + ';'
        return html.replace("default-src 'none';", "default-src 'none'; " + connectSrc)
      },
    },
  ],
  server: {
    host: localHost,
    cors: false,
  },
  preview: {
    host: localHost,
  },
  build: {
    assetsInlineLimit: 0,
  },
})
