/* Builds the Control Center (main px), its footer legend and the dashboard bar (pp) markup for the control-center-*.html
 * mockups (concept revision 3, PLAN §1). Load it AFTER the placeholders and AFTER window-nav-shared.js (the shell's
 * chrome), BEFORE kit.js: it runs synchronously during parsing, so kit.js later renders the <i data-i> icons and data-art
 * art inside what it built.
 *
 *   <div class="ccm" data-cc='{"focus":"wifi"}'></div>              inside .lgk-overlay (main px) or a .lgk-pop
 *   <div class="cc-legend" data-legend='{"mode":"pad","items":[["A","Select"],["B","Close"]]}'></div>   inside .lgk-overlay
 *   <div class="bar2" data-bar='{"pill":{"state":"open"}}'></div>    inside a .lgk-pop with --pop-scale 1.2
 *
 * data-id of every target (focus / hover / audit / glass.py cmp): settings power batt return notif | wifi bt air ms rr
 * stream more vol vol-mute mic mic-mute | recenter playspace off on env bri | close | back n1..n5 | tn tq tp tb ts th
 * q-wifi q-net q-bt q-d1 q-d2 q-d3 q-add.  Tiles: tile-now tile-ctl tile-room.  Bar: home app0 app1 plus play view stream
 * pill avatar.
 *
 * cc options: focus, hover (+ hx, hy), vol, mic, env, bri, muted ("vol" | "mic"), toggles {wifi, bt, air, ms},
 * room (false = passthrough off), alert ("low" | "crit"), playing (false), now ("stack"), centre ("more"), tab. */
(() => {
  const parse = (el, k) => { try { return JSON.parse(el.getAttribute(k) || '{}'); } catch (e) { console.error('bad JSON', e); return {}; } };

  function stateOf(id, c) {
    const s = [];
    if (c.focus === id) s.push('gp');
    if (c.hover === id) s.push('is-hover');
    return s.join(' ');
  }
  function hoverStyle(id, c) { return c.hover === id ? `--hx:${c.hx || '50%'}; --hy:${c.hy || '50%'};` : ''; }
  function el(tag, id, cls, style, inner, c) {
    return `<${tag} data-id="${id}" class="${cls} ${stateOf(id, c)}" style="${style || ''}${hoverStyle(id, c)}">${inner}</${tag}>`;
  }
  /* rows in a platter: a lit row (hover, focus, selected) hides the separators on both sides of it */
  function row(id, cls, inner, c, style = '') {
    const lit = c.focus === id || c.hover === id || /\bis-nav\b/.test(cls) ? ' lit' : '';
    return el('div', id, `c-row ${cls}${lit}`, style, inner, c);
  }
  const lbl = (t) => `<span class="lbl">${t}</span>`;

  /* ------------------------------------------------------------ Now tile (360 x 524) */
  function nowTile(c) {
    if (c.now === 'stack') return stackTile(c);
    const b = c.batt || { h: 82, l: 64, r: 21, rst: 'low' };
    let h = `<div data-id="tile-now" class="lgk-glass tile now" data-mat="panel" data-lens>`;
    h += el('span', 'settings', 'lgk-btn circle c-corner', 'left:24px; top:24px;', '<i data-i="gear"></i>', c);
    h += el('span', 'power', 'lgk-btn circle c-corner', 'left:276px; top:24px;', '<i data-i="power"></i>', c);
    h += `<div class="t-date">Tue 7 Oct</div><div class="t-clock">4:56</div>`;
    if (c.alert) {
      const crit = c.alert === 'crit';
      h += el('div', 'batt', `c-cap alert${crit ? ' crit' : ''}`, 'left:24px; right:24px; top:192px;',
        `<i data-i="wand" style="--is:24px"></i><span>Right Controller · ${crit ? '4' : '9'} %</span><span class="trail"><i data-i="chevron-right"></i></span>`, c);
    } else {
      const chip = (g, v, st, flip) => `<span class="bchip"><i data-i="${g}"${flip ? ' style="transform:scaleX(-1)"' : ''}></i><b class="bnum ${st || ''}">${v}</b></span>`;
      h += el('div', 'batt', 'c-cap plain c-batt', 'left:24px; right:24px; top:192px;',
        chip('vr', b.h, b.hst) + chip('wand', b.l, b.lst) + chip('wand', b.r, b.rst, true), c);
    }
    h += `<div class="c-platter" style="top:268px; height:160px; padding:12px; box-sizing:border-box; gap:12px">`;
    if (c.playing === false) {
      h += `<div style="display:flex; align-items:center; gap:14px; height:64px; position:relative">
              <span style="width:64px; height:64px; border-radius:50%; background:rgb(255 255 255 / .10); flex:none; display:grid; place-items:center; --is:28px; color:var(--lg-text-3)"><i data-i="controller"></i></span>
              <span class="v2" style="font:600 24px/1.2 var(--lg-font)">Not Playing</span></div>`;
    } else {
      h += `<div style="display:flex; align-items:center; gap:14px; height:64px; position:relative">
              <span class="lgk-art" data-art="poster:0:" style="width:64px; height:64px; border-radius:50%; background-size:cover; background-position:50% 30%; flex:none; box-shadow:0 2px 6px rgb(0 0 0 / .35)"></span>
              <span style="min-width:0"><div class="ell" style="font:600 24px/1.25 var(--lg-font)">Starfall Drift</div>
              <div class="v2" style="font:500 20px/1.3 var(--lg-font)">Running · 1 h 12 min</div></span></div>`;
      h += el('div', 'return', 'c-cap', 'justify-content:center; padding:0 24px;', '<i data-i="play" style="--is:22px"></i><span>Return to Game</span>', c);
    }
    h += `</div>`;
    h += el('div', 'notif', 'c-cap', 'left:24px; right:24px; top:440px;',
      `<span class="c-stack"><i class="lgk-art" data-art="avatar:6:M"></i><i style="background:var(--lg-orange); color:var(--cc-dark)"><i data-i="wand"></i></i></span><span>3 Notifications</span><span class="trail"><i data-i="chevron-right"></i></span>`, c);
    return h + `</div>`;
  }

  /* the notification list replaces the Now tile's content in place (same 360 x 524 box) */
  function stackTile(c) {
    let h = `<div data-id="tile-now" class="lgk-glass tile now" data-mat="panel" data-lens>`;
    h += el('span', 'back', 'lgk-btn circle c-corner', 'left:24px; top:24px;', '<i data-i="chevron-left"></i>', c);
    h += `<div style="left:100px; right:24px; top:36px; font:700 28px/1.2 var(--lg-font)">Notifications</div>`;
    h += `<div class="c-list" style="left:24px; right:24px; top:108px; bottom:24px">`;
    const card = (id, ic, title, body, t, opts = {}) => el('div', id, `c-card${opts.pin ? ' pin' : ''}`, '',
      `${ic}<span class="ntx"><b>${title}</b><span>${body}<em> · ${t}</em></span></span>${opts.dot ? '<i class="dot"></i>' : ''}`, c);
    h += card('n1', `<span class="nic dk" style="background:var(--lg-orange)"><i data-i="wand"></i></span>`, 'Right Controller', 'Battery low · 9 %', 'now', { pin: 1 });
    h += card('n2', `<span class="nic" style="background:var(--lg-blue)"><i data-i="person"></i></span>`, '2 Friend Requests', 'Kestrel, Juno', '5 m', { pin: 1 });
    h += `<div class="c-sechdr">Earlier</div>`;
    h += card('n3', `<span class="nic lgk-art" data-art="avatar:6:M"></span>`, 'Mara', 'Joining tonight?', '12 m', { dot: 1 });
    h += card('n4', `<span class="nic" style="background:var(--lg-purple)"><i data-i="gift"></i></span>`, 'Gift from Kestrel', 'Paper Comets', '1 h', { dot: 1 });
    h += card('n5', `<span class="nic lgk-art" data-art="poster:1:"></span>`, 'Wishlist sale −40 %', 'Hollow Peaks', '3 h');
    return h + `</div></div>`;
  }

  /* ------------------------------------------------------------ sliders (64 px capsule; mute zone or inert glyph) */
  function slider(id, top, v, glyph, c, opts = {}) {
    const mute = opts.mute;
    const muted = mute && c.muted === id;
    const fillGlyph = mute ? '' : `<i data-i="${glyph}"></i>`;
    const zone = mute ? el('span', `${id}-mute`, 'mz', '', `<i data-i="${muted ? 'speakerslash' : glyph}"></i>`, c) : '';
    return el('div', id, `c-slider${mute ? ' mute' : ''}${muted ? ' muted' : ''}`, `top:${top}px; --v:${v};`,
      `${zone}<span class="trk"><span class="fill">${fillGlyph}</span><span class="knob"></span></span>`, c);
  }

  /* ------------------------------------------------------------ Controls tile (and the More page) */
  function ctlTile(c) {
    if (c.centre === 'more') return moreTile(c);
    const t = Object.assign({ wifi: true, bt: true, air: false, ms: true }, c.toggles || {});
    let h = `<div data-id="tile-ctl" class="lgk-glass tile ctl" data-mat="panel" data-lens>`;
    h += el('span', 'wifi', `lgk-btn circle c-tg${t.wifi ? ' on' : ''}`, 'left:24px; top:24px;', '<i data-i="wifi"></i>', c);
    h += el('span', 'bt', `lgk-btn circle c-tg${t.bt ? ' on' : ''}`, 'left:108px; top:24px;', '<i data-i="bluetooth"></i>', c);
    h += el('span', 'air', `lgk-btn circle c-tg${t.air ? ' on orange' : ''}`, 'left:192px; top:24px;', '<i data-i="airplane"></i>', c);
    h += el('span', 'ms', `lgk-btn circle c-tg${t.ms ? ' on' : ''}`, 'left:276px; top:24px;', '<i data-i="wave"></i>', c);
    h += `<div class="c-platter" style="top:100px; height:240px">`;
    h += row('rr', '', `<span class="lead"><i data-i="gauge"></i></span>${lbl('Refresh Rate')}<span class="trail">120<i data-i="chevron-right"></i></span>`, c);
    h += row('stream', '', `<span class="lead"><i data-i="vrlink"></i></span>${lbl('Streaming')}<span class="trail">Ready<i data-i="chevron-right"></i></span>`, c);
    h += row('more', '', `<span class="lead"><i data-i="sliders"></i></span>${lbl('More Controls')}<span class="trail"><i data-i="chevron-right"></i></span>`, c);
    h += `</div>`;
    h += slider('vol', 356, c.vol != null ? c.vol : .55, 'speaker', c, { mute: true });
    h += slider('mic', 436, c.mic != null ? c.mic : .80, 'mic', c, { mute: true });
    return h + `</div>`;
  }

  function moreTile(c) {
    let h = `<div data-id="tile-ctl" class="lgk-glass tile ctl wide" data-mat="panel" data-lens>`;
    /* sidebar: Steam's six Quick Access tabs (five + Streaming), recessed, no line; navigation selection = .18 pill */
    h += `<div style="left:0; top:0; bottom:0; width:282px; border-radius:54px 0 0 54px; background:var(--lg-fill-regular)"></div>`;
    const tabs = [['tn', 'bell', 'Notifications', 'var(--lg-red)'], ['tq', 'sliders', 'Quick Settings', 'var(--lg-blue)'], ['tp', 'bolt', 'Performance', 'var(--lg-orange)'],
      ['tb', 'battery', 'Battery', 'var(--lg-green)'], ['ts', 'vrlink', 'Streaming', 'var(--lg-indigo)'], ['th', 'help', 'Help', 'var(--lg-gray)']];
    tabs.forEach(([id, g, label, col], i) => {
      const dk = /green|orange/.test(col) ? ' color:var(--cc-dark);' : '';
      h += row(id, `nav${id === (c.tab || 'tq') ? ' is-nav' : ''}`, `<span class="chip" style="background:${col};${dk}"><i data-i="${g}"></i></span>${lbl(label)}`, c,
        `position:absolute; left:12px; width:258px; top:${24 + i * 80}px;`);
    });
    /* content: Steam's own Quick Settings panel component, rendered unchanged and restyled at window scale */
    h += el('span', 'back', 'lgk-btn circle c-corner', 'left:306px; top:24px;', '<i data-i="chevron-left"></i>', c);
    h += `<div style="left:382px; top:35px; font:700 30px/1.25 var(--lg-font)">Quick Settings</div>`;
    h += `<div style="left:306px; right:24px; top:104px; bottom:0; overflow:hidden; display:flex; flex-direction:column;
            -webkit-mask-image:linear-gradient(180deg,#000 0,#000 calc(100% - 72px),transparent 100%)">`;
    h += `<div class="c-sechdr" style="padding:0 26px 12px">Other</div>`;
    h += `<div class="c-platter" style="position:relative; left:0; right:0">`;
    h += row('q-wifi', '', `<span class="lead"><i data-i="wifi"></i></span>${lbl('Wi-Fi')}<span class="trail"><span class="c-switch on"></span></span>`, c);
    h += row('q-net', '', `<span class="lead"></span>${lbl('HomeNet')}<span class="trail">Connected<i data-i="chevron-right"></i></span>`, c);
    h += row('q-bt', '', `<span class="lead"><i data-i="bluetooth"></i></span>${lbl('Bluetooth')}<span class="trail"><span class="c-switch on"></span></span>`, c);
    h += row('q-d1', '', `<span class="lead"></span>${lbl('Controller (R)')}<span class="trail">Connected</span>`, c);
    h += row('q-d2', 'is-disabled', `<span class="lead"></span>${lbl('Headphones')}<span class="trail">Not Connected</span>`, c);
    h += row('q-d3', 'is-disabled', `<span class="lead"></span>${lbl('Speaker')}<span class="trail">Not Connected</span>`, c);
    h += row('q-add', '', `<span class="lead"></span>${lbl('Add Device')}<span class="trail"><i data-i="chevron-right"></i></span>`, c);
    h += `</div></div>`;
    return h + `</div>`;
  }

  /* ------------------------------------------------------------ Room tile */
  function roomTile(c) {
    if (c.centre === 'more') return '';
    const on = c.room !== false;
    let h = `<div data-id="tile-room" class="lgk-glass tile room" data-mat="panel" data-lens>`;
    h += el('span', 'recenter', 'lgk-btn circle c-corner', 'left:24px; top:24px;', '<i data-i="recenter"></i>', c);
    h += el('span', 'playspace', 'lgk-btn circle c-corner', 'left:276px; top:24px;', '<i data-i="playspace"></i>', c);
    h += `<div class="t-title">Room View</div>`;
    h += `<div class="t-sub">Passthrough is ${on ? 'on' : 'off'}</div>`;
    h += `<div class="c-seg" style="left:24px; width:312px; top:264px">`;
    h += `<span data-id="off" class="${on ? '' : 'is-selected '}${stateOf('off', c)}"><span>Off</span></span>`;
    h += `<span data-id="on" class="${on ? 'is-selected ' : ''}${stateOf('on', c)}"><i data-i="eye"></i><span>On</span></span></div>`;
    h += slider('env', 356, c.env != null ? c.env : .46, 'mountain', c);
    h += slider('bri', 436, c.bri != null ? c.bri : .70, 'sun', c);
    return h + `</div>`;
  }

  function buildCC(root) {
    const c = parse(root, 'data-cc');
    let h = nowTile(c) + ctlTile(c) + roomTile(c);
    h += `<span data-id="close" class="lgk-glass lgk-btn circle c-close ${stateOf('close', c)}" data-mat="liquid" style="position:absolute; left:610px; top:556px; --r:30px; --dz:15">
            <i data-i="xmark"></i></span>`;
    root.innerHTML = h;
  }

  /* ------------------------------------------------------------ Steam's footer legend (#Footer, y 628-712; PLAN §1.10)
   * items: [[button, label], ...] in Steam's order; A and B always present. mode "pad" draws the glyph badges, "laser"
   * does not (VP P-26). Only A and B -> quiet legend (no capsule); anything else -> the shell's capsule (.wn-orn). */
  function buildLegend(root) {
    const c = parse(root, 'data-legend');
    const items = c.items || [['A', 'Select'], ['B', 'Close']];
    const pad = c.mode !== 'laser';
    const quiet = items.every(([g]) => g === 'A' || g === 'B');
    const leg = ([g, label]) => {
      const nav = g === 'A' || g === 'B';
      return `<span class="wn-leg${nav ? ' nav' : ''}">${label}${pad ? `<span class="lgk-glyph">${g}</span>` : ''}</span>`;
    };
    let h = '';
    if (quiet) h = `<div class="cc-quiet" data-tier="Steam's #Footer, quiet legend (A and B only, PLAN §1.10)">${items.map(leg).join('')}</div>`;
    else {
      const acts = items.filter(([g]) => g !== 'A' && g !== 'B').map(leg).join('');
      const navs = items.filter(([g]) => g === 'A' || g === 'B').map(leg).join('');
      h = `<div class="lgk-glass lgk-toolbar wn-orn" data-mat="liquid" data-lens style="--dz:18" data-dz="0" data-tier="Steam's #Footer as the shell's ornament capsule (PLAN §1.10)">${acts}<span class="gsep"></span>${navs}</div>`;
    }
    root.outerHTML = h;
  }

  /* ------------------------------------------------------------ dashboard bar (pp) */
  function buildBar(root) {
    const c = parse(root, 'data-bar');
    const apps = c.apps || ['poster:0:', 'program:8:terminal'];
    const room = Object.assign({ play: '', view: 'on', stream: '' }, c.room || {});
    const pill = Object.assign({ state: 'rest', batt: { mode: 'num', v: 82, st: '' }, badge: 0 }, c.pill || {});
    const disc = (id, cls, inner, extraStyle = '') => `<span data-id="${id}" class="disc ${cls} ${stateOf(id, c)}" style="${hoverStyle(id, c)}${extraStyle}">${inner}</span>`;
    let h = `<div class="lgk-glass home" data-mat="liquid" data-lens><span class="slot${c.sel === 'home' || c.sel == null ? ' sel' : ''}">${disc('home', '', '<i data-i="controller"></i>')}</span></div>`;
    h += `<div class="lgk-glass apps" data-mat="liquid" data-lens>`;
    apps.forEach((a, i) => {
      const id = 'app' + i;
      h += `<span class="slot${c.sel === i ? ' sel' : ''}"><span data-id="${id}" data-art="${a}" class="disc art lgk-art ${stateOf(id, c)}"></span></span>`;
    });
    h += `<span class="slot">${disc('plus', c.plus === 'open' ? 'on' : '', '<i data-i="plus"></i>')}</span></div>`;
    h += `<span class="space"></span>`;
    h += `<div class="lgk-glass sys" data-mat="liquid" data-lens>`;
    h += `<span class="slot">${disc('play', room.play === 'open' ? 'on' : '', '<i data-i="playspace"></i>')}</span>`;
    h += `<span class="slot">${disc('view', room.view === 'on' ? 'on' : '', '<i data-i="eye"></i>')}</span>`;
    h += `<span class="slot">${disc('stream', room.stream === 'open' ? 'on' : '', '<i data-i="vrlink"></i>')}</span>`;
    /* Steam orders SteamVR's bar_buttons first, then header buttons such as Downloads */
    if (c.dl != null) h += `<span class="slot"><span class="dlring" style="--p:${c.dl}"><i class="lgk-art" data-art="poster:3:"></i></span></span>`;
    const b = pill.batt;
    const batt = b.mode === 'level' ? `<span class="blev ${b.st || ''}" style="--lvl:${b.v}%"><i></i></span>` : `<b class="bnum ${b.st || ''}">${b.v}</b>`;
    const pst = [pill.state === 'open' ? 'open' : '', pill.state === 'focus' || pill.focus ? 'gp' : '', pill.state === 'hover' ? 'is-hover' : ''].join(' ');
    h += `<span data-id="pill" class="pill ${pst}"><span class="clock">4:56</span>${batt}<i data-i="wifi"></i><i data-i="speaker"></i>${pill.badge ? `<span class="badge">${pill.badge}</span>` : ''}</span>`;
    h += `<span class="slot" style="width:60px">${`<span data-id="avatar" class="avatar lgk-art ${stateOf('avatar', c)}" data-art="avatar:2:B"></span>`}</span></div>`;
    root.innerHTML = h;
  }

  document.querySelectorAll('.ccm[data-cc]').forEach(buildCC);
  document.querySelectorAll('.cc-legend[data-legend]').forEach(buildLegend);
  document.querySelectorAll('.bar2[data-bar]').forEach(buildBar);
})();
