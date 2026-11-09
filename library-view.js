/* Presentation only: the existing legal records, references and favorites remain authoritative. */
'use strict';
let lexLibraryLimit = 6;
let lexLibraryFilter = '';
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
  const focusedFavorite = document.activeElement?.matches('.save-law') ? document.activeElement.dataset.lawIndex : null;
  const openReferences = new Set([...grid.querySelectorAll('.law-details[open]')].map(element => element.dataset.lawIndex));
  grid.innerHTML = shown.length ? shown.map(({ law, index }) => {
    const reference = lawSources[index];
    const saved = favorites.has(law[0]);
    const sourceURL = /^https?:\/\//.test(reference.url) ? reference.url : '';
    return `<article class="law-card" data-law-index="${index}">
      <div class="law-card-primary">
        <div class="law-heading"><h3 id="lawTitle${index}" tabindex="-1">${esc(law[0])}</h3><p class="law-summary">${esc(law[3])}</p></div>
        <button class="save-law ${saved ? 'saved' : ''}" type="button" data-law-index="${index}" aria-label="${saved ? 'Quitar de favoritos' : 'Guardar en favoritos'}: ${esc(law[0])}" aria-pressed="${saved}" onclick="toggleSavedByIndex(${index})">${lexBookmark(saved)}</button>
        ${sourceURL ? `<a class="law-card-main-action law-title-link" href="${esc(sourceURL)}" target="_blank" rel="noopener noreferrer" aria-label="Consultar ${esc(law[0])} en la fuente oficial">Consultar ${lexArrow}</a>` : '<span class="law-source-unavailable">Fuente no disponible</span>'}
      </div>
      <details class="law-details" data-law-index="${index}"${openReferences.has(String(index)) ? ' open' : ''}>
        <summary>Referencia y opciones <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></summary>
        <div class="law-details-body"><dl class="law-reference"><div><dt>Área</dt><dd>${esc(law[1])} · ${esc(law[2])}</dd></div><div><dt>Enlace revisado</dt><dd>${esc(reference.review)}</dd></div>${reference.edition ? `<div><dt>Edición / referencia</dt><dd>${esc(reference.edition)}</dd></div>` : ''}</dl>
          <p class="law-note">${esc(reference.note)}</p>
          ${reference.pdf ? `<div class="law-actions"><a class="btn btn-outline" href="${esc(reference.pdf)}" target="_blank" rel="noopener noreferrer">Abrir PDF oficial ${lexArrow}</a><span>El visor oficial permite consultar y guardar el documento.</span></div>` : ''}
        </div>
      </details>
    </article>`;
  }).join('') : `<div class="empty"><p>${savedOnly ? 'Todavía no hay favoritos que coincidan.' : 'No encontramos una norma con esos filtros.'}</p><button class="quiet-link" type="button" onclick="resetLibraryFilters()">Limpiar búsqueda y filtros</button></div>`;
  for (const id of ['visibleLawCount', 'mobileLawCount']) {
    const count = document.getElementById(id); if (count) count.textContent = filtered.length;
  }
  const status = document.getElementById('libraryResultStatus');
  if (status) status.textContent = filtered.length ? `${shown.length} de ${filtered.length} ${filtered.length === 1 ? 'norma' : 'normas'}${savedOnly ? ' favoritas' : ''}` : 'Sin resultados';
  const more = document.getElementById('lawLoadMore');
  if (more) { more.hidden = shown.length >= filtered.length; more.textContent = 'Mostrar más normas'; }
  if (focusedFavorite !== null) {
    const replacement = grid.querySelector(`.save-law[data-law-index="${focusedFavorite}"]`);
    (replacement || document.getElementById('lawSaved'))?.focus({ preventScroll: true });
  }
}
function loadMoreLaws() {
  const previousCount = document.querySelectorAll('#lawGrid .law-card').length;
  lexLibraryLimit += 6;
  renderLibrary();
  document.querySelectorAll('#lawGrid .law-heading h3')[previousCount]?.focus({ preventScroll: true });
}
function resetLibraryFilters() {
  document.getElementById('lawSearch').value = '';
  document.getElementById('lawArea').selectedIndex = 0;
  document.getElementById('lawType').selectedIndex = 0;
  document.getElementById('lawSaved').value = 'all';
  renderLibrary();
  document.getElementById('lawSearch').focus({ preventScroll: true });
}
