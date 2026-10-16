'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const catalog = fs.readFileSync(path.join(root, 'catalog.js'), 'utf8');
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'v1-library.json'), 'utf8');
const KEY = 'watchstack_library_v1';
const BACKUP = KEY + '_pre_v13';
const RESTORE = KEY + '_before_replace';
function start(t, raw, extra = {}, setup) {
  const errors = [], diagnostics = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', error => { diagnostics.push(error.message); if (!error.message.includes('navigation')) errors.push(error); });
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    url: 'https://ozzosffo.github.io/watchstack/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc
  });
  const w = dom.window, d = w.document;
  w.scrollTo = () => {};
  w.confirm = () => true;
  w.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} };
  let requests = 0;
  w.fetch = async () => { requests++; return { ok: false }; };
  if (raw !== undefined) w.localStorage.setItem(KEY, raw);
  for (const [key, value] of Object.entries(extra)) w.localStorage.setItem(key, value);
  setup?.(w);
  w.eval(catalog); w.eval(source);
  t.after(() => { assert.deepEqual(errors.map(e => e.message), [], 'no uncaught DOM errors'); w.close(); });
  const click = (selector, scope = d) => { const el = scope.querySelector(selector); assert.ok(el, selector); el.click(); return el; };
  const open = () => click('[data-action="select"]');
  const saved = () => JSON.parse(w.localStorage.getItem(KEY));
  const submit = (values, selector = '#modal-root form') => {
    const f = d.querySelector(selector); assert.ok(f);
    for (const [name, value] of Object.entries(values)) {
      if (f.elements[name].type === 'checkbox') f.elements[name].checked = !!value;
      else f.elements[name].value = value;
    }
    f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  };
  const input = (el, value) => { el.value = value; el.dispatchEvent(new w.InputEvent('input', { bubbles: true, data: value, isComposing: true })); };
  const change = (id, value) => { const el = d.getElementById(id); el.value = value; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const importFile = async data => {
    click('[data-action="settings"]');
    const fileInput = d.getElementById('import-file');
    Object.defineProperty(fileInput, 'files', { value: [new w.File([data], 'test-backup.json', { type: 'application/json' })] });
    fileInput.dispatchEvent(new w.Event('change', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 30));
  };
  return { w, d, click, open, saved, submit, input, change, importFile, diagnostics, requests: () => requests };
}
test('fresh install keeps the exact 23-work MCU route, six phases and two existing checks', t => {
  const a = start(t); a.open();
  assert.equal(a.d.querySelectorAll('.media-row').length, 23);
  assert.equal(a.d.querySelectorAll('.phase-block').length, 6);
  assert.equal(a.d.querySelectorAll('[data-watch]:checked').length, 2);
  assert.equal(a.d.querySelectorAll('.media-row img').length, 23);
  assert.equal(a.requests(), 0, 'curated MCU artwork needs no API call');
  assert.equal(a.w.localStorage.getItem(KEY), null, 'rendering must not write seed over anything');
});
test('the previous version opens without writing or changing any existing ID, note or check', t => {
  const a = start(t, fixture); a.open();
  assert.equal(a.w.localStorage.getItem(KEY), fixture);
  const expected = JSON.parse(fixture);
  const id = expected.collections[0].sections[0].items[0].id;
  assert.ok([...a.d.querySelectorAll('[data-item]')].some(el => el.dataset.item === id));
  assert.equal(a.d.querySelectorAll('[data-watch]:checked').length, 2);
});
test('one check persists, preserves every ID and saves the exact pre-upgrade bytes', t => {
  const a = start(t, fixture); a.open();
  a.click('[data-watch]');
  const before = JSON.parse(fixture), after = a.saved();
  assert.equal(after.collections[0].sections[0].items[0].status, 'done');
  before.collections[0].sections[0].items[0].status = 'done';
  assert.deepEqual(after, before);
  assert.equal(a.w.localStorage.getItem(BACKUP), fixture);
  const b = start(t, JSON.stringify(after)); b.open();
  assert.equal(b.d.querySelectorAll('[data-watch]:checked').length, 3);
});
test('a checkbox can be unchecked and the watched-only list updates immediately', t => {
  const a = start(t, fixture); a.open();
  a.click('[data-action="filter"][data-filter="done"]');
  assert.equal(a.d.querySelectorAll('.media-row').length, 2);
  a.click('[data-watch]');
  assert.equal(a.d.querySelectorAll('.media-row').length, 1);
  assert.equal(a.saved().collections[0].sections.flatMap(s => s.items).filter(i => i.status === 'done').length, 1);
});
test('Korean composition keeps the same focused input while rendering matching results', t => {
  const a = start(t, fixture); a.open();
  const input = a.d.getElementById('searchbox'); input.focus();
  input.dispatchEvent(new a.w.CompositionEvent('compositionstart', { bubbles: true }));
  a.input(input, '로키');
  assert.equal(a.d.getElementById('searchbox'), input);
  assert.equal(a.d.activeElement, input);
  assert.equal(a.d.querySelectorAll('.media-row').length, 2);
  input.dispatchEvent(new a.w.CompositionEvent('compositionend', { bubbles: true, data: '로키' }));
  assert.equal(input.value, '로키');
});
test('type, watched status, group and text filters work together with one empty state', t => {
  const a = start(t, fixture); a.open();
  a.change('type-filter', '드라마'); a.click('[data-action="filter"][data-filter="plan"]');
  const group = a.saved().collections[0].sections[3].id;
  a.change('section-filter', group);
  assert.equal(a.d.querySelectorAll('.media-row').length, 3);
  a.input(a.d.getElementById('searchbox'), '없는제목');
  assert.equal(a.d.querySelectorAll('.empty-state').length, 1);
  assert.equal(a.d.querySelectorAll('.phase-block').length, 0);
  a.click('[data-action="clear-filters"]');
  assert.equal(a.d.querySelectorAll('.media-row').length, 23);
});
test('groups collapse with a native button and search automatically exposes results', t => {
  const a = start(t, fixture); a.open();
  const button = a.click('[data-action="collapse"]');
  assert.equal(a.d.querySelector('[data-action="collapse"]').getAttribute('aria-expanded'), 'false');
  assert.ok(a.d.getElementById(button.getAttribute('aria-controls')).hidden);
  a.input(a.d.getElementById('searchbox'), '아이언맨');
  assert.equal(a.d.querySelector('[data-action="collapse"]').getAttribute('aria-expanded'), 'true');
  assert.equal(a.d.querySelectorAll('.media-row').length, 1);
});
test('poster view and selected collection survive a reload through separate preferences', t => {
  const a = start(t, fixture); a.open(); a.click('[data-view="grid"]');
  assert.ok(a.d.querySelector('.gallery-view'));
  const prefs = a.w.localStorage.getItem('watchstack_preferences_v1');
  const b = start(t, fixture, { watchstack_preferences_v1: prefs });
  assert.ok(b.d.querySelector('.gallery-view'));
  assert.equal(b.w.localStorage.getItem(KEY), fixture);
});
test('create and edit a collection, group and work with native forms', t => {
  const a = start(t, fixture); a.click('[data-action="new-list"]');
  a.submit({ title: '우리 애니', description: '시즌별로 모으기' });
  const id = a.saved().collections.at(-1).id;
  assert.equal(a.d.querySelector('.collection-heading h1').textContent, '우리 애니');
  a.click('[data-action="edit-list"]'); a.submit({ title: '내 애니 모음' });
  a.click('[data-action="new-section"]'); a.submit({ title: '시즌 2', description: '두 번째 이야기' });
  const group = a.saved().collections.at(-1).sections.at(-1).id;
  a.click('[data-action="new-item-global"]');
  a.submit({ title: '작품 1', section: group, type: '애니', year: '2026', watched: true, note: '한글 메모' });
  const c = a.saved().collections.find(c => c.id === id), item = c.sections.at(-1).items[0];
  assert.equal(item.status, 'done'); assert.equal(item.note, '한글 메모');
  assert.equal(item.type, '애니'); assert.equal(item.year, 2026);
  a.click('[data-action="edit-item"]'); a.submit({ title: '작품 수정', note: '두 줄\n메모' });
  assert.equal(a.saved().collections.at(-1).sections.at(-1).items[0].id, item.id);
  assert.equal(a.saved().collections.at(-1).sections.at(-1).items[0].note, '두 줄\n메모');
});
test('moving a work to another phase preserves its ID, check and metadata', t => {
  const a = start(t, fixture); a.open();
  const c = a.saved().collections[0], item = c.sections[1].items[1];
  a.click('[data-action="edit-item"][data-iid="' + item.id + '"]');
  a.submit({ section: c.sections[0].id });
  const after = a.saved().collections[0];
  assert.equal(after.sections[1].items.length, c.sections[1].items.length - 1);
  assert.deepEqual(after.sections[0].items.at(-1), item);
});
test('work and group reordering preserves all records', t => {
  const a = start(t, fixture); a.open();
  const before = a.saved().collections[0], first = before.sections[0].items[0];
  a.click('[data-action="edit-item"][data-iid="' + first.id + '"]');
  a.click('[data-action="move-item"][data-dir="1"]');
  assert.equal(a.saved().collections[0].sections[0].items[1].id, first.id);
  a.click('[data-action="edit-section"]'); a.click('[data-action="move-section"][data-dir="1"]');
  assert.equal(a.saved().collections[0].sections[1].id, before.sections[0].id);
  assert.equal(a.saved().collections[0].sections.flatMap(g => g.items).length, 23);
});
test('deletion has confirmation, a persistent recovery copy and a working undo', t => {
  const a = start(t, fixture); a.open();
  a.click('[data-action="edit-item"]'); a.click('[data-action="delete-item"]');
  assert.equal(a.saved().collections[0].sections[0].items.length, 3);
  assert.equal(a.w.localStorage.getItem(RESTORE), fixture);
  a.click('[data-action="undo"]'); assert.deepEqual(a.saved(), JSON.parse(fixture));
});
test('deleting a whole collection can be undone', t => {
  const a = start(t, fixture); a.open();
  a.click('[data-action="edit-list"]'); a.click('[data-action="delete-list"]');
  assert.equal(a.saved().collections.length, 1);
  a.click('[data-action="undo"]'); assert.deepEqual(a.saved(), JSON.parse(fixture));
});
test('deletion is canceled without a write when confirmation is declined', t => {
  const a = start(t, fixture); a.open(); a.w.confirm = () => false;
  a.click('[data-action="edit-item"]'); a.click('[data-action="delete-item"]');
  assert.equal(a.w.localStorage.getItem(KEY), fixture);
  assert.ok(a.d.querySelector('#modal-root form'));
});
test('a damaged JSON record is protected instead of being silently reseeded or overwritten', t => {
  const raw = '{"broken":'; const a = start(t, raw);
  assert.ok(a.d.querySelector('.recovery-banner'));
  assert.equal(a.d.querySelectorAll('.collection-card').length, 0);
  a.click('[data-action="new-list"]'); a.submit({ title: '새 목록' });
  assert.equal(a.w.localStorage.getItem(KEY), raw);
  assert.ok(a.d.querySelector('#modal-root form'));
  assert.match(a.d.getElementById('toast').textContent, /원본/);
});
test('unsupported future versions and malformed or oversized groups never truncate stored data', t => {
  for (const object of [
    { version: 2, collections: [] },
    { version: 1, collections: [{ sections: 'bad' }] },
    { version: 1, collections: [{ sections: [{ items: Array.from({ length: 1501 }, () => ({ title: 'x' })) }] }] }
  ]) {
    const raw = JSON.stringify(object), a = start(t, raw);
    assert.ok(a.d.querySelector('.recovery-banner'));
    assert.equal(a.w.localStorage.getItem(KEY), raw);
  }
});
test('quota failure rolls back the check and never reports a successful save', t => {
  const a = start(t, fixture); a.open();
  const proto = a.w.Storage.prototype, real = proto.setItem;
  proto.setItem = function(key, value) { if (key === KEY) throw new a.w.DOMException('full', 'QuotaExceededError'); return real.call(this, key, value); };
  a.click('[data-watch]');
  assert.equal(a.w.localStorage.getItem(KEY), fixture);
  assert.equal(a.d.querySelectorAll('[data-watch]:checked').length, 2);
  assert.match(a.d.getElementById('toast').textContent, /저장하지 못했/);
  assert.equal(a.d.querySelectorAll('#toast [data-action="undo"]').length, 0);
});
test('a failed safety snapshot blocks overwriting the primary record', t => {
  const a = start(t, fixture); a.open();
  const proto = a.w.Storage.prototype, real = proto.setItem;
  proto.setItem = function(key, value) { if (key === BACKUP) throw new Error('full'); return real.call(this, key, value); };
  a.click('[data-watch]');
  assert.equal(a.w.localStorage.getItem(KEY), fixture);
  assert.equal(a.d.querySelectorAll('[data-watch]:checked').length, 2);
});
test('import previews without writing and defaults to appending distinct collection IDs', async t => {
  const a = start(t, fixture); await a.importFile(fixture);
  assert.equal(a.w.localStorage.getItem(KEY), fixture);
  const radio = a.d.querySelector('input[name="mode"]:checked');
  assert.equal(radio.value, 'merge');
  a.submit({});
  const result = a.saved(), original = JSON.parse(fixture);
  assert.equal(result.collections.length, 4);
  assert.deepEqual(result.collections.slice(0, 2), original.collections);
  const ids = result.collections.flatMap(c => [c.id, ...c.sections.flatMap(g => [g.id, ...g.items.map(i => i.id)])]);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(result.collections[2].sections[0].items[0].status, original.collections[0].sections[0].items[0].status);
});
test('replace import keeps incoming IDs and snapshots the exact prior record', async t => {
  const a = start(t, fixture);
  const incoming = { version: 1, collections: [{ id: 'imported', title: '복원한 기록', icon: '🎬', color: '#a393ff', sections: [] }] };
  await a.importFile(JSON.stringify(incoming)); a.submit({ mode: 'replace' });
  assert.equal(a.saved().collections.length, 1); assert.equal(a.saved().collections[0].id, 'imported');
  assert.equal(a.w.localStorage.getItem(RESTORE), fixture);
  a.click('[data-action="undo"]'); assert.deepEqual(a.saved(), JSON.parse(fixture));
});
test('a valid backup can repair damaged JSON while preserving its raw bytes in recovery', async t => {
  const damaged = '{invalid'; const a = start(t, damaged);
  await a.importFile(fixture); a.submit({ mode: 'replace' });
  assert.deepEqual(a.saved(), JSON.parse(fixture));
  assert.equal(a.w.localStorage.getItem(BACKUP), damaged);
  assert.equal(a.w.localStorage.getItem(RESTORE), damaged);
  assert.equal(a.d.querySelector('.recovery-banner'), null);
});
test('invalid import leaves the working database untouched', async t => {
  const a = start(t, fixture); await a.importFile('{"collections":[null]}');
  assert.equal(a.w.localStorage.getItem(KEY), fixture);
  assert.equal(a.d.querySelector('[data-form="import"]'), null);
});
test('cross-tab updates refresh checks and block a stale open form', t => {
  const a = start(t, fixture); a.open(); a.click('[data-action="edit-item"]');
  const next = JSON.parse(fixture); next.collections[0].sections[0].items[0].status = 'done';
  const raw = JSON.stringify(next); a.w.localStorage.setItem(KEY, raw);
  a.w.dispatchEvent(new a.w.StorageEvent('storage', { key: KEY, newValue: raw }));
  assert.equal(a.d.querySelectorAll('#app [data-watch]:checked').length, 3);
  a.submit({ title: '오래된 폼' });
  assert.equal(a.w.localStorage.getItem(KEY), raw);
  assert.match(a.d.getElementById('toast').textContent, /다른 창/);
});
test('a missed storage event still cannot overwrite another tab during the next edit', t => {
  const a = start(t, fixture); a.open();
  const next = JSON.parse(fixture); next.collections[0].title = '다른 창의 제목';
  const raw = JSON.stringify(next); a.w.localStorage.setItem(KEY, raw);
  a.click('[data-watch]');
  assert.equal(a.w.localStorage.getItem(KEY), raw);
  assert.equal(a.d.querySelector('.collection-heading h1').textContent, '다른 창의 제목');
});
test('work details expose metadata and use only a native watched checkbox', t => {
  const a = start(t, fixture); a.open(); a.click('[data-action="details"]');
  assert.ok(a.d.querySelector('.details-copy h3').textContent.includes('아이언맨'));
  assert.ok(a.d.querySelector('.wiki-link').getAttribute('rel').includes('noopener'));
  assert.ok(a.d.querySelector('.art-source').href.startsWith('https://en.wikipedia.org/'));
  a.click('#modal-root [data-watch]');
  assert.equal(a.saved().collections[0].sections[0].items[0].status, 'done');
  assert.equal(a.d.querySelector('#modal-root [data-watch]').checked, true);
});
test('modal traps Tab, makes the app inert and restores focus on Escape', t => {
  const a = start(t, fixture); a.open();
  const button = a.d.querySelector('[data-action="edit-list"]'); button.focus(); button.click();
  assert.equal(a.d.getElementById('app').inert, true);
  const all = [...a.d.querySelectorAll('.modal button:not(:disabled),.modal input:not([type="hidden"]),.modal select,.modal textarea,.modal a[href]')];
  all.at(-1).focus(); all.at(-1).dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  assert.equal(a.d.activeElement, all[0]);
  a.d.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(a.d.querySelector('.modal'), null); assert.equal(a.d.getElementById('app').inert, false);
  assert.equal(a.d.activeElement.dataset.action, 'edit-list');
});
test('titles, notes and poster URLs are safely rendered as text', t => {
  const object = JSON.parse(fixture), item = object.collections[0].sections[0].items[0];
  item.title = '<img src=x onerror=alert(1)>'; item.note = '</p><script>bad()</script>'; item.posterUrl = 'javascript:alert(1)';
  const a = start(t, JSON.stringify(object)); a.open();
  assert.equal(a.d.querySelector('.media-title').textContent, item.title);
  assert.equal(a.d.querySelector('.media-note').textContent, item.note);
  assert.equal(a.d.querySelector('[src^="javascript:"]'), null);
  assert.equal(a.d.querySelectorAll('#app script').length, 0);
});
test('blank titles are rejected without silently creating an empty collection', t => {
  const a = start(t, fixture); a.click('[data-action="new-list"]'); a.submit({ title: '   ' });
  assert.equal(a.w.localStorage.getItem(KEY), fixture);
  assert.ok(a.d.querySelector('#modal-root form'));
});
test('CSS parses and declares tablet, phone, safe-area and reduced-motion layouts', t => {
  const a = start(t, fixture), css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const style = a.d.createElement('style'); style.textContent = css; a.d.head.appendChild(style);
  assert.ok(style.sheet.cssRules.length > 150);
  assert.match(css, /max-width: 1100px/); assert.match(css, /max-width: 520px/);
  assert.match(css, /safe-area-inset-bottom/); assert.match(css, /prefers-reduced-motion/);
  a.open();
  assert.equal(a.d.querySelector('.watch-control').querySelector('input').type, 'checkbox');
  assert.equal(a.d.querySelector('.media-row [aria-pressed]'), null);
});
test('group collapse remains usable within filtered search results', t => {
  const a = start(t, fixture); a.open();
  a.input(a.d.getElementById('searchbox'), '로키');
  a.click('[data-action="collapse"]');
  assert.equal(a.d.querySelector('[data-action="collapse"]').getAttribute('aria-expanded'), 'false');
});
test('a failed save also rolls back the checkbox inside an open details dialog', t => {
  const a = start(t, fixture); a.open(); a.click('[data-action="details"]');
  const proto = a.w.Storage.prototype, real = proto.setItem;
  proto.setItem = function(key, value) { if (key === KEY) throw new Error('full'); return real.call(this, key, value); };
  a.click('#modal-root [data-watch]');
  assert.equal(a.w.localStorage.getItem(KEY), fixture);
  assert.equal(a.d.querySelector('#modal-root [data-watch]').checked, false);
});
test('deleting a phase removes only that group and can be undone', t => {
  const a = start(t, fixture); a.open();
  a.click('[data-action="edit-section"]'); a.click('[data-action="delete-section"]');
  assert.equal(a.saved().collections[0].sections.length, 5);
  assert.equal(a.saved().collections[0].sections.flatMap(g => g.items).length, 19);
  assert.deepEqual(a.saved().collections[1], JSON.parse(fixture).collections[1]);
  a.click('[data-action="undo"]'); assert.deepEqual(a.saved(), JSON.parse(fixture));
});
function mockServiceWorker(w, controlled, waiting = null) {
  const handlers = {};
  const api = {
    controller: controlled ? {} : null,
    addEventListener(name, handler) { handlers[name] = handler; },
    async register() { return { waiting, addEventListener() {} }; }
  };
  Object.defineProperty(w.navigator, 'serviceWorker', { value: api });
  return handlers;
}
test('initial service-worker activation never reloads an open form', t => {
  let events;
  const a = start(t, fixture, {}, w => { events = mockServiceWorker(w, false); });
  a.click('[data-action="new-list"]'); events.controllerchange();
  assert.ok(a.d.querySelector('[data-form="list"]'));
  assert.equal(a.diagnostics.filter(s => s.includes('navigation')).length, 0);
});
test('an update activated by another tab waits for this tab to finish its form', t => {
  let events;
  const a = start(t, fixture, {}, w => { events = mockServiceWorker(w, true); });
  a.click('[data-action="new-list"]'); events.controllerchange();
  assert.ok(a.d.querySelector('[data-form="list"]'));
  assert.equal(a.d.getElementById('update-banner').hidden, false);
  assert.equal(a.diagnostics.filter(s => s.includes('navigation')).length, 0);
  a.click('[data-action="install-update"]');
  assert.equal(a.diagnostics.filter(s => s.includes('navigation')).length, 0);
  a.click('[data-action="close-modal"]'); a.click('[data-action="install-update"]');
  assert.equal(a.diagnostics.filter(s => s.includes('navigation')).length, 1);
});
test('waiting updates require an explicit action and refuse to interrupt editing', async t => {
  let messages = 0;
  const a = start(t, fixture, {}, w => mockServiceWorker(w, true, { postMessage(message) { if (message.type === 'SKIP_WAITING') messages++; } }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(messages, 0); assert.equal(a.d.getElementById('update-banner').hidden, false);
  a.click('[data-action="new-list"]'); a.click('[data-action="install-update"]');
  assert.equal(messages, 0);
  a.click('[data-action="close-modal"]'); a.click('[data-action="install-update"]');
  assert.equal(messages, 1);
});
