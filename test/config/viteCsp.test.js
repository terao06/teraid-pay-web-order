import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import viteConfig from '../../vite.config.js'

const indexHtml = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')

test('enables face image upload only when explicitly requested on the development server', (t) => {
  const previous = process.env.VITE_FACE_PAYMENT_UPLOAD
  t.after(() => {
    if (previous === undefined) delete process.env.VITE_FACE_PAYMENT_UPLOAD
    else process.env.VITE_FACE_PAYMENT_UPLOAD = previous
  })

  const enabled = (command, isPreview = false) =>
    viteConfig({ mode: 'development', command, isPreview }).define.__FACE_PAYMENT_UPLOAD__
  process.env.VITE_FACE_PAYMENT_UPLOAD = 'false'
  assert.equal(enabled('serve'), false)
  process.env.VITE_FACE_PAYMENT_UPLOAD = 'true'
  assert.equal(enabled('serve'), true)
  assert.equal(enabled('serve', true), false)
  assert.equal(enabled('build'), false)
})

test('proxies visit session starts from development and preview origins', () => {
  const config = viteConfig({ mode: 'development' })
  const route = '^/device/visit-sessions$'
  assert.equal(config.server.proxy[route]?.changeOrigin, true)
  assert.deepEqual(config.preview.proxy[route], config.server.proxy[route])
})

test('proxies order registrations for an individual visit from development and preview origins', () => {
  const config = viteConfig({ mode: 'development' })
  const findRoute = (proxy, path) => Object.keys(proxy).find((route) => new RegExp(route).test(path))

  for (const { proxy } of [config.server, config.preview]) {
    const route = findRoute(proxy, '/device/visit-sessions/123/orders')
    assert.equal(proxy[route]?.changeOrigin, true)
    assert.equal(findRoute(proxy, '/device/visit-sessions/123/orders/456'), undefined)
    assert.equal(findRoute(proxy, '/device/visit-sessions/current/orders'), undefined)
  }
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

test('proxies all four payment and session completion routes in development and preview', () => {
  const config = viteConfig({ mode: 'development' })
  for (const { proxy } of [config.server, config.preview]) {
    for (const path of [
      '/device/visit-sessions/123/checkouts', '/device/checkouts/45/payments/face',
      '/device/checkouts/45/payments/67/verify', '/device/visit-sessions/123/complete',
    ]) {
      const route = Object.keys(proxy).find((pattern) => new RegExp(pattern).test(path))
      assert.equal(proxy[route]?.changeOrigin, true)
    }
    assert.equal(Object.keys(proxy).some((pattern) => new RegExp(pattern).test('/device/checkouts/x/payments/face')), false)
  }
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
