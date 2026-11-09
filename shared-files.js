/* Catálogo público: los archivos se publican desde la carpeta materiales/ del repositorio. */
const LEX_MATERIALS_OWNER='cuentautmach-svg';
const LEX_MATERIALS_REPO='lex-studium';
let lexMaterials=[];
let lexMaterialsLoaded=false;
const lexMaterialTypes=/\.(pdf|docx?|pptx?|xlsx?|odt|ods|txt|md|png|jpe?g|webp|zip|epub)$/i;
function lexSwitchShelf(which){
  const showFiles=which==='archivos';
  document.getElementById('lexShelfLaws').classList.toggle('hidden',showFiles);
  document.getElementById('lexShelfFiles').classList.toggle('hidden',!showFiles);
  const a=document.getElementById('lexTabLaws'),b=document.getElementById('lexTabFiles');
  a.classList.toggle('active',!showFiles);b.classList.toggle('active',showFiles);
  a.setAttribute('aria-selected',String(!showFiles));b.setAttribute('aria-selected',String(showFiles));a.tabIndex=showFiles?-1:0;b.tabIndex=showFiles?0:-1;
  if(showFiles)lexLoadDocuments(false);
}
function lexNiceFileName(path){
  return path.split('/').pop().replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim();
}
function lexFileURL(path){
  return 'https://'+LEX_MATERIALS_OWNER+'.github.io/'+LEX_MATERIALS_REPO+'/'+path.split('/').map(encodeURIComponent).join('/');
}
function lexFileSize(n){
  if(n<1024)return n+' B';
  if(n<1024*1024)return (n/1024).toFixed(1)+' KB';
  return (n/(1024*1024)).toFixed(1)+' MB';
}
function lexRenderDocuments(){
  const box=document.getElementById('lexDocsGrid'),status=document.getElementById('lexDocsStatus');
  if(!box||!status)return;
  if(!lexMaterialsLoaded)return;
  const q=document.getElementById('lexDocsSearch').value.toLocaleLowerCase('es');
  const filtered=lexMaterials.filter(x=>x.path.toLocaleLowerCase('es').includes(q)||lexNiceFileName(x.path).toLocaleLowerCase('es').includes(q));
  status.textContent=filtered.length+' archivo'+(filtered.length===1?' disponible':'s disponibles')+' para ver y descargar.';
  if(!filtered.length){
    box.innerHTML='<div class="lex-docs-empty"><strong>'+(q?'No encontramos archivos con esa búsqueda.':'Todavía no hay archivos compartidos.')+'</strong>'+(q?'Prueba otra palabra.':'La administración puede cargar el primer documento desde el botón de GitHub que aparece abajo.')+'</div>';
    return;
  }
  box.innerHTML=filtered.map(x=>{
    const extension=x.path.split('.').pop().toUpperCase();
    const viewIcon='<svg class="file-outline" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h9l5 5v13H5Z"/><path d="M14 3v6h5M8 13h8M8 17h6"/></svg>';
    const url=lexFileURL(x.path);
    const folder=x.path.split('/').slice(1,-1).join(' / ')||'Material general';
    const filename=x.path.split('/').pop();
    return '<article class="lex-doc-card">'+
      '<div class="lex-doc-badge"><span class="lex-doc-icon">'+viewIcon+'</span><span class="lex-doc-format">'+esc(extension)+'</span></div>'+
      '<h4 class="lex-doc-name">'+esc(lexNiceFileName(x.path))+'</h4>'+
      '<div class="lex-doc-context">'+esc(folder)+' · '+lexFileSize(x.size)+'</div>'+
      '<div class="lex-doc-actions"><a class="btn btn-outline" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Ver archivo <svg class="icon-arrow" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 19 19 5M5 5h14v14"/></svg></a><a class="btn btn-primary" href="'+esc(url)+'" download="'+esc(filename)+'">Descargar <svg class="icon-arrow" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v13m-5-5 5 5 5-5M4 19v3h16v-3"/></svg></a></div>'+
      '</article>';
  }).join('');
}
async function lexLoadDocuments(force){
  if(lexMaterialsLoaded&&!force){lexRenderDocuments();return}
  const status=document.getElementById('lexDocsStatus'),box=document.getElementById('lexDocsGrid');
  if(!status||!box)return;
  status.textContent='Consultando los archivos compartidos en GitHub…';box.innerHTML='';
  try{
    const api='https://api.github.com/repos/'+LEX_MATERIALS_OWNER+'/'+LEX_MATERIALS_REPO+'/git/trees/main?recursive=1';
    const response=await fetch(api,{headers:{Accept:'application/vnd.github+json'}});
    if(!response.ok)throw new Error('GitHub respondió '+response.status);
    const data=await response.json();
    if(!Array.isArray(data.tree))throw new Error('Listado no disponible');
    lexMaterials=data.tree.filter(x=>x.type==='blob'&&x.path.startsWith('materiales/')&&lexMaterialTypes.test(x.path)&&!/^(_|README\.)/i.test(x.path.split('/').pop()));
    lexMaterials.sort((a,b)=>a.path.localeCompare(b.path,'es',{sensitivity:'base'}));
    lexMaterialsLoaded=true;
    lexRenderDocuments();
    if(data.truncated)status.textContent+=' Algunos elementos pueden faltar porque el repositorio es muy grande.';
  }catch(err){
    lexMaterialsLoaded=false;
    status.textContent='Ahora no se pudo consultar el catálogo ('+err.message+'). Puedes reintentar.';
    box.innerHTML='<div class="lex-docs-empty">También puedes consultar los documentos directamente en <a href="https://github.com/'+LEX_MATERIALS_OWNER+'/'+LEX_MATERIALS_REPO+'/tree/main/materiales" target="_blank" rel="noopener noreferrer">GitHub <svg class="icon-arrow" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 19 19 5M5 5h14v14"/></svg></a>.</div>';
  }
}

document.querySelector('.lex-library-tabs').addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();
  const showFiles=event.key==='End'||(event.key!=='Home'&&document.activeElement.id==='lexTabLaws');
  lexSwitchShelf(showFiles?'archivos':'leyes');
  document.getElementById(showFiles?'lexTabFiles':'lexTabLaws').focus();
});
