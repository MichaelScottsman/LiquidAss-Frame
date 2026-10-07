/* Glass Shell Phase 2 concept "window-nav": builds the chrome shared by the window-nav-*.html
 * mockups (tab-bar ornament, toolbar row, bottom ornament, SteamVR frame controls, dashboard
 * bar, window-bar pill, laser, keyboard). Runs synchronously before kit.js, which then turns the
 * <i data-i> icons into SVG, paints art, measures the room under each glass and adds lensing.
 *
 * Placeholders: <div data-wn="KIND" ...options...></div>. Positions are view px (1920 x 1080)
 * for quads outside the window, and main-window px for parts inside .lgk-overlay.
 */
(() => {
  'use strict';
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content; };
  const flag = (el, k) => el.dataset[k] !== undefined;

  /* ---------------- tab-bar ornament: Steam's VR main menu (frame.menu popup, x1.10) */
  const PRIMARY = [['home', 'Home'], ['library', 'Library'], ['store', 'Store'], ['friends', 'Friends & Chat'], ['media', 'Media'], ['download', 'Downloads']];
  const SYSTEM = [['terminal', 'Console', 'console'], ['gear', 'Steam Settings', 'settings'], ['vr', 'VR Settings', 'vr settings']];
  function tab(icon, label, el) {
    const k = label.toLowerCase();
    const cls = ['wn-tab'];
    if (el.dataset.sel && k.startsWith(el.dataset.sel)) cls.push('is-nav-selected');
    if (el.dataset.focus && k.startsWith(el.dataset.focus)) cls.push('is-focus');
    if (el.dataset.hover && k.startsWith(el.dataset.hover)) cls.push('is-hover');
    if (el.dataset.open && k.startsWith(el.dataset.open)) cls.push('is-selected');
    const badge = (k === 'steam settings' && flag(el, 'badge')) ? '<b class="wn-badge"></b>' : '';
    return `<div class="${cls.join(' ')}"><i data-i="${icon}"></i><span>${label}</span>${badge}</div>`;
  }
  function buildTabbar(el) {
    const exp = flag(el, 'expanded');
    const sys = flag(el, 'console') ? SYSTEM : SYSTEM.slice(1);
    const cap = (items) => `<div class="lgk-glass wn-tabcap" data-mat="liquid" data-lens style="--dz:25">${items}</div>`;
    const frag = h(`<div class="lgk-pop wn-tabbar${exp ? ' expanded' : ''}" style="--pop-scale:1.10" data-dz="25" data-tier="T1 frame.menu + T4 z + T5 liquid">
      ${cap(PRIMARY.map(([i, l]) => tab(i, l, el)).join(''))}
      ${cap(sys.map(([i, l]) => tab(i, l, el)).join(''))}
      ${cap(tab('power', 'Power', el))}
    </div>`);
    const pop = frag.firstElementChild;
    el.replaceWith(pop);
    // anchor: the popup's right edge sits 18 view px (14 mm) left of the window, centred on the overlay
    const S = 1.10, w = pop.offsetWidth * S, hgt = pop.offsetHeight * S;
    const right = parseFloat(el.dataset.right), cy = parseFloat(el.dataset.cy);
    pop.style.left = (right - w) + 'px';
    pop.style.top = (cy - hgt / 2) + 'px';
  }

  /* ---------------- toolbar row inside the window (Steam's #header) */
  function buildToolbar(el) {
    const back = el.dataset.back || 'nested';                 // root | nested | grown:<title> | none
    const title = el.dataset.title || '';
    const search = el.dataset.search || 'idle';               // idle | focus | filled:<q> | none | circle
    const sw = el.dataset.searchw === 'wide' ? ' wide' : '';
    const dim = flag(el, 'dim') ? ' dim' : '';
    let out = '';
    if (back.startsWith('grown:')) out += `<span class="lgk-btn circle wn-back grown is-hover${dim}" style="--hx:22%;--hy:40%"><i data-i="chevron-left"></i>${back.slice(6)}</span>`;
    else if (back !== 'none') out += `<span class="lgk-btn circle wn-back${back === 'root' ? ' root' : ''}${dim}"><i data-i="chevron-left"></i></span>`;
    if (title) out += `<div class="wn-title ${flag(el, 'center') ? 'centered t-title2' : 't-large'}${dim}">${title}</div>`;
    if (search === 'idle') out += `<div class="lgk-search wn-search${sw}${dim}"><i data-i="search"></i><span class="ph">Search games, friends and Store</span></div>`;
    else if (search === 'focus') out += `<div class="lgk-search wn-search${sw} is-focus${dim}"><i data-i="search"></i><span class="typed"><span class="caret"></span><span class="ph" style="margin-left:6px">Search games, friends and Store</span></span></div>`;
    else if (search.startsWith('filled:')) out += `<div class="lgk-search wn-search${sw}${flag(el, 'searchfocus') ? ' is-focus' : ''}${dim}"><i data-i="search"></i><span class="typed">${search.slice(7)}${flag(el, 'searchfocus') ? '<span class="caret"></span>' : ''}</span><span class="lgk-btn circle clear"><i data-i="xmark" class="bold"></i></span></div>`;
    else if (search === 'circle') out += `<span class="lgk-btn circle wn-icon-circle${dim}"><i data-i="search"></i></span>`;
    el.replaceWith(h(`<div class="wn-toolbar">${out}</div>`));
  }

  /* ---------------- bottom ornament: Steam's #Footer legend as real buttons */
  function glyph(g) {
    if (g === 'menu') return '<span class="lgk-glyph wn-menu-glyph"></span>';
    if (g === 'view') return '<span class="lgk-glyph wn-view-glyph"></span>';
    return `<span class="lgk-glyph">${g}</span>`;
  }
  function buildOrnament(el) {
    // data-legends="X:Filter|Y:Sort By|menu:Options|A:Select|B:Back"; prefix "*" = hover, "!" = selected (menu open), "~" = focus
    const items = (el.dataset.legends || '').split('|').filter(Boolean).map((s) => {
      let st = '';
      while ('*!~'.includes(s[0])) { st += s[0]; s = s.slice(1); }
      const [g, ...l] = s.split(':'); const label = l.join(':');
      const nav = (g === 'A' || g === 'B') ? ' nav' : '';
      const cls = ['wn-leg' + nav];
      if (st.includes('*')) cls.push('is-hover');
      if (st.includes('!')) cls.push('is-selected');
      if (st.includes('~')) cls.push('is-focus');
      return { g, label, cls };
    });
    let firstNav = true;
    const html = items.map((it) => {
      if (it.cls[0].includes('nav') && firstNav && items.indexOf(it) > 0) { it.cls.push('split'); firstNav = false; }
      return `<span class="${it.cls.join(' ')}" style="--hx:40%;--hy:35%">${glyph(it.g)}${it.label}</span>`;
    }).join('');
    const top = el.dataset.top || '628';
    el.replaceWith(h(`<div class="lgk-glass lgk-toolbar wn-orn" data-mat="liquid" data-lens style="--dz:25; top:${top}px" data-dz="25" data-tier="T1 #Footer + T4 pop + T5 liquid">${html}</div>`));
  }

  /* ---------------- SteamVR frame controls (systemui panel, x0.75) */
  function buildFrame(el) {
    const f = (el.dataset.focus || '').split(',');
    const hv = (el.dataset.hover || '').split(',');
    const b = (i, icon, extra = '') => `<span class="lgk-btn circle plain${f.includes(String(i)) ? ' is-focus' : ''}${hv.includes(String(i)) ? ' is-hover' : ''}${extra}" style="--s:80px"><i data-i="${icon}"></i></span>`;
    const close = flag(el, 'close') ? `<div class="lgk-glass wn-framecap" data-mat="panel" style="padding:0 10px">${b(5, 'xmark', ' danger')}</div>` : '';
    const frag = h(`<div class="lgk-pop wn-frame" style="--pop-scale:.75" data-tier="T1 vr:systemui (panel follows DOM, E16)">
      <div class="lgk-glass wn-framecap" data-mat="panel">${b(1, 'keyboard')}<span class="sep"></span>${b(2, 'float')}${b(3, 'theater')}<span class="sep"></span>${b(4, 'more')}</div>${close}</div>`);
    const pop = frag.firstElementChild; el.replaceWith(pop);
    pop.style.left = (parseFloat(el.dataset.cx) - pop.offsetWidth * .75 / 2) + 'px';
    pop.style.top = el.dataset.y + 'px';
    if (el.dataset.dim) pop.style.opacity = el.dataset.dim;
  }

  /* ---------------- dashboard bar (two liquid capsules; the system concept owns its content) */
  function buildBar(el) {
    const frag = h(`<div class="lgk-pop wn-bar" style="--pop-scale:1.20" data-tier="bar quad">
      <div class="lgk-glass lgk-toolbar wn-barcap" data-mat="liquid" data-lens>
        <span class="lgk-btn circle" style="background:rgb(255 255 255 / .18)"><i data-i="controller"></i></span>
        <span class="lgk-btn circle lgk-art" data-art="poster:3:" style="background-size:cover; background-position:50% 30%"></span>
        <span class="lgk-btn circle plain"><i data-i="plus"></i></span>
      </div>
      <div class="lgk-glass lgk-toolbar wn-barcap" data-mat="liquid" data-lens style="padding:0 8px 0 22px">
        <span class="t-headline t-num">4:56</span>
        <span class="lgk-btn circle plain"><i data-i="wifi"></i></span>
        <span class="lgk-btn circle plain"><i data-i="bell"></i></span>
        <span class="lgk-btn circle plain"><i data-i="grid"></i></span>
        <span class="lgk-btn circle lgk-art" data-art="avatar:2:B" style="background-size:cover"></span>
      </div></div>`);
    const pop = frag.firstElementChild; el.replaceWith(pop);
    pop.style.left = (parseFloat(el.dataset.cx) - pop.offsetWidth * 1.2 / 2) + 'px';
    pop.style.top = el.dataset.y + 'px';
  }

  function buildPill(el) {
    const p = h(`<div class="wn-pill${flag(el, 'hover') ? ' hover' : ''}" data-tier="vr:systemui GrabHandle"></div>`).firstElementChild;
    el.replaceWith(p);
    const w = flag(el, 'hover') ? 198 : 180;
    p.style.left = (parseFloat(el.dataset.cx) - w / 2) + 'px'; p.style.top = el.dataset.y + 'px';
  }

  /* ---------------- laser beam + dot (SteamVR draws them; shown to place hover light) */
  function buildLaser(el) {
    const [x, y] = el.dataset.to.split(',').map(Number);
    const [fx, fy] = (el.dataset.from || '1660,1100').split(',').map(Number);
    el.replaceWith(h(`<svg style="position:absolute; inset:0; width:1920px; height:1080px; pointer-events:none; z-index:40" viewBox="0 0 1920 1080">
      <defs><linearGradient id="beam${x}" gradientUnits="userSpaceOnUse" x1="${fx}" y1="${fy}" x2="${x}" y2="${y}"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#dbe8ff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity=".9"/></linearGradient></defs>
      <polygon points="${fx - 6},${fy} ${fx + 6},${fy} ${x + 1},${y} ${x - 1},${y}" fill="url(#beam${x})" opacity=".55"/></svg>
      <div class="lgk-laser-dot" style="left:${x}px; top:${y}px"></div>`));
  }

  /* ---------------- Steam VR keyboard (keyboard quad, x0.74) with the display-only echo row */
  function buildKeyboard(el) {
    const rows = ['q w e r t y u i o p', 'a s d f g h j k l', 'z x c v b n m'];
    const hot = el.dataset.hot || '';
    const key = (c) => `<span class="k${c === hot ? ' hot' : ''}">${c}</span>`;
    const echo = el.dataset.echo !== undefined && el.dataset.echo !== ''
      ? `<span class="lbl">Search</span><span>${el.dataset.echo}<span class="caret" style="display:inline-block;width:2px;height:26px;vertical-align:-5px;margin-left:2px;background:#fff"></span></span>`
      : `<span class="lbl">Search</span><span class="ph">Games, friends and Store</span>`;
    const frag = h(`<div class="lgk-pop" style="--pop-scale:.74" data-dz="0" data-tier="keyboard quad (SM concept) + T5 thick platter">
      <div class="lgk-glass wn-kb" data-mat="thick" style="--dz:10">
        <div class="echo">${echo}</div>
        <div class="row">${'1 2 3 4 5 6 7 8 9 0'.split(' ').map(key).join('')}<span class="k dark w15">Delete</span></div>
        <div class="row"><span class="k dark w15">Tab</span>${rows[0].split(' ').map(key).join('')}</div>
        <div class="row"><span class="k dark w2">Caps</span>${rows[1].split(' ').map(key).join('')}<span class="k enter w2">Done</span></div>
        <div class="row"><span class="k dark w2">Shift</span>${rows[2].split(' ').map(key).join('')}<span class="k dark w2">Shift</span></div>
        <div class="row"><span class="k dark w15">&#x263A;</span><span class="k dark">&#x2039;</span><span class="k w6"></span><span class="k dark">&#x203A;</span><span class="k dark w15">&#x2715;</span></div>
      </div></div>`);
    const pop = frag.firstElementChild; el.replaceWith(pop);
    pop.style.left = (parseFloat(el.dataset.cx) - pop.offsetWidth * .74 / 2) + 'px';
    pop.style.top = el.dataset.y + 'px';
  }

  const B = { tabbar: buildTabbar, toolbar: buildToolbar, ornament: buildOrnament, frame: buildFrame, bar: buildBar, pill: buildPill, laser: buildLaser, keyboard: buildKeyboard };
  $$('[data-wn]').forEach((el) => { const f = B[el.dataset.wn]; if (f) f(el); });
})();
