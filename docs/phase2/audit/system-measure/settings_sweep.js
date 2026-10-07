/* main. Sweeps settings pages: for each route in PAGES, lists section headers and every field row (label, control type, control and row size), plus focusable count, scroll height and font sizes. Navigation only; returns to the starting route. Usage: python glass.py js "$(cat docs/phase2/audit/system-measure/settings_sweep.js)(['/settings/system','/settings/audio'])" (about 1.5 s per page; keep batches under 30 pages for the 60 s js timeout). */
(async(PAGES)=>{
 const W=L.surface('main'); const D=W.document;
 const start=L.route();
 const G=t=>L.sel('%{*GamepadDialogContent>'+t+'}');
 const out=[];
 const r1=e=>{const r=e.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)]};
 for(const p of PAGES){
  L.nav(p); await L.sleep(1300);
  const pc=L.q('main','%{PagedSettingsDialog_PageList_ShowTitle>PagedSettingsDialog_PageContent}');
  if(!pc){out.push({p,err:'nopc'});continue;}
  const title=(pc.querySelector('.DialogHeader')||{}).innerText||'';
  const items=[];
  const walk=pc.querySelectorAll('.SettingsDialogSubHeader, '+G('Field')+', '+L.sel('%{Group}')+', '+L.sel('%{RecordingModeOption}')+', '+L.sel('%{InstallFolder}'));
  for(const el of walk){
   if(el.matches('.SettingsDialogSubHeader')){items.push('## '+el.innerText.trim());continue;}
   if(el.matches(L.sel('%{Group}'))){items.push('  [segmented '+[...el.children].map(c=>c.innerText.trim()).join('/')+'] '+r1(el.firstElementChild||el).join('x'));continue;}
   if(el.matches(L.sel('%{RecordingModeOption}'))){items.push('  [radiocard] '+el.innerText.trim().split('\n')[0]+' '+r1(el).join('x'));continue;}
   if(el.matches(L.sel('%{InstallFolder}'))){items.push('  [drivetab] '+el.innerText.trim().replace(/\n/g,' ')+' '+r1(el).join('x'));continue;}
   const lab=(el.querySelector(G('FieldLabel'))||{}).innerText||'';
   const desc=(el.querySelector(G('FieldDescription'))||{}).innerText||'';
   let ctl='row',cs=null;
   const tg=el.querySelector(G('Toggle')); const sl=el.querySelector('[role=slider]'); const dd=el.querySelector(L.sel('%{DropDownControlButton}'));
   const bt=[...el.querySelectorAll('button.DialogButton')].filter(b=>!b.matches(L.sel('%{DropDownControlButton}')));
   const inp=el.querySelector('input'); const val=el.querySelector(G('LabelFieldValue')); const cb=el.querySelectorAll('.DialogCheckbox');
   if(tg){ctl='toggle';cs=r1(tg)} else if(sl){ctl='slider';cs=r1(sl)} else if(dd){ctl='dropdown "'+dd.innerText.trim().split('\n')[0]+'"';cs=r1(dd)} else if(cb.length){ctl='checkbox×'+cb.length;cs=r1(cb[0])} else if(inp){ctl='input';cs=r1(inp)} else if(bt.length){ctl='button '+bt.map(b=>'"'+b.innerText.trim()+'"').join(',');cs=r1(bt[0])} else if(val){ctl='value "'+val.innerText.trim().slice(0,40)+'"'}
   const dis=el.matches(G('Disabled'))?' DISABLED':''; const clk=el.matches(G('Clickable'))?' clickable':'';
   const tgs=el.querySelectorAll(G('Toggle')); if(tgs.length>1) ctl='toggle×'+tgs.length;
   items.push('  '+(lab||'(no label)').replace(/\n/g,' ').slice(0,60)+(desc?' {desc}':'')+' :: '+ctl+(cs?' '+cs.join('x'):'')+' row '+r1(el)[1]+dis+clk);
  }
  const foc=[...pc.querySelectorAll('.Focusable')].filter(e=>e.getBoundingClientRect().height>0);
  const hs=foc.map(e=>e.getBoundingClientRect().height).sort((a,b)=>a-b);
  const fs=[...new Set([...pc.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.innerText&&e.innerText.trim()).map(e=>W.getComputedStyle(e).fontSize))].sort();
  out.push({p,title,scrollH:pc.scrollHeight,focusables:foc.length,minH:Math.round(hs[0]||0),medH:Math.round(hs[hs.length>>1]||0),fonts:fs.join(' '),items});
 }
 L.nav(start); await L.sleep(400);
 return JSON.stringify(out);
})
