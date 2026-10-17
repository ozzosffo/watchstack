'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const fixture = require('./fixtures/search-api.json');
const source = fs.readFileSync(path.join(root, 'search.js'), 'utf8');
const catalog = fs.readFileSync(path.join(root, 'catalog.js'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const pages = values => ({ query: { pages: Object.fromEntries(values.map(page => [page.pageid, page])) } });
function start(t, name = 'interstellar', transform = value => value) {
  const dom = new JSDOM('', { url: 'https://ozzosffo.github.io/watchstack/', runScripts: 'outside-only' });
  const w = dom.window, calls = [];
  w.fetch = async (href, options) => {
    const url = new URL(href); calls.push({ url, options });
    let data;
    if (url.hostname === 'api.tvmaze.com') data = fixture.tvmaze;
    else if (url.hostname === 'www.wikidata.org') data = { entities: fixture.entities };
    else if (url.hostname === 'en.wikipedia.org') data = pages(fixture.images);
    else data = pages(fixture[name]);
    return { ok: true, json: async () => transform(clone(data), url) };
  };
  w.eval(catalog); w.eval(source);
  t.after(() => w.close());
  return { w, calls, engine: w.WATCHSTACK_SEARCH };
}
test('partial title resolves to a real film with year, portrait poster, stable ID and source', async t => {
  const a = start(t), progress = [];
  const answer = await a.engine.search('인터스', { onProgress: update => progress.push(update) });
  const film = answer.works.find(work => work.title === '인터스텔라');
  assert.equal(film.type, '영화'); assert.equal(film.year, 2014);
  assert.match(film.posterUrl, /Interstellar_film_poster/);
  assert.equal(film.catalogId, 'wikipedia-en:interstellarfilm');
  assert.match(film.sourceUrl, /^https:\/\/ko.wikipedia.org/);
  assert.match(film.posterSourceUrl, /^https:\/\/en.wikipedia.org/);
  assert.ok(progress.some(update => update.works.some(work => work.title === film.title)), 'candidates arrive before enrichment');
  assert.ok(!answer.works.some(work => /놀란|동음이의/.test(work.title)));
  for (const call of a.calls) {
    assert.equal(call.options.credentials, 'omit');
    assert.equal(call.url.searchParams.get('origin'), '*');
    assert.equal(call.url.searchParams.has('gsrwhat'), false, 'unsupported title-only search is never used');
  }
  const count = a.calls.length;
  await a.engine.search('인터스'); assert.equal(a.calls.length, count, 'repeated query uses memory cache');
  assert.equal(a.w.localStorage.length, 0, 'search never writes watch history');
});
test('anime resolves separately from its manga and year uses original first airing', async t => {
  const a = start(t, 'anime');
  const result = await a.engine.search('귀칼');
  const work = result.works.find(work => work.title === '귀멸의 칼날 (애니메이션)');
  assert.equal(work.type, '애니'); assert.equal(work.year, 2019);
  assert.ok(!result.works.some(work => work.title === '귀멸의 칼날' || /등장인물/.test(work.title)));
  assert.ok(a.calls.some(call => call.url.searchParams.get('gpssearch') === '귀멸의 칼날'));
  assert.match(a.engine.namuUrl(work), /^https:\/\/namu.wiki\/Search\?q=/);
});
test('series without a category year receives the first Wikidata start year', async t => {
  const a = start(t, 'loki');
  const work = (await a.engine.search('로키')).works.find(work => work.title === '로키 (드라마)');
  assert.equal(work.type, '드라마'); assert.equal(work.year, 2021);
});
test('light-novel matches fall back to actual anime shows with TVmaze attribution', async t => {
  const a = start(t, 'rezero');
  const result = await a.engine.search('리제로');
  assert.equal(result.works.length, 2, 'unrelated Jezero is excluded');
  const work = result.works[0];
  assert.equal(work.type, '애니'); assert.equal(work.year, 2016);
  assert.equal(work.catalogId, 'tvmaze:14459');
  assert.match(work.posterUrl, /^https:\/\/static.tvmaze.com/);
  assert.equal(work.sourceProvider, 'TVmaze'); assert.equal(work.sourceLicense, 'CC BY-SA');
  assert.equal(work.sourceUrl, fixture.tvmaze[0].show.url);
  assert.ok(work.title.includes('(애니메이션)'));
});
test('network errors retain the curated MCU candidates without creating empty records', async t => {
  const a = start(t);
  a.w.fetch = async () => { throw new TypeError('offline'); };
  const answer = await a.engine.search('가오갤');
  assert.equal(answer.offline, true); assert.ok(answer.works.length);
  assert.ok(answer.works.every(work => /가디언즈/.test(work.title)));
  const missing = await a.engine.search('없는작품');
  assert.equal(missing.offline, true); assert.equal(missing.works.length, 0);
});
test('unsafe image and source schemes are discarded and canceled queries reject', async t => {
  const a = start(t, 'interstellar', data => {
    for (const page of Object.values(data.query?.pages || {})) { if (page.thumbnail) page.thumbnail.source = 'javascript:alert(1)'; page.fullurl = 'data:text/html,unsafe'; }
    return data;
  });
  const work = (await a.engine.search('인터스')).works[0];
  assert.equal(work.posterUrl, ''); assert.equal(work.sourceUrl, ''); assert.equal(work.posterSourceUrl, '');
  const controller = new a.w.AbortController(); controller.abort();
  await assert.rejects(a.engine.search('다른제목', { signal: controller.signal }), { name: 'AbortError' });
  const direct = a.engine.localWorks('아이언맨')[0];
  assert.match(a.engine.namuUrl(direct), /^https:\/\/namu.wiki\/w\//);
});
