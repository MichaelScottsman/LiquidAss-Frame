/* main + bar + barpopup. Opens Quick Access from the bar (a click on its button), switches through every tab (tabs only change the visible panel) and lists section headers and field rows with sizes. Never operates a control; the locked step closes the popup afterwards and the script clears its faked hover (a leftover hover leaves a 'Quick Access Menu' tooltip stuck under the bar). Usage: python glass.py js "$(cat docs/phase2/audit/system-measure/qam_sweep.js)" */
(async()=>{
 const W=ms=>new Promise(r=>setTimeout(r,ms));
 for(const p of SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance.VRDashboardBarPopups)p.closePopup();
 await W(400);
 const el=L.q('bar','%{QuickAccessButton}'); L.click('bar','%{QuickAccessButton}'); el.dispatchEvent(new(L.surface('bar').MouseEvent)('mouseenter')); await W(1000);
 const S=L.surface('barpopup');
 const r1=e=>{const r=e.getBoundingClientRect();return Math.round(r.width)+'x'+Math.round(r.height)};
 const G=t=>L.sel('%{*GamepadDialogContent>'+t+'}');
 const out={};
 const tabs=L.qa('barpopup','[role=tab]');
 for(const t of tabs){
  const name=t.getAttribute('aria-label');
  L.click('barpopup','[role=tab][aria-label="'+name+'"]'); await W(800);
  const panel=L.q('barpopup','%{ActiveTab} %{TabGroupPanel}')||L.q('barpopup','%{ActiveTab}');
  const items=[];
  for(const e of panel.querySelectorAll('.SettingsDialogSubHeader, '+L.sel('%{*PanelSection>PanelSectionTitle}')+', '+G('Field')+', button.DialogButton')){
    if(e.matches('button.DialogButton')){ if(e.closest(G('Field'))) continue; items.push('  [button] "'+e.innerText.trim()+'" '+r1(e)); continue;}
    if(!e.matches(G('Field'))){items.push('## '+e.innerText.trim()+' ('+S.getComputedStyle(e).fontSize+' '+S.getComputedStyle(e).textTransform+')');continue;}
    const lab=(e.querySelector(G('FieldLabel'))||{}).innerText||'';
    const desc=(e.querySelector(G('FieldDescription'))||{}).innerText||'';
    const tg=e.querySelector(G('Toggle')), sl=e.querySelector('[role=slider]'), bt=e.querySelector('button.DialogButton');
    let c='row'; let cs='';
    if(tg){c='toggle';cs=r1(tg)} else if(sl){c='slider "'+(sl.getAttribute('aria-label')||'')+'" notches='+sl.querySelectorAll(L.sel('%{*SliderControlPanelGroup>SliderNotch}')).length; cs=r1(sl)} else if(bt){c='button "'+bt.innerText.trim()+'"';cs=r1(bt)}
    items.push('  '+(lab||'(no label)').replace(/\n/g,' ').slice(0,50)+(desc?' {desc: '+desc.replace(/\n/g,' ').slice(0,40)+'}':'')+' :: '+c+' '+cs+' row '+r1(e)+(e.matches(G('Disabled'))?' DISABLED':'')+(e.matches(G('Clickable'))?' clickable':''));
  }
  const ex=[...panel.querySelectorAll('*')].filter(x=>x.childElementCount===0&&x.innerText&&x.innerText.trim()&&!x.closest(G('Field'))&&!x.closest('button')).map(x=>'"'+x.innerText.trim().slice(0,40)+'" '+S.getComputedStyle(x).fontSize);
  items.push('  other text: '+ex.slice(0,12).join(' ; '));
  out[name]=items;
 }
 L.click('barpopup','[role=tab][aria-label="Quick Settings"]'); await W(300);
 el.dispatchEvent(new(L.surface('bar').MouseEvent)('mouseleave')); /* clear the faked hover so no tooltip stays stuck under the bar */
 return JSON.stringify(out);
})()
