(() => {
'use strict';
const STORAGE_KEY = 'watchstack_library_v1';
const PALETTE = ['#a393ff','#f39b9d','#74cdbd','#ebbb74','#78b2f6','#dc9cf0'];
const ICONS = ['🎬','🍿','📺','🌙','🌸','⭐','🎮','🎧','🚀','📚','🪐','🎨'];
const TYPES = ['영화','드라마','애니','기타'];
const STATUSES = ['plan','watching','done'];
const STATUS_TEXT = {plan:'볼 예정',watching:'보는 중',done:'완료'};
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
     items:g.items.map(x=>({id:uid(),title:x[0],year:x[1],type:x[2],status:x[3]||'plan',watchedEpisodes:0,totalEpisodes:0,note:''}))
   }))
 };
}
function seed(){return {version:1,collections:[initialMCU()]}}
function normalize(raw){
 if(!raw || !Array.isArray(raw.collections) || raw.collections.length>300) throw new Error('지원하지 않는 백업 파일입니다.');
 const collections=raw.collections.map(c=>({id:uid(),title:clean(c.title,90)||'이름 없는 컬렉션',description:clean(c.description,350),icon:ICONS.includes(c.icon)?c.icon:clean(c.icon,3)||'🎬',color:PALETTE.includes(c.color)?c.color:PALETTE[0],sections:(Array.isArray(c.sections)?c.sections:[]).slice(0,300).map(g=>({id:uid(),title:clean(g.title,90)||'목록',description:clean(g.description,160),items:(Array.isArray(g.items)?g.items:[]).slice(0,1500).map(i=>({id:uid(),title:clean(i.title,160)||'제목 없음',type:TYPES.includes(i.type)?i.type:'기타',year:Number.isInteger(+i.year)&&+i.year>=1880&&+i.year<=2100?+i.year:null,status:STATUSES.includes(i.status)?i.status:'plan',watchedEpisodes:Math.max(0,Math.min(99999,parseInt(i.watchedEpisodes,10)||0)),totalEpisodes:Math.max(0,Math.min(99999,parseInt(i.totalEpisodes,10)||0)),note:clean(i.note,900)}))}))}));
 return {version:1,collections};
}
function load(){try{const saved=localStorage.getItem(STORAGE_KEY);if(saved)return normalizePreserveIds(JSON.parse(saved));}catch(e){console.warn('저장된 데이터를 불러올 수 없습니다:',e)}return seed();}
function normalizePreserveIds(obj){const result=normalize(obj);(obj.collections||[]).forEach((c,ci)=>{const dst=result.collections[ci];if(!dst)return;dst.id=clean(c.id,100)||dst.id;(c.sections||[]).forEach((s,si)=>{const t=dst.sections[si];if(!t)return;t.id=clean(s.id,100)||t.id;(s.items||[]).forEach((i,ii)=>{if(t.items[ii])t.items[ii].id=clean(i.id,100)||t.items[ii].id;});});});return result;}
let db=load();
let selectedId=null;
let statusFilter='all';
let typeFilter='all';
let searchQuery='';
let collapsed=new Set();
let sidebarOpen=false;
let beforeInstallPrompt=null;
let toastTimer;
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(db));}catch(e){notify('저장 공간이 부족합니다. 백업 파일을 내려받아 주세요.')}}
function esc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function count(c){let all=0,done=0,watching=0;for(const s of c.sections)for(const i of s.items){all++;if(i.status==='done')done++;if(i.status==='watching')watching++;}return {all,done,watching,percent:all?Math.round(done/all*100):0};}
function countGroup(g){let done=0;for(const i of g.items)if(i.status==='done')done++;return {all:g.items.length,done,percent:g.items.length?Math.round(done/g.items.length*100):0};}
function getC(){return db.collections.find(c=>c.id===selectedId)}
function getG(c,sid){return c?.sections.find(g=>g.id===sid)}
function getI(c,sid,iid){return getG(c,sid)?.items.find(i=>i.id===iid)}
function notify(msg){let t=document.getElementById('toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2600)}
function nav(){return `<aside class="sidebar ${sidebarOpen?'open':''}">
  <div class="brand"><div class="brand-mark">▣</div><div>WATCHSTACK<small>YOUR STORY TRACKER</small></div></div>
  <div class="side-label">MY SPACE</div>
  <button class="navbtn ${!selectedId?'active':''}" data-action="home"><span class="leftic">▦</span> 내 대시보드</button>
  <div class="side-break"></div>
  <div class="side-label">COLLECTIONS <span style="float:right">${db.collections.length}</span></div>
  <div class="collection-nav">${db.collections.map(c=>`<button class="side-col ${selectedId===c.id?'active':''}" data-action="select" data-cid="${esc(c.id)}"><span class="dot" style="background:${c.color}"></span><span class="cut">${esc(c.title)}</span><span class="mini-count">${count(c).all}</span></button>`).join('')}</div>
  <button class="add-side" data-action="new-list">＋ 새 컬렉션 만들기</button>
  <div class="side-bottom"><div class="side-tip"><b>✦ 어떤 이야기도 기록하세요</b><p>영화 · 드라마 · 애니 · 기타 콘텐츠를 나만의 리스트로 관리할 수 있어요.</p></div>
    <div class="side-footer-actions"><button class="ghost-btn" data-action="settings">⚙ 설정 및 백업</button></div>
    <div class="nav-footer">v1.0 · 데이터는 이 기기에 저장돼요</div>
  </div></aside><div class="side-screen ${sidebarOpen?'open':''}" data-action="close-menu"></div>`}
function topbar(){return `<div class="topline"><div class="mobile-header"><button class="menu-btn" data-action="menu" aria-label="메뉴 열기">☰</button><div class="brand"><div class="brand-mark">▣</div>WATCHSTACK</div></div><div class="desktop-breadcrumb breadcrumb">MY SPACE &nbsp;/&nbsp; <span>${selectedId?esc(getC()?.title||'목록'):'대시보드'}</span></div><div class="top-actions"><span class="pill">● &nbsp;이 기기에 자동 저장</span><button class="ghost-btn" data-action="settings" title="설정 및 백업">⚙ <span class="desktop-text">설정</span></button></div></div>`}
function home(){
 const all=db.collections.reduce((a,c)=>{const n=count(c);a.total+=n.all;a.done+=n.done;a.watching+=n.watching;return a},{total:0,done:0,watching:0});
 const upcoming=db.collections.flatMap(c=>c.sections.flatMap(s=>s.items.filter(i=>i.status==='watching').map(i=>({i,c}))));
 return `<div class="home-hero"><div class="hero-glow">◈</div><div class="hero-content"><span class="lead-label">YOUR WATCH JOURNEY</span><h1 class="hero-title">보고 싶은 이야기,<br><em>놓치지 말고 기록해요.</em></h1><p class="lead-desc">영화부터 드라마, 애니메이션까지. 나만의 리스트를 만들고, 한 작품씩 채워가는 즐거움을 느껴보세요.</p></div></div>
 <div class="stats"><div class="stat-card"><span class="stat-label">전체 작품</span><span class="stat-number">${all.total}</span><span class="stat-extra">작품</span></div><div class="stat-card"><span class="stat-label">시청 완료</span><span class="stat-number" style="color:var(--green)">${all.done}</span><span class="stat-extra">작품</span></div><div class="stat-card"><span class="stat-label">보는 중</span><span class="stat-number" style="color:var(--orange)">${all.watching}</span><span class="stat-extra">작품</span></div></div>
 ${upcoming.length?`<div class="section-head"><div><h2>▶ 이어서 보기</h2><p>지금 보고 있는 작품들이에요</p></div></div><div class="upnext">${upcoming.slice(0,14).map(({i,c})=>`<button class="up-card" data-action="select" data-cid="${esc(c.id)}"><div class="up-tag">${esc(c.icon)} ${esc(c.title)}</div><b>${esc(i.title)}</b><span>${esc(i.type)} ${i.totalEpisodes?`· ${i.watchedEpisodes}/${i.totalEpisodes}화`:''}</span></button>`).join('')}</div>`:''}
 <div class="section-head"><div><h2>내 컬렉션</h2><p>누르면 시청 리스트를 관리할 수 있어요</p></div><button class="btn" data-action="new-list">＋ 새 컬렉션</button></div>
 ${db.collections.length?`<div class="collection-grid">${db.collections.map(c=>{const n=count(c);return `<button class="collection-card" style="--cardcolor:${c.color}" data-action="select" data-cid="${esc(c.id)}"><div class="card-top"><span class="card-icon">${esc(c.icon)}</span><span class="card-arrow">↗</span></div><h3>${esc(c.title)}</h3><p>${esc(c.description)||'나만의 시청 목록'}</p><div class="mini-progress"><div class="mini-fill" style="width:${n.percent}%"></div></div><div class="card-meta"><span>${n.done} / ${n.all} 작품 완료</span><span>${n.percent}%</span></div></button>`}).join('')}</div>`:`<div class="empty-state"><span class="large-emoji">🍿</span>아직 컬렉션이 없어요.<br>첫 번째 시청 목록을 만들어보세요!</div>`}
 <p class="shortcut">🔒 회원가입이나 서버 없이 사용하며, 백업 파일로 다른 기기에 옮길 수 있어요.</p>`;
}
function matches(i){return (statusFilter==='all'||i.status===statusFilter)&&(typeFilter==='all'||i.type===typeFilter)&&(!searchQuery||`${i.title} ${i.note} ${i.year||''}`.toLowerCase().includes(searchQuery.toLowerCase()));}
function collectionPage(c){const n=count(c),visible=c.sections.reduce((a,s)=>a+s.items.filter(matches).length,0);
 return `<div class="collection-hero" style="--collection-accent:${c.color}"><div class="collection-main-top"><div class="collection-bigicon">${esc(c.icon)}</div><div><div class="collection-tag">✧ CUSTOM COLLECTION</div><h1 class="collection-name">${esc(c.title)}</h1><p class="collection-sub">${esc(c.description)||'나만의 이야기를 정리하는 공간'}</p></div><div class="collection-head-right"><button class="ghost-btn" data-action="edit-list" data-cid="${esc(c.id)}">✎ 컬렉션 편집</button></div></div>
  <div class="collection-progress"><div class="track"><div class="fill" style="width:${n.percent}%"></div></div><span class="progress-text">${n.done} / ${n.all} 완료 · ${n.percent}%</span></div></div>
  <div class="toolbar"><div class="filters">${[['all','전체'],['plan','볼 예정'],['watching','보는 중'],['done','완료']].map(([v,t])=>`<button class="filter ${statusFilter===v?'active':''}" data-action="filter" data-filter="${v}">${t}</button>`).join('')}</div><div class="searchbox"><span>⌕</span><input id="searchbox" type="search" placeholder="작품 검색" value="${esc(searchQuery)}" aria-label="작품 검색"></div></div>
  <div class="toolbar" style="margin-top:-7px"><div class="filters">${[['all','전체 유형'],...TYPES.map(t=>[t,t])].map(([v,t])=>`<button class="filter ${typeFilter===v?'active':''}" data-action="type-filter" data-type="${esc(v)}">${esc(t)}</button>`).join('')}</div><button class="ghost-btn" data-action="new-section">＋ 그룹 추가</button></div>
  <div class="section-list">${c.sections.map(g=>renderSection(c,g)).join('')}${(!visible&&(searchQuery||statusFilter!=='all'||typeFilter!=='all'))?`<div class="noresults">조건에 맞는 작품이 없어요. 필터를 바꿔 보세요.</div>`:''}</div>
  ${!c.sections.length?`<div class="empty-state"><span class="large-emoji">📚</span>그룹을 추가하고 작품을 넣어보세요.<br>페이즈, 시즌, 장르 등 원하는 방식으로 구분할 수 있어요.</div>`:''}
  <div class="collection-footer"><button class="btn" data-action="new-item-global">＋ 작품 추가하기</button><button class="btn secondary" data-action="edit-list">⚙ 목록 관리</button></div>
  <p class="shortcut">작품 왼쪽 체크로 완료 표시 · 상태 메뉴로 ‘볼 예정 / 보는 중 / 완료’ 변경</p>`;
}
function renderSection(c,g){const n=countGroup(g);const entries=g.items.filter(matches);const isCollapsed=collapsed.has(g.id);
 return `<section class="phase-block ${isCollapsed?'collapsed':''}"><div class="phase-top" data-action="collapse" data-sid="${esc(g.id)}" role="button" tabindex="0" aria-expanded="${!isCollapsed}"><div class="phase-toggle">⌄</div><div class="phase-main"><h3>${esc(g.title)}</h3><div class="phase-sub">${esc(g.description)||'사용자 지정 그룹'}</div></div><div class="phase-bar"><span style="width:${n.percent}%"></span></div><span class="phase-count">${n.done}/${n.all}</span><div class="phase-actions"><button class="iconbtn" data-action="edit-section" data-sid="${esc(g.id)}" title="그룹 편집" aria-label="그룹 편집">✎</button></div></div><div class="phase-items">${entries.map(i=>renderItem(c,g,i)).join('')}${!entries.length?`<div class="noresults">${g.items.length?'검색 조건에 맞는 작품이 없어요.':'아직 작품이 없어요.'}</div>`:''}<button class="add-item-row" data-action="new-item" data-sid="${esc(g.id)}">＋ 이 그룹에 작품 추가</button></div></section>`;
}
function renderItem(c,g,i){let mark=i.status==='done'?'✓':i.status==='watching'?'●':'';
 return `<div class="media-row"><button class="media-mark ${i.status==='done'?'complete':i.status==='watching'?'inprogress':''}" data-action="toggle-done" data-sid="${esc(g.id)}" data-iid="${esc(i.id)}" aria-label="${esc(i.title)} 완료 상태 변경" aria-pressed="${i.status==='done'}">${mark}</button><div class="poster" style="--postcolor:${c.color}">${esc((i.title||'?').slice(0,1))}</div><div class="media-detail"><b title="${esc(i.title)}">${esc(i.title)}</b><div class="media-sub"><span>${TYPE_ICON[i.type]} ${esc(i.type)}</span>${i.year?`<span class="sep">·</span><span>${i.year}</span>`:''}${i.totalEpisodes?`<span class="sep">·</span><span>${i.watchedEpisodes}/${i.totalEpisodes}화</span>`:''}${i.note?`<span class="sep">·</span><span class="media-note" title="${esc(i.note)}">${esc(i.note)}</span>`:''}</div></div><select class="status-select ${i.status==='done'?'complete':i.status==='watching'?'inprogress':''}" data-status="true" data-sid="${esc(g.id)}" data-iid="${esc(i.id)}" aria-label="${esc(i.title)} 시청 상태">${STATUSES.map(s=>`<option value="${s}" ${i.status===s?'selected':''}>${STATUS_TEXT[s]}</option>`).join('')}</select><div class="media-actions"><button class="iconbtn" data-action="edit-item" data-sid="${esc(g.id)}" data-iid="${esc(i.id)}" title="작품 편집" aria-label="작품 편집">⋯</button></div></div>`;
}
function render(opts={}){
 if(selectedId&&!getC())selectedId=null;
 const container=document.getElementById('app');
 container.innerHTML=`<div class="app-shell">${nav()}<main class="main">${topbar()}${selectedId?collectionPage(getC()):home()}</main></div>`;
 if(opts.focusSearch){const box=document.querySelector('#searchbox');if(box){box.focus();box.setSelectionRange(box.value.length,box.value.length);}}
}
function resetFilters(){statusFilter='all';typeFilter='all';searchQuery='';collapsed.clear();}
function selectList(id){if(!db.collections.some(c=>c.id===id))return;selectedId=id;sidebarOpen=false;resetFilters();render();window.scrollTo(0,0)}
function goHome(){selectedId=null;sidebarOpen=false;resetFilters();render();window.scrollTo(0,0)}
function fileExport(){const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='watchstack-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('백업 파일을 다운로드했어요.')}
function modal(html){document.getElementById('modal-root').innerHTML=`<div class="modal-backdrop" data-action="backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title">${html}</div></div>`;const first=document.querySelector('#modal-root .field');first?.focus()}
function closeModal(){document.getElementById('modal-root').innerHTML=''}
function topModal(title,sub){return `<div class="modal-head"><div><h2 id="dialog-title">${title}</h2><p class="modal-intro">${sub}</p></div><button class="modal-close" data-action="close-modal" aria-label="닫기">×</button></div>`}
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
function itemDialog(c,g,item){if(!c.sections.length){sectionDialog(null);notify('작품을 추가하려면 먼저 그룹을 만들어 주세요.');return;}
 const edit=!!item;const i=item||{title:'',type:'영화',year:'',status:'plan',note:'',watchedEpisodes:0,totalEpisodes:0};
 modal(`${topModal(edit?'작품 편집':'작품 추가','영화 · 드라마 · 애니 · 기타 콘텐츠를 자유롭게 등록하세요.')}
 <form data-form="item" data-iid="${edit?esc(i.id):''}" data-old-sid="${edit?esc(g.id):''}">
 <div class="form-field"><label>작품 제목 *</label><input class="field" name="title" required maxlength="160" placeholder="예: 스파이더맨: 노 웨이 홈" value="${esc(i.title)}"></div>
 <div class="form-row"><div class="form-field"><label>유형</label><select name="type">${TYPES.map(t=>`<option value="${t}" ${i.type===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="form-field"><label>공개 연도</label><input class="field" type="number" inputmode="numeric" name="year" min="1880" max="2100" placeholder="예: 2025" value="${i.year??''}"></div></div>
 <div class="form-row"><div class="form-field"><label>시청 상태</label><select name="status">${STATUSES.map(s=>`<option value="${s}" ${i.status===s?'selected':''}>${STATUS_TEXT[s]}</option>`).join('')}</select></div><div class="form-field"><label>들어갈 그룹</label><select name="section">${c.sections.map(s=>`<option value="${esc(s.id)}" ${s.id===g?.id?'selected':''}>${esc(s.title)}</option>`).join('')}</select></div></div>
 <div class="form-row"><div class="form-field"><label>총 화수 (선택)</label><input class="field" type="number" inputmode="numeric" name="totalEpisodes" min="0" max="99999" value="${i.totalEpisodes||''}" placeholder="예: 12"></div><div class="form-field"><label>현재 본 화수 (선택)</label><input class="field" type="number" inputmode="numeric" name="watchedEpisodes" min="0" max="99999" value="${i.watchedEpisodes||''}" placeholder="예: 5"></div></div>
 <div class="form-field"><label>내 메모 (선택)</label><textarea name="note" maxlength="900" placeholder="기억할 내용, 기대 포인트 등">${esc(i.note)}</textarea></div>
 ${edit?`<div class="form-field"><label>목록 안에서 작품 순서</label><div class="form-row"><button type="button" class="btn secondary" data-action="move-item" data-sid="${esc(g.id)}" data-iid="${esc(i.id)}" data-dir="-1">↑ 위로 이동</button><button type="button" class="btn secondary" data-action="move-item" data-sid="${esc(g.id)}" data-iid="${esc(i.id)}" data-dir="1">↓ 아래로 이동</button></div></div>`:''}
 <div class="modal-footer">${edit?`<button type="button" class="btn danger delete" data-action="delete-item" data-sid="${esc(g.id)}" data-iid="${esc(i.id)}">삭제</button>`:''}<button class="btn secondary" type="button" data-action="close-modal">취소</button><button class="btn" type="submit">${edit?'저장하기':'작품 추가'}</button></div></form>`);
}
function settingsDialog(){const n=db.collections.length;modal(`${topModal('설정 및 백업','시청 기록은 서버가 아닌 지금 사용하는 브라우저에 저장됩니다.')}
 <div class="backup-panel"><b>📦 내 데이터 보관하기</b><p>${n}개 컬렉션의 작품 목록, 상태, 메모가 한 파일에 저장돼요. 다른 기기에서 가져올 수도 있습니다.</p><button class="btn" data-action="export-data">⬇ JSON 백업</button><button class="btn secondary" data-action="import-data">⬆ 백업 가져오기</button><input id="import-file" class="hidden" type="file" accept=".json,application/json"></div>
 <div class="backup-panel"><b>📱 아이패드에서 앱처럼 사용하기</b><p>웹사이트를 Safari에서 열고 <b>공유 ⤴ → 홈 화면에 추가</b>를 누르세요. 홈 화면 아이콘으로 실행할 수 있습니다. 설치형 앱(PWA)은 HTTPS 사이트에 배포한 뒤 사용 가능합니다.</p><button class="btn secondary" data-action="install-pwa" id="install-btn">앱 설치 방법 보기</button></div>
 <div class="backup-panel"><b>🦸 MCU 샘플 컬렉션</b><p>페이즈 1~6으로 나눈 필수 작품 23개가 들어 있어요. 샘플을 수정하거나 삭제해도 다른 목록에는 영향을 주지 않습니다.</p><button class="btn secondary" data-action="readd-mcu">MCU 샘플 하나 더 만들기</button></div>
 <div class="danger-zone"><b>기억해 주세요</b><p>로그인·서버 동기화는 제공하지 않아요. 브라우저 데이터 삭제, 사파리 저장 공간 정리, 다른 기기 사용 시 기록이 자동으로 이전되지 않으니 중요한 목록은 주기적으로 백업해 주세요.</p></div>
 <div class="modal-footer"><button class="btn secondary" data-action="close-modal">닫기</button></div>`);}
function fileImport(file){if(!file)return;if(file.size>7*1024*1024){notify('7MB 이하의 JSON 백업만 가져올 수 있어요.');return}const reader=new FileReader();reader.onload=()=>{try{const incoming=normalize(JSON.parse(reader.result));if(!confirm(`현재 ${db.collections.length}개 컬렉션을 가져온 ${incoming.collections.length}개 컬렉션으로 교체합니다. 진행할까요?`))return;db=incoming;persist();closeModal();goHome();notify('백업을 성공적으로 복원했어요.');}catch(e){notify(e.message||'파일을 읽지 못했어요.')}};reader.onerror=()=>notify('파일을 불러오지 못했어요.');reader.readAsText(file,'utf-8')}
function removeItem(sid,iid){const c=getC(),g=getG(c,sid),i=getI(c,sid,iid);if(!i)return;if(!confirm(`‘${i.title}’ 작품을 삭제할까요?`))return;g.items=g.items.filter(x=>x.id!==iid);persist();closeModal();render();notify('작품을 삭제했어요.')}
function handleAction(btn,evt){const action=btn.dataset.action, cid=btn.dataset.cid,sid=btn.dataset.sid,iid=btn.dataset.iid;
 const c=getC(),g=getG(c,sid),i=getI(c,sid,iid);
 if(action==='home')return goHome();
 if(action==='select')return selectList(cid);
 if(action==='menu'){sidebarOpen=true;return render()}
 if(action==='close-menu'){sidebarOpen=false;return render()}
 if(action==='new-list')return listDialog(null);
 if(action==='edit-list')return c&&listDialog(c);
 if(action==='new-section')return c&&sectionDialog(null);
 if(action==='edit-section')return g&&sectionDialog(g);
 if(action==='new-item')return itemDialog(c,g,null);
 if(action==='new-item-global')return itemDialog(c,c?.sections[0],null);
 if(action==='edit-item')return i&&itemDialog(c,g,i);
 if(action==='settings')return settingsDialog();
 if(action==='close-modal')return closeModal();
 if(action==='backdrop'){if(evt.target===btn)closeModal();return}
 if(action==='filter'){statusFilter=btn.dataset.filter;return render()}
 if(action==='type-filter'){typeFilter=btn.dataset.type;return render()}
 if(action==='collapse'){collapsed.has(sid)?collapsed.delete(sid):collapsed.add(sid);return render()}
 if(action==='toggle-done'&&i){i.status=i.status==='done'?'plan':'done';persist();render();return notify(i.status==='done'?'시청 완료! 🎉':'볼 예정으로 변경했어요.')}
 if(action==='set-color'||action==='set-icon'){
   const form=btn.closest('form');const prop=action==='set-color'?'color':'icon';form.elements[prop].value=btn.dataset[prop];form.querySelectorAll(action==='set-color'?'.swatch':'.emoji-option').forEach(el=>el.classList.toggle('selected',el===btn));return;
 }
 if(action==='move-item'&&i){
   const from=g.items.findIndex(x=>x.id===iid),to=from+Number(btn.dataset.dir);
   if(to<0||to>=g.items.length)return notify('더 이상 이동할 수 없어요.');
   [g.items[from],g.items[to]]=[g.items[to],g.items[from]];persist();closeModal();render();return notify('작품 순서를 변경했어요.');
 }
 if(action==='move-section'&&g){
   const from=c.sections.findIndex(x=>x.id===sid),to=from+Number(btn.dataset.dir);
   if(to<0||to>=c.sections.length)return notify('더 이상 이동할 수 없어요.');
   [c.sections[from],c.sections[to]]=[c.sections[to],c.sections[from]];persist();closeModal();render();return notify('그룹 순서를 변경했어요.');
 }
 if(action==='delete-item')return removeItem(sid,iid);
 if(action==='delete-section'&&g){if(!confirm(`‘${g.title}’ 그룹과 작품 ${g.items.length}개를 모두 삭제할까요?`))return;c.sections=c.sections.filter(x=>x.id!==sid);persist();closeModal();render();return notify('그룹을 삭제했어요.')}
 if(action==='delete-list'){
   const target=db.collections.find(x=>x.id===cid);if(!target||!confirm(`‘${target.title}’ 컬렉션과 그 안의 모든 작품을 삭제할까요?`))return;
   db.collections=db.collections.filter(x=>x.id!==cid);persist();closeModal();return goHome();
 }
 if(action==='export-data')return fileExport();
 if(action==='import-data')return document.getElementById('import-file')?.click();
 if(action==='readd-mcu'){db.collections.push(initialMCU());persist();closeModal();render();notify('MCU 샘플을 추가했어요.');return}
 if(action==='install-pwa'){
   if(beforeInstallPrompt){beforeInstallPrompt.prompt();beforeInstallPrompt.userChoice.then(()=>{beforeInstallPrompt=null});return}
   alert('아이패드 Safari: 공유 버튼(네모+위 화살표) → 홈 화면에 추가 → 추가.\n\n앱 설치가 활성화되려면 해당 파일을 HTTPS 웹사이트(예: GitHub Pages)에 배포해야 합니다.');return;
 }
}
document.addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(!btn)return;const backdrop=btn.dataset.action==='backdrop';if(backdrop&&e.target!==btn)return;if(btn.tagName==='BUTTON'||btn.dataset.action==='collapse'||backdrop)e.preventDefault();handleAction(btn,e)});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();if((e.key==='Enter'||e.key===' ')&&e.target?.dataset?.action==='collapse'){e.preventDefault();handleAction(e.target,e);}});
document.addEventListener('change',e=>{
 const target=e.target;if(target.dataset.status){const i=getI(getC(),target.dataset.sid,target.dataset.iid);if(!i)return;i.status=STATUSES.includes(target.value)?target.value:'plan';persist();render();notify('상태를 변경했어요.');}
 if(target.id==='import-file')fileImport(target.files?.[0]);
});
document.addEventListener('input',e=>{if(e.target.id==='searchbox'){searchQuery=e.target.value;render({focusSearch:true});}});
document.addEventListener('submit',e=>{
 const f=e.target.closest('form[data-form]');if(!f)return;e.preventDefault();if(!f.reportValidity())return;
 const data=Object.fromEntries(new FormData(f).entries());
 if(f.dataset.form==='list'){
  const edited=db.collections.find(x=>x.id===f.dataset.cid);
  if(edited){edited.title=clean(data.title,90);edited.description=clean(data.description,350);edited.icon=data.icon;edited.color=data.color;}
  else{const added={id:uid(),title:clean(data.title,90),description:clean(data.description,350),icon:data.icon,color:data.color,sections:[{id:uid(),title:'기본 목록',description:'',items:[]}]};db.collections.push(added);selectedId=added.id;}
 }
 if(f.dataset.form==='section'){
  const c=getC(),edited=c.sections.find(s=>s.id===f.dataset.sid);
  if(edited){edited.title=clean(data.title,90);edited.description=clean(data.description,160)}
  else c.sections.push({id:uid(),title:clean(data.title,90),description:clean(data.description,160),items:[]});
 }
 if(f.dataset.form==='item'){
  const c=getC(),old=getG(c,f.dataset.oldSid),item=old?.items.find(i=>i.id===f.dataset.iid),target=getG(c,data.section);
  if(!target)return notify('그룹을 선택해 주세요.');
  const total=Math.max(0,parseInt(data.totalEpisodes,10)||0),watched=Math.max(0,parseInt(data.watchedEpisodes,10)||0);
  const updated={id:item?.id||uid(),title:clean(data.title,160),type:TYPES.includes(data.type)?data.type:'기타',year:data.year?parseInt(data.year,10):null,status:STATUSES.includes(data.status)?data.status:'plan',totalEpisodes:total,watchedEpisodes:total?Math.min(watched,total):watched,note:clean(data.note,900)};
  const priorIndex=item?old.items.findIndex(i=>i.id===item.id):-1;
  if(item)old.items=old.items.filter(i=>i.id!==item.id);
  if(item&&old?.id===target.id){target.items.splice(priorIndex>=0?priorIndex:target.items.length,0,updated);}else target.items.push(updated);
 }
 persist();closeModal();render();notify('저장했어요.');
});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();beforeInstallPrompt=e});
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('Offline support:',err));
render();
})();