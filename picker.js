(() => {
'use strict';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const miniIcon = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const removeIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg>';
function markup({ multiple = false, title = '' } = {}) {
  return `<div class="work-picker" data-work-picker><div class="form-field"><label for="work-query">${multiple ? '작품 담기 (선택)' : '작품 제목 *'}</label><input id="work-query" class="field" name="${multiple ? 'workQuery' : 'title'}" ${multiple ? '' : 'required'} maxlength="160" placeholder="제목을 입력하고 작품을 선택하세요" value="${esc(title)}" autocomplete="off" autocapitalize="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-controls="work-suggestions" aria-expanded="false"></div><p class="lookup-status" data-work-status role="status">제목을 두 글자 이상 입력해 보세요.</p><div id="work-suggestions" class="work-suggestions" role="listbox" aria-label="작품 검색 결과" hidden></div><div class="picked-works" data-picked-works></div><div class="lookup-credit" data-work-credit></div></div>`;
}
function mount(form, { multiple = false, initial = [], onPick = () => {}, onClear = () => {}, onEnrich = () => {}, notify = () => {} } = {}) {
  const container = form.querySelector('[data-work-picker]');
  if (!container) return null;
  const input = container.querySelector('#work-query'), list = container.querySelector('[role="listbox"]');
  const credit = container.querySelector('[data-work-credit]');
  const status = container.querySelector('[data-work-status]'), chosen = container.querySelector('[data-picked-works]');
  let selected = [...initial], results = [], activeIndex = -1, controller = null, timer, sequence = 0, composing = false, disposed = false, loading = false, dismissed = false, selectedRequest = -1, pendingChoice = null;
  const connected = () => !disposed && form.isConnected;
  const same = (a, b) => a.catalogId && b.catalogId ? a.catalogId === b.catalogId : a.title === b.title && a.year === b.year;
  const meta = work => [work.type, work.year].filter(Boolean).join(' · ');
  const image = work => `<span class="lookup-art"><span aria-hidden="true">🎬</span>${work.posterUrl ? `<img src="${esc(work.posterUrl)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}</span>`;
  const bindImageErrors = area => area.querySelectorAll('img').forEach(img => img.addEventListener('error', () => img.remove(), { once: true }));
  function updateCredit() {
    const work = [...selected, ...(!list.hidden ? results : [])].find(work => work.sourceProvider === 'TVmaze');
    credit.innerHTML = work ? '<a href="' + esc(work.sourceUrl) + '" target="_blank" rel="noopener noreferrer">정보 출처: TVmaze ↗</a>' : '';
  }
  function hide() {
    dismissed = true; list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); activeIndex = -1; updateCredit();
  }
  function stop() { clearTimeout(timer); controller?.abort(); sequence++; loading = false; selectedRequest = -1; pendingChoice = null; }
  function renderSelected() {
    chosen.innerHTML = selected.length ? `<div class="picked-label">${multiple ? '담은 작품 ' + selected.length + '편' : '선택한 작품'}</div>${selected.map((work, index) => `<div class="picked-work">${image(work)}<div class="picked-copy"><strong>${esc(work.title)}</strong><span>${esc(meta(work))}</span><a href="${esc((window.WATCHSTACK_SEARCH?.namuUrl(work) || 'https://namu.wiki/Search?q=' + encodeURIComponent(work.title)))}" target="_blank" rel="noopener noreferrer">나무위키 ↗</a></div><button type="button" class="iconbtn" data-work-remove="${index}" aria-label="${esc(work.title)} 선택 취소">${removeIcon}</button></div>`).join('')}` : '';
    chosen.querySelectorAll('[data-work-remove]').forEach(button => button.addEventListener('click', () => {
      const index = Number(button.dataset.workRemove), removed = selected[index];
      if (!removed) return;
      if (pendingChoice && same(removed, pendingChoice)) stop();
      selected.splice(index, 1); onClear(removed, selected);
      if (!multiple) input.value = '';
      renderSelected(); status.textContent = '다른 작품을 검색할 수 있어요.'; input.focus({ preventScroll: true });
    }));
    bindImageErrors(chosen); updateCredit();
  }
  function choose(index) {
    const work = results[index]; if (!work || !connected()) return;
    if (multiple && selected.some(previous => same(previous, work))) return notify('이미 담은 작품이에요.');
    if (multiple && selected.length >= 1500) return notify('한 번에 1,500편까지 담을 수 있어요.');
    if (loading) { selectedRequest = sequence; pendingChoice = work; } else stop();
    selected = multiple ? [...selected, { ...work }] : [{ ...work }];
    input.value = multiple ? '' : work.title;
    onPick(work, selected); hide(); renderSelected();
    status.textContent = loading ? '작품을 선택했어요. 포스터 정보를 마저 불러오고 있어요.' : multiple ? '다른 작품도 이어서 검색해 보세요.' : '작품 정보를 자동으로 채웠어요.';
    input.focus({ preventScroll: true });
  }
  function paint(works) {
    results = works; activeIndex = -1;
    list.innerHTML = works.map((work, index) => `<button type="button" class="work-option" id="work-option-${index}" role="option" aria-selected="false" tabindex="-1" data-work-result="${index}">${image(work)}<span class="lookup-copy"><strong>${esc(work.title)}</strong><small>${esc(meta(work))}</small></span><span class="lookup-add" aria-hidden="true">${miniIcon}</span></button>`).join('');
    list.querySelectorAll('[data-work-result]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); choose(Number(button.dataset.workResult)); }));
    bindImageErrors(list);
    list.hidden = !works.length; input.setAttribute('aria-expanded', String(!!works.length)); input.removeAttribute('aria-activedescendant'); updateCredit();
  }
  function setActive(index) {
    if (!results.length) return;
    activeIndex = (index + results.length) % results.length;
    const buttons = list.querySelectorAll('[role="option"]');
    buttons.forEach((button, i) => { button.setAttribute('aria-selected', String(i === activeIndex)); button.classList.toggle('active', i === activeIndex); });
    const button = buttons[activeIndex];
    input.setAttribute('aria-activedescendant', button.id);
    button.scrollIntoView?.({ block: 'nearest' });
  }
  function schedule() {
    if (!connected()) return;
    stop(); dismissed = false;
    const query = input.value.trim();
    if (!multiple && selected.length && query !== selected[0].title) {
      const previous = selected[0]; selected = []; onClear(previous, selected); renderSelected();
    }
    if (query.length < 2) { hide(); status.textContent = query ? '두 글자 이상 입력해 주세요.' : ''; return; }
    const engine = window.WATCHSTACK_SEARCH;
    if (!engine) { hide(); status.textContent = '검색을 불러오지 못했어요. 직접 입력으로 추가할 수 있어요.'; return; }
    paint(engine.localWorks(query)); status.textContent = '작품을 찾고 있어요…';
    const requestId = sequence;
    timer = setTimeout(async () => {
      controller = new AbortController(); loading = true;
      try {
        const answer = await engine.search(query, { signal: controller.signal, onProgress(answer) {
          if (connected() && !dismissed && sequence === requestId && selectedRequest !== requestId && input.value.trim() === query) {
            paint(answer.works); status.textContent = '작품을 선택할 수 있어요. 포스터 정보를 불러오고 있어요…';
          }
        } });
        if (!connected() || sequence !== requestId) return;
        if (selectedRequest === requestId && pendingChoice) {
          const updated = answer.works.find(work => same(work, pendingChoice)), index = selected.findIndex(work => same(work, pendingChoice));
          if (updated && index >= 0) { const previous = selected[index]; selected[index] = updated; onEnrich(previous, updated, selected); renderSelected(); }
          selectedRequest = -1; pendingChoice = null;
          status.textContent = multiple ? '다른 작품도 이어서 검색해 보세요.' : '작품 정보를 자동으로 채웠어요.';
          return;
        }
        if (dismissed || input.value.trim() !== query) return;
        paint(answer.works);
        status.textContent = answer.offline
          ? answer.works.length ? '연결이 불안정해 저장된 작품 후보만 보여요.' : '검색에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'
          : answer.works.length ? '작품을 선택하면 정보가 자동으로 채워져요.' : '검색 결과가 없어요. 다른 제목으로 검색하거나 직접 입력해 주세요.';
      } catch (error) {
        if (error.name === 'AbortError' || !connected() || sequence !== requestId) return;
        status.textContent = '검색에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';
      } finally { if (sequence === requestId) loading = false; }
    }, 420);
  }
  input.addEventListener('compositionstart', () => { composing = true; stop(); });
  input.addEventListener('compositionend', () => { composing = false; schedule(); });
  input.addEventListener('input', event => { if (!composing && !event.isComposing) schedule(); });
  input.addEventListener('keydown', event => {
    if (composing || event.isComposing || event.keyCode === 229) return;
    if (!list.hidden && results.length && ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      if (event.key === 'Enter') choose(activeIndex >= 0 ? activeIndex : 0);
      else setActive(activeIndex < 0 ? (event.key === 'ArrowDown' ? 0 : results.length - 1) : activeIndex + (event.key === 'ArrowDown' ? 1 : -1));
    }
  });
  form.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !list.hidden) { event.preventDefault(); event.stopPropagation(); stop(); hide(); }
    if (event.key === 'Tab') hide();
  });
  form.addEventListener('click', event => { if (!container.contains(event.target)) hide(); });
  renderSelected();
  if (selected.length) status.textContent = '';
  const state = { get selected() { return [...selected]; }, dispose() { disposed = true; stop(); } };
  form.workPicker = state;
  return state;
}
window.WATCHSTACK_PICKER = Object.freeze({ markup, mount });
})();
