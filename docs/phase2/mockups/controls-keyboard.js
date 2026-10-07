/* Steam's VR keyboard for the Glass Shell Phase 2 mockups (package C4b; concept controls.md §12 as conformed to
 * PLAN §1 at M0: evidence docs/phase2/wp/C4b.md).
 *
 * Self-contained: it injects its own CSS and draws its own glyphs, so any mockup that loads kit.css can draw the
 * keyboard by loading this file BEFORE kit.js:
 *
 *   <div class="lgk-pop" style="left:382px; top:636px; transform:scale(1.355, 1.19)">
 *     <div class="vkb" data-vkb='{"tier":"t5","mode":"laser","echo":{...},"hover":"a"}'></div>
 *   </div>
 *
 * Geometry is Steam's (inventory hud.md §5.3, E-KEY): the 854 x 280 kb px quad; %{Modal>Keyboard} padding 3 3 1 1;
 * five 850 x 47 rows; hit areas with Steam's size classes and padding 1 1 2 2. The visible key is the hit area minus
 * that padding minus a 1 px margin (paint only: hit areas are unchanged). With the echo on top, the key block is moved
 * down 41 kb px (translate on %{VRVirtualKeyboardContents}; hit areas move with their keys, CTL C-D18).
 *
 * Options (JSON in data-vkb), all optional:
 *   tier     "t5" glassd thick cover (default) | "t1" CSS only: Steam's background recoloured (tint, sheen, edge)
 *   mode     "laser" (default) | "pad": controller glyph badges show only in "pad" (PLAN §1.4, VP P-26)
 *   echo     {icon:"search|message|lock", label, text, ph, masked, caret, comp} | false   (T2 echo row)
 *   pos      "top" (default: key block moved) | "bottom" (keys unmoved: IME, emoji or buffered rows present, C-D18)
 *   buffer   text: buffered mode, Steam's own %{VirtualKeyboardTextBuffer} restyled (no echo of ours, keys unmoved)
 *   enter    the Enter label (Steam's strEnterKeyLabel path; default "Enter")
 *   hover    key id under the laser (lit: + white .08 and a .12 spot at hx, hy)        laser mode
 *   focus    key id with Steam's virtual focus (+ white .28, spot .16, arc .55)      gamepad mode
 *   focus60  true: draw the focus at its first frame (60 %, P5 lgs-focus-in)
 *   pressed  key id (%{Modal>Touched}: white .94, dark label, glow, 1 px "goes down")
 *   shift    "one" (one-shot, both Shift keys white) | "caps" (Caps white + bar)
 *   accents  {on: key id, keys: [...], focus: "É"}   Steam's %{KeyboardExtendedRow} as a bubble on the platter
 *   laser    {key, x, y, from:[x,y]}: SteamVR's beam to a point of a key; the hit point is SteamVR's dot in t1 and
 *            the shell's pointer proxy ring in t5 (native mode only, PLAN §1.11, S16)
 *   radius   platter radius in kb px (default 20: concentric with Steam's corner keys, see C4b.md)
 * Key ids: the character ("a", "1", "`", ";") or "Backspace", "Tab", "Caps", "Enter", "ShiftL", "ShiftR", "emoji",
 * "space", "left", "right", "close".  data-id attributes name the parts for glass.py cmp. */
(() => {
  'use strict';

  /* ------------------------------------------------------------------ CSS (kb px; kit.css tokens) */
  const CSS = `
.vkb { position: relative; width: 854px; height: 280px; --vkb-r: 20px; font-family: var(--lg-font); color: var(--lg-text-1);
  -webkit-font-smoothing: antialiased; }
.vkb > .vkb-plat { position: absolute; left: 0; top: 0; width: 854px; height: 280px; --r: var(--vkb-r); }
/* CSS only (native off): Steam's DefaultTheme --background-color and the outer container recoloured to WN §8.4's
   degraded glass: a tint inside the dial (.84 = P-87's maximum, for key contrast over a bright room), a vertical sheen,
   the E3 arc + lobe from kit/window-nav-shared, a dark inner edge. backdrop-filter cannot see the room from this quad. */
.vkb.t1 > .vkb-plat { -webkit-backdrop-filter: none !important; backdrop-filter: none !important;
  background: linear-gradient(180deg, rgb(255 255 255 / .08), rgb(255 255 255 / 0) 30%), rgb(28 30 38 / .84) !important; }
.vkb-rows { position: absolute; left: 0; top: 0; width: 854px; height: 280px; z-index: 2; }
.vkb.moved .vkb-rows { top: 41px; }
.vkb-row { position: absolute; left: 1px; width: 850px; height: 47px; }
.vkb-hit { position: absolute; top: 0; height: 47px; }
/* the visible key: raised fill (PLAN §1.4 rest recipe), radius 11; light is drawn in the key's own background,
   under the label (VP P-10). --add: uniform white; --spot: radial light; --arc: the inset top highlight */
.vkb-key { position: absolute; left: 3px; right: 2px; top: 2px; bottom: 3px; border-radius: 11px; box-sizing: border-box;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  --base: rgb(255 255 255 / .15); --sheen: .07; --arc: .22; --add: 0; --spot: 0; --sx: 50%; --sy: 30%;
  background:
    radial-gradient(circle at var(--sx) var(--sy), rgb(255 255 255 / var(--spot)) 0, rgb(255 255 255 / 0) 75%),
    linear-gradient(rgb(255 255 255 / var(--add)), rgb(255 255 255 / var(--add))),
    linear-gradient(180deg, rgb(255 255 255 / var(--sheen)), rgb(255 255 255 / 0) 60%),
    var(--base);
  box-shadow: inset 0 1.5px 1.5px -1px rgb(255 255 255 / var(--arc)), 0 2px 3px rgb(0 0 0 / .22);
  font: 500 20px/1 var(--lg-font); color: var(--lg-text-1); white-space: nowrap; }
.vkb-key.mod { --base: rgb(255 255 255 / .075); --sheen: .05; font: 600 15px/1 var(--lg-font); }
.vkb-key.space { --base: rgb(255 255 255 / .15); }
.vkb-key.enter { --base: var(--lg-tint-primary); --sheen: .18; --arc: .38; color: #fff; font: 600 17px/1 var(--lg-font);
  box-shadow: inset 0 1.5px 1.5px -1px rgb(255 255 255 / var(--arc)), 0 2px 4px rgb(0 0 0 / .25); }
.vkb-key .sh { font: 500 15px/1 var(--lg-font); color: rgb(255 255 255 / .60); }
.vkb-key .in { display: inline-flex; align-items: center; gap: 7px; }
.vkb-key .in.stack { flex-direction: column; gap: 2px; }
.vkb-key .vkb-i { width: 20px; height: 20px; flex: none; }
.vkb-key .vkb-i.up { width: 12px; height: 12px; opacity: .55; margin-bottom: -2px; }
/* laser hover (html.lgs-input-laser %{KeyboardKeyHitArea}:hover > key): lit, never white (C-D8 as amended by §1.4) */
.vkb-key.is-hover { --add: .08; --spot: .12; --sx: var(--hx, 50%); --sy: var(--hy, 30%); }
/* gamepad virtual focus (html.lgs-input-pad %{Modal>Focused}): tokens --lgs-focus-add/-spot/-arc */
.vkb-key.is-focus { --add: .28; --spot: .16; --sx: 50%; --sy: 30%; --arc: .55; }
.vkb-key.is-focus.f60 { --add: .168; --spot: .096; --arc: .418; }   /* 60 % of each focus layer's delta (lgs-focus-in at t0) */
/* on (Shift one-shot, Caps) and pressed (Touched): white .94 with a dark label */
.vkb-key:is(.is-on, .is-pressed) { --base: var(--lg-fill-selected); --sheen: 0; --add: 0; --spot: 0; --arc: 0; color: var(--lg-text-on-selected); }
.vkb-key:is(.is-on, .is-pressed) .sh { color: rgb(13 14 18 / .55); }
.vkb-key.is-pressed { box-shadow: inset 0 1px 2px rgb(0 0 0 / .20), 0 0 12px 1.5px rgb(255 255 255 / .30); }
/* hover or focus on a white or coloured key: the outer glow, never a fill (P-16). Hover: --lgs-white-glow x m .74.
   Focus: stronger, 14px 4px .50 kb px (about 19 px 5 px main), so the 8-16 view px band gains >= +20 L between dense keys */
.vkb-key:is(.is-on, .enter):is(.is-hover, .is-focus) { --add: 0; --spot: 0;
  box-shadow: inset 0 1.5px 1.5px -1px rgb(255 255 255 / var(--arc)), 0 0 13px 1.5px rgb(255 255 255 / .30), 0 2px 3px rgb(0 0 0 / .22); }
.vkb-key:is(.is-on, .enter).is-focus {
  box-shadow: inset 0 1.5px 1.5px -1px rgb(255 255 255 / var(--arc)), 0 0 14px 4px rgb(255 255 255 / .50), 0 2px 3px rgb(0 0 0 / .22); }
.vkb-key.enter.is-focus { --spot: .10; }
.vkb-key:is(.is-on, .enter).is-focus.f60 { --spot: .06;
  box-shadow: inset 0 1.5px 1.5px -1px rgb(255 255 255 / var(--arc)), 0 0 14px 4px rgb(255 255 255 / .30), 0 2px 3px rgb(0 0 0 / .22); }
.vkb-key .capsbar { width: 22px; height: 3px; border-radius: 2px; background: currentColor; }
/* controller glyph badges: Steam's %{Modal>ActionButtonGlyph} restyled (30 px x .74 circle, 16 px Bold x .84), pad only */
.vkb-bdg { display: inline-grid; place-items: center; min-width: 22px; height: 22px; padding: 0 5px; box-sizing: border-box;
  border-radius: 11px; background: rgb(255 255 255 / .22); font: 700 13.5px/1 var(--lg-font); color: #fff; }
.vkb-bdg.two { font-size: 12.5px; }
.vkb-key.enter .vkb-bdg { background: rgb(255 255 255 / .30); }
.vkb-key:is(.is-on, .is-pressed) .vkb-bdg { background: rgb(13 14 18 / .14); color: var(--lg-text-on-selected); }
/* echo row (T2, display-only, pointer-events none): a recessed capsule; the field's name, the text or dots, the caret */
.vkb-echo { position: absolute; left: 8px; right: 8px; height: 33px; border-radius: 16.5px; z-index: 3;
  background: rgb(0 0 0 / .30); box-shadow: inset 0 2px 5px rgb(0 0 0 / .30), inset 0 -2px 3px -1px rgb(255 255 255 / .10);
  display: flex; align-items: center; gap: 12px; padding: 0 16px; box-sizing: border-box; white-space: nowrap; overflow: hidden; }
.vkb-echo.top { top: 5px; }
.vkb-echo.bottom { top: 242px; }
.vkb-echo.buffer { top: 4px; justify-content: center; }
.vkb-echo .lbl { flex: none; display: inline-flex; align-items: center; gap: 6px; font: 600 15px/1 var(--lg-font); color: var(--lg-text-2); }
.vkb-echo .lbl .vkb-i { width: 15px; height: 15px; color: rgb(255 255 255 / .62); }
.vkb-echo .txt { display: flex; align-items: center; min-width: 0; font: 500 19px/1 var(--lg-font); color: var(--lg-text-1); }
.vkb-echo .txt.long { -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 24px); mask-image: linear-gradient(90deg, transparent 0, #000 24px); }
.vkb-echo .ph { color: rgb(255 255 255 / .55); }
.vkb-echo .dots { font: 700 19px/1 var(--lg-font); letter-spacing: .18em; }
.vkb-echo .comp { text-decoration: underline 2px rgb(255 255 255 / .70); text-underline-offset: 4px; }
.vkb-echo .caret { flex: none; width: 2px; height: 21px; border-radius: 1px; background: var(--lg-blue); margin-left: 1px; }
/* long-press accents: Steam's %{KeyboardExtendedRow} as a menu bubble on the platter (a fill inside the quad, not glass) */
.vkb-acc { position: absolute; z-index: 5; display: flex; gap: 4px; padding: 6px; border-radius: 17px;
  background: linear-gradient(180deg, rgb(255 255 255 / .10), rgb(255 255 255 / 0) 50%), rgb(44 46 54 / .96);
  box-shadow: 0 6px 18px rgb(0 0 0 / .45); }
.vkb-acc .vkb-key { position: relative; left: auto; right: auto; top: auto; bottom: auto; width: 48px; height: 42px; }
/* SteamVR's beam and dot, and the shell's pointer proxy ring (native mode only) */
.vkb-dot { position: absolute; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%; background: #fff; z-index: 52; pointer-events: none;
  box-shadow: 0 0 0 3px rgb(255 255 255 / .25), 0 0 14px 4px rgb(160 200 255 / .55); }
.vkb-proxy { position: absolute; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 50%; box-sizing: border-box; z-index: 52; pointer-events: none;
  border: 2.5px solid rgb(255 255 255 / .95); background: radial-gradient(circle, #fff 0 3px, transparent 3.5px);
  box-shadow: 0 0 0 1.5px rgb(0 0 0 / .30), inset 0 0 0 1px rgb(0 0 0 / .18), 0 0 14px 4px rgb(255 255 255 / .40); }
`;
  if (!document.getElementById('vkb-css')) {
    const s = document.createElement('style'); s.id = 'vkb-css'; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ------------------------------------------------------------------ glyphs (24-unit grid, the kit's paths) */
  const IC = {
    search: { s: ['M15.6 15.6 20 20'], c: ['10.6 10.6 6.4'] },
    message: { s: ['M5.6 4.8h12.8A2.6 2.6 0 0 1 21 7.4v7a2.6 2.6 0 0 1-2.6 2.6H11l-4.6 3.4V17h-.8A2.6 2.6 0 0 1 3 14.4v-7a2.6 2.6 0 0 1 2.6-2.6z'] },
    lock: { s: ['M8.4 10.4V7.8a3.6 3.6 0 0 1 7.2 0v2.6'], f: ['M6.6 10.4h10.8a1.4 1.4 0 0 1 1.4 1.4v7.2a1.4 1.4 0 0 1-1.4 1.4H6.6a1.4 1.4 0 0 1-1.4-1.4v-7.2a1.4 1.4 0 0 1 1.4-1.4z'] },
    person: { s: ['M4.6 20c.9-3.8 3.8-6 7.4-6s6.5 2.2 7.4 6'], c: ['12 8.4 3.8'] },
    emoji: { c: ['12 12 8.6'], s: ['M8 14.4c1 1.4 2.4 2.1 4 2.1s3-.7 4-2.1'], cf: ['9 9.8 1.2', '15 9.8 1.2'] },
    kbdown: { s: ['M5.5 4h13A2.5 2.5 0 0 1 21 6.5v6a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 12.5v-6A2.5 2.5 0 0 1 5.5 4z', 'M8.4 11.6h7.2', 'M9 18.4l3 2.2 3-2.2'], cf: ['7.6 7.9 1', '10.5 7.9 1', '13.5 7.9 1', '16.4 7.9 1'] },
    left: { s: ['M14.5 6 8.5 12l6 6'] }, right: { s: ['M9.5 6l6 6-6 6'] },
    up: { s: ['M6.5 14.5 12 9l5.5 5.5'] }, down: { s: ['M6.5 9.5 12 15l5.5-5.5'] },
  };
  function svg(name, cls = '') {
    const d = IC[name] || {}; let b = '';
    (d.f || []).forEach(p => { b += `<path d="${p}" fill="currentColor"/>`; });
    (d.s || []).forEach(p => { b += `<path d="${p}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`; });
    (d.c || []).forEach(c => { const [x, y, r] = c.split(' '); b += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="currentColor" stroke-width="2"/>`; });
    (d.cf || []).forEach(c => { const [x, y, r] = c.split(' '); b += `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor"/>`; });
    return `<svg class="vkb-i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${b}</svg>`;
  }

  /* ------------------------------------------------------------------ Steam's layout (qwerty, minimal mode) */
  // [id, shifted label | null, kind, width % of the 850 px row | null (shares the rest)]
  const chars = (s, sh) => s.split('').map((c, i) => [c, sh ? sh[i] : null, 'chr', null]);
  const ROWS = [
    [['`', '~', 'chr', 3.3], ...chars('1234567890-=', '!@#$%^&*()_+'), ['Backspace', null, 'mod', 11.7]],
    [['Tab', null, 'mod', 7], ...chars('qwertyuiop'), ...chars('[]\\', '{}|')],
    [['Caps', null, 'mod', 9.4], ...chars('asdfghjkl'), ...chars(';\'', ':"'), ['Enter', null, 'enter', 11.7]],
    [['ShiftL', null, 'mod', 14], ...chars('zxcvbnm'), ...chars(',./', '<>?'), ['ShiftR', null, 'mod', 14]],
    [['emoji', null, 'meta', 8.2], ['space', null, 'space', null], ['left', null, 'meta', 8.2], ['right', null, 'meta', 8.2], ['close', null, 'meta', 8.2]],
  ];
  const ROW_W = 850, PITCH = 47, Y0 = 3;
  const BADGE = { Backspace: 'X', space: 'Y', ShiftL: 'LT', Enter: 'RT' };   // P-C6: X delete, Y space, LT shift, RT enter

  function layout() {
    return ROWS.map((row, r) => {
      const fixed = row.reduce((a, k) => a + (k[3] || 0), 0) / 100 * ROW_W;
      const flex = row.filter(k => !k[3]).length;
      const each = (ROW_W - fixed) / flex;
      let x = 0;
      return row.map(([id, sh, kind, pct]) => { const w = pct ? pct / 100 * ROW_W : each; const k = { id, sh, kind, x, w, r }; x += w; return k; });
    });
  }

  function keyInner(k, st) {
    const up = st.shift === 'one' || st.shift === 'caps';
    const bdg = st.mode === 'pad' && BADGE[k.id] ? `<span class="vkb-bdg${BADGE[k.id].length > 1 ? ' two' : ''}">${BADGE[k.id]}</span>` : '';
    switch (k.id) {
      case 'Backspace': return bdg ? `<span class="in stack">${bdg}<span>Backspace</span></span>` : 'Backspace';   // 94 px key: the badge stacks above
      case 'Tab': return 'Tab';
      case 'Caps': return st.shift === 'caps' ? 'Caps<span class="capsbar"></span>' : 'Caps';
      case 'ShiftL': return `<span class="in">Shift${bdg}</span>`;
      case 'ShiftR': return 'Shift';
      case 'Enter': return `<span class="in">${st.enter || 'Enter'}${bdg}</span>`;
      case 'space': return bdg;
      case 'emoji': return svg('emoji');
      case 'left': return svg('up', 'up') + svg('left');
      case 'right': return svg('down', 'up') + svg('right');
      case 'close': return svg('kbdown');
      default: {
        if (k.sh) return up ? `<span>${k.sh}</span>` : `<span class="sh">${k.sh}</span><span>${k.id}</span>`;
        return `<span>${up && /[a-z]/.test(k.id) ? k.id.toUpperCase() : k.id}</span>`;
      }
    }
  }

  function keyClass(k, st) {
    const c = ['vkb-key'];
    if (k.kind === 'mod' || k.kind === 'meta') c.push('mod');
    if (k.kind === 'space') c.push('space');
    if (k.kind === 'enter') c.push('enter');
    if (st.hover === k.id) c.push('is-hover');
    if (st.focus === k.id) c.push('is-focus');
    if (st.focus === k.id && st.focus60) c.push('f60');
    if (st.pressed === k.id) c.push('is-pressed');
    if (st.shift === 'one' && (k.id === 'ShiftL' || k.id === 'ShiftR')) c.push('is-on');
    if (st.shift === 'caps' && k.id === 'Caps') c.push('is-on');
    return c.join(' ');
  }

  function echoHTML(st, pos) {
    const e = st.echo;
    if (st.buffer !== undefined) {
      return `<div class="vkb-echo buffer" data-id="kb-buffer" data-tier="Steam's VirtualKeyboardTextBuffer restyled (T1); no echo of ours"><span class="txt">${st.buffer}<span class="caret"></span></span></div>`;
    }
    if (!e) return '';
    const icon = e.icon ? svg(e.masked && e.icon !== 'lock' ? 'lock' : e.icon) : (e.masked ? svg('lock') : '');
    let txt;
    if (e.masked) txt = `<span class="dots">${'\u2022'.repeat(e.dots || 8)}</span>`;
    else if (e.text) txt = e.comp ? `${e.text}<span class="comp">${e.comp}</span>` : e.text;
    else txt = `<span class="ph">${e.ph || ''}</span>`;
    const caret = e.caret === false ? '' : '<span class="caret"></span>';
    const lbl = e.label || icon ? `<span class="lbl">${icon}${e.label || ''}</span>` : '';
    return `<div class="vkb-echo ${pos}" data-id="kb-echo" data-tier="T2 echo (display only, pointer-events none)">${lbl}<span class="txt${e.long ? ' long' : ''}">${e.ph && !e.text && !e.masked ? caret + txt : txt + caret}</span></div>`;
  }

  function build(host) {
    let st = {};
    try { st = JSON.parse(host.dataset.vkb || '{}'); } catch (err) { console.error('vkb: bad JSON', err); }
    st.mode = st.mode || 'laser';
    const tier = st.tier || 't5';
    const pos = st.buffer !== undefined ? 'buffer' : (st.pos || (st.echo === false ? 'none' : 'top'));
    const moved = pos === 'top' || pos === 'buffer';
    host.classList.add('vkb', tier);
    if (moved) host.classList.add('moved');
    host.dataset.mode = st.mode;
    if (st.radius) host.style.setProperty('--vkb-r', st.radius + 'px');
    const L = layout();
    const rows = L.map((row, r) => `<div class="vkb-row" style="top:${Y0 + r * PITCH}px">` + row.map(k => {
      const hv = st.hover === k.id ? ` style="--hx:${st.hx || '50%'}; --hy:${st.hy || '40%'}"` : '';
      return `<div class="vkb-hit" data-key="${k.id}" style="left:${k.x.toFixed(2)}px; width:${k.w.toFixed(2)}px"><div class="${keyClass(k, st)}"${hv}>${keyInner(k, st)}</div></div>`;
    }).join('') + '</div>').join('');
    let acc = '';
    if (st.accents) {
      const a = st.accents, row = L.find(rw => rw.some(k => k.id === a.on)), k = row.find(q => q.id === a.on);
      const left = 1 + k.x - 3, top = (moved ? 41 : 0) + Y0 + k.r * PITCH - 44 - 6;
      acc = `<div class="vkb-acc" data-id="kb-accents" style="left:${left.toFixed(1)}px; top:${top}px" data-tier="T1 %{KeyboardExtendedRow} (Steam's position)">` +
        a.keys.map(c => `<span class="vkb-key${c === a.focus ? ' is-focus' : ''}"><span>${c}</span></span>`).join('') + '</div>';
    }
    const plat = `<div class="lgk-glass vkb-plat" data-mat="thick"${tier === 't5' ? ' data-lens data-lens-bezel="14"' : ''} data-dz="0" style="--dz:0" data-id="kb-platter"
      data-tier="${tier === 't5' ? 'T5 glassd thick cover on the keyboard surface (K-G1..K-G5, P9 G4), at the quad plane (0 mm; -10 mm after K-G6)' : 'CSS only: Steam\'s DefaultTheme background recoloured (WN §8.4)'}"></div>`;
    host.innerHTML = plat + echoHTML(st, pos === 'buffer' ? 'buffer' : pos) + `<div class="vkb-rows" data-id="kb-keys">${rows}</div>` + acc;

    if (st.laser) {
      const go = () => {
        const tgt = host.querySelector(`.vkb-hit[data-key="${CSS_ESC(st.laser.key)}"] .vkb-key`);
        if (!tgt) return;
        const r = tgt.getBoundingClientRect(), view = host.closest('.lgk-view') || document.body, vr = view.getBoundingClientRect();
        const x = r.left - vr.left + r.width * parseFloat(st.laser.x || '50') / 100, y = r.top - vr.top + r.height * parseFloat(st.laser.y || '50') / 100;
        const [fx, fy] = st.laser.from || [1190, 1100];
        const id = 'vkbbeam' + Math.round(x);
        view.insertAdjacentHTML('beforeend', `<svg style="position:absolute; inset:0; width:1920px; height:1080px; pointer-events:none; z-index:40" viewBox="0 0 1920 1080">
          <defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${fx}" y1="${fy}" x2="${x}" y2="${y}"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#dbe8ff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity=".9"/></linearGradient></defs>
          <polygon points="${fx - 7},${fy} ${fx + 7},${fy} ${x + 1},${y} ${x - 1},${y}" fill="url(#${id})" opacity=".55"/></svg>
          <div class="${tier === 't5' ? 'vkb-proxy' : 'vkb-dot'}" style="left:${x.toFixed(1)}px; top:${y.toFixed(1)}px" data-tier="${tier === 't5' ? 'T2 pointer proxy (native mode only, PLAN §1.11)' : "SteamVR's laser dot"}"></div>`);
      };
      addEventListener('DOMContentLoaded', () => requestAnimationFrame(go));
    }
  }
  const CSS_ESC = s => (window.CSS && window.CSS.escape) ? window.CSS.escape(s) : s.replace(/["\\]/g, '\\$&');

  window.VKB = { build };
  document.querySelectorAll('[data-vkb]').forEach(build);
})();
