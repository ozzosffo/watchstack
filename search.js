(() => {
'use strict';
const catalog = () => window.WATCHSTACK_CATALOG || {};
const cache = new Map();
const ALIASES = { '가오갤': '가디언즈 오브 갤럭시', '귀칼': '귀멸의 칼날', '진격거': '진격의 거인', '리제로': 'Re:제로', '엔겜': '어벤져스: 엔드게임' };
const text = (value, max = 200) => String(value ?? '').trim().slice(0, max);
const key = value => text(value).normalize('NFKC').toLowerCase().replace(/[\s:：·.,!?()（）_*–—-]/g, '');
const url = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
const expanded = query => {
  const normal = key(query);
  for (const [alias, value] of Object.entries(ALIASES)) if (normal === key(alias)) return value;
  return query;
};
function englishTitle(source) {
  try { return decodeURIComponent(new URL(source).pathname.split('/wiki/')[1] || '').replaceAll('_', ' '); } catch { return ''; }
}
function localWorks(query) {
  const q = key(query), long = key(expanded(query));
  if (!q) return [];
  return Object.entries(catalog()).map(([entry, info]) => {
    const separator = entry.lastIndexOf('|'), title = entry.slice(0, separator), year = Number(entry.slice(separator + 1));
    const enTitle = englishTitle(info.sourceUrl);
    return { title, year, type: /시즌|완다비전|팔콘과 윈터/.test(title) ? '드라마' : '영화',
      posterUrl: url(info.posterUrl), posterSourceUrl: url(info.sourceUrl), sourceUrl: url(info.sourceUrl),
      catalogId: 'wikipedia-en:' + key(enTitle || title), sourceProvider: '위키백과', enTitle, wikiTitle: title, wikiSearch: false };
  }).filter(work => key(work.title).includes(q) || key(work.title).includes(long) || key(work.enTitle).includes(q) ||
    (query === '가오갤' && /가디언즈/.test(work.title))).slice(0, 8);
}
function abortError() { return new DOMException('Search canceled', 'AbortError'); }
async function api(base, params, signal, raw = false) {
  if (signal?.aborted) throw abortError();
  const endpoint = new URL(base);
  Object.entries(raw ? params : { format: 'json', origin: '*', ...params }).forEach(([k, v]) => endpoint.searchParams.set(k, String(v)));
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 8000);
  try {
    const response = await fetch(endpoint.href, { credentials: 'omit', signal: controller.signal });
    if (!response.ok) throw new Error('Search is temporarily unavailable');
    const data = await response.json();
    if (data.error) throw new Error('Search is temporarily unavailable');
    return data;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}
const pageArray = data => Object.values(data?.query?.pages || {}).filter(p => p.pageid > 0);
function classify(page) {
  if (page.pageprops && 'disambiguation' in page.pageprops) return null;
  const description = (page.terms?.description || []).join(' ');
  const enTitle = page.langlinks?.find(x => x.lang === 'en')?.['*'] || '';
  const primary = page.title + ' ' + description + ' ' + enTitle;
  if (/목록|흥행 기록|등장인물|동음이의|수상 내역|촬영지|List of /i.test(page.title + ' ' + enTitle)) return null;
  if (/영화\s*(감독|배우)|성우|배우|작곡가|각본가|프로게이머|라이트 노벨|만화$|manga series|novel series|filmmaker|actress|actor|composer|fictional character|superhero team|video game/i.test(description)) return null;
  const categories = (page.categories || []).map(c => c.title).filter(c => /(영화|드라마|애니메이션|텔레비전 프로그램|텔레비전 시리즈|시즌)$/.test(c)).join(' ');
  const content = primary + ' ' + categories;
  if (/애니메이션|\banime\b|\banimated\b/i.test(content)) return '애니';
  if (/영화|\bfilm\b|\bmovie\b/i.test(content)) return '영화';
  if (/드라마|텔레비전|오리지널 시리즈|\bTV series\b|\btelevision\b|\bminiseries\b|\bseason\s+\d/i.test(content)) return '드라마';
  return null;
}
function categoryYear(page) {
  const years = (page.categories || []).map(c => c.title.match(/^분류:(\d{4})년(?:에|부터)?\s*(?:공개|개봉|시작|방영|애니메이션|영화|드라마|텔레비전)/)?.[1]).filter(Boolean).map(Number);
  const described = (page.terms?.description || []).join(' ').match(/(?:^|\s)(\d{4})년/);
  if (described) years.push(Number(described[1]));
  return years.length ? Math.min(...years) : null;
}
function releaseYear(entity, type) {
  const properties = type === '영화' ? ['P577', 'P580', 'P1191'] : ['P580', 'P577', 'P1191'];
  for (const property of properties) {
    const years = (entity?.claims?.[property] || []).filter(c => c.rank !== 'deprecated').map(c => {
      const date = c.mainsnak?.datavalue?.value?.time?.match(/^\+(\d{4})-/);
      return date ? Number(date[1]) : null;
    }).filter(y => y >= 1880 && y <= 2100);
    if (years.length) return Math.min(...years);
  }
  return null;
}
function merge(works) {
  const result = [], seen = new Set();
  for (const work of works) {
    const identity = key(work.enTitle) || key(work.title) + '|' + (work.year || '');
    if (seen.has(identity)) continue;
    seen.add(identity); result.push(work);
  }
  return result.slice(0, 8);
}
function candidateWork(page, entities = {}, images = new Map()) {
    const type = classify(page), enTitle = page.langlinks?.find(x => x.lang === 'en')?.['*'] || '';
    const image = images.get(key(enTitle));
    const portrait = p => p?.thumbnail && p.thumbnail.height >= p.thumbnail.width;
    const art = portrait(image) ? image : portrait(page) ? page : image?.thumbnail ? image : page;
    return { title: text(page.title, 160), type, year: releaseYear(entities[page.pageprops?.wikibase_item], type) || categoryYear(page),
      posterUrl: url(art?.thumbnail?.source), posterSourceUrl: url(art?.fullurl), sourceUrl: url(page.fullurl),
      catalogId: enTitle ? 'wikipedia-en:' + key(enTitle) : 'wikipedia-ko:' + page.pageid,
      sourceProvider: '위키백과', enTitle, wikiTitle: text(page.title.replace(/\s+\(/g, '('), 160), wikiSearch: true };
}
async function adaptedSeries(pages, lookup, signal) {
  const base = [...pages].find(page => /만화|소설|노벨|manga|novel/i.test((page.terms?.description || []).join(' ')) && key(page.title).includes(key(lookup)) && page.langlinks?.some(link => link.lang === 'en'));
  if (!base) return [];
  const en = base.langlinks.find(link => link.lang === 'en')['*'].replace(/\s*\((?:manga|novel).*?\)$/i, '');
  try {
    const data = await api('https://api.tvmaze.com/search/shows', { q: en }, signal, true);
    if (!Array.isArray(data)) return [];
    return data.filter(entry => entry.show?.id && key(entry.show.name).includes(key(en))).slice(0, 4).map((entry, index) => {
      const show = entry.show, type = show.type === 'Animation' || show.genres?.includes('Anime') ? '애니' : show.type === 'Scripted' ? '드라마' : '기타';
      const year = Number(show.premiered?.slice(0, 4));
      return { title: text(index === 0 ? base.title + (type === '애니' ? ' (애니메이션)' : ' (드라마)') : base.title + ' · ' + show.name, 160),
        type, year: year >= 1880 && year <= 2100 ? year : null, posterUrl: url(show.image?.medium || show.image?.original),
        sourceUrl: url(show.url), posterSourceUrl: url(show.url), sourceProvider: 'TVmaze',
        sourceLicense: 'CC BY-SA', sourceLicenseUrl: 'https://www.tvmaze.com/api',
        catalogId: 'tvmaze:' + show.id, enTitle: show.name, wikiTitle: text(base.title, 160), wikiSearch: true };
    });
  } catch (error) { if (signal?.aborted) throw abortError(); return []; }
}
async function search(query, { signal, onProgress } = {}) {
  query = text(query, 120);
  const local = localWorks(query);
  if (query.length < 2) return { works: local, offline: false };
  const cached = cache.get(key(query));
  if (cached && Date.now() - cached.time < 5 * 60 * 1000) return { works: cached.works, offline: false };
  const lookup = expanded(query), common = { action: 'query', prop: 'pageimages|info|pageprops|pageterms|langlinks|categories',
    inprop: 'url', piprop: 'thumbnail', pithumbsize: 240, pilicense: 'any', wbptterms: 'description',
    lllang: 'en', cllimit: 500, clshow: '!hidden' };
  const pages = new Map();
  function candidatesNow() {
    return [...pages.values()].filter(page => {
    const en = page.langlinks?.find(x => x.lang === 'en')?.['*'] || '';
    return classify(page) && (key(page.title).includes(key(lookup)) || key(en).includes(key(query)));
  }).sort((a, b) => {
    const match = page => key(page.title) === key(lookup) ? 0 : key(page.title).startsWith(key(lookup)) ? 1 : 2;
    return match(a) - match(b) || (a.index || 99) - (b.index || 99);
  }).slice(0, 8);
  }
  function collect(data) {
    if (signal?.aborted) throw abortError();
    pageArray(data).forEach(page => { const existing = pages.get(page.pageid); pages.set(page.pageid, existing ? { ...existing, ...page } : page); });
    onProgress?.({ works: merge([...local, ...candidatesNow().map(page => candidateWork(page))]), offline: false, loading: true });
    return data;
  }
  const responses = await Promise.allSettled([
    api('https://ko.wikipedia.org/w/api.php', { ...common, generator: 'prefixsearch', gpssearch: lookup, gpsnamespace: 0, gpslimit: 10 }, signal).then(collect),
    api('https://ko.wikipedia.org/w/api.php', { ...common, generator: 'search', gsrsearch: lookup + '*', gsrnamespace: 0, gsrlimit: 10 }, signal).then(collect)
  ]);
  if (signal?.aborted) throw abortError();
  if (!responses.some(r => r.status === 'fulfilled')) return { works: local, offline: true };
  const candidates = candidatesNow();
  const ids = [...new Set(candidates.filter(p => !categoryYear(p)).map(p => p.pageprops?.wikibase_item).filter(q => /^Q\d+$/.test(q)))];
  const titles = [...new Set(candidates.map(p => p.langlinks?.find(x => x.lang === 'en')?.['*']).filter(Boolean))];
  const [entityResponse, imageResponse] = await Promise.allSettled([
    ids.length ? api('https://www.wikidata.org/w/api.php', { action: 'wbgetentities', ids: ids.join('|'), props: 'claims', languages: 'ko|en' }, signal) : Promise.resolve({}),
    titles.length ? api('https://en.wikipedia.org/w/api.php', { action: 'query', titles: titles.join('|'), prop: 'pageimages|info', inprop: 'url', piprop: 'thumbnail', pithumbsize: 240, pilicense: 'any', redirects: 1 }, signal) : Promise.resolve({})
  ]);
  if (signal?.aborted) throw abortError();
  const entities = entityResponse.status === 'fulfilled' ? entityResponse.value.entities || {} : {};
  const imageData = imageResponse.status === 'fulfilled' ? imageResponse.value : {};
  const images = new Map(pageArray(imageData).map(p => [key(p.title), p]));
  (imageData.query?.normalized || []).concat(imageData.query?.redirects || []).forEach(alias => {
    if (images.has(key(alias.to))) images.set(key(alias.from), images.get(key(alias.to)));
  });
  const remote = candidates.map(page => candidateWork(page, entities, images));
  const adaptations = !local.length && !remote.length ? await adaptedSeries(pages.values(), lookup, signal) : [];
  if (signal?.aborted) throw abortError();
  const works = merge([...local, ...remote, ...adaptations]);
  cache.set(key(query), { time: Date.now(), works });
  if (cache.size > 40) cache.delete(cache.keys().next().value);
  return { works, offline: false };
}
function namuUrl(work) {
  return work.wikiSearch
    ? 'https://namu.wiki/Search?q=' + encodeURIComponent(work.wikiTitle || work.title)
    : 'https://namu.wiki/w/' + encodeURIComponent(work.wikiTitle || work.title);
}
window.WATCHSTACK_SEARCH = Object.freeze({ search, localWorks, namuUrl });
})();
