(() => {
'use strict';
const STORAGE_KEY = 'watchstack_library_v1';
const PALETTE = ['#a393ff','#f39b9d','#74cdbd','#ebbb74','#78b2f6','#dc9cf0'];
const ICONS = ['🎬','🍿','📺','🌙','🌸','⭐','🎮','🎧','🚀','📚','🪐','🎨'];
const TYPES = ['영화','드라마','애니','기타'];
const TYPE_ICON = {영화:'🎬',드라마:'📺',애니:'🌸',기타:'✨'};
const sample = [
 {name:'페이즈 1',desc:'인피니티 사가 · 2008–2012',items:[['아이언맨',2008,'영화'],['토르: 천둥의 신',2011,'영화'],['퍼스트 어벤져',2011,'영화'],['어벤져스',2012,'영화']]},
 {name:'페이즈 2',desc:'인피니티 사가 · 2013–2015',items:[['캡틴 아메리카: 윈터 솔져',2014,'영화'],['가디언즈 오브 갤럭시',2014,'영화','done'],['어벤져스: 에이지 오브 울트론',2015,'영화','done']]},
 {name:'페이즈 3',desc:'인피니티 사가 · 2016–2019',items:[['캡틴 아메리카: 시빌 워',2016,'영화'],['닥터 스트레인지',2016,'영화'],['토르: 라그나로크',2017,'영화'],['어벤져스: 인피니티 워',2018,'영화'],['앤트맨과 와스프',2018,'영화'],['어벤져스: 엔드게임',2019,'영화']]},
 {name:'페이즈 4',desc:'멀티버스 사가 · 2021–2022',items:[['완다비전',2021,'드라마'],['팔콘과 윈터 솔져',2021,'드라마'],['로키 시즌 1',2021,'드라마'],['닥터 스트레인지: 대혼돈의 멀티버스',2022,'영화'],['블랙 팬서: 와칸다 포에버',2022,'영화']]},
 {name:'페이즈 5',desc:'멀티버스 사가 · 2023–2025',items:[['로키 시즌 2',2023,'드라마'],['데드풀과 울버린',2024,'영화'],['캡틴 아메리카: 브레이브 뉴 월드',2025,'영화'],['썬더볼츠*',2025,'영화']]},
 {name:'페이즈 6',desc:'멀티버스 사가 · 2025–',items:[['판타스틱 4: 새로운 출발',2025,'영화']]}
];
function uid(){return 'id'+Date.now().toString(36)+Math.random().toString(36).slice(2,9)}
function clean(v,max=300){return String(v??'').trim().slice(0,max)}
function initialMCU(){
 return {
   id:uid(),title:'MCU 필수 시청 로드맵',
   description:'둠스데이 전까지 핵심 작품만 · 총 23편 · 스포일러 없음',
   icon:'🦸',color:'#a393ff',
   sections:sample.map(g=>({
     id:uid(),title:g.name,description:g.desc,
     items:g.items.map(x=>({id:uid(),title:x[0],year:x[1],type:x[2],status:x[3]||'plan',posterUrl:'',wikiTitle:'',note:''}))
   }))
 };
}
function seed(){return {version:1,collections:[initialMCU()]}}

const BACKUP_KEY = STORAGE_KEY + '_pre_v13';
const RESTORE_KEY = STORAGE_KEY + '_before_replace';
const PREFS_KEY = 'watchstack_preferences_v1';
let loadIssue = '';
let lastStoredRaw = null;
let revision = 0;
let undoData = null;
function safeUrl(url) {
  try { const u = new URL(String(url || '')); return u.protocol === 'https:' ? u.href.slice(0, 2000) : ''; } catch { return ''; }
}
function normalize(raw, freshIds = false) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.collections) ||
      raw.collections.length > 300 || (raw.version != null && raw.version !== 1)) {
    throw new Error('지원하지 않는 백업 형식입니다. 원본 파일은 그대로 보관해 주세요.');
  }
  const seen = new Set();
  const id = value => {
    let candidate = freshIds ? '' : clean(value, 100);
    if (!candidate || seen.has(candidate)) candidate = uid();
    seen.add(candidate);
    return candidate;
  };
  const array = (value, max) => {
    if (value == null) return [];
    if (!Array.isArray(value) || value.length > max) throw new Error('목록 형식 또는 크기를 확인해 주세요. 원본을 줄이거나 삭제하지 않았어요.');
    return value;
  };
  const object = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('목록에 읽을 수 없는 항목이 있어요.');
    return value;
  };
  return { ...raw, version: 1, collections: raw.collections.map(value => {
    const c = object(value);
    return { ...c, id: id(c.id), title: clean(c.title, 90) || '이름 없는 컬렉션',
      description: clean(c.description, 350), icon: clean(c.icon, 12) || '🎬',
      color: PALETTE.includes(c.color) ? c.color : PALETTE[0],
      sections: array(c.sections, 300).map(value => {
        const g = object(value);
        return { ...g, id: id(g.id), title: clean(g.title, 90) || '기본 목록',
          description: clean(g.description, 160), items: array(g.items, 1500).map(value => {
            const i = object(value);
            return { ...i, id: id(i.id), title: clean(i.title, 160) || '제목 없음',
              type: TYPES.includes(i.type) ? i.type : '기타',
              year: Number.isInteger(+i.year) && +i.year >= 1880 && +i.year <= 2100 ? +i.year : null,
              status: i.status === 'done' ? 'done' : 'plan', posterUrl: safeUrl(i.posterUrl),
              wikiTitle: clean(i.wikiTitle, 160), note: clean(i.note, 900) };
          }) };
      }) };
  }) };
}
function load() {
  try {
    lastStoredRaw = localStorage.getItem(STORAGE_KEY);
    if (lastStoredRaw !== null) return normalize(JSON.parse(lastStoredRaw));
    return seed();
  } catch (error) {
    loadIssue = '저장된 기록을 읽을 수 없어요. 원본을 보호하기 위해 편집을 잠시 멈췄어요.';
    return { version: 1, collections: [] };
  }
}
function readPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; }
}
let db = load();
let preferences = readPrefs();
let selectedId = db.collections.some(c => c.id === preferences.selectedId) ? preferences.selectedId : null;
let statusFilter = 'all';
let typeFilter = 'all';
let sectionFilter = 'all';
let searchQuery = '';
let collectionQuery = '';
let viewMode = preferences.viewMode === 'grid' ? 'grid' : 'list';
let collapsed = new Set();
let beforeInstallPrompt = null;
let toastTimer;
let modalReturnFocus = null;
let posterObserver;
const posterCache = new Map();
const posterQueue = [];
let activePosterRequests = 0;
function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ selectedId, viewMode })); } catch { /* Preferences are optional. */ }
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}
const paths = {
  stack: 'M12 3 2 8l10 5 10-5-10-5ZM2 12l10 5 10-5M2 16l10 5 10-5',
  home: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  plus: 'M12 5v14M5 12h14', arrow: 'M5 12h14m-6-6 6 6-6 6',
  chevron: 'm6 9 6 6 6-6', search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  edit: 'm15 5 4 4M4 20l4-1L21 6l-4-4L4 15Z', more: 'M5 12h.01M12 12h.01M19 12h.01',
  grid: 'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',
  list: 'M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01',
  close: 'm6 6 12 12M6 18 18 6', download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  settings: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z',
  check: 'm5 12 4 4L19 6', external: 'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7',
  back: 'm12 5-7 7 7 7M5 12h15', shield: 'M12 3 3 6v6c0 5 9 9 9 9s9-4 9-9V6ZM8 12l3 3 5-6',
  film: 'M4 3h16v18H4ZM8 3v18M16 3v18M4 8h4M4 16h4M16 8h4M16 16h4'
};
function icon(name, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.film}"/></svg>`;
}
function count(c) {
  const items = c.sections.flatMap(g => g.items);
  const done = items.filter(i => i.status === 'done').length;
  return { all: items.length, done, percent: items.length ? Math.round(done / items.length * 100) : 0 };
}
function countGroup(g) { return count({ sections: [g] }); }
function getC() { return db.collections.find(c => c.id === selectedId); }
function getG(c, id) { return c?.sections.find(g => g.id === id); }
function getI(c, sid, iid) { return getG(c, sid)?.items.find(i => i.id === iid); }
function notify(message, canUndo = false) {
  const el = document.getElementById('toast');
  el.innerHTML = `<span>${esc(message)}</span>${canUndo && undoData ? '<button data-action="undo">실행 취소</button>' : ''}`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), canUndo ? 6500 : 3500);
}
function syncStorage(raw) {
  try {
    const incoming = raw === null ? { version: 1, collections: [] } : normalize(JSON.parse(raw));
    db = incoming; lastStoredRaw = raw; loadIssue = ''; undoData = null; revision++;
    render();
    notify('다른 창에서 변경한 기록을 반영했어요.');
  } catch {
    loadIssue = '다른 창에서 바뀐 기록을 읽을 수 없어요. 원본을 보호하고 있어요.';
    render();
  }
}
function commit(change, options = {}) {
  if (loadIssue && !options.repair) { notify('설정 및 백업에서 원본을 보관하고 복원해 주세요.'); return false; }
  const previous = JSON.stringify(db);
  try {
    const currentRaw = localStorage.getItem(STORAGE_KEY);
    if (currentRaw !== lastStoredRaw) {
      syncStorage(currentRaw);
      notify('다른 창의 변경을 먼저 반영했어요. 다시 시도해 주세요.');
      return false;
    }
    change();
    const next = JSON.stringify(db);
    // Preserve the exact pre-upgrade bytes. Never replace a damaged original silently.
    if (currentRaw !== null && localStorage.getItem(BACKUP_KEY) === null) localStorage.setItem(BACKUP_KEY, currentRaw);
    if (options.destructive && currentRaw !== null) localStorage.setItem(RESTORE_KEY, currentRaw);
    localStorage.setItem(STORAGE_KEY, next);
    lastStoredRaw = next; loadIssue = ''; revision++;
    undoData = options.undo === false ? null : previous;
    return true;
  } catch (error) {
    db = JSON.parse(previous);
    notify(error.message?.startsWith('limit:') ? error.message.slice(6) : '저장하지 못했어요. 기존 기록은 그대로예요. 백업 후 저장 공간을 확인해 주세요.');
    return false;
  }
}
function undo() {
  if (!undoData) return;
  const previous = undoData;
  if (commit(() => { db = JSON.parse(previous); }, { undo: false })) { render(); notify('마지막 변경을 취소했어요.'); }
}
function artwork(i) {
  const manual = safeUrl(i.posterUrl);
  const info = window.WATCHSTACK_CATALOG?.[i.title + '|' + i.year];
  return { url: manual || safeUrl(info?.posterUrl), source: manual ? '' : safeUrl(info?.sourceUrl) };
}
function poster(i, className = '', eager = false) {
  const art = artwork(i);
  return `<span class="poster-cover ${className}" data-title="${esc(i.title)}" data-year="${i.year || ''}" data-type="${esc(i.type)}"><span class="poster-fallback" aria-hidden="true">${icon('film', 24)}<span>${esc(i.title)}</span></span>${art.url ? `<img src="${esc(art.url)}" alt="" loading="${eager ? 'eager' : 'lazy'}" decoding="async" referrerpolicy="no-referrer">` : ''}</span>`;
}
function nav() {
  return `<aside class="sidebar" aria-label="주 메뉴">
    <button class="brand" data-action="home" aria-label="WATCHSTACK 홈"><span class="brand-mark">${icon('stack', 24)}</span><span>WATCHSTACK<small>나만의 시청 기록</small></span></button>
    <span class="side-label">나의 보관함</span>
    <button class="navbtn ${!selectedId ? 'active' : ''}" data-action="home" ${!selectedId ? 'aria-current="page"' : ''}>${icon('home')} 내 컬렉션</button>
    <div class="side-heading"><span class="side-label">컬렉션 <b>${db.collections.length}</b></span><button class="iconbtn" data-action="new-list" aria-label="새 컬렉션">${icon('plus', 18)}</button></div>
    <nav class="collection-nav" aria-label="컬렉션 목록">${db.collections.map(c => `<button class="side-col ${selectedId === c.id ? 'active' : ''}" data-action="select" data-cid="${esc(c.id)}" ${selectedId === c.id ? 'aria-current="page"' : ''}><span class="dot" style="background:${c.color}"></span><span class="cut">${esc(c.title)}</span><span class="mini-count">${count(c).all}</span></button>`).join('')}</nav>
    <button class="add-side" data-action="new-list">${icon('plus', 18)} 새 컬렉션 만들기</button>
    <div class="side-bottom"><div class="side-tip">${icon('shield')}<b>나의 기록, 나의 공간.</b><p>회원가입 없이 무료로.<br>이 브라우저에 저장돼요.</p></div><button class="navbtn" data-action="settings">${icon('settings')} 설정 및 백업</button><span class="nav-footer">WATCHSTACK 1.3 · 무료 PWA</span></div>
  </aside>`;
}
function topbar() {
  return `<header class="topline"><button class="mobile-brand" data-action="home" aria-label="WATCHSTACK 홈"><span class="brand-mark">${icon('stack', 21)}</span>WATCHSTACK</button><div class="breadcrumb"><button data-action="home">내 컬렉션</button>${selectedId ? `<span>/</span><span class="cut">${esc(getC()?.title)}</span>` : ''}</div><div class="top-actions"><span class="save-status ${loadIssue ? 'error' : ''}"><i></i>${loadIssue ? '기록 보호 중' : '이 기기에 자동 저장'}</span><button class="iconbtn" data-action="settings" aria-label="설정 및 백업">${icon('settings')}</button></div></header>`;
}
function bottomNav() {
  return `<nav class="bottom-nav" aria-label="빠른 메뉴"><button data-action="home" class="${!selectedId ? 'active' : ''}">${icon('home')}<span>내 컬렉션</span></button><button class="bottom-add" data-action="${selectedId ? 'new-item-global' : 'new-list'}">${icon('plus', 22)}<span>${selectedId ? '작품 추가' : '컬렉션 추가'}</span></button><button data-action="settings">${icon('shield')}<span>설정 및 백업</span></button></nav>`;
}
function findNext(c) {
  for (const g of c.sections) { const i = g.items.find(i => i.status !== 'done'); if (i) return { c, g, i }; }
}
function home() {
  const totals = db.collections.reduce((a, c) => { const n = count(c); a.all += n.all; a.done += n.done; return a; }, { all: 0, done: 0 });
  const next = db.collections.map(findNext).find(Boolean);
  const showcase = db.collections.flatMap(c => c.sections.flatMap(g => g.items)).filter(i => artwork(i).url).slice(0, 4);
  return `<section class="home-hero"><div class="hero-copy"><span class="eyebrow">MY WATCHSTACK</span><h1>좋은 이야기를<br><em>차곡차곡.</em></h1><p>보고 싶은 작품을 모으고,<br>함께한 이야기는 체크해 두세요.</p><button class="btn" data-action="new-list">${icon('plus', 18)} 새 컬렉션 만들기</button></div><div class="poster-deck" aria-hidden="true">${showcase.length ? showcase.map((i, index) => `<div class="deck-card deck-${index}">${poster(i, '', true)}</div>`).join('') : `<div class="hero-art">${icon('stack', 110)}<span>YOUR NEXT STORY</span></div>`}<span class="deck-caption">영화 · 드라마 · 애니메이션</span></div></section>
    <div class="stats" aria-label="전체 시청 현황"><div class="stat-card"><span>전체 작품</span><b>${totals.all}<small>편</small></b></div><div class="stat-card"><span><i class="status-dot"></i>봤다</span><b class="mint">${totals.done}<small>편</small></b></div><div class="stat-card"><span>아직 안 봤다</span><b>${totals.all - totals.done}<small>편</small></b></div></div>
    ${next ? `<button class="next-card" data-action="resume" data-cid="${esc(next.c.id)}" data-sid="${esc(next.g.id)}" data-iid="${esc(next.i.id)}">${poster(next.i)}<span class="next-copy"><span class="eyebrow">다음에 볼 이야기</span><strong>${esc(next.i.title)}</strong><span class="next-meta">${esc(next.c.title)} <span>· ${esc(next.g.title)}</span></span></span><span class="next-arrow">${icon('arrow', 22)}</span></button>` : ''}
    <div class="section-head"><div><span class="eyebrow">MY COLLECTIONS</span><h2>내 컬렉션 <span>${db.collections.length}</span></h2></div><button class="ghost-btn" data-action="new-list">${icon('plus', 18)} 새 컬렉션</button></div>
    ${db.collections.length > 3 ? `<label class="searchbox collection-search">${icon('search', 18)}<input id="collection-search" type="search" placeholder="컬렉션 이름으로 검색" aria-label="컬렉션 검색" value="${esc(collectionQuery)}"></label>` : ''}
    <div id="collection-cards">${collectionCards()}</div>
    <p class="privacy-note">${icon('shield', 15)} 기록은 이 브라우저에 저장돼요. 다른 기기로 옮길 때는 백업해 주세요.</p>`;
}
function collectionCards() {
  const collections = db.collections.filter(c => (c.title + ' ' + c.description).toLowerCase().includes(collectionQuery.toLowerCase()));
  if (!collections.length) return `<div class="empty-state">${icon('stack', 38)}<h3>${collectionQuery ? '찾는 컬렉션이 없어요' : '첫 이야기를 담아볼까요?'}</h3><p>${collectionQuery ? '다른 이름으로 검색해 보세요.' : '영화, 드라마, 애니메이션을 자유롭게 모아보세요.'}</p><button class="btn secondary" data-action="${collectionQuery ? 'clear-collection-search' : 'new-list'}">${collectionQuery ? '검색 지우기' : '컬렉션 만들기'}</button></div>`;
  return `<div class="collection-grid">${collections.map(c => {
    const n = count(c), covers = c.sections.flatMap(g => g.items).filter(i => artwork(i).url).slice(0, 4);
    return `<button class="collection-card" style="--cardcolor:${c.color}" data-action="select" data-cid="${esc(c.id)}"><span class="card-art">${covers.length ? `<span class="card-covers">${covers.map(i => poster(i)).join('')}</span>` : `<span class="card-large-icon">${esc(c.icon)}</span>`}<span class="card-badge">${esc(c.icon)}</span><span class="card-arrow">${icon('arrow', 18)}</span></span><span class="card-body"><strong>${esc(c.title)}</strong><span class="card-desc">${esc(c.description) || '나만의 시청 컬렉션'}</span><span class="card-meta"><span>${n.done}<span class="muted"> / ${n.all}편 봤다</span></span><b>${n.percent}%</b></span><span class="mini-progress"><span style="width:${n.percent}%"></span></span><span class="card-groups">${c.sections.length}개 그룹 <span>·</span> ${[...new Set(c.sections.flatMap(g => g.items.map(i => i.type)))].join(' · ') || '자유롭게 채워보세요'}</span></span></button>`;
  }).join('')}<button class="new-card" data-action="new-list"><span>${icon('plus', 26)}</span><strong>새로운 이야기를 담아보세요</strong><small>나만의 컬렉션 만들기</small></button></div>`;
}
function matches(i, g) {
  return (statusFilter === 'all' || i.status === statusFilter) && (typeFilter === 'all' || i.type === typeFilter) &&
    (!searchQuery || `${i.title} ${i.note} ${i.year || ''} ${g.title}`.toLowerCase().includes(searchQuery.toLowerCase()));
}
function hasFilters() { return !!searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || sectionFilter !== 'all'; }
function filteredSections(c) { return c.sections.filter(g => sectionFilter === 'all' || sectionFilter === g.id); }
function visibleCount(c) { return filteredSections(c).reduce((n, g) => n + g.items.filter(i => matches(i, g)).length, 0); }
function collectionPage(c) {
  const n = count(c), next = findNext(c);
  return `<button class="back-link" data-action="home">${icon('back', 16)} 내 컬렉션</button><section class="collection-hero" style="--collection-accent:${c.color}"><div class="collection-main-top"><span class="collection-bigicon">${esc(c.icon)}</span><div class="collection-heading"><span class="eyebrow">MY COLLECTION</span><h1>${esc(c.title)}</h1><p>${esc(c.description) || '보고 싶은 이야기를 나만의 순서로.'}</p></div><button class="ghost-btn" data-action="edit-list" aria-label="컬렉션 편집">${icon('edit', 17)}<span>편집</span></button></div><div class="collection-summary"><div class="summary-numbers"><strong>${n.done}<span> / ${n.all}편 봤다</span></strong><b>${n.percent}%</b></div><div class="track" role="progressbar" aria-label="시청 진행률" aria-valuenow="${n.percent}" aria-valuemin="0" aria-valuemax="100"><div style="width:${n.percent}%"></div></div><span class="progress-caption">${n.all ? n.all === n.done ? '모든 이야기를 함께했어요. 다음 컬렉션을 만들어볼까요?' : `다음 이야기까지, ${n.all - n.done}편이 기다려요.` : '첫 작품을 추가해 보세요.'}</span></div></section>
    <div class="collection-tools"><div class="filters" role="group" aria-label="시청 여부 필터">${[['all','전체',n.all],['plan','안 봤다',n.all-n.done],['done','봤다',n.done]].map(([v, text, num]) => `<button class="filter ${statusFilter === v ? 'active' : ''}" data-action="filter" data-filter="${v}" aria-pressed="${statusFilter === v}">${text}<span>${num}</span></button>`).join('')}</div><div class="view-toggle" role="group" aria-label="보기 방식"><button data-action="view" data-view="list" class="${viewMode === 'list' ? 'active' : ''}" aria-label="목록으로 보기" aria-pressed="${viewMode === 'list'}">${icon('list', 18)}</button><button data-action="view" data-view="grid" class="${viewMode === 'grid' ? 'active' : ''}" aria-label="포스터로 보기" aria-pressed="${viewMode === 'grid'}">${icon('grid', 18)}</button></div></div>
    <div class="search-tools"><label class="searchbox">${icon('search', 18)}<input id="searchbox" type="search" placeholder="작품, 메모, 그룹 검색" aria-label="작품 검색" value="${esc(searchQuery)}" autocomplete="off"></label><label class="selectbox"><span class="sr-only">작품 유형</span><select id="type-filter">${[['all','모든 유형'],...TYPES.map(t => [t,t])].map(([v,t]) => `<option value="${v}" ${typeFilter === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label class="selectbox group-select"><span class="sr-only">페이즈 또는 시즌</span><select id="section-filter"><option value="all">모든 그룹</option>${c.sections.map(g => `<option value="${esc(g.id)}" ${sectionFilter === g.id ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</select></label></div>
    <div class="list-heading"><span id="result-count">${visibleCount(c)}편${hasFilters() ? ' 검색 결과' : '의 이야기'} <span>· 체크하면 시청 완료</span></span><div><button class="text-btn" data-action="expand-all">모두 펼치기</button><button class="text-btn" data-action="new-section">${icon('plus', 15)} 그룹 추가</button></div></div>
    <div id="collection-results">${collectionResults(c)}</div>
    <div class="collection-footer"><button class="btn" data-action="new-item-global">${icon('plus', 18)} 작품 추가</button><button class="btn secondary" data-action="new-section">${icon('plus', 18)} 그룹 추가</button></div>
    ${next ? '' : n.all ? '<p class="privacy-note">차곡차곡 모은 이야기, 모두 봤어요.</p>' : ''}`;
}
function collectionResults(c) {
  const groups = filteredSections(c).filter(g => !hasFilters() || g.items.some(i => matches(i, g)));
  if (!groups.length) return `<div class="empty-state">${icon(hasFilters() ? 'search' : 'film', 38)}<h3>${hasFilters() ? '조건에 맞는 작품이 없어요' : '이 컬렉션의 첫 이야기를 담아보세요'}</h3><p>${hasFilters() ? '검색어나 시청 여부, 그룹을 바꿔 보세요.' : '페이즈, 시즌, 작품별로 그룹을 만들 수 있어요.'}</p><button class="btn secondary" data-action="${hasFilters() ? 'clear-filters' : 'new-item-global'}">${hasFilters() ? '필터 초기화' : '작품 추가'}</button></div>`;
  return `<div class="section-list ${viewMode === 'grid' ? 'gallery-view' : ''}">${groups.map(g => renderSection(c, g)).join('')}</div>`;
}
function renderSection(c, g) {
  const n = countGroup(g), entries = g.items.filter(i => matches(i, g));
  const isCollapsed = collapsed.has(g.id);
  return `<section class="phase-block ${isCollapsed ? 'collapsed' : ''}" aria-label="${esc(g.title)}"><div class="phase-top"><button class="phase-toggle" data-action="collapse" data-sid="${esc(g.id)}" aria-expanded="${!isCollapsed}" aria-controls="group-${esc(g.id)}">${icon('chevron', 18)}<span class="phase-main"><strong>${esc(g.title)}</strong><small>${esc(g.description) || '내가 정한 그룹'}</small></span><span class="phase-count"><b>${n.done}</b> / ${n.all}</span></button><button class="iconbtn" data-action="edit-section" data-sid="${esc(g.id)}" aria-label="${esc(g.title)} 그룹 편집">${icon('more')}</button></div><div class="phase-content" id="group-${esc(g.id)}" ${isCollapsed ? 'hidden' : ''}><div class="phase-items">${entries.map((i, index) => renderItem(c, g, i, g.items.indexOf(i) + 1)).join('')}</div>${!entries.length ? '<p class="noresults">아직 작품이 없어요. 첫 작품을 추가해 보세요.</p>' : ''}<button class="add-item-row" data-action="new-item" data-sid="${esc(g.id)}">${icon('plus', 16)} 이 그룹에 작품 추가</button></div></section>`;
}
function renderItem(c, g, i, order) {
  const done = i.status === 'done';
  return `<article class="media-row ${done ? 'row-watched' : ''}" data-item="${esc(i.id)}"><label class="watch-control"><input type="checkbox" data-watch data-sid="${esc(g.id)}" data-iid="${esc(i.id)}" aria-label="${esc(i.title)} 봤다" ${done ? 'checked' : ''}><span class="watch-box" aria-hidden="true">${icon('check', 17)}</span><span class="sr-only">봤다</span></label><button class="poster-button" data-action="details" data-sid="${esc(g.id)}" data-iid="${esc(i.id)}" aria-label="${esc(i.title)} 작품 정보">${poster(i)}</button><div class="media-detail"><span class="item-order">${String(order).padStart(2, '0')}</span><button class="media-title" data-action="details" data-sid="${esc(g.id)}" data-iid="${esc(i.id)}">${esc(i.title)}</button><div class="media-sub"><span>${esc(i.type)}</span>${i.year ? `<span class="sep">·</span><span>${i.year}</span>` : ''}<span class="watched-tag">${done ? '봤다' : '안 봤다'}</span></div>${i.note ? `<p class="media-note">${esc(i.note)}</p>` : ''}</div><button class="iconbtn item-menu" data-action="edit-item" data-sid="${esc(g.id)}" data-iid="${esc(i.id)}" aria-label="${esc(i.title)} 편집">${icon('more')}</button></article>`;
}
function captureFocus() {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  return { id: el.id, action: el.dataset.action, sid: el.dataset.sid, iid: el.dataset.iid, cid: el.dataset.cid, watch: el.hasAttribute('data-watch'), value: el.dataset.filter || el.dataset.view };
}
function restoreFocus(focus) {
  if (!focus) return;
  const el = focus.id ? document.getElementById(focus.id) : [...document.querySelectorAll(focus.watch ? '[data-watch]' : '[data-action]')].find(el => el.dataset.action === focus.action && el.dataset.sid === focus.sid && el.dataset.iid === focus.iid && el.dataset.cid === focus.cid && (!focus.value || el.dataset.filter === focus.value || el.dataset.view === focus.value));
  el?.focus({ preventScroll: true });
}
function render() {
  const focus = captureFocus();
  if (selectedId && !getC()) selectedId = null;
  const recovery = loadIssue ? `<div class="recovery-banner" role="alert"><span>${esc(loadIssue)}</span><button class="ghost-btn" data-action="settings">복구 및 백업</button></div>` : '';
  document.getElementById('app').innerHTML = `<div class="app-shell">${nav()}<main class="main" id="main-content">${topbar()}${recovery}${selectedId ? collectionPage(getC()) : home()}<footer class="page-footer"><span>WATCHSTACK</span><span>나만의 시청 기록 · 무료로, 차곡차곡.</span></footer></main>${bottomNav()}</div>`;
  savePrefs(); observePosters(); restoreFocus(focus);
}
function renderResults() {
  const c = getC(); if (!c) return;
  document.getElementById('collection-results').innerHTML = collectionResults(c);
  document.getElementById('result-count').innerHTML = `${visibleCount(c)}편${hasFilters() ? ' 검색 결과' : '의 이야기'} <span>· 체크하면 시청 완료</span>`;
  observePosters();
}
function resetFilters() { statusFilter = 'all'; typeFilter = 'all'; sectionFilter = 'all'; searchQuery = ''; collapsed.clear(); }
function selectList(id) {
  if (!db.collections.some(c => c.id === id)) return;
  selectedId = id; resetFilters(); render(); window.scrollTo({ top: 0 });
  document.querySelector('.collection-heading h1')?.setAttribute('tabindex', '-1');
  document.querySelector('.collection-heading h1')?.focus({ preventScroll: true });
}
function goHome() { selectedId = null; resetFilters(); render(); window.scrollTo({ top: 0 }); }

function modal(html) {
  if (!document.querySelector('#modal-root .modal')) modalReturnFocus = captureFocus();
  document.getElementById('modal-root').innerHTML = `<div class="modal-backdrop" data-action="backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1">${html}</section></div>`;
  document.getElementById('app').inert = true;
  document.body.classList.add('modal-open');
  const form = document.querySelector('#modal-root form');
  if (form) form.dataset.revision = String(revision);
  document.querySelectorAll('#modal-root .form-field').forEach((field, index) => {
    const label = field.querySelector('label'), input = field.querySelector('input:not([type="hidden"]),textarea,select');
    if (label && input && !label.contains(input)) {
      if (!input.id) input.id = 'dialog-field-' + index;
      label.htmlFor = input.id;
    }
  });
  document.querySelector('#modal-root .field, #modal-root button, #modal-root .modal')?.focus({ preventScroll: true });
  observePosters();
}
function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
  document.getElementById('app').inert = false;
  document.body.classList.remove('modal-open');
  restoreFocus(modalReturnFocus);
  modalReturnFocus = null;
}
function topModal(title, sub) {
  return `<div class="modal-head"><div><h2 id="dialog-title">${title}</h2><p class="modal-intro">${sub}</p></div><button class="modal-close iconbtn" data-action="close-modal" aria-label="닫기">${icon('close')}</button></div>`;
}
function listDialog(c){const edit=!!c;const current=c||{title:'',description:'',icon:'🎬',color:PALETTE[0]};
 modal(`${topModal(edit?'컬렉션 수정':'새 컬렉션 만들기','영화, 드라마, 애니 등을 원하는 방식으로 묶어보세요.')}
 <form data-form="list" data-cid="${edit?esc(c.id):''}">
 <div class="form-field"><label for="list-name">컬렉션 이름 *</label><input id="list-name" class="field" name="title" required maxlength="90" placeholder="예: 지브리 영화 정주행" value="${esc(current.title)}"></div>
 <div class="form-field"><label for="list-desc">설명 (선택)</label><textarea id="list-desc" name="description" maxlength="350" placeholder="이 컬렉션에 대해 간단히 적어보세요">${esc(current.description)}</textarea></div>
 <div class="form-field"><label>아이콘 선택</label><div class="emoji-select">${ICONS.map(i=>`<button type="button" class="emoji-option ${current.icon===i?'selected':''}" data-action="set-icon" data-icon="${esc(i)}">${i}</button>`).join('')}</div><input type="hidden" name="icon" value="${esc(current.icon)}"></div>
 <div class="form-field"><label>컬렉션 색상</label><div class="palette">${PALETTE.map(color=>`<button type="button" class="swatch ${current.color===color?'selected':''}" data-action="set-color" style="background:${color}" data-color="${color}" aria-label="${color}"></button>`).join('')}</div><input type="hidden" name="color" value="${current.color}"></div>
 <div class="modal-footer">${edit?`<button type="button" class="btn danger delete" data-action="delete-list" data-cid="${esc(c.id)}">삭제</button>`:''}<button type="button" class="btn secondary" data-action="close-modal">취소</button><button class="btn" type="submit">${edit?'저장하기':'컬렉션 만들기'}</button></div></form>`);
}
function sectionDialog(g){const edit=!!g;modal(`${topModal(edit?'그룹 편집':'새 그룹 추가','그룹으로 페이즈, 시즌, 장르, 시리즈 등을 구분할 수 있어요.')}
 <form data-form="section" data-sid="${edit?esc(g.id):''}"><div class="form-field"><label>그룹 이름 *</label><input class="field" name="title" maxlength="90" required placeholder="예: 시즌 1 / 페이즈 1 / 극장판" value="${esc(g?.title||'')}"></div>
 <div class="form-field"><label>부제목 (선택)</label><input class="field" name="description" maxlength="160" placeholder="예: 2021 ~ 2022" value="${esc(g?.description||'')}"></div>
 ${edit?`<div class="form-field"><label>목록에서 그룹 위치</label><div class="form-row"><button type="button" class="btn secondary" data-action="move-section" data-sid="${esc(g.id)}" data-dir="-1">↑ 위로 이동</button><button type="button" class="btn secondary" data-action="move-section" data-sid="${esc(g.id)}" data-dir="1">↓ 아래로 이동</button></div></div>`:''}
 <div class="modal-footer">${edit?`<button type="button" class="btn danger delete" data-action="delete-section" data-sid="${esc(g.id)}">그룹 삭제</button>`:''}<button class="btn secondary" type="button" data-action="close-modal">취소</button><button class="btn" type="submit">${edit?'저장하기':'추가하기'}</button></div></form>`);}
function itemDialog(c,g,item){if(!c || !c.sections.length){sectionDialog(null);notify('작품을 추가하려면 먼저 그룹을 만들어 주세요.');return;}
 const edit=!!item;const i=item||{title:'',type:'영화',year:'',status:'plan',note:'',posterUrl:'',wikiTitle:''};
 modal(`${topModal(edit?'작품 편집':'작품 추가','제목과 그룹만 정해도 바로 기록할 수 있어요.')}
 <form data-form="item" data-iid="${edit?esc(i.id):''}" data-old-sid="${edit?esc(g.id):''}">
 <div class="form-field"><label>작품 제목 *</label><input class="field" name="title" required maxlength="160" placeholder="예: 스파이더맨: 노 웨이 홈" value="${esc(i.title)}"></div>
 <div class="form-row"><div class="form-field"><label>유형</label><select name="type">${TYPES.map(t=>`<option value="${t}" ${i.type===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="form-field"><label>공개 연도</label><input class="field" type="number" inputmode="numeric" name="year" min="1880" max="2100" placeholder="예: 2025" value="${i.year??''}"></div></div>
 <div class="form-row"><div class="form-field"><label>넣을 그룹</label><select name="section">${c.sections.map(s=>`<option value="${esc(s.id)}" ${s.id===g?.id?'selected':''}>${esc(s.title)}</option>`).join('')}</select></div><div class="form-field check-field"><label><input type="checkbox" name="watched" value="yes" ${i.status==='done'?'checked':''}> 봤다</label></div></div>
 <div class="form-field"><label>표지 이미지 URL (선택)</label><input class="field" name="posterUrl" type="url" placeholder="https://... (이미지 주소)" value="${esc(i.posterUrl)}"><p class="input-hint">자동 이미지가 없는 경우 직접 지정할 수 있어요. 이미지 이용 권한을 확인해 주세요.</p></div>
 <div class="form-field"><label>나무위키 문서 제목 (선택)</label><input class="field" name="wikiTitle" maxlength="160" placeholder="비워두면 작품명으로 연결" value="${esc(i.wikiTitle)}"></div>
 <div class="form-field"><label>내 메모 (선택)</label><textarea name="note" maxlength="900" placeholder="기억할 내용, 기대 포인트 등">${esc(i.note)}</textarea></div>
 ${edit?`<div class="form-field"><label>목록 안에서 작품 순서</label><div class="form-row"><button type="button" class="btn secondary" data-action="move-item" data-sid="${esc(g.id)}" data-iid="${esc(i.id)}" data-dir="-1">↑ 위로 이동</button><button type="button" class="btn secondary" data-action="move-item" data-sid="${esc(g.id)}" data-iid="${esc(i.id)}" data-dir="1">↓ 아래로 이동</button></div></div>`:''}
 <div class="modal-footer">${edit?`<button type="button" class="btn danger delete" data-action="delete-item" data-sid="${esc(g.id)}" data-iid="${esc(i.id)}">삭제</button>`:''}<button class="btn secondary" type="button" data-action="close-modal">취소</button><button class="btn" type="submit">${edit?'저장하기':'작품 추가'}</button></div></form>`);
}
function detailsDialog(c, g, i) {
  const art = artwork(i), auto = posterCache.get(i.title + '|' + i.year + '|' + i.type);
  const source = art.source || auto?.source;
  modal(`${topModal('작품 정보', esc(g.title))}
    <div class="details-layout"><div class="details-art">${poster(i, '', true)}${source ? `<a class="art-source" href="${esc(source)}" target="_blank" rel="noopener noreferrer">이미지 출처 ↗</a>` : ''}</div><div class="details-copy"><span class="eyebrow">${esc(i.type)} ${i.year ? '· ' + i.year : ''}</span><h3>${esc(i.title)}</h3><label class="detail-check"><input type="checkbox" data-watch data-sid="${esc(g.id)}" data-iid="${esc(i.id)}" aria-label="${esc(i.title)} 봤다" ${i.status === 'done' ? 'checked' : ''}> 봤다</label><a class="wiki-link" target="_blank" rel="noopener noreferrer" href="https://namu.wiki/w/${encodeURIComponent(i.wikiTitle || i.title)}">나무위키에서 정보 보기 ${icon('external', 14)}</a><p class="input-hint">외부 문서에는 스포일러가 있을 수 있어요.</p></div></div>
    <div class="details-note"><span class="eyebrow">내 메모</span><p>${esc(i.note) || '아직 메모가 없어요. 기대되는 점이나 기억할 내용을 남겨보세요.'}</p></div><div class="modal-footer"><button class="btn secondary" data-action="close-modal">닫기</button><button class="btn" data-action="edit-item" data-sid="${esc(g.id)}" data-iid="${esc(i.id)}">${icon('edit', 17)} 작품 편집</button></div>`);
}
function storageValue(key) { try { return localStorage.getItem(key); } catch { return null; } }
function settingsDialog() {
  const totals = db.collections.reduce((sum, c) => sum + count(c).all, 0);
  modal(`${topModal('설정 및 백업', '컬렉션과 시청 기록을 안전하게 보관하세요.')}
    ${loadIssue ? `<div class="recovery-banner" role="alert">${esc(loadIssue)}</div><div class="backup-panel"><h3>읽기 전 원본 보관</h3><p>잘못된 데이터도 덮어쓰지 않았어요. 원본을 먼저 내려받아 보관할 수 있어요.</p><button class="btn secondary" data-action="export-original">저장된 원본 내려받기</button></div>` : ''}
    <div class="backup-panel"><div class="panel-heading">${icon('shield')}<h3>내 기록 백업</h3><span>${db.collections.length}개 컬렉션 · ${totals}편</span></div><p>목록, 체크, 포스터 주소, 메모를 JSON 파일로 보관해요.<br>다른 기기로 옮길 때도 이 파일 하나면 돼요.</p><div class="backup-actions"><button class="btn" data-action="export-data">${icon('download', 17)} 백업 내려받기</button><button class="btn secondary" data-action="import-data">백업 가져오기</button></div><input id="import-file" class="hidden" type="file" accept=".json,application/json"><p class="input-hint">가져오기는 먼저 내용을 확인하고, 기존 목록에 추가할 수 있어요.</p></div>
    ${storageValue(BACKUP_KEY) !== null || storageValue(RESTORE_KEY) !== null ? `<div class="backup-panel"><h3>자동 복구 사본</h3><p>업데이트 전 원본과 최근 삭제·교체 전 기록을 보관해요. 사본을 확인한 뒤 복원할 수 있어요.</p>${storageValue(BACKUP_KEY) !== null ? '<button class="btn secondary" data-action="recovery" data-key="upgrade">업데이트 전 사본 확인</button>' : ''}${storageValue(RESTORE_KEY) !== null ? '<button class="btn secondary" data-action="recovery" data-key="replace">삭제·교체 전 사본 확인</button>' : ''}</div>` : ''}
    <div class="backup-panel"><h3>앱처럼 사용하기</h3><p>아이패드·아이폰 Safari에서 <b>공유 → 홈 화면에 추가</b>를 누르세요. 처음 연 뒤에는 오프라인에서도 목록을 확인하고 체크할 수 있어요.</p><button class="btn secondary" data-action="install-pwa">앱 설치 안내</button><p class="input-hint">새로 불러오는 포스터와 외부 문서는 인터넷 연결이 필요해요.</p></div>
    <div class="backup-panel"><h3>MCU 필수 시청 로드맵</h3><p>기존과 같은 23편을 페이즈 1~6으로 담았어요. 현재 목록을 건드리지 않고 새 컬렉션으로 추가해요.</p><button class="btn secondary" data-action="readd-mcu">MCU 23편 새로 추가</button></div>
    <p class="storage-explanation">회원가입·서버 동기화 없이 무료로 사용해요. 기록은 이 기기의 이 브라우저에 저장돼요. 브라우저 데이터를 지우기 전에는 꼭 백업해 주세요.</p><div class="modal-footer"><button class="btn secondary" data-action="close-modal">닫기</button></div>`);
}
function download(text, filename) {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('백업 파일을 준비했어요. 다운로드한 파일을 보관해 주세요.');
  } catch { notify('파일을 준비하지 못했어요. 브라우저의 다운로드 설정을 확인해 주세요.'); }
}
function fileExport() { download(JSON.stringify(db, null, 2), 'watchstack-backup-' + new Date().toISOString().slice(0, 10) + '.json'); }
let pendingImport = null;
function previewImport(raw, filename = '백업 파일') {
  const incoming = normalize(JSON.parse(raw));
  pendingImport = incoming;
  const works = incoming.collections.reduce((n, c) => n + count(c).all, 0);
  modal(`${topModal('백업 내용 확인', esc(filename))}<div class="import-summary"><b>${incoming.collections.length}개 컬렉션</b><span>총 ${works}편의 작품과 시청 기록</span></div><ul class="import-list">${incoming.collections.slice(0, 12).map(c => `<li><span>${esc(c.icon)} ${esc(c.title)}</span><small>${count(c).done} / ${count(c).all}편 봤다</small></li>`).join('')}</ul><form data-form="import"><fieldset class="import-options"><legend>어떻게 가져올까요?</legend><label><input type="radio" name="mode" value="merge" checked><span><b>기존 목록에 추가</b><small>현재 기록을 그대로 두고 새 컬렉션으로 추가해요.</small></span></label><label><input type="radio" name="mode" value="replace"><span><b>전체 교체</b><small>현재 ${db.collections.length}개 컬렉션을 이 백업으로 바꿔요. 변경 전 자동 사본을 남겨요.</small></span></label></fieldset><div class="modal-footer"><button class="btn secondary" type="button" data-action="close-modal">취소</button><button class="btn" type="submit">가져오기</button></div></form>`);
}
function fileImport(file) {
  if (!file) return;
  if (file.size > 7 * 1024 * 1024) { notify('7MB 이하의 JSON 파일만 가져올 수 있어요.'); return; }
  const reader = new FileReader();
  reader.onload = () => { try { previewImport(reader.result, file.name); } catch (error) { notify(error.message || '올바른 JSON 백업 파일인지 확인해 주세요.'); } };
  reader.onerror = () => notify('파일을 읽지 못했어요.');
  reader.readAsText(file, 'utf-8');
}
async function fetchPoster(title, year, type) {
  const key = title + '|' + year + '|' + type;
  if (posterCache.has(key)) return posterCache.get(key);
  // Limit free public lookups and deduplicate requests across re-renders.
  const promise = new Promise(resolve => { posterQueue.push({ title, year, key, resolve }); });
  posterCache.set(key, promise);
  drainPosterQueue();
  return promise;
}
function drainPosterQueue() {
  while (activePosterRequests < 3 && posterQueue.length) {
    const job = posterQueue.shift(); activePosterRequests++;
    lookupPoster(job).then(result => {
      posterCache.set(job.key, result); job.resolve(result);
      if (posterCache.size > 300) posterCache.delete(posterCache.keys().next().value);
    }).finally(() => { activePosterRequests--; drainPosterQueue(); });
  }
}
async function lookupPoster({ title, year }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const url = new URL('https://ko.wikipedia.org/w/api.php');
    Object.entries({ action: 'query', generator: 'search', gsrsearch: title + ' ' + (year || ''), gsrlimit: '1',
      prop: 'pageimages|info', inprop: 'url', piprop: 'thumbnail', pithumbsize: '240', pilicense: 'free', format: 'json', origin: '*' }).forEach(([k, v]) => url.searchParams.set(k, v));
    const response = await fetch(url, { signal: controller.signal, credentials: 'omit' });
    if (!response.ok) return null;
    const data = await response.json(), page = Object.values(data.query?.pages || {})[0];
    const image = safeUrl(page?.thumbnail?.source);
    return image ? { url: image, source: safeUrl(page?.fullurl) } : null;
  } catch { return null; } finally { clearTimeout(timer); }
}
function observePosters() {
  posterObserver?.disconnect();
  document.querySelectorAll('.poster-cover img').forEach(img => img.addEventListener('error', () => img.remove(), { once: true }));
  const reveal = async el => {
    if (!el.isConnected || el.querySelector('img')) return;
    const result = await fetchPoster(el.dataset.title, el.dataset.year, el.dataset.type);
    if (!el.isConnected || !result || el.querySelector('img')) return;
    const img = document.createElement('img');
    img.src = result.url; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => img.remove(), { once: true });
    el.appendChild(img);
    const detailsArt = el.closest('.details-art');
    if (detailsArt && result.source && !detailsArt.querySelector('.art-source')) {
      const link = document.createElement('a');
      link.className = 'art-source'; link.href = result.source; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.textContent = '이미지 출처 ↗'; detailsArt.appendChild(link);
    }
  };
  const posters = [...document.querySelectorAll('.poster-cover')].filter(el => !el.querySelector('img'));
  if (!('IntersectionObserver' in window)) { posters.slice(0, 20).forEach(reveal); return; }
  posterObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { posterObserver.unobserve(entry.target); reveal(entry.target); }
  }), { rootMargin: '120px' });
  posters.forEach(el => posterObserver.observe(el));
}
function afterSave(message) { closeModal(); render(); notify(message, true); }
function handleAction(btn, event) {
  const { action, cid, sid, iid } = btn.dataset;
  const c = getC(), g = getG(c, sid), i = getI(c, sid, iid);
  if (action === 'home') return goHome();
  if (action === 'select') return selectList(cid);
  if (action === 'resume') {
    selectList(cid);
    document.querySelectorAll('[data-item]').forEach(el => {
      if (el.dataset.item === iid) {
        el.scrollIntoView?.({ block: 'center', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        el.classList.add('highlight'); el.querySelector('[data-watch]')?.focus({ preventScroll: true });
      }
    });
    return;
  }
  if (action === 'new-list') return listDialog(null);
  if (action === 'edit-list') return c && listDialog(c);
  if (action === 'new-section') return c && sectionDialog(null);
  if (action === 'edit-section') return g && sectionDialog(g);
  if (action === 'new-item' || action === 'new-item-global') return c && itemDialog(c, g || c.sections[0], null);
  if (action === 'edit-item') return i && itemDialog(c, g, i);
  if (action === 'details') return i && detailsDialog(c, g, i);
  if (action === 'settings') return settingsDialog();
  if (action === 'close-modal') return closeModal();
  if (action === 'backdrop') { if (event.target === btn) closeModal(); return; }
  if (action === 'undo') return undo();
  if (action === 'filter') { statusFilter = btn.dataset.filter; collapsed.clear(); return render(); }
  if (action === 'view') { viewMode = btn.dataset.view; return render(); }
  if (action === 'clear-filters') { resetFilters(); return render(); }
  if (action === 'clear-collection-search') { collectionQuery = ''; return render(); }
  if (action === 'expand-all') { collapsed.clear(); return renderResults(); }
  if (action === 'collapse') { collapsed.has(sid) ? collapsed.delete(sid) : collapsed.add(sid); renderResults(); restoreFocus({ action, sid }); return; }
  if (action === 'set-color' || action === 'set-icon') {
    const form = btn.closest('form'), prop = action === 'set-color' ? 'color' : 'icon';
    form.elements[prop].value = btn.dataset[prop];
    form.querySelectorAll(action === 'set-color' ? '.swatch' : '.emoji-option').forEach(el => { el.classList.toggle('selected', el === btn); el.setAttribute('aria-pressed', String(el === btn)); });
    return;
  }
  if (['move-item', 'move-section'].includes(action)) {
    const list = action === 'move-item' ? g?.items : c?.sections, id = action === 'move-item' ? iid : sid;
    if (!list) return;
    const from = list.findIndex(el => el.id === id), to = from + Number(btn.dataset.dir);
    if (from < 0 || to < 0 || to >= list.length) return notify('더 이상 이동할 수 없어요.');
    if (!confirmDiscardIfDirty()) return;
    if (commit(() => { [list[from], list[to]] = [list[to], list[from]]; })) afterSave('순서를 바꿨어요.');
    return;
  }
  if (action === 'delete-item' && i) {
    if (confirm('‘' + i.title + '’ 작품을 삭제할까요?') && commit(() => { g.items = g.items.filter(x => x.id !== iid); }, { destructive: true })) afterSave('작품을 삭제했어요.');
    return;
  }
  if (action === 'delete-section' && g) {
    if (confirm('‘' + g.title + '’ 그룹과 작품 ' + g.items.length + '편을 삭제할까요?') && commit(() => { c.sections = c.sections.filter(x => x.id !== sid); }, { destructive: true })) afterSave('그룹을 삭제했어요.');
    return;
  }
  if (action === 'delete-list') {
    const target = db.collections.find(x => x.id === cid);
    if (target && confirm('‘' + target.title + '’ 컬렉션과 모든 작품을 삭제할까요?') && commit(() => { db.collections = db.collections.filter(x => x.id !== cid); }, { destructive: true })) afterSave('컬렉션을 삭제했어요.');
    return;
  }
  if (action === 'export-data') return fileExport();
  if (action === 'export-original') {
    const raw = storageValue(STORAGE_KEY); return raw === null ? notify('저장된 원본을 읽을 수 없어요.') : download(raw, 'watchstack-original.json');
  }
  if (action === 'import-data') {
    const input = document.getElementById('import-file'); if (input) { input.value = ''; input.click(); } return;
  }
  if (action === 'recovery') {
    const raw = storageValue(btn.dataset.key === 'upgrade' ? BACKUP_KEY : RESTORE_KEY);
    try { previewImport(raw, '자동 복구 사본'); } catch { if (raw !== null) download(raw, 'watchstack-recovery-original.json'); notify('사본을 바로 읽을 수 없어 원본 파일을 준비했어요.'); }
    return;
  }
  if (action === 'readd-mcu') {
    if (db.collections.length >= 300) return notify('컬렉션은 최대 300개까지 만들 수 있어요.');
    const added = initialMCU();
    if (commit(() => db.collections.push(added))) { closeModal(); selectList(added.id); notify('MCU 23편을 새 컬렉션에 담았어요.', true); } return;
  }
  if (action === 'install-pwa') {
    if (beforeInstallPrompt) { beforeInstallPrompt.prompt(); beforeInstallPrompt.userChoice.finally(() => { beforeInstallPrompt = null; }); return; }
    modal(`${topModal('홈 화면에 WATCHSTACK 추가', '아이패드와 아이폰에서 앱처럼 편하게 열어보세요.')}<ol class="install-steps"><li>이 사이트를 <b>Safari</b>에서 열어요.</li><li>공유 버튼을 눌러요.</li><li><b>홈 화면에 추가</b> → <b>추가</b>를 눌러요.</li></ol><p class="storage-explanation">같은 기기에서도 브라우저나 설치 방식에 따라 저장 공간이 다를 수 있어요. 설치 전 백업하고, 필요한 경우 새 앱에서 가져와 주세요.</p><div class="modal-footer"><button class="btn" data-action="close-modal">알겠어요</button></div>`); return;
  }
  if (action === 'install-update') {
    if (document.querySelector('#modal-root form')) return notify('입력 중인 내용을 먼저 저장하거나 창을 닫아 주세요.');
    if (reloadPending) location.reload();
    else pendingWorker?.postMessage({ type: 'SKIP_WAITING' });
  }
}
let modalInitialValues = '';
function formValues(form) { return JSON.stringify([...new FormData(form).entries()]); }
function confirmDiscardIfDirty() {
  const form = document.querySelector('#modal-root form');
  return !form || !modalInitialValues || formValues(form) === modalInitialValues || confirm('수정한 내용은 저장되지 않았어요. 순서만 바꿀까요?');
}
document.addEventListener('click', event => {
  const btn = event.target.closest('[data-action]'); if (!btn) return;
  if (btn.dataset.action === 'backdrop' && event.target !== btn) return;
  if (btn.tagName === 'BUTTON') event.preventDefault();
  handleAction(btn, event);
  const form = document.querySelector('#modal-root form');
  if (form && !form.dataset.initialized) { form.dataset.initialized = 'true'; modalInitialValues = formValues(form); }
});
document.addEventListener('keydown', event => {
  const dialog = document.querySelector('#modal-root .modal');
  if (!dialog) return;
  if (event.key === 'Escape') { event.preventDefault(); closeModal(); return; }
  if (event.key === 'Tab') {
    const focusable = [...dialog.querySelectorAll('button:not(:disabled),input:not([type="hidden"]):not(:disabled),select,textarea,a[href]')];
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});
document.addEventListener('change', event => {
  const target = event.target;
  if (target.id === 'import-file') return fileImport(target.files?.[0]);
  if (target.id === 'type-filter') { typeFilter = target.value; collapsed.clear(); renderResults(); return; }
  if (target.id === 'section-filter') { sectionFilter = target.value; collapsed.clear(); renderResults(); return; }
  if (target.hasAttribute('data-watch')) {
    const c = getC(), i = getI(c, target.dataset.sid, target.dataset.iid);
    if (!i) return;
    const checked = target.checked, focus = captureFocus();
    if (commit(() => { i.status = checked ? 'done' : 'plan'; })) {
      render();
      if (document.querySelector('#modal-root .detail-check')) {
        const detail = document.querySelector('#modal-root [data-watch]'); if (detail) detail.checked = checked;
      }
      restoreFocus(focus); notify(checked ? '봤다! 다음 이야기로 가볼까요?' : '안 봤다로 바꿨어요.', true);
    } else { target.checked = getI(getC(), target.dataset.sid, target.dataset.iid)?.status === 'done'; render(); }
  }
});
document.addEventListener('input', event => {
  if (event.target.id === 'searchbox') { searchQuery = event.target.value; collapsed.clear(); renderResults(); }
  if (event.target.id === 'collection-search') { collectionQuery = event.target.value; document.getElementById('collection-cards').innerHTML = collectionCards(); observePosters(); }
});
document.addEventListener('submit', event => {
  const form = event.target.closest('form[data-form]'); if (!form) return;
  event.preventDefault();
  if (!form.reportValidity()) return;
  if (Number(form.dataset.revision) !== revision) { notify('다른 창에서 기록이 바뀌었어요. 편집 창을 다시 열어 주세요.'); return; }
  const data = Object.fromEntries(new FormData(form).entries());
  if (['list','section','item'].includes(form.dataset.form) && !clean(data.title)) { notify('공백 대신 제목을 입력해 주세요.'); form.elements.title.focus(); return; }
  let nextSelected = selectedId;
  const success = commit(() => {
    const c = getC();
    if (form.dataset.form === 'list') {
      const edited = db.collections.find(x => x.id === form.dataset.cid);
      const values = { title: clean(data.title, 90), description: clean(data.description, 350), icon: clean(data.icon, 12) || '🎬', color: PALETTE.includes(data.color) ? data.color : PALETTE[0] };
      if (edited) Object.assign(edited, values);
      else {
        if (db.collections.length >= 300) throw new Error('limit:컬렉션은 최대 300개까지 만들 수 있어요.');
        const added = { id: uid(), ...values, sections: [{ id: uid(), title: '기본 목록', description: '', items: [] }] };
        db.collections.push(added); nextSelected = added.id;
      }
    }
    if (form.dataset.form === 'section' && c) {
      const edited = getG(c, form.dataset.sid), values = { title: clean(data.title, 90), description: clean(data.description, 160) };
      if (edited) Object.assign(edited, values); else { if (c.sections.length >= 300) throw new Error('limit:그룹은 컬렉션마다 최대 300개까지 만들 수 있어요.'); c.sections.push({ id: uid(), ...values, items: [] }); }
    }
    if (form.dataset.form === 'item' && c) {
      const old = getG(c, form.dataset.oldSid), item = old?.items.find(i => i.id === form.dataset.iid), target = getG(c, data.section);
      if (!target || (target.items.length >= 1500 && target !== old)) throw new Error('limit:그룹이 없거나 그룹당 최대 1,500편을 넘었어요.');
      const updated = { ...item, id: item?.id || uid(), title: clean(data.title, 160), type: TYPES.includes(data.type) ? data.type : '기타',
        year: data.year ? parseInt(data.year, 10) : null, status: data.watched === 'yes' ? 'done' : 'plan', posterUrl: safeUrl(data.posterUrl), wikiTitle: clean(data.wikiTitle, 160), note: clean(data.note, 900) };
      const index = item ? old.items.findIndex(i => i.id === item.id) : -1;
      if (item) old.items.splice(index, 1);
      if (item && old === target) target.items.splice(index, 0, updated); else target.items.push(updated);
    }
    if (form.dataset.form === 'import') {
      if (!pendingImport) throw new Error('missing');
      if (data.mode === 'replace') db = normalize(pendingImport);
      else {
        const imported = normalize(pendingImport, true);
        if (db.collections.length + imported.collections.length > 300) throw new Error('limit:합친 컬렉션이 300개를 넘어요. 일부 컬렉션만 담긴 백업을 가져와 주세요.');
        db.collections.push(...imported.collections);
      }
      nextSelected = null;
    }
  }, { repair: form.dataset.form === 'import', destructive: form.dataset.form === 'import', undo: !loadIssue });
  if (success) { selectedId = nextSelected; pendingImport = null; resetFilters(); afterSave(form.dataset.form === 'import' ? '백업을 가져왔어요.' : '저장했어요.'); }
});
window.addEventListener('storage', event => { if (event.key === STORAGE_KEY || event.key === null) syncStorage(event.newValue); });
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); beforeInstallPrompt = event; });
let pendingWorker = null;
let reloadPending = false;
function showUpdate(worker) {
  pendingWorker = worker;
  const banner = document.getElementById('update-banner'); if (!banner) return;
  banner.hidden = false;
  banner.innerHTML = '<span>새 버전이 준비됐어요. 저장된 기록은 유지돼요.</span><button class="btn secondary" data-action="install-update">업데이트</button>';
}
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  let refreshing = false;
  let hasHadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // First installation already has the current shell; claiming it must not reload a form.
    if (!hasHadController && !pendingWorker) { hasHadController = true; return; }
    hasHadController = true;
    if (refreshing) return;
    // An update accepted in another tab can also change this tab's controller.
    if (document.querySelector('#modal-root form')) { reloadPending = true; showUpdate(null); return; }
    refreshing = true; location.reload();
  });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(registration => {
    if (registration.waiting) showUpdate(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(worker); });
    });
  }).catch(() => { /* The checklist continues to work if offline installation is unavailable. */ });
}
render();
})();
