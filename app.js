(() => {
'use strict';
const STORAGE_KEY = 'watchstack_library_v1';
const PALETTE = ['#a393ff','#f39b9d','#74cdbd','#ebbb74','#78b2f6','#dc9cf0'];
const ICONS = ['🎬','🍿','📺','🌙','🌸','⭐','🎮','🎧','🚀','📚','🪐','🎨'];
const TYPES = ['영화','드라마','애니','기타'];
const STATUSES = ['plan','done'];
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
function normalize(raw){
 if(!raw || !Array.isArray(raw.collections) || raw.collections.length>300) throw new Error('지원하지 않는 백업 파일입니다.');
 const collections=raw.collections.map(c=>({id:uid(),title:clean(c.title,90)||'이름 없는 컬렉션',description:clean(c.description,350),icon:ICONS.includes(c.icon)?c.icon:clean(c.icon,3)||'🎬',color:PALETTE.includes(c.color)?c.color:PALETTE[0],sections:(Array.isArray(c.sections)?c.sections:[]).slice(0,300).map(g=>({id:uid(),title:clean(g.title,90)||'목록',description:clean(g.description,160),items:(Array.isArray(g.items)?g.items:[]).slice(0,1500).map(i=>({id:uid(),title:clean(i.title,160)||'제목 없음',type:TYPES.includes(i.type)?i.type:'기타',year:Number.isInteger(+i.year)&&+i.year>=1880&&+i.year<=2100?+i.year:null,status:i.status==='done'?'done':'plan',posterUrl:safeUrl(i.posterUrl),wikiTitle:clean(i.wikiTitle,160),note:clean(i.note,900)}))}))}));
 return {version:1,collections};
}
function load(){try{const saved=localStorage.getItem(STORAGE_KEY);if(saved)return normalizePreserveIds(JSON.parse(saved));}catch(e){console.warn('저장된 데이터를 불러올 수 없습니다:',e)}return seed();}
function normalizePreserveIds(obj){const result=normalize(obj);(obj.collections||[]).forEach((c,ci)=>{const dst=result.collections[ci];if(!dst)return;dst.id=clean(c.id,100)||dst.id;(c.sections||[]).forEach((s,si)=>{const t=dst.sections[si];if(!t)return;t.id=clean(s.id,100)||t.id;(s.items||[]).forEach((i,ii)=>{if(t.items[ii])t.items[ii].id=clean(i.id,100)||t.items[ii].id;});});});return result;}
let db=load();
let selectedId=null;
let statusFilter='all';
let posterCache=new Map();
let posterObserver;
const AI_ENDPOINT_KEY='watchstack_ai_endpoint_v1';
const AI_SESSION_KEY='watchstack_ai_access';
function aiEndpoint(){try{return localStorage.getItem(AI_ENDPOINT_KEY)||''}catch{return ''}}
function aiAccess(){try{return sessionStorage.getItem(AI_SESSION_KEY)||''}catch{return ''}}
function safeUrl(url){try{const v=new URL(String(url||''));return v.protocol==='https:'?v.href.slice(0,1000):''}catch{return ''}}
let typeFilter='all';
let searchQuery='';
let collapsed=new Set();
let sidebarOpen=false;
let beforeInstallPrompt=null;
let toastTimer;
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(db));}catch(e){notify('저장 공간이 부족합니다. 백업 파일을 내려받아 주세요.')}}
function esc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function count(c){let all=0,done=0;for(const s of c.sections)for(const i of s.items){all++;if(i.status==='done')done++;}return {all,done,percent:all?Math.round(done/all*100):0};}
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
  <button class="add-side" data-action="new-list">＋ 새 컬렉션 만들기</button><button class="add-side ai-side" data-action="ai-builder">✦ AI 리스트 만들기</button>
  <div class="side-bottom"><div class="side-tip"><b>✦ 어떤 이야기도 기록하세요</b><p>영화 · 드라마 · 애니 · 기타 콘텐츠를 나만의 리스트로 관리할 수 있어요.</p></div>
    <div class="side-footer-actions"><button class="ghost-btn" data-action="settings">⚙ 설정 및 백업</button></div>
    <div class="nav-footer">v1.1 · 데이터는 이 기기에 저장돼요</div>
  </div></aside><div class="side-screen ${sidebarOpen?'open':''}" data-action="close-menu"></div>`}
function topbar(){return `<div class="topline"><div class="mobile-header"><button class="menu-btn" data-action="menu" aria-label="메뉴 열기">☰</button><div class="brand"><div class="brand-mark">▣</div>WATCHSTACK</div></div><div class="desktop-breadcrumb breadcrumb">MY SPACE &nbsp;/&nbsp; <span>${selectedId?esc(getC()?.title||'목록'):'대시보드'}</span></div><div class="top-actions"><span class="pill">● &nbsp;이 기기에 자동 저장</span><button class="ghost-btn" data-action="settings" title="설정 및 백업">⚙ <span class="desktop-text">설정</span></button></div></div>`}
function home(){
 const all=db.collections.reduce((a,c)=>{const n=count(c);a.total+=n.all;a.done+=n.done;return a},{total:0,done:0});
 return `<div class="home-hero"><div class="hero-glow">◈</div><div class="hero-content"><span class="lead-label">YOUR WATCH JOURNEY</span><h1 class="hero-title">보고 싶은 이야기,<br><em>놓치지 말고 기록해요.</em></h1><p class="lead-desc">영화부터 드라마, 애니메이션까지. 나만의 리스트를 만들고, 체크해서 기록해요.</p><button class="btn ai-hero" data-action="ai-builder">✦ AI로 시청 리스트 만들기</button></div></div>
 <div class="stats"><div class="stat-card"><span class="stat-label">전체 작품</span><span class="stat-number">${all.total}</span><span class="stat-extra">작품</span></div><div class="stat-card"><span class="stat-label">시청 완료</span><span class="stat-number" style="color:var(--green)">${all.done}</span><span class="stat-extra">작품</span></div><div class="stat-card"><span class="stat-label">남은 작품</span><span class="stat-number">${all.total-all.done}</span><span class="stat-extra">작품</span></div></div>
 <div class="section-head"><div><h2>내 컬렉션</h2><p>누르면 시청 리스트를 관리할 수 있어요</p></div><button class="btn" data-action="new-list">＋ 새 컬렉션</button></div>
 ${db.collections.length?`<div class="collection-grid">${db.collections.map(c=>{const n=count(c);return `<button class="collection-card" style="--cardcolor:${c.color}" data-action="select" data-cid="${esc(c.id)}"><div class="card-top"><span class="card-icon">${esc(c.icon)}</span><span class="card-arrow">↗</span></div><h3>${esc(c.title)}</h3><p>${esc(c.description)||'나만의 시청 목록'}</p><div class="mini-progress"><div class="mini-fill" style="width:${n.percent}%"></div></div><div class="card-meta"><span>${n.done} / ${n.all} 작품 완료</span><span>${n.percent}%</span></div></button>`}).join('')}</div>`:`<div class="empty-state"><span class="large-emoji">🍿</span>아직 컬렉션이 없어요.<br>첫 번째 시청 목록을 만들어보세요!</div>`}
 <p class="shortcut">🔒 시청 기록은 이 기기에 저장돼요. 백업을 권장해요.</p>`;
}
function matches(i){return (statusFilter==='all'||i.status===statusFilter)&&(typeFilter==='all'||i.type===typeFilter)&&(!searchQuery||`${i.title} ${i.note} ${i.year||''}`.toLowerCase().includes(searchQuery.toLowerCase()));}
function collectionPage(c){const n=count(c),visible=c.sections.reduce((a,s)=>a+s.items.filter(matches).length,0);
 return `<div class="collection-hero" style="--collection-accent:${c.color}"><div class="collection-main-top"><div class="collection-bigicon">${esc(c.icon)}</div><div><div class="collection-tag">✧ CUSTOM COLLECTION</div><h1 class="collection-name">${esc(c.title)}</h1><p class="collection-sub">${esc(c.description)||'나만의 이야기를 정리하는 공간'}</p></div><div class="collection-head-right"><button class="ghost-btn" data-action="edit-list" data-cid="${esc(c.id)}">✎ 컬렉션 편집</button></div></div>
  <div class="collection-progress"><div class="track"><div class="fill" style="width:${n.percent}%"></div></div><span class="progress-text">${n.done} / ${n.all} 완료 · ${n.percent}%</span></div></div>
  <div class="toolbar"><div class="filters">${[['all','전체'],['plan','안 봄'],['done','봤음']].map(([v,t])=>`<button class="filter ${statusFilter===v?'active':''}" data-action="filter" data-filter="${v}">${t}</button>`).join('')}</div><div class="searchbox"><span>⌕</span><input id="searchbox" type="search" placeholder="작품 검색" value="${esc(searchQuery)}" aria-label="작품 검색"></div></div>
  <div class="toolbar" style="margin-top:-7px"><div class="filters">${[['all','전체 유형'],...TYPES.map(t=>[t,t])].map(([v,t])=>`<button class="filter ${typeFilter===v?'active':''}" data-action="type-filter" data-type="${esc(v)}">${esc(t)}</button>`).join('')}</div><div class="form-row"><button class="ghost-btn" data-action="ai-builder">✦ AI 만들기</button><button class="ghost-btn" data-action="new-section">＋ 그룹 추가</button></div></div>
  <div class="section-list">${c.sections.map(g=>renderSection(c,g)).join('')}${(!visible&&(searchQuery||statusFilter!=='all'||typeFilter!=='all'))?`<div class="noresults">조건에 맞는 작품이 없어요. 필터를 바꿔 보세요.</div>`:''}</div>
  ${!c.sections.length?`<div class="empty-state"><span class="large-emoji">📚</span>그룹을 추가하고 작품을 넣어보세요.<br>페이즈, 시즌, 장르 등 원하는 방식으로 구분할 수 있어요.</div>`:''}
  <div class="collection-footer"><button class="btn" data-action="new-item-global">＋ 작품 추가하기</button><button class="btn secondary" data-action="edit-list">⚙ 목록 관리</button></div>
  <p class="shortcut">작품 왼쪽 체크박스를 누르면 봤음 / 안 봄이 바뀌어요. · 📖 나무위키 문서 보기</p>`;
}
function renderSection(c,g){const n=countGroup(g);const entries=g.items.filter(matches);const isCollapsed=collapsed.has(g.id);
 return `<section class="phase-block ${isCollapsed?'collapsed':''}"><div class="phase-top" data-action="collapse" data-sid="${esc(g.id)}" role="button" tabindex="0" aria-expanded="${!isCollapsed}"><div class="phase-toggle">⌄</div><div class="phase-main"><h3>${esc(g.title)}</h3><div class="phase-sub">${esc(g.description)||'사용자 지정 그룹'}</div></div><div class="phase-bar"><span style="width:${n.percent}%"></span></div><span class="phase-count">${n.done}/${n.all}</span><div class="phase-actions"><button class="iconbtn" data-action="edit-section" data-sid="${esc(g.id)}" title="그룹 편집" aria-label="그룹 편집">✎</button></div></div><div class="phase-items">${entries.map(i=>renderItem(c,g,i)).join('')}${!entries.length?`<div class="noresults">${g.items.length?'검색 조건에 맞는 작품이 없어요.':'아직 작품이 없어요.'}</div>`:''}<button class="add-item-row" data-action="new-item" data-sid="${esc(g.id)}">＋ 이 그룹에 작품 추가</button></div></section>`;
}
function renderItem(c,g,i){const done=i.status==='done', poster=safeUrl(i.posterUrl);
 const wiki='https://namu.wiki/w/'+encodeURIComponent(i.wikiTitle||i.title);
 return `<div class="media-row ${done?'row-watched':''}"><button class="media-mark ${done?'complete':''}" data-action="toggle-done" data-sid="${esc(g.id)}" data-iid="${esc(i.id)}" aria-label="${esc(i.title)} ${done?'시청 체크 해제':'봤음으로 체크'}" aria-pressed="${done}">${done?'✓':''}</button><div class="poster poster-cover" style="--postcolor:${c.color}" data-title="${esc(i.title)}" data-year="${i.year||''}" data-type="${esc(i.type)}">${poster?`<img src="${esc(poster)}" alt="${esc(i.title)} 표지" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:`<span>${esc((i.title||'?').slice(0,1))}</span>`}</div><div class="media-detail"><b title="${esc(i.title)}">${esc(i.title)}</b><div class="media-sub"><span>${TYPE_ICON[i.type]} ${esc(i.type)}</span>${i.year?`<span class="sep">·</span><span>${i.year}</span>`:''}${i.note?`<span class="sep">·</span><span class="media-note" title="${esc(i.note)}">${esc(i.note)}</span>`:''}</div><a class="wiki-link" target="_blank" rel="noopener noreferrer" href="${esc(wiki)}">📖 나무위키 ↗</a></div><div class="media-actions"><button class="iconbtn" data-action="edit-item" data-sid="${esc(g.id)}" data-iid="${esc(i.id)}" title="작품 편집" aria-label="작품 편집">⋯</button></div></div>`;
}
function render(opts={}){
 if(selectedId&&!getC())selectedId=null;
 const container=document.getElementById('app');
 container.innerHTML=`<div class="app-shell">${nav()}<main class="main">${topbar()}${selectedId?collectionPage(getC()):home()}</main></div>`;
 if(opts.focusSearch){const box=document.querySelector('#searchbox');if(box){box.focus();box.setSelectionRange(box.value.length,box.value.length);}}
 observePosters();
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
 const edit=!!item;const i=item||{title:'',type:'영화',year:'',status:'plan',note:'',posterUrl:'',wikiTitle:''};
 modal(`${topModal(edit?'작품 편집':'작품 추가','시청 여부는 목록의 체크박스로 관리해요.')}
 <form data-form="item" data-iid="${edit?esc(i.id):''}" data-old-sid="${edit?esc(g.id):''}">
 <div class="form-field"><label>작품 제목 *</label><input class="field" name="title" required maxlength="160" placeholder="예: 스파이더맨: 노 웨이 홈" value="${esc(i.title)}"></div>
 <div class="form-row"><div class="form-field"><label>유형</label><select name="type">${TYPES.map(t=>`<option value="${t}" ${i.type===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="form-field"><label>공개 연도</label><input class="field" type="number" inputmode="numeric" name="year" min="1880" max="2100" placeholder="예: 2025" value="${i.year??''}"></div></div>
 <div class="form-row"><div class="form-field"><label>넣을 그룹</label><select name="section">${c.sections.map(s=>`<option value="${esc(s.id)}" ${s.id===g?.id?'selected':''}>${esc(s.title)}</option>`).join('')}</select></div><div class="form-field check-field"><label><input type="checkbox" name="watched" value="yes" ${i.status==='done'?'checked':''}> 이미 봤음</label></div></div>
 <div class="form-field"><label>표지 이미지 URL (선택)</label><input class="field" name="posterUrl" type="url" placeholder="https://... (이미지 주소)" value="${esc(i.posterUrl)}"><p class="input-hint">자동 이미지가 없는 경우 직접 지정할 수 있어요. 이미지 이용 권한을 확인해 주세요.</p></div>
 <div class="form-field"><label>나무위키 문서 제목 (선택)</label><input class="field" name="wikiTitle" maxlength="160" placeholder="비워두면 작품명으로 연결" value="${esc(i.wikiTitle)}"></div>
 <div class="form-field"><label>내 메모 (선택)</label><textarea name="note" maxlength="900" placeholder="기억할 내용, 기대 포인트 등">${esc(i.note)}</textarea></div>
 ${edit?`<div class="form-field"><label>목록 안에서 작품 순서</label><div class="form-row"><button type="button" class="btn secondary" data-action="move-item" data-sid="${esc(g.id)}" data-iid="${esc(i.id)}" data-dir="-1">↑ 위로 이동</button><button type="button" class="btn secondary" data-action="move-item" data-sid="${esc(g.id)}" data-iid="${esc(i.id)}" data-dir="1">↓ 아래로 이동</button></div></div>`:''}
 <div class="modal-footer">${edit?`<button type="button" class="btn danger delete" data-action="delete-item" data-sid="${esc(g.id)}" data-iid="${esc(i.id)}">삭제</button>`:''}<button class="btn secondary" type="button" data-action="close-modal">취소</button><button class="btn" type="submit">${edit?'저장하기':'작품 추가'}</button></div></form>`);
}
function settingsDialog(){const n=db.collections.length;modal(`${topModal('설정 및 백업','시청 기록은 서버가 아닌 지금 사용하는 브라우저에 저장됩니다.')}
 <div class="backup-panel"><b>📦 내 데이터 보관하기</b><p>${n}개 컬렉션의 작품 목록, 시청 체크, 메모가 한 파일에 저장돼요. 다른 기기에서 가져올 수도 있습니다.</p><button class="btn" data-action="export-data">⬇ JSON 백업</button><button class="btn secondary" data-action="import-data">⬆ 백업 가져오기</button><input id="import-file" class="hidden" type="file" accept=".json,application/json"></div>
 <div class="backup-panel"><b>📱 아이패드에서 앱처럼 사용하기</b><p>웹사이트를 Safari에서 열고 <b>공유 ⤴ → 홈 화면에 추가</b>를 누르세요. 홈 화면 아이콘으로 실행할 수 있습니다. 설치형 앱(PWA)은 HTTPS 사이트에 배포한 뒤 사용 가능합니다.</p><button class="btn secondary" data-action="install-pwa" id="install-btn">앱 설치 방법 보기</button></div>
 <div class="backup-panel"><b>✦ AI 리스트 생성 연결</b><p>GitHub Pages에는 AI 비밀키를 넣을 수 없어요. 별도 AI 서버를 설정하면 사이트에서 바로 생성할 수 있고, 미설정 시 ChatGPT에서 만든 JSON을 가져올 수 있습니다.</p><label for="endpoint-setting">AI 서버 주소 (선택)</label><input id="endpoint-setting" class="field" type="url" placeholder="https://....workers.dev" value="${esc(aiEndpoint())}"><label for="access-setting">AI 연결 코드 (브라우저 세션에만 임시 보관)</label><input id="access-setting" class="field" type="password" autocomplete="off" placeholder="서버에서 설정한 접근 코드" value="${esc(aiAccess())}"><button class="btn secondary" data-action="save-endpoint">연결 설정 저장</button></div>
 <div class="backup-panel"><b>🦸 MCU 샘플 컬렉션</b><p>페이즈 1~6으로 나눈 필수 작품 23개가 들어 있어요. 샘플을 수정하거나 삭제해도 다른 목록에는 영향을 주지 않습니다.</p><button class="btn secondary" data-action="readd-mcu">MCU 샘플 하나 더 만들기</button></div>
 <div class="danger-zone"><b>기억해 주세요</b><p>로그인·서버 동기화는 제공하지 않아요. 브라우저 데이터 삭제, 사파리 저장 공간 정리, 다른 기기 사용 시 기록이 자동으로 이전되지 않으니 중요한 목록은 주기적으로 백업해 주세요.</p></div>
 <div class="modal-footer"><button class="btn secondary" data-action="close-modal">닫기</button></div>`);}
function fileImport(file){if(!file)return;if(file.size>7*1024*1024){notify('7MB 이하의 JSON 백업만 가져올 수 있어요.');return}const reader=new FileReader();reader.onload=()=>{try{const incoming=normalize(JSON.parse(reader.result));if(!confirm(`현재 ${db.collections.length}개 컬렉션을 가져온 ${incoming.collections.length}개 컬렉션으로 교체합니다. 진행할까요?`))return;db=incoming;persist();closeModal();goHome();notify('백업을 성공적으로 복원했어요.');}catch(e){notify(e.message||'파일을 읽지 못했어요.')}};reader.onerror=()=>notify('파일을 불러오지 못했어요.');reader.readAsText(file,'utf-8')}
function removeItem(sid,iid){const c=getC(),g=getG(c,sid),i=getI(c,sid,iid);if(!i)return;if(!confirm(`‘${i.title}’ 작품을 삭제할까요?`))return;g.items=g.items.filter(x=>x.id!==iid);persist();closeModal();render();notify('작품을 삭제했어요.')}
function parseAICollection(raw){
 const obj=typeof raw==='string'?JSON.parse(raw):raw;
 const data=obj.collection||obj; if(!data||!Array.isArray(data.sections)||!data.sections.length)throw new Error('sections 배열이 있는 JSON이 필요해요.');
 const sections=data.sections.slice(0,40).map(g=>({id:uid(),title:clean(g.title,90)||'기본 목록',description:clean(g.description,160),items:(Array.isArray(g.items)?g.items:[]).slice(0,150).map(i=>typeof i==='string'?{title:i}:{...i}).map(i=>({id:uid(),title:clean(i.title,160)||'제목 없음',year:Number.isInteger(+i.year)&&+i.year>=1880&&+i.year<=2100?+i.year:null,type:TYPES.includes(i.type)?i.type:'영화',status:'plan',posterUrl:safeUrl(i.posterUrl),wikiTitle:clean(i.wikiTitle,160),note:clean(i.note,900)}))}));
 if(!sections.some(g=>g.items.length))throw new Error('작품 목록이 비어 있어요.');
 return {id:uid(),title:clean(data.title,90)||'AI 추천 시청 리스트',description:clean(data.description,350),icon:'🎬',color:PALETTE[db.collections.length%PALETTE.length],sections};
}
function importAIJSON(raw){try{const added=parseAICollection(raw);db.collections.push(added);persist();closeModal();selectList(added.id);notify('새 시청 리스트를 만들었어요!');}catch(e){notify('JSON 가져오기 실패: '+(e.message||'형식을 확인해 주세요.'))}}
function aiPrompt(idea){return `영화/드라마/애니를 기록하는 앱 WATCHSTACK에 넣을 시청 리스트를 생성해 줘.
요청: ${idea}
한국어, 스포일러 없이, 공개 연도와 공식 시리즈/페이즈 분류를 가능한 한 정확히 확인해 줘. 영화나 드라마 전체를 한 작품으로 작성하고, 필수가 아닌 건 과감히 제외해 줘.
JSON만 출력해 줘. 형식: {"title":"컬렉션 이름","description":"짧은 설명","sections":[{"title":"페이즈/시즌/그룹","description":"그룹 설명","items":[{"title":"작품 이름","type":"영화","year":2024,"wikiTitle":"나무위키에서 검색할 문서명"}]}]}. type은 영화,드라마,애니,기타 중 하나. 최종 시청 순서대로 정렬하고 마크다운 코드블록은 사용하지 마.`;}
function aiDialog(){modal(`${topModal('✦ AI 시청 리스트 만들기','원하는 작품이나 감상 목표를 말해 주세요. 직접 생성하려면 AI 서버 연결이 필요합니다.')}
 <div class="form-field"><label for="ai-idea">어떤 리스트를 만들까요?</label><textarea id="ai-idea" rows="4" placeholder="예: 마블 둠스데이 보기 전 필수 작품만 MCU 페이즈별로, 스포일러 없이 정리해줘"></textarea></div>
 <div class="form-field"><label>AI 연결 상태</label><p class="input-hint" id="ai-state">${aiEndpoint()?'AI 서버 주소가 등록돼 있어요. 연결을 확인하고 생성합니다.':'아직 AI 서버가 연결되지 않았어요. 아래 ChatGPT 연동/JSON 가져오기를 사용할 수 있어요.'}</p></div>
 <div class="form-row ai-buttons"><button class="btn" data-action="generate-ai" ${aiEndpoint()?'':'disabled'}>✦ 사이트 안에서 AI 생성</button><button class="btn secondary" data-action="ai-copy-prompt">ChatGPT 요청 복사</button><a class="btn secondary" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">ChatGPT 열기 ↗</a></div>
 <div class="form-field"><label for="ai-json">ChatGPT가 만든 JSON 붙여넣기</label><textarea id="ai-json" rows="5" placeholder='{"title":"나만의 리스트","sections":[{"title":"시즌 1","items":[{"title":"작품명","type":"애니","year":2020}]}]}'></textarea><button class="btn secondary" data-action="ai-import-json">JSON으로 컬렉션 생성</button></div>
 <p class="input-hint">AI 추천에는 오류가 있을 수 있어요. 공식 공개 연도와 페이즈를 확인해 주세요. 나무위키 문서는 각 작품에서 열 수 있어요.</p>`);}
async function generateAI(){const idea=clean(document.getElementById('ai-idea')?.value,1200);if(!idea){notify('어떤 리스트를 원하는지 적어 주세요.');return;}const endpoint=aiEndpoint();if(!endpoint)return notify('AI 서버를 먼저 연결해 주세요.');const btn=document.querySelector('[data-action="generate-ai"]');if(btn){btn.disabled=true;btn.textContent='AI가 리스트를 만드는 중…';}try{
 const res=await fetch(endpoint.replace(/\/$/,'')+'/generate',{method:'POST',headers:{'Content-Type':'application/json','X-Watchstack-Code':aiAccess()},body:JSON.stringify({prompt:idea})});const data=await res.json();if(!res.ok)throw new Error(data.error||'AI 서버 응답 오류');importAIJSON(data);
 }catch(e){notify('AI 생성 실패: '+(e.message||'네트워크 오류'));}finally{if(btn&&btn.isConnected){btn.disabled=false;btn.textContent='✦ 사이트 안에서 AI 생성';}}}
function copyAIPrompt(){const idea=clean(document.getElementById('ai-idea')?.value,1200);if(!idea)return notify('원하는 리스트를 적어 주세요.');const prompt=aiPrompt(idea);const onCopied=()=>{notify('요청 복사 완료! ChatGPT 열기를 눌러 붙여넣고 JSON을 가져오세요.');};if(navigator.clipboard?.writeText)navigator.clipboard.writeText(prompt).then(onCopied).catch(()=>{const box=document.getElementById('ai-json');box.value=prompt;notify('아래 텍스트를 복사해서 ChatGPT에 붙여넣어 주세요.');});else{const box=document.getElementById('ai-json');box.value=prompt;notify('아래 텍스트를 복사해서 ChatGPT에 붙여넣어 주세요.');}}
async function fetchPoster(title,year,type){const key=title+'|'+year+'|'+type;if(posterCache.has(key))return posterCache.get(key);posterCache.set(key,'');
 try{if(aiEndpoint()){
   const url=aiEndpoint().replace(/\/$/,'')+'/poster?title='+encodeURIComponent(title)+'&year='+encodeURIComponent(year||'')+'&type='+encodeURIComponent(type);
   const r=await fetch(url,{headers:{'X-Watchstack-Code':aiAccess()}});if(r.ok){const obj=await r.json();const src=safeUrl(obj.posterUrl);if(src){posterCache.set(key,src);return src}}
 }
 // 자유 라이선스 이미지에 한해 위키백과 대표 썸네일을 보조로 사용합니다.
 const search=new URL('https://ko.wikipedia.org/w/api.php');Object.entries({action:'query',generator:'search',gsrsearch:title+' '+(year||''),gsrlimit:'1',prop:'pageimages',piprop:'thumbnail',pithumbsize:'160',pilicense:'free',format:'json',origin:'*'}).forEach(([k,v])=>search.searchParams.set(k,v));const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),6500);
 let response;try{response=await fetch(search,{signal:controller.signal});}finally{clearTimeout(timer)}if(!response.ok)return '';
 const data=await response.json();const pages=Object.values(data.query?.pages||{});const image=safeUrl(pages[0]?.thumbnail?.source);if(image){posterCache.set(key,image);return image;}
 }catch(e){console.info('표지를 찾지 못했어요:',title)}return '';
}
function observePosters(){posterObserver?.disconnect();const posters=[...document.querySelectorAll('.poster-cover:not(:has(img))')];if(!posters.length)return;const reveal=async el=>{if(!el.isConnected||el.querySelector('img'))return;const src=await fetchPoster(el.dataset.title,el.dataset.year,el.dataset.type);if(!el.isConnected||!src||el.querySelector('img'))return;const img=document.createElement('img');img.src=src;img.alt=el.dataset.title+' 대표 이미지';img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();el.appendChild(img);};if(!('IntersectionObserver' in window)){posters.slice(0,32).forEach(reveal);return;}posterObserver=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){posterObserver.unobserve(entry.target);reveal(entry.target);}})},{rootMargin:'180px'});posters.forEach(p=>posterObserver.observe(p));}
function handleAction(btn,evt){const action=btn.dataset.action, cid=btn.dataset.cid,sid=btn.dataset.sid,iid=btn.dataset.iid;
 const c=getC(),g=getG(c,sid),i=getI(c,sid,iid);
 if(action==='home')return goHome();
 if(action==='select')return selectList(cid);
 if(action==='menu'){sidebarOpen=true;return render()}
 if(action==='close-menu'){sidebarOpen=false;return render()}
 if(action==='new-list')return listDialog(null);
 if(action==='ai-builder')return aiDialog();
 if(action==='ai-copy-prompt')return copyAIPrompt();
 if(action==='ai-import-json')return importAIJSON(document.getElementById('ai-json')?.value||'');
 if(action==='generate-ai')return generateAI();
 if(action==='save-endpoint'){const value=clean(document.getElementById('endpoint-setting')?.value,900);if(value&&!safeUrl(value))return notify('HTTPS 주소를 입력해 주세요.');if(value)localStorage.setItem(AI_ENDPOINT_KEY,value.replace(/\/$/,''));else localStorage.removeItem(AI_ENDPOINT_KEY);const access=clean(document.getElementById('access-setting')?.value,250);if(access)sessionStorage.setItem(AI_SESSION_KEY,access);else sessionStorage.removeItem(AI_SESSION_KEY);return notify('AI 연결 설정을 저장했어요.');}
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
 if(action==='toggle-done'&&i){i.status=i.status==='done'?'plan':'done';persist();render();return notify(i.status==='done'?'시청 완료! 🎉':'미시청으로 변경했어요.')}
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
 const target=e.target;
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
  const updated={id:item?.id||uid(),title:clean(data.title,160),type:TYPES.includes(data.type)?data.type:'기타',year:data.year?parseInt(data.year,10):null,status:data.watched==='yes'?'done':'plan',posterUrl:safeUrl(data.posterUrl),wikiTitle:clean(data.wikiTitle,160),note:clean(data.note,900)};
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