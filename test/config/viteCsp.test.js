import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import viteConfig from '../../vite.config.js'

const indexHtml = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')

test('proxies visit session starts from development and preview origins', () => {
  const config = viteConfig({ mode: 'development' })
  const route = '^/device/visit-sessions$'
  assert.equal(config.server.proxy[route]?.changeOrigin, true)
  assert.deepEqual(config.preview.proxy[route], config.server.proxy[route])
})

test('proxies category and item list queries from development and preview origins', () => {
  const config = viteConfig({ mode: 'development' })
  const findRoute = (proxy, path) => Object.keys(proxy).find((route) => new RegExp(route).test(path))

  for (const { proxy } of [config.server, config.preview]) {
    for (const path of ['/device/menu/categories', '/device/menu/categories/7/items']) {
      const route = findRoute(proxy, `${path}?visit_session_id=123`)
      assert.equal(proxy[route]?.changeOrigin, true)
    }
    assert.equal(findRoute(proxy, '/device/menu/categories/7/items/12'), undefined)
  }
})

test('allows signed menu images from HTTPS and the local API image host', () => {
  assert.ok(indexHtml.includes('img-src https: http://localhost:9002;'))
})

test('allows Vite-injected styles and hot updates on both loopback addresses', () => {
  const config = viteConfig({ mode: 'development' })
  const plugin = config.plugins.find(({ name }) => name === 'local-dev-csp')
  const server = { httpServer: { address: () => ({ port: 5174 }) } }
  const transform = () => plugin.transformIndexHtml(indexHtml, { server })

  const first = transform()
  const tag = first.tags.find(({ tag, attrs }) => tag === 'meta' && attrs.property === 'csp-nonce')
  const nonce = tag.attrs.nonce

  assert.match(nonce, /^[a-z\d+/]{22}==$/i)
  assert.ok(first.html.includes("style-src 'self' 'nonce-" + nonce + "';"))
  assert.ok(first.html.includes("connect-src 'self' ws://127.0.0.1:5174 ws://localhost:5174;"))
  assert.ok(first.html.includes("script-src 'self';"))
  assert.doesNotMatch(first.html, /unsafe-inline/)
  assert.notEqual(transform().tags[0].attrs.nonce, nonce)
})
