/* Navigation is presentation state; storage keys and legal records stay unchanged. */
function syncCampusNavigation(page) {
  const currentPage = page || document.querySelector('.page.active')?.id || 'biblioteca';
  const currentSection = currentPage === 'biblioteca' ? lexShelf : currentPage;
  document.body.dataset.section=currentSection;
  document.querySelectorAll('.campus-nav button').forEach(button=>{
    const active=button.dataset.section===currentSection;
    button.classList.toggle('active',active);
    if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  });
  document.getElementById('workspaceSection').textContent=({leyes:'Biblioteca',guardadas:'Mis lecturas',archivos:'Material compartido',perfil:'Mi espacio',comunidad:'Comunidad'})[currentSection]||'Biblioteca';
}
function setCampusMenu(open, restoreFocus=true) {
  const mobile=matchMedia('(max-width:1100px)').matches;
  const visible=Boolean(open && mobile);
  const sidebar=document.getElementById('campusNavigation');
  const wasOpen=document.body.classList.contains('menu-open');
  document.body.classList.toggle('menu-open',visible);
  sidebar.classList.toggle('open',visible);
  document.getElementById('menuBackdrop').hidden=!visible;
  document.getElementById('menuToggle').setAttribute('aria-expanded',String(visible));
  sidebar.inert=mobile && !visible;
  document.querySelector('.campus-main').inert=visible;
  document.querySelector('.mobile-masthead').inert=visible;
  if(visible){sidebar.setAttribute('role','dialog');sidebar.setAttribute('aria-modal','true');sidebar.setAttribute('aria-label','Navegación principal');}
  else{sidebar.removeAttribute('role');sidebar.removeAttribute('aria-modal');sidebar.removeAttribute('aria-label');}
  if(visible)document.getElementById('menuClose').focus({preventScroll:true});
  else if(wasOpen && restoreFocus)document.getElementById('menuToggle').focus({preventScroll:true});
}
document.addEventListener('keydown',event=>{
  if(event.key==='Escape') {
    if(document.body.classList.contains('menu-open'))setCampusMenu(false);
    else if(document.getElementById('catalog').classList.contains('reading'))returnToCatalog();
  }
  const sheet=document.getElementById('catalog');
  if(event.key==='Tab' && sheet.classList.contains('reading') && matchMedia('(min-width:761px)').matches && !document.body.classList.contains('menu-open')) {
    const controls=[...document.querySelectorAll('#lawDetail a[href],#lawDetail button,#lawDetail summary,#lawDetail [tabindex="0"]')].filter(element=>element.getClientRects().length && !element.disabled);
    const first=controls[0],last=controls.at(-1);
    if(!document.getElementById('lawDetail').contains(document.activeElement)){event.preventDefault();first.focus();}
    else if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
  }
  if(event.key==='Tab' && document.body.classList.contains('menu-open')) {
    const controls=[...document.querySelectorAll('#campusNavigation button,#campusNavigation a')].filter(element=>element.getClientRects().length && !element.disabled);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
  }
});
window.addEventListener('popstate',()=>{if(!history.state?.lexRecord && document.getElementById('catalog').classList.contains('reading'))returnToCatalog(true);});
const menuBreakpoint=matchMedia('(max-width:1100px)');
menuBreakpoint.addEventListener('change',()=>setCampusMenu(false,false));
const readingBreakpoint=matchMedia('(max-width:760px)');
readingBreakpoint.addEventListener('change',()=>{
  if(!readingBreakpoint.matches && document.getElementById('catalog').classList.contains('reading')){
    document.getElementById('catalog').classList.remove('reading');
    setRecordSheet(false);
    document.querySelector('.library-heading').hidden=false;
    document.getElementById('catalogToolbar').hidden=lexShelf==='archivos';
    if(history.state?.lexRecord)history.replaceState(null,'',location.pathname+location.search);
  }
});
setCampusMenu(false,false);
syncCampusNavigation('biblioteca');
renderLibrary();
const initialRecord=location.hash.match(/^#norma-(\d+)$/);
if(initialRecord && laws[Number(initialRecord[1])]){
  lexLibraryLimit=laws.length;
  renderLibrary();
  openLaw(Number(initialRecord[1]));
}

document.getElementById('catalog').addEventListener('click',event=>{if(event.target===event.currentTarget && matchMedia('(min-width:761px)').matches && event.currentTarget.classList.contains('reading'))returnToCatalog();});
