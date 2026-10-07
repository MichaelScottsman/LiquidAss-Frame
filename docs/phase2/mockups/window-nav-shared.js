/* Glass Shell Phase 2 concept "window-nav" (the shell): builds the chrome shared by the
 * window-nav-*.html mockups and by every area mockup that includes it (tab-bar ornament,
 * toolbar row, bottom ornament, SteamVR window-bar row, dashboard bar, laser + pointer proxy,
 * keyboard, item More circle). Runs synchronously before kit.js, which then turns the
 * <i data-i> icons into SVG, paints art, measures the room under each glass and adds lensing.
 *
 * Placeholders: <div data-wn="KIND" ...options...></div>. Positions are view px (1920 x 1080)
 * for quads outside the window, and main-window px for parts inside .lgk-overlay.
 * Revision 2 (critique pass): device-accurate tab bar (Console on, live pitch), ornament
 * contract with gamepad / laser modes and the frozen Options target, window-bar row.
 */
(() => {
  'use strict';
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content; };
  const flag = (el, k) => el.dataset[k] !== undefined;

  /* ---------------- tab-bar ornament: Steam's VR main menu (frame.menu popup, x1.10 view px per popup px)
   * Items as on this device (inventory bar.md §3, audit shell-nav A.3): six sections, then Console
   * (developer mode), Steam Settings, [Help during setup], VR Settings, Steam's SectionGap, Power.
   * data-pitch (popup px) comes from the live sizing rule (concept §3.3.2): 58 at r = 1 with
   * Console, 52 at r = 0.863 when the popup does not scale with the window.  data-noconsole hides
   * Console (developer mode off). */
  const PRIMARY = [['home', 'Home'], ['library', 'Library'], ['store', 'Store'], ['friends', 'Friends & Chat'], ['media', 'Media'], ['download', 'Downloads']];
  function tab(icon, label, el, extra = '') {
    const k = label.toLowerCase();
    const cls = ['wn-tab'];
    const is = (v) => v && v.split(',').some((x) => x && k.startsWith(x.trim()));
    if (is(el.dataset.sel)) cls.push('is-nav-selected');
    if (is(el.dataset.focus)) cls.push('is-focus');
    if (is(el.dataset.hover)) cls.push('is-hover');
    if (is(el.dataset.open)) cls.push('is-open');
    if (extra) cls.push(extra);
    const badge = (k === 'steam settings' && flag(el, 'badge')) ? '<b class="wn-badge"></b>' : '';
    return `<div class="${cls.join(' ')}"><span class="ic"><i data-i="${icon}"></i></span><span class="lbl">${label}</span>${badge}</div>`;
  }
  function buildTabbar(el) {
    const exp = flag(el, 'expanded');
    const p = parseFloat(el.dataset.pitch || '58');
    const d = p - 8;
    const sys = [];
    if (!flag(el, 'noconsole')) sys.push(['terminal', 'Console']);
    sys.push(['gear', 'Steam Settings']);
    if (flag(el, 'help')) sys.push(['sparkle', 'Help']);
    sys.push(['vr', 'VR Settings']);
    const cap = (items) => `<div class="lgk-glass wn-tabcap" data-mat="liquid" data-lens style="--dz:25">${items}</div>`;
    const S = parseFloat(el.dataset.scale || '1.10');
    const frag = h(`<div class="lgk-pop wn-tabbar${exp ? ' expanded' : ''}" style="--pop-scale:${S}; --p:${p}px; --d:${d}px" data-dz="25" data-tier="frame.menu: T1 Steam vars + T2 live pitch + T4 popup z (no crop) + T5 liquid">
      ${cap(PRIMARY.map(([i, l]) => tab(i, l, el)).join(''))}
      ${cap(sys.map(([i, l]) => tab(i, l, el)).join('') + tab('power', 'Power', el, 'secgap'))}
    </div>`);
    const pop = frag.firstElementChild;
    el.replaceWith(pop);
    // Steam's anchor: the popup's right edge 18 view px (14 mm) left of the window; centred on the panel
    // (data-cy = the panel's centre) or, when the bar fits the glass, on the glass (data-cy = glass centre).
    const w = pop.offsetWidth * S, hgt = pop.offsetHeight * S;
    const right = parseFloat(el.dataset.right), cy = parseFloat(el.dataset.cy);
    pop.style.left = (right - w) + 'px';
    pop.style.top = (cy - hgt / 2) + 'px';
    pop.dataset.heightView = Math.round(hgt);
    if (el.dataset.dim) pop.querySelectorAll('.wn-tabcap').forEach((c) => c.classList.add('wn-dimmed'));
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
    const ph = el.dataset.ph || 'Search for games or profiles...';
    if (search === 'idle') out += `<div class="lgk-search wn-search${sw}${dim}"><i data-i="search"></i><span class="ph">${ph}</span></div>`;
    else if (search === 'focus') out += `<div class="lgk-search wn-search${sw} is-focus${dim}"><i data-i="search"></i><span class="typed"><span class="caret"></span><span class="ph" style="margin-left:6px">${ph}</span></span></div>`;
    else if (search.startsWith('filled:')) out += `<div class="lgk-search wn-search${sw}${flag(el, 'searchfocus') ? ' is-focus' : ''}${dim}"><i data-i="search"></i><span class="typed">${search.slice(7)}${flag(el, 'searchfocus') ? '<span class="caret"></span>' : ''}</span><span class="lgk-btn circle clear"><i data-i="xmark" class="bold"></i></span></div>`;
    else if (search === 'circle') out += `<span class="lgk-btn circle wn-icon-circle${dim}"><i data-i="search"></i></span>`;
    el.replaceWith(h(`<div class="wn-toolbar">${out}</div>`));
  }

  /* ---------------- bottom ornament: Steam's #Footer (+ laser-mode %{SortAndFilterContainer}) as one toolbar
   * data-legends="X:Filter|Y:Sort By|menu:Options@Hollow Peaks|A:Select|B:Back"
   *   G:Label        an action legend; label first, the controller glyph trailing (DESIGN2 §7.3)
   *   menu:L@Name    the frozen Options target named on the button (concept §3.4.3)
   *   sf-sort:Value  Steam's laser-mode Sort button (leading sort glyph + the current sort)
   *   sf-filter:L    Steam's laser-mode Filter button
   *   A:/B:          nav legends: quiet; omitted when data-mode="laser" (concept §3.4.2)
   *   prefixes  * hover   ! menu open (white)   ~ gamepad focus */
  function glyph(g) {
    if (g === 'menu') return '<span class="lgk-glyph wn-menu-glyph"></span>';
    return `<span class="lgk-glyph">${g}</span>`;
  }
  function buildOrnament(el) {
    const laser = el.dataset.mode === 'laser';
    const items = (el.dataset.legends || '').split('|').filter(Boolean).map((s) => {
      let st = '';
      while ('*!~'.includes(s[0])) { st += s[0]; s = s.slice(1); }
      const [g, ...l] = s.split(':'); let label = l.join(':'); let tgt = '';
      if (label.includes('@')) { [label, tgt] = label.split('@'); }
      const kind = g.startsWith('sf-') ? 'sf' : (g === 'A' || g === 'B') ? 'nav' : 'act';
      const cls = ['wn-leg'];
      if (kind !== 'act') cls.push(kind);
      if (st.includes('*')) cls.push('is-hover');
      if (st.includes('!')) cls.push('is-open');
      if (st.includes('~')) cls.push('is-focus');
      return { g, label, tgt, kind, cls };
    }).filter((it) => !(laser && it.kind === 'nav'));
    let html = '', prev = null;
    for (const it of items) {
      if (prev && prev !== it.kind) html += '<span class="gsep"></span>';
      prev = it.kind;
      if (it.kind === 'sf') {
        const ic = it.g === 'sf-sort' ? 'sort' : 'filter';
        html += `<span class="${it.cls.join(' ')}" style="--hx:40%;--hy:35%"><i data-i="${ic}"></i><span class="val">${it.label}</span></span>`;
      } else {
        const t = it.tgt ? ` <span class="tgt">· ${it.tgt}</span>` : '';
        html += `<span class="${it.cls.join(' ')}" style="--hx:40%;--hy:35%">${it.label}${t}${glyph(it.g)}</span>`;
      }
    }
    if (el.dataset.seg) {                                     // area slot: one segmented control (e.g. All · VR · Non-VR)
      const [opts, sel] = el.dataset.seg.split('@');
      html += '<span class="gsep"></span><span class="lgk-seg compact">' + opts.split(',').map((o, i) => `<span${String(i) === sel ? ' class="is-selected"' : ''}>${o}</span>`).join('') + '</span>';
    }
    if (!html) { el.remove(); return; }
    const top = el.dataset.top || '628';
    el.replaceWith(h(`<div class="lgk-glass lgk-toolbar wn-orn" data-mat="liquid" data-lens style="--dz:18; top:${top}px" data-dz="0" data-tier="ornament contract: T1 #Footer + %{SortAndFilterContainer}; T2 target + modes; T5 liquid slab (inset, no pop)">${html}</div>`));
  }

  /* ---------------- SteamVR frame controls (systemui panel, x0.75), old placement (kept for area mockups) */
  function frameCap(el) {
    const f = (el.dataset.focus || '').split(',');
    const hv = (el.dataset.hover || '').split(',');
    const on = (el.dataset.on || '').split(',');
    const b = (i, icon, extra = '') => `<span class="lgk-btn circle plain${f.includes(String(i)) ? ' is-focus' : ''}${hv.includes(String(i)) ? ' is-hover' : ''}${on.includes(String(i)) ? ' is-selected' : ''}${extra}" style="--s:80px"><i data-i="${icon}"></i></span>`;
    const close = flag(el, 'close') ? `<div class="lgk-glass wn-framecap" data-mat="panel" style="padding:0 10px">${b(5, 'xmark', ' danger')}</div>` : '';
    return { close, main: `<div class="lgk-glass wn-framecap" data-mat="panel">${b(1, 'keyboard')}<span class="sep"></span>${b(2, 'float')}${b(3, 'theater')}<span class="sep"></span>${b(4, 'more')}</div>` };
  }
  function buildFrame(el) {
    const c = frameCap(el);
    const frag = h(`<div class="lgk-pop wn-frame" style="--pop-scale:.75" data-tier="T1 vr:systemui (panel follows DOM, E16)">${c.main}${c.close}</div>`);
    const pop = frag.firstElementChild; el.replaceWith(pop);
    pop.style.left = (parseFloat(el.dataset.cx) - pop.offsetWidth * .75 / 2) + 'px';
    pop.style.top = el.dataset.y + 'px';
    if (el.dataset.dim) pop.style.opacity = el.dataset.dim;
  }

  /* ---------------- the window-bar row (concept §3.5): frame controls left of the window-bar pill, one row under the window.
   * data-cx: the window's centre (the pill is centred on it); data-y: the row's top (view px). */
  function buildWinbar(el) {
    const c = frameCap(el);
    const close = flag(el, 'close');
    const frag = h(`<div class="lgk-pop wn-frame" style="--pop-scale:.75" data-tier="frame controls: T1 vr:systemui (E16) + T4 move left [PLAUSIBLE]">${close ? c.close : ''}${c.main}</div>`);
    const pop = frag.firstElementChild; el.replaceWith(pop);
    const cx = parseFloat(el.dataset.cx), y = parseFloat(el.dataset.y);
    const pillW = flag(el, 'pillhover') ? 198 : 183;
    pop.style.left = (cx - pillW / 2 - 26 - pop.offsetWidth * .75) + 'px';
    pop.style.top = y + 'px';
    if (el.dataset.dim) pop.style.opacity = el.dataset.dim;
    const pill = h(`<div class="wn-pill${flag(el, 'pillhover') ? ' hover' : ''}" data-tier="grab handle: T1 + T4 moved up under the window [PLAUSIBLE]"></div>`).firstElementChild;
    pop.after(pill);
    pill.style.left = (cx - pillW / 2) + 'px';
    pill.style.top = (y + 75 / 2 - 6) + 'px';
  }

  /* ---------------- dashboard bar (two liquid capsules; the control-center concept owns its content) */
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
    const w = flag(el, 'hover') ? 198 : 183;
    p.style.left = (parseFloat(el.dataset.cx) - w / 2) + 'px'; p.style.top = el.dataset.y + 'px';
  }

  /* ---------------- laser beam (SteamVR) + the shell's pointer proxy dot at the hit point (Steam DOM) */
  function buildLaser(el) {
    const [x, y] = el.dataset.to.split(',').map(Number);
    const [fx, fy] = (el.dataset.from || '1660,1100').split(',').map(Number);
    const id = 'beam' + x + '_' + y;
    el.replaceWith(h(`<svg style="position:absolute; inset:0; width:1920px; height:1080px; pointer-events:none; z-index:40" viewBox="0 0 1920 1080">
      <defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${fx}" y1="${fy}" x2="${x}" y2="${y}"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#dbe8ff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity=".9"/></linearGradient></defs>
      <polygon points="${fx - 6},${fy} ${fx + 6},${fy} ${x + 1},${y} ${x - 1},${y}" fill="url(#${id})" opacity=".55"/></svg>
      <div class="wn-proxy" style="left:${x}px; top:${y}px" data-tier="T2 pointer proxy"></div>`));
  }

  /* ---------------- the item More circle (T2, shell-owned): 52 px liquid circle on a card's top-right corner */
  function buildMore(el) {
    const x = parseFloat(el.dataset.x), y = parseFloat(el.dataset.y);
    const open = flag(el, 'open') ? ' is-open' : '', hov = flag(el, 'hover') ? ' is-hover' : '';
    el.replaceWith(h(`<div class="lgk-glass wn-more${open}${hov}" data-mat="liquid" data-lens style="left:${x - 26}px; top:${y - 26}px; --dz:15" data-dz="15" data-tier="T2 More circle (dispatches Steam's menu event)"><i data-i="more"></i></div>`));
  }

  /* ---------------- Steam VR keyboard (keyboard quad, x0.74) with the display-only echo row */
  function buildKeyboard(el) {
    const rows = ['q w e r t y u i o p', 'a s d f g h j k l', 'z x c v b n m'];
    const hot = el.dataset.hot || '';
    const key = (c) => `<span class="k${c === hot ? ' hot' : ''}">${c}</span>`;
    const echo = el.dataset.echo !== undefined && el.dataset.echo !== ''
      ? `<span class="lbl">Search</span><span>${el.dataset.echo}<span class="caret" style="display:inline-block;width:2px;height:26px;vertical-align:-5px;margin-left:2px;background:#fff"></span></span>`
      : `<span class="ph">Search for games or profiles...</span>`;
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

  if (document.body && document.body.dataset.annot !== undefined && !/annot/.test(location.hash)) history.replaceState(null, '', location.pathname + '#annot');
  const B = { tabbar: buildTabbar, toolbar: buildToolbar, ornament: buildOrnament, frame: buildFrame, winbar: buildWinbar, bar: buildBar, pill: buildPill, laser: buildLaser, more: buildMore, keyboard: buildKeyboard };
  $$('[data-wn]').forEach((el) => { const f = B[el.dataset.wn]; if (f) f(el); });
})();
