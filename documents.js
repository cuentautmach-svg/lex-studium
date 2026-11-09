/* Extensión de la biblioteca existente. Funciona también en GitHub Pages. */
'use strict';
const LEX_MATERIALS_OWNER = 'cuentautmach-svg';
const LEX_MATERIALS_REPO = 'lex-studium';
const lexMaterialTypes = /\.(pdf|docx?|pptx?|xlsx?|odt|ods|txt|md|png|jpe?g|webp|zip|epub)$/i;
const LEX_MAX_UPLOAD = 20 * 1024 * 1024;
let lexMaterials = [];
let lexMaterialsLoaded = false;
let lexDocumentsLoading = null;
let lexCatalogNotice = '';
let lexAdminSession = null;
let lexSessionLoading = null;
const lexById = id => document.getElementById(id);

function lexSwitchShelf(which) {
  const showFiles = which === 'archivos';
  lexById('lexShelfLaws').classList.toggle('hidden', showFiles);
  lexById('lexShelfFiles').classList.toggle('hidden', !showFiles);
  for (const [id, active] of [['lexTabLaws', !showFiles], ['lexTabFiles', showFiles]]) {
    const tab = lexById(id);
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  }
  if (showFiles) lexLoadDocuments(false);
}
function lexNiceFileName(path) {
  return path.split('/').pop().replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}
function lexFileSize(size) {
  if (size < 1024) return size + ' B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
  return (size / (1024 * 1024)).toFixed(1) + ' MB';
}
function lexSafeURL(value) {
  try {
    const url = new URL(value, location.href);
    return /^https?:$/.test(url.protocol) ? url.href : '#';
  } catch { return '#'; }
}
async function lexFetchJSON(url, options = {}) {
  const response = await fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(12000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'No se pudo completar la solicitud. Inténtalo de nuevo.');
    error.status = response.status;
    throw error;
  }
  return data;
}
function lexRenderDocuments() {
  if (!lexMaterialsLoaded) return;
  const query = lexById('lexDocsSearch').value.trim().toLocaleLowerCase('es');
  const files = lexMaterials.filter(file => [file.title, file.description, file.filename, file.folder].join(' ').toLocaleLowerCase('es').includes(query));
  lexById('lexDocsStatus').textContent = files.length + (files.length === 1 ? ' archivo disponible' : ' archivos disponibles') + ' para consultar y descargar.' + lexCatalogNotice;
  if (!files.length) {
    lexById('lexDocsGrid').innerHTML = '<div class="lex-docs-empty"><strong>' + (query ? 'No encontramos archivos con esa búsqueda.' : 'Todavía no hay archivos compartidos.') + '</strong>' + (query ? 'Prueba otra palabra.' : 'Los documentos publicados por la administración aparecerán aquí.') + '</div>';
    return;
  }
  lexById('lexDocsGrid').innerHTML = files.map(file => {
    const extension = file.extension.toUpperCase();
    const isOffice = /^(DOCX?|PPTX?)$/.test(extension);
    const icon = extension === 'PDF' ? '📕' : /^DOC/.test(extension) ? '📝' : /^PPT/.test(extension) ? '📊' : '📂';
    const view = file.managed && isOffice ? '' : '<a class="btn btn-outline" href="' + esc(lexSafeURL(file.viewUrl)) + '" target="_blank" rel="noopener noreferrer" aria-label="Ver ' + esc(file.title) + ' en otra pestaña">Ver archivo ↗</a>';
    return '<article class="lex-doc-card"><div class="lex-doc-badge"><span class="lex-doc-icon" aria-hidden="true">' + icon + '</span><span class="lex-doc-format">' + esc(extension) + '</span></div><h4 class="lex-doc-name">' + esc(file.title) + '</h4>' + (file.description ? '<p class="lex-doc-description">' + esc(file.description) + '</p>' : '') + '<div class="lex-doc-context">' + esc(file.folder || 'Material compartido') + ' · ' + lexFileSize(file.size) + '</div><div class="lex-doc-actions">' + view + '<a class="btn btn-primary" href="' + esc(lexSafeURL(file.downloadUrl)) + '" download="' + esc(file.filename) + '" aria-label="Descargar ' + esc(file.title) + '">Descargar ↓</a></div></article>';
  }).join('');
}
async function lexLoadDocuments(force) {
  if (lexDocumentsLoading) return lexDocumentsLoading;
  if (lexMaterialsLoaded && !force) { lexRenderDocuments(); return; }
  lexDocumentsLoading = lexRefreshDocuments();
  try { await lexDocumentsLoading; } finally { lexDocumentsLoading = null; }
}
async function lexRefreshDocuments() {
  const status = lexById('lexDocsStatus');
  const refresh = lexById('lexDocsRefresh');
  refresh.disabled = true;
  refresh.textContent = 'Consultando…';
  lexById('lexDocsGrid').setAttribute('aria-busy', 'true');
  status.textContent = 'Consultando los archivos compartidos…';
  try {
    const [managed, legacy] = await Promise.allSettled([
      lexFetchJSON('/api/documents').then(data => {
        if (!Array.isArray(data.documents)) throw new Error('Catálogo no disponible');
        return data.documents.map(file => ({ ...file, managed: true }));
      }),
      lexFetchJSON('https://api.github.com/repos/' + LEX_MATERIALS_OWNER + '/' + LEX_MATERIALS_REPO + '/git/trees/main?recursive=1', { headers: { Accept: 'application/vnd.github+json' } }).then(data => {
        if (!Array.isArray(data.tree)) throw new Error('Catálogo no disponible');
        return { truncated: data.truncated, files: data.tree.filter(item => item.type === 'blob' && item.path.startsWith('materiales/') && lexMaterialTypes.test(item.path) && !/^(_|README\.)/i.test(item.path.split('/').pop())).map(item => {
          const url = 'https://' + LEX_MATERIALS_OWNER + '.github.io/' + LEX_MATERIALS_REPO + '/' + item.path.split('/').map(encodeURIComponent).join('/');
          const downloadUrl = 'https://raw.githubusercontent.com/' + LEX_MATERIALS_OWNER + '/' + LEX_MATERIALS_REPO + '/main/' + item.path.split('/').map(encodeURIComponent).join('/');
          return { title: lexNiceFileName(item.path), filename: item.path.split('/').pop(), extension: item.path.split('.').pop(), folder: item.path.split('/').slice(1, -1).join(' / ') || 'Material general', size: item.size, viewUrl: url, downloadUrl };
        }) };
      })
    ]);
    if (managed.status === 'rejected' && legacy.status === 'rejected') throw new Error('No se pudo consultar el catálogo.');
    const localFiles = managed.status === 'fulfilled' ? managed.value : lexMaterials.filter(file => file.managed);
    const legacyFiles = legacy.status === 'fulfilled' ? legacy.value.files : lexMaterials.filter(file => !file.managed);
    lexMaterials = [...localFiles, ...legacyFiles].sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }));
    lexMaterialsLoaded = true;
    lexCatalogNotice = legacy.status === 'rejected' ? ' Los materiales anteriores de GitHub no se pudieron actualizar; puedes reintentar.' : legacy.value.truncated ? ' GitHub devolvió una lista incompleta; puede haber más materiales.' : '';
    if (managed.status === 'rejected' && managed.reason.status !== 404) lexCatalogNotice += ' No se pudieron actualizar los documentos cargados desde la página.';
    lexRenderDocuments();
  } catch {
    if (lexMaterialsLoaded) {
      lexCatalogNotice = ' No se pudo actualizar: se conserva el último listado. Inténtalo de nuevo.';
      lexRenderDocuments();
    } else {
      status.textContent = 'No se pudo consultar el catálogo. Pulsa Actualizar para reintentar.';
      lexById('lexDocsGrid').innerHTML = '<div class="lex-docs-empty">Puedes consultar los materiales anteriores en <a href="https://github.com/' + LEX_MATERIALS_OWNER + '/' + LEX_MATERIALS_REPO + '/tree/main/materiales" target="_blank" rel="noopener noreferrer">GitHub ↗</a>.</div>';
    }
  } finally {
    refresh.disabled = false;
    refresh.textContent = '↻ Actualizar';
    lexById('lexDocsGrid').setAttribute('aria-busy', 'false');
  }
}

function lexShowSession(session) {
  lexAdminSession = session;
  lexById('lexAdminLogin').classList.toggle('hidden', !session.configured || session.authenticated);
  lexById('lexUploadForm').classList.toggle('hidden', !session.authenticated);
  lexById('lexGithubUpload').classList.toggle('hidden', session.configured);
  lexById('lexAdminStatus').textContent = session.authenticated ? 'Puedes publicar materiales para todos los visitantes.' : session.configured ? 'Inicia sesión para subir documentos. Los visitantes no necesitan una cuenta para descargarlos.' : 'La carga desde esta página está pendiente de activación. Puedes seguir publicando materiales desde GitHub.';
}
async function lexCheckSession() {
  if (lexSessionLoading) return lexSessionLoading;
  lexById('lexAdminStatus').textContent = 'Comprobando el acceso de administración…';
  lexSessionLoading = lexFetchJSON('/api/admin/session').then(lexShowSession).catch(error => {
    lexShowSession({ configured: false, authenticated: false });
    if (error.status !== 404) lexById('lexAdminStatus').textContent = 'No se pudo comprobar el acceso de administración. Cierra y abre este panel para reintentar. También puedes publicar desde GitHub.';
  });
  try { await lexSessionLoading; } finally { lexSessionLoading = null; }
}
lexById('lexAdminPanel').addEventListener('toggle', event => { if (event.target.open) lexCheckSession(); });
lexById('lexAdminLogin').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  button.textContent = 'Iniciando sesión…';
  try {
    const session = await lexFetchJSON('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: lexById('lexAdminPassword').value }) });
    lexShowSession(session);
    lexById('lexAdminPassword').value = '';
    lexById('lexDocumentTitle').focus();
  } catch (error) { lexById('lexAdminStatus').textContent = error.message; }
  finally { button.disabled = false; button.textContent = 'Iniciar sesión'; }
});
lexById('lexAdminLogout').addEventListener('click', async () => {
  const button = lexById('lexAdminLogout');
  button.disabled = true;
  try {
    await lexFetchJSON('/api/admin/logout', { method: 'POST', headers: { 'X-CSRF-Token': lexAdminSession?.csrfToken || '' } });
    lexById('lexUploadForm').reset();
    lexById('lexFileSelected').textContent = '';
    lexById('lexUploadStatus').textContent = '';
    lexShowSession({ configured: true, authenticated: false });
    lexById('lexAdminPassword').focus();
  } catch (error) { lexById('lexAdminStatus').textContent = error.message; }
  finally { button.disabled = false; }
});
lexById('lexDocumentFile').addEventListener('change', event => {
  const file = event.target.files[0];
  lexById('lexFileSelected').textContent = file ? file.name + ' · ' + lexFileSize(file.size) : '';
  if (file && !lexById('lexDocumentTitle').value) lexById('lexDocumentTitle').value = lexNiceFileName(file.name).slice(0, 160);
});
lexById('lexUploadForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const file = lexById('lexDocumentFile').files[0];
  const status = lexById('lexUploadStatus');
  if (!file || !/\.(pdf|docx?|pptx?)$/i.test(file.name)) { status.textContent = 'Selecciona un archivo PDF, Word o PowerPoint.'; return; }
  if (file.size > LEX_MAX_UPLOAD) { status.textContent = 'El archivo supera los 20 MB. Selecciona uno más pequeño.'; return; }
  const controls = [...form.querySelectorAll('input,textarea,button')];
  const data = new FormData(form);
  controls.forEach(control => { control.disabled = true; });
  lexById('lexUploadSubmit').textContent = 'Subiendo documento…';
  form.setAttribute('aria-busy', 'true');
  status.textContent = 'Subiendo y comprobando el archivo. Espera a la confirmación.';
  try {
    await lexFetchJSON('/api/documents', { method: 'POST', headers: { 'X-CSRF-Token': lexAdminSession?.csrfToken || '' }, body: data, signal: AbortSignal.timeout(120000) });
    form.reset();
    lexById('lexFileSelected').textContent = '';
    status.textContent = 'Documento publicado. Ya está disponible para consultar y descargar.';
    await lexLoadDocuments(true);
  } catch (error) {
    status.textContent = error.message;
    if (error.status === 401 || error.status === 403) { await lexCheckSession(); lexById('lexAdminStatus').textContent = 'Tu sesión necesita renovarse. Inicia sesión de nuevo y vuelve a seleccionar el documento.'; }
  } finally {
    controls.forEach(control => { control.disabled = false; });
    lexById('lexUploadSubmit').textContent = 'Subir y publicar documento ↑';
    form.setAttribute('aria-busy', 'false');
  }
});
document.querySelector('.lex-library-tabs').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const files = event.key === 'End' || (event.key !== 'Home' && document.activeElement.id === 'lexTabLaws');
  lexSwitchShelf(files ? 'archivos' : 'leyes');
  lexById(files ? 'lexTabFiles' : 'lexTabLaws').focus();
});
