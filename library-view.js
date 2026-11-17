/* The legal records and references in index.html remain authoritative. */
'use strict';
let lexLibraryLimit = 6;
let lexLibraryFilter = '';
let lexSelectedLaw = 0;
let lexShelf = 'leyes';
let lexExpandedAreas = false;
let lexCatalogScroll = 0;
let lexRecordTrigger = null;
const lexNormalizeSearch = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
const lexArrow = '<svg class="icon-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg>';
const lexBookmark = saved => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4Z" fill="' + (saved ? 'currentColor' : 'none') + '"/></svg>';

function renderLibrary() {
  const query = lexNormalizeSearch(document.getElementById('lawSearch')?.value || '').trim();
  const area = document.getElementById('lawArea')?.value || 'Todas las áreas';
  const type = document.getElementById('lawType')?.value || 'Todos los tipos';
  const savedOnly = document.getElementById('lawSaved')?.value === 'saved';
  const signature = JSON.stringify([query, area, type, savedOnly]);
  if (signature !== lexLibraryFilter) { lexLibraryLimit = 6; lexLibraryFilter = signature; }
  const favorites = new Set(store().savedLaws || []);
  const words = query.split(/\s+/).filter(Boolean);
  const filtered = laws.map((law, index) => ({ law, index })).filter(({ law }) =>
    words.every(word => lexNormalizeSearch(law.join(' ')).includes(word)) &&
    (area === 'Todas las áreas' || law[1] === area) &&
    (type === 'Todos los tipos' || law[2] === type) && (!savedOnly || favorites.has(law[0])));
  const shown = filtered.slice(0, lexLibraryLimit);
  const grid = document.getElementById('lawGrid');
  if (!grid) return;
  const active = document.activeElement;
  const focusedFavorite = active?.matches('.save-law') ? active.dataset.lawIndex : null;
  const focusedDetailSave = active?.id === 'detailSave';
  if (!shown.some(item => item.index === lexSelectedLaw)) lexSelectedLaw = shown[0]?.index ?? null;
  grid.innerHTML = shown.length ? shown.map(({ law, index }) => {
    const saved = favorites.has(law[0]);
    const selected = index === lexSelectedLaw;
    return `<article class="catalog-entry${selected ? ' selected' : ''}" data-law-index="${index}">
      <button class="catalog-select" type="button" data-law-index="${index}" aria-controls="lawDetail"${selected ? ' aria-current="true"' : ''} onclick="openLaw(${index}, this)"><h3 class="catalog-title" id="lawTitle${index}" tabindex="-1">${esc(law[0])}</h3><p class="catalog-meta">${esc(law[1])} <span aria-hidden="true">·</span> ${esc(law[2])}</p><span class="catalog-open" aria-hidden="true">Ver ficha <svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></span></button>
      <button class="save-law ${saved ? 'saved' : ''}" type="button" data-law-index="${index}" aria-label="${saved ? 'Quitar de favoritos' : 'Guardar en favoritos'}: ${esc(law[0])}" aria-pressed="${saved}" onclick="toggleSavedByIndex(${index})">${lexBookmark(saved)}</button>
    </article>`;
  }).join('') : `<div class="catalog-empty"><h3>${savedOnly ? 'Tu colección empieza aquí.' : 'No encontramos esa norma.'}</h3><p>${savedOnly ? 'Guarda una norma desde su ficha o desde el catálogo para volver a ella después.' : 'Prueba otro término o cambia los filtros de búsqueda.'}</p><button class="quiet-link" type="button" onclick="${savedOnly ? "openLibrary('leyes')" : 'resetLibraryFilters()'}">${savedOnly ? 'Explorar la biblioteca' : 'Limpiar búsqueda y filtros'}</button></div>`;
  for (const id of ['visibleLawCount', 'mobileLawCount']) {
    const count = document.getElementById(id); if (count) count.textContent = filtered.length;
  }
  const status = document.getElementById('libraryResultStatus');
  if (status) status.textContent = filtered.length ? `${shown.length} de ${filtered.length} ${filtered.length === 1 ? 'norma' : 'normas'}` : 'Sin resultados';
  const more = document.getElementById('lawLoadMore');
  if (more) { more.hidden = shown.length >= filtered.length; more.textContent = 'Ver más normas'; }
  document.getElementById('catalog').classList.toggle('no-results', !shown.length);
  if (lexShelf !== 'archivos') lexShelf = savedOnly ? 'guardadas' : 'leyes';
  renderLawDetail();
  renderAreaIndex();
  updateLibraryHeading();
  const savedCount = document.getElementById('savedNavCount');
  if (savedCount) savedCount.textContent = favorites.size;
  if (typeof syncCampusNavigation === 'function') syncCampusNavigation();
  if (focusedFavorite !== null) {
    const replacement = grid.querySelector(`.save-law[data-law-index="${focusedFavorite}"]`);
    (replacement || document.querySelector('.catalog-empty button'))?.focus({ preventScroll: true });
  } else if (focusedDetailSave) {
    (document.getElementById('detailSave') || document.querySelector('.record-empty button'))?.focus({ preventScroll: true });
  }
}
function renderLawDetail() {
  const pane = document.getElementById('lawDetail');
  if (!pane) return;
  const back = '<button class="record-back" type="button" onclick="returnToCatalog()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H4m6-6-6 6 6 6"/></svg> Volver al catálogo</button>';
  if (lexSelectedLaw === null || !laws[lexSelectedLaw]) {
    pane.innerHTML = back + '<div class="record-empty"><h2 id="recordTitle">Un lugar para tus próximas lecturas.</h2><p>Elige una norma del catálogo para consultar su ficha y sus fuentes.</p><button class="btn btn-outline" type="button" onclick="openLibrary(\'leyes\')">Ver todas las normas</button></div>';
    return;
  }
  const index = lexSelectedLaw, law = laws[index], reference = lawSources[index];
  const saved = isLawSaved(law[0]);
  const url = /^https:\/\//.test(reference.url) ? reference.url : '';
  const pdf = /^https:\/\//.test(reference.pdf || '') ? reference.pdf : '';
  pane.innerHTML = `${back}<div class="record-content">
    <header class="record-heading"><p class="record-kind">${esc(law[2])} <span aria-hidden="true">/</span> ${esc(law[1])}</p><h2 id="recordTitle" class="record-title" tabindex="-1">${esc(law[0])}</h2><button id="detailSave" class="record-save${saved ? ' saved' : ''}" type="button" aria-label="${saved ? 'Quitar de favoritos' : 'Guardar en favoritos'}: ${esc(law[0])}" aria-pressed="${saved}" onclick="toggleSavedByIndex(${index})">${lexBookmark(saved)}<span>${saved ? 'Guardada' : 'Guardar'}</span></button></header>
    <p class="record-summary">${esc(law[3])}</p>
    <dl class="record-facts"><div><dt>Área jurídica</dt><dd>${esc(law[1])}</dd></div><div><dt>Tipo de fuente</dt><dd>${esc(law[2])}</dd></div>${reference.edition ? `<div class="record-edition"><dt>Edición / referencia</dt><dd>${esc(reference.edition)}</dd></div>` : ''}<div><dt>Enlace revisado</dt><dd>${esc(reference.review)}</dd></div></dl>
    <div class="record-actions">${url ? `<a class="btn btn-primary record-source" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Consultar fuente oficial ${lexArrow}</a>` : '<span>Fuente no disponible</span>'}${pdf ? `<a class="btn btn-outline record-pdf" href="${esc(pdf)}" target="_blank" rel="noopener noreferrer">Abrir PDF ${lexArrow}</a>` : ''}</div>
    <details class="record-reference"><summary>Sobre esta fuente <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></summary><p class="law-note">${esc(reference.note)}</p></details>
    <p class="record-footer">Contrasta siempre las reformas vigentes en el Registro Oficial.</p>
  </div>`;
}
/* Hoja de lectura (≥761 px): diálogo modal; el fondo queda inerte mientras está abierta. */
function setRecordSheet(open) {
  const pane = document.getElementById('lawDetail');
  const sheet = Boolean(open) && !matchMedia('(max-width:760px)').matches;
  const targets = ['.campus-topbar','.library-heading','#catalogToolbar','.catalog-index','.campus-footer'];
  if (!matchMedia('(max-width:1100px)').matches) targets.push('.campus-sidebar');
  targets.forEach(selector => document.querySelectorAll(selector).forEach(element => { element.inert = sheet; }));
  if (sheet) { pane.setAttribute('role', 'dialog'); pane.setAttribute('aria-modal', 'true'); }
  else { pane.removeAttribute('role'); pane.removeAttribute('aria-modal'); }
}
function openLaw(index, trigger) {
  if (!laws[index]) return;
  lexSelectedLaw = index;
  lexRecordTrigger = trigger || document.querySelector(`.catalog-select[data-law-index="${index}"]`);
  renderLibrary();
  lexCatalogScroll = scrollY;
  if (!matchMedia('(max-width:760px)').matches) {
    document.getElementById('catalog').classList.add('reading');
    setRecordSheet(true);
    document.getElementById('recordTitle')?.focus({preventScroll:true});
  } else {
    document.getElementById('catalog').classList.add('reading');
    document.getElementById('catalogToolbar').hidden = true;
    document.querySelector('.library-heading').hidden = true;
    if (!history.state?.lexRecord) history.pushState({lexRecord: true}, '', '#norma-' + index);
    scrollTo({top:0,behavior:'instant'});
    document.getElementById('recordTitle')?.focus({preventScroll:true});
  }
}
function returnToCatalog(fromHistory = false) {
  const catalog = document.getElementById('catalog');
  setRecordSheet(false);
  catalog.classList.remove('reading');
  document.getElementById('catalogToolbar').hidden = lexShelf === 'archivos';
  document.querySelector('.library-heading').hidden = false;
  if (history.state?.lexRecord && !fromHistory) history.back();
  scrollTo({top:lexCatalogScroll,behavior:'instant'});
  const replacement = document.querySelector(`.catalog-select[data-law-index="${lexSelectedLaw}"]`) || document.querySelector('.catalog-empty button');
  replacement?.focus({preventScroll:true});
}
function loadMoreLaws() {
  const previousCount = document.querySelectorAll('#lawGrid .catalog-entry').length;
  lexLibraryLimit += 6;
  renderLibrary();
  document.querySelectorAll('#lawGrid .catalog-select')[previousCount]?.focus({ preventScroll: true });
}
function resetLibraryFilters() {
  document.getElementById('lawSearch').value = '';
  document.getElementById('lawArea').selectedIndex = 0;
  document.getElementById('lawType').selectedIndex = 0;
  document.getElementById('lawSaved').value = 'all';
  lexShelf = 'leyes';
  renderLibrary();
  document.getElementById('lawSearch').focus({ preventScroll: true });
}
function updateLibraryHeading() {
  const headings = {leyes:['Biblioteca jurídica','Encuentra una norma. Abre su ficha. Consulta la fuente.'],guardadas:['Mis lecturas','Las normas que quieres tener a mano.'],archivos:['Material compartido','Apuntes, guías y documentos subidos por la administración. Consúltalos y descárgalos gratis.']};
  const copy = headings[lexShelf] || headings.leyes;
  document.getElementById('libraryHeading').textContent = copy[0];
  document.getElementById('libraryIntro').textContent = copy[1];
}
function openLibrary(which = 'leyes', reset = true) {
  if (history.state?.lexRecord) history.replaceState(null,'',location.pathname+location.search);
  if (!matchMedia('(max-width:760px)').matches) document.getElementById('catalog').classList.remove('reading');
  setRecordSheet(false);
  lexShelf = ['leyes','guardadas','archivos'].includes(which) ? which : 'leyes';
  document.querySelector('.library-heading').hidden = false;
  document.getElementById('catalogToolbar').hidden = lexShelf === 'archivos';
  document.getElementById('lexShelfLaws').classList.toggle('hidden',lexShelf==='archivos');
  document.getElementById('lexShelfFiles').classList.toggle('hidden',lexShelf!=='archivos');
  if (reset && lexShelf !== 'archivos') {
    document.getElementById('lawSearch').value = '';
    document.getElementById('lawArea').selectedIndex = 0;
    document.getElementById('lawType').selectedIndex = 0;
  }
  if (lexShelf !== 'archivos') document.getElementById('lawSaved').value = lexShelf==='guardadas'?'saved':'all';
  goById('biblioteca');
  if (lexShelf === 'archivos') lexLoadDocuments(false); else renderLibrary();
  updateLibraryHeading();
  syncCampusNavigation('biblioteca');
}
function renderAreaIndex() {
  const box = document.getElementById('areaIndex');
  if (!box) return;
  const areas = [...new Set(laws.map(law=>law[1]))];
  const preferred = ['Constitucional','Civil','Penal','Procesal','Laboral'];
  const ordered = [...preferred.filter(area=>areas.includes(area)),...areas.filter(area=>!preferred.includes(area))];
  const shown = lexExpandedAreas ? ordered : ordered.slice(0,5);
  const selected = document.getElementById('lawArea').value;
  const allActive = selected==='Todas las áreas' && lexShelf!=='archivos';
  box.innerHTML = `<button class="area-link${allActive?' active':''}" type="button" data-area="Todas las áreas"${allActive?' aria-current="true"':''} onclick="selectLibraryArea(this.dataset.area)"><span>Todas</span><span>${laws.length}</span></button>` + shown.map(area=>`<button class="area-link${selected===area && lexShelf!=='archivos'?' active':''}" type="button" data-area="${esc(area)}"${selected===area && lexShelf!=='archivos'?' aria-current="true"':''} onclick="selectLibraryArea(this.dataset.area)"><span>${esc(area)}</span><span>${laws.filter(law=>law[1]===area).length}</span></button>`).join('');
  const more = document.getElementById('areaIndexMore');
  more.setAttribute('aria-expanded',String(lexExpandedAreas));
  more.innerHTML = `${lexExpandedAreas?'Ver menos materias':'Ver todas las materias'} <span aria-hidden="true">${lexExpandedAreas?'−':'+'}</span>`;
}
function toggleAreaIndex() { lexExpandedAreas=!lexExpandedAreas; renderAreaIndex(); }
function selectLibraryArea(area) {
  openLibrary('leyes',false);
  document.getElementById('lawSearch').value='';
  document.getElementById('lawType').selectedIndex=0;
  document.getElementById('lawArea').value=area;
  renderLibrary();
  setCampusMenu(false,false);
  document.getElementById('lawSearch').focus({preventScroll:true});
}
