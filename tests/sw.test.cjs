'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const scope = 'https://ozzosffo.github.io/watchstack/';
const CURRENT = 'watchstack-v1.5.0-20261017';
function worker(online = true) {
  const listeners = {}, stores = new Map(), state = { skips: 0, claims: 0, online, requests: [] };
  const key = request => new URL(typeof request === 'string' ? request : request.url, scope).href;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const files = stores.get(name);
      return {
        async addAll(items) { for (const item of items) files.set(key(item), new Response(item.includes('.js') ? 'script' : '<html>shell</html>')); },
        async put(request, response) { files.set(key(request), response); },
        async match(request, options = {}) {
          const target = new URL(key(request));
          if (options.ignoreSearch) {
            for (const [url, response] of files) if (new URL(url).pathname === target.pathname) return response.clone();
          }
          return files.get(target.href)?.clone();
        }
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); }
  };
  const self = {
    registration: { scope }, location: { origin: 'https://ozzosffo.github.io' },
    addEventListener(name, fn) { listeners[name] = fn; },
    async skipWaiting() { state.skips++; }, clients: { async claim() { state.claims++; } }
  };
  vm.runInNewContext(source, { self, caches, URL, Response, AbortController, setTimeout, clearTimeout,
    fetch: async request => { state.requests.push(request); if (!state.online) throw new Error('offline'); return new Response('network'); } });
  const dispatch = async (name, properties = {}) => {
    let promise;
    listeners[name]({ ...properties, waitUntil(p) { promise = p; }, respondWith(p) { promise = p; } });
    return promise;
  };
  const request = (file, mode = 'cors', method = 'GET') => ({ url: new URL(file, scope).href, mode, method });
  return { state, stores, caches, dispatch, request };
}
test('installation caches every versioned shell asset and waits for explicit update', async () => {
  const w = worker(); await w.dispatch('install');
  const keys = [...w.stores.get(CURRENT).keys()];
  for (const file of ['index.html','app.js?v=1.5.0','catalog.js?v=1.5.0','search.js?v=1.5.0','picker.js?v=1.5.0','styles.css?v=1.5.0','manifest.webmanifest','assets/icon-192.png','assets/icon-512.png']) {
    assert.ok(keys.includes(scope + file), file);
    assert.ok(fs.existsSync(path.join(__dirname, '..', file.split('?')[0])), 'cached file exists');
  }
  assert.equal(w.state.skips, 0);
  await w.dispatch('message', { data: { type: 'SKIP_WAITING' } });
  assert.equal(w.state.skips, 1);
});
test('activation deletes only WATCHSTACK version caches and claims clients', async () => {
  const w = worker(); await w.dispatch('install');
  await w.caches.open('watchstack-v1.2-no-ai-20261015'); await w.caches.open('unrelated-app-v1');
  await w.dispatch('activate');
  assert.ok(!w.stores.has('watchstack-v1.2-no-ai-20261015'));
  assert.ok(w.stores.has(CURRENT)); assert.ok(w.stores.has('unrelated-app-v1'));
  assert.equal(w.state.claims, 1);
});
test('offline navigation and versioned assets use the cached shell', async () => {
  const w = worker(false); await w.dispatch('install');
  const navigation = await w.dispatch('fetch', { request: w.request('unseen-route', 'navigate') });
  assert.match(await navigation.text(), /shell/);
  const script = await w.dispatch('fetch', { request: w.request('app.js?v=1.5.0') });
  assert.equal(await script.text(), 'script');
});
test('a missing offline script or image returns 503, never index HTML', async () => {
  const w = worker(false); await w.dispatch('install');
  for (const name of ['missing.js','assets/missing.png']) {
    const response = await w.dispatch('fetch', { request: w.request(name) });
    assert.equal(response.status, 503);
    assert.ok(!response.headers.get('Content-Type').includes('html'));
    assert.ok(!(await response.text()).includes('<html>'));
  }
});
test('live responses refresh the cache and remain available offline', async () => {
  const w = worker(); await w.dispatch('install');
  const request = w.request('app.js?v=1.5.0');
  assert.equal(await (await w.dispatch('fetch', { request })).text(), 'network');
  w.state.online = false;
  assert.equal(await (await w.dispatch('fetch', { request })).text(), 'network');
});
test('the worker ignores external hosts, other Pages projects and non-GET requests', async () => {
  const w = worker(false); await w.dispatch('install');
  for (const request of [
    { url: 'https://upload.wikimedia.org/image.jpg', method: 'GET' },
    { url: 'https://ozzosffo.github.io/other-project/app.js', method: 'GET' },
    w.request('save', 'cors', 'POST')
  ]) assert.equal(await w.dispatch('fetch', { request }), undefined);
  assert.equal(w.state.requests.length, 0);
});
test('PWA identity, start URL and scope remain unchanged', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.id, './'); assert.equal(manifest.start_url, './'); assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
});
