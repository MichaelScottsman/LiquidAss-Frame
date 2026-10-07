/* Glass Shell Phase 2 — "Game pages and Now Playing" concept: shared mockup helpers.
 *
 * Load AFTER kit.js. kit.js boots on DOMContentLoaded, so everything this file adds while the
 * document is still parsing (symbols, scene chrome, the title and details scenes) is still
 * processed by the kit (icons, art, lensing, room adaptation, annotations).
 *
 * On .lgk-view:
 *   data-tab="library|home|store|friends|media|download|gear|vr|power|none"   selected tab-bar item
 *   data-fc="steam|game|none"     SteamVR frame controls under the window (Steam frame or a game frame)
 *   data-bar="idle|running|none"  dashboard bar (running = the game's circle with a dot)
 * On <html>: data-annot  -> label every [data-dz] element with its depth and tier (kit #annot)
 *
 * Scene builders (revision 2). On an .lgk-overlay:
 *   data-gp="title"    the title view: hero art = the window, text column, play cluster, tab row.
 *     data-state   installed | notinstalled | update | stream | launching | running | disabled | shortcut
 *     data-focus   play | playfrom | stop | input | vrbind | manage | tab | none   (gamepad focus)
 *     data-hover   same keys (laser hover)
 *     data-open    playfrom | manage | stop    (that source turns white: its menu or alert is open)
 *     data-tip     playfrom | stop | manage    (tooltip shown ABOVE its control)
 *     data-depth   pop (default: Play +15 mm, circles and capsules +10, tab row +10) | flat (all 0)
 *     data-vr      1 (default) shows the Controller Bindings capsule; 0 hides it
 *     data-private 1 adds the private badge on the gear
 *     data-cloud   1 adds the Steam Cloud chip (trailing end of the tab row)
 *     data-hero    art spec ("hero-clean:0:") or "img:assets/<file>"
 *     data-logo    text, or "img:assets/<file>"
 *     data-dim     "L,B" left and bottom dimming alphas at the text column (default .50,.55: T2 adaptive
 *                  result for this art); the T1 fallback is .65 with on-art labels at .80
 *     data-chip / data-syn / data-stats   text column contents ("Label|Value;Label|Value")
 *   data-gp="details"  a details state (tabs pinned): blurred art backdrop + inline title + pinned tab row.
 *     data-tab     activity | yourstuff | community | gameinfo
 *     data-name    the inline title (T2, from appStore display_name)
 *     data-hero    art spec for the blurred backdrop
 *     Children with class .gp-content are moved into the window's scroller.
 *   data-foot="A:Open|≡:Options|B:Back"   bottom ornament legends (both scenes)
 */
(() => {
  'use strict';
  const K = window.LGK;
  if (!K) return;
  if (document.documentElement.hasAttribute('data-annot')) history.replaceState(null, '', '#annot');

  /* ---------------------------------------------------------------- extra symbols (24-unit grid) */
  Object.assign(K.ICONS, {
    stop: { f: ['M7.6 6.2h8.8c.8 0 1.4.6 1.4 1.4v8.8c0 .8-.6 1.4-1.4 1.4H7.6c-.8 0-1.4-.6-1.4-1.4V7.6c0-.8.6-1.4 1.4-1.4z'] },
    'arrow-up-right': { s: ['M8.2 15.8 16 8', 'M9.6 8H16v6.4'] },
    folder: { s: ['M3.8 7.4c0-.9.7-1.6 1.6-1.6h4l1.8 2h7.4c.9 0 1.6.7 1.6 1.6v7.8c0 .9-.7 1.6-1.6 1.6H5.4c-.9 0-1.6-.7-1.6-1.6z'] },
    'folder-plus': { s: ['M3.8 7.4c0-.9.7-1.6 1.6-1.6h4l1.8 2h7.4c.9 0 1.6.7 1.6 1.6v7.8c0 .9-.7 1.6-1.6 1.6H5.4c-.9 0-1.6-.7-1.6-1.6z', 'M12 11v5', 'M9.5 13.5h5'] },
    wrench: { s: ['M14.8 4.2a4.6 4.6 0 0 0-4.4 6l-6 6a1.9 1.9 0 0 0 2.7 2.7l6-6a4.6 4.6 0 0 0 6.1-4.4l-2.8 2.7-2.5-.6-.6-2.5z'] },
    sliders: { s: ['M4.5 7.5h8', 'M17.5 7.5h2', 'M4.5 16.5h2', 'M11.5 16.5h8'], c: ['15 7.5 2.3', '9 16.5 2.3'] },
    'eye-slash': { s: ['M3.5 12s3-5.8 8.5-5.8S20.5 12 20.5 12s-3 5.8-8.5 5.8S3.5 12 3.5 12z', 'M4.6 4.6l14.8 14.8'], c: ['12 12 2.6'] },
    eye: { s: ['M3.5 12s3-5.8 8.5-5.8S20.5 12 20.5 12s-3 5.8-8.5 5.8S3.5 12 3.5 12z'], c: ['12 12 2.8'] },
    trophy: { s: ['M8 4.6h8v5.2a4 4 0 0 1-8 0z', 'M8 6.2H5.2c0 2.6 1.2 4 3 4.3', 'M16 6.2h2.8c0 2.6-1.2 4-3 4.3', 'M12 13.8v3.4', 'M8.6 19.8h6.8', 'M9.8 17.2h4.4'] },
    like: { s: ['M4.4 10.4h3.2v8.6H4.4z', 'M7.6 10.4l3.3-5.6c.9-.3 1.9.4 1.8 1.4l-.4 3.3h4.6c1 0 1.8 1 1.5 2l-1.6 6c-.2.8-.9 1.3-1.7 1.3H7.6'] },
    bubble: { s: ['M5.2 5.6h13.6c.9 0 1.6.7 1.6 1.6v8.4c0 .9-.7 1.6-1.6 1.6H11l-4.2 3.2v-3.2H5.2c-.9 0-1.6-.7-1.6-1.6V7.2c0-.9.7-1.6 1.6-1.6z'] },
    note: { s: ['M6.4 3.8h8l4.2 4.2v11.2c0 .6-.4 1-1 1H6.4c-.6 0-1-.4-1-1V4.8c0-.6.4-1 1-1z', 'M14.4 3.8V8h4.2', 'M8.6 12.6h6.8', 'M8.6 16h4.6'] },
    vrbind: { s: ['M6.7 11.3c-.9-2.1 1.6-5.3 5.5-7.1s7.7-1.6 8.6.5-1.6 5.3-5.5 7.1-7.7 1.6-8.6-.5z', 'M9.6 11.6 8.3 19.6c-.2.9.5 1.7 1.4 1.7h1.4c.8 0 1.5-.6 1.5-1.5l.3-8.6'], cf: ['13.4 7.9 1.5'] },
    'chevron-updown': { s: ['M8 9.6 12 6l4 3.6', 'M8 14.4 12 18l4-3.6'] },
    desktop: { s: ['M4.6 5h14.8c.9 0 1.6.7 1.6 1.6v8.8c0 .9-.7 1.6-1.6 1.6H4.6c-.9 0-1.6-.7-1.6-1.6V6.6C3 5.7 3.7 5 4.6 5z', 'M9 20.4h6', 'M12 17v3.4'] },
    /* Play-from: a display with a play mark (where the game runs), chevron badge added by the cluster */
    stream: { s: ['M4.4 4.6h15.2c.9 0 1.6.7 1.6 1.6v9.4c0 .9-.7 1.6-1.6 1.6H4.4c-.9 0-1.6-.7-1.6-1.6V6.2c0-.9.7-1.6 1.6-1.6z', 'M9 20.4h6', 'M12 17.2v3.2'], f: ['M10.3 8.2v6l5-3z'] },
    branch: { c: ['7 6 2', '7 18 2', '17 8 2'], s: ['M7 8v8', 'M17 10c0 3.6-4.2 3.2-8.6 6.6'] },
    record: { c: ['12 12 8.4'], cf: ['12 12 4.2'] },
    brush: { s: ['M14.4 4.6l5 5-7.6 7.6-5-5z', 'M6.8 12.2c-2.4.6-2.8 2.8-3.2 7.2 4.4-.4 6.6-.8 7.2-3.2'] },
    gauge: { s: ['M4.3 16.6a8.4 8.4 0 1 1 15.4 0', 'M12 13.8l3.6-4.4'], cf: ['12 13.8 1.6'] },
    box: { s: ['M4.4 8 12 4l7.6 4v8L12 20l-7.6-4z', 'M4.4 8 12 12l7.6-4', 'M12 12v8'] },
    'shield-check': { s: ['M12 3.6l7 2.6v5.4c0 4.4-3 7.6-7 8.8-4-1.2-7-4.4-7-8.8V6.2z', 'M8.8 12l2.3 2.3 4.3-4.6'] },
    globe: { c: ['12 12 8.4'], s: ['M3.6 12h16.8', 'M12 3.6c2.4 2.4 3.4 5.2 3.4 8.4s-1 6-3.4 8.4c-2.4-2.4-3.4-5.2-3.4-8.4s1-6 3.4-8.4z'] },
    book: { s: ['M12 6.4c-1.8-1.4-4.6-1.8-7.4-1.4v12.8c2.8-.4 5.6 0 7.4 1.4 1.8-1.4 4.6-1.8 7.4-1.4V5c-2.8-.4-5.6 0-7.4 1.4z', 'M12 6.4v12.8'] },
    bubbles: { s: ['M4 5.4h10.4c.8 0 1.4.6 1.4 1.4v5.6c0 .8-.6 1.4-1.4 1.4H8.6L5.4 16v-2.2H4c-.8 0-1.4-.6-1.4-1.4V6.8c0-.8.6-1.4 1.4-1.4z', 'M18.4 9.4h1.6c.8 0 1.4.6 1.4 1.4v5.4c0 .8-.6 1.4-1.4 1.4h-1.2V20l-3-2.4h-4.4c-.8 0-1.4-.6-1.4-1.4v-.6'] },
    lifebuoy: { c: ['12 12 8.4', '12 12 3.6'], s: ['M6 6l3.4 3.4', 'M18 6l-3.4 3.4', 'M6 18l3.4-3.4', 'M18 18l-3.4-3.4'] },
    lock: { s: ['M6.4 10.6h11.2c.6 0 1 .4 1 1v7.4c0 .6-.4 1-1 1H6.4c-.6 0-1-.4-1-1v-7.4c0-.6.4-1 1-1z', 'M8.4 10.6V8a3.6 3.6 0 0 1 7.2 0v2.6'] },
    tag: { s: ['M4.2 4.2h7.2l8.4 8.4-7.2 7.2-8.4-8.4z'], cf: ['8 8 1.4'] },
    exit: { s: ['M13.6 4.4H6.6c-.6 0-1 .4-1 1v13.2c0 .6.4 1 1 1h7', 'M10.6 12h9.4', 'M17 8.6l3.4 3.4-3.4 3.4'] },
    info: { c: ['12 12 8.4'], s: ['M12 11v5.2'], cf: ['12 7.8 1.2'] },
    list: { s: ['M8.6 7h11', 'M8.6 12h11', 'M8.6 17h11'], cf: ['5 7 1.3', '5 12 1.3', '5 17 1.3'] },
    hand: { s: ['M8.4 12.2V6.4a1.4 1.4 0 0 1 2.8 0v5', 'M11.2 11V4.8a1.4 1.4 0 0 1 2.8 0V11', 'M14 11.2V6.2a1.4 1.4 0 0 1 2.8 0v7.4c0 4-2.4 6.6-5.6 6.6-2.6 0-4-1.2-5.4-3.4l-1.8-3a1.4 1.4 0 0 1 2.3-1.6l1.9 2.2'] },
    callout: { s: ['M4.6 6h7.8', 'M4.6 10.4h5', 'M14.6 8.2l3.4 3.4', 'M14.6 15h4.8'], c: ['16.2 15 0.1'] },
    throbber: { s: ['M12 3.6a8.4 8.4 0 1 1-8.4 8.4'] },
    'arrow-clockwise': { s: ['M19 12a7 7 0 1 1-2.1-5', 'M17.4 3.6v3.8h-3.8'] },
    star2: { s: ['M12 3.8l2.5 5.1 5.6.8-4.1 4 1 5.6L12 16.7l-5 2.6 1-5.6-4.1-4 5.6-.8z'] },
    laser: { s: ['M5 19l7.4-7.4', 'M14.2 9.8l1.2-1.2'], c: ['17.4 6.6 2.4'] },
  });

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  /* ---------------------------------------------------------------- the play cluster (§3.2) */
  function cluster(o) {
    const st = o.state;
    const dzP = o.pop ? 15 : 0, dzC = o.pop ? 10 : 0;
    const k = key => (o.focus === key ? ' is-focus' : '') + (o.hover === key ? ' is-hover' : '') + (o.open === key ? ' is-selected' : '');
    const lens = key => (o.open === key ? '' : ' data-lens');
    const tipLabel = { playfrom: 'Play From', stop: 'Stop', manage: 'Manage', input: 'Configure Controller', vrbind: 'VR Controller Bindings' };
    const tip = key => o.tip === key ? `<div class="lgk-glass gp-tip" data-mat="thick" style="--dz:${dzC + 5}" data-dz="owner+5" data-tier="tooltip above (T2)">${tipLabel[key]}</div>` : '';
    const slot = (key, inner) => `<span class="gp-slot" data-k="${key}">${inner}${tip(key)}</span>`;
    const P = {
      installed: ['play', 'Play', 'play'], shortcut: ['play', 'Play', 'play'], disabled: ['play', 'Play', ''],
      notinstalled: ['download', 'Install', 'primary'], update: ['download', 'Update', 'primary'],
      stream: ['play', null, 'play'], launching: ['throbber', 'Launching', 'play'], running: ['play', 'Resume', 'play'],
    }[st] || ['play', 'Play', 'play'];
    const label = P[1] === null
      ? `<span class="gp-two"><span>Stream</span><small>from Ben-PC2</small></span>`
      : P[1];
    const out = [];
    out.push(slot('play', `<div class="lgk-glass gp-ctl gp-overart gp-play${k('play')}${st === 'disabled' ? ' gp-dis' : ''}" data-mat="liquid"${P[2] ? ` data-tint="${P[2]}"` : ''} data-lens style="--dz:${dzP}" data-dz="${o.pop ? '0→15' : '0'}" data-tier="Play: T1; T4 pop + T5 tinted slab after GQ8"><i data-i="${P[0]}"${P[0] === 'throbber' ? ' class="bold"' : ''}></i>${label}</div>`));
    const hasPF = !['notinstalled', 'running', 'shortcut'].includes(st);
    if (hasPF) out.push(slot('playfrom', `<div class="lgk-glass gp-ctl gp-overart gp-circ gp-pf${k('playfrom')}" data-mat="clear"${lens('playfrom')} style="--dz:${dzC}" data-dz="${o.pop ? '0→10' : '0'}" data-tier="T1"><i data-i="stream"></i><span class="gp-pfbadge"><i data-i="chevron-down" class="bold"></i></span></div>`));
    if (st === 'running') out.push(slot('stop', `<div class="lgk-glass gp-ctl gp-overart gp-circ${k('stop')}${o.focus === 'stop' || o.hover === 'stop' ? ' is-danger-focus' : ''}" data-mat="clear"${lens('stop')} style="--dz:${dzC}" data-dz="${o.pop ? '0→10' : '0'}" data-tier="T1"><i data-i="stop"></i></div>`));
    out.push(slot('input', `<div class="lgk-glass gp-ctl gp-overart gp-cap${k('input')}" data-mat="clear"${lens('input')} style="--dz:${dzC}" data-dz="${o.pop ? '0→10' : '0'}" data-tier="T1+T2 label"><i data-i="controller"></i>Steam Input</div>`));
    if (o.vr) out.push(slot('vrbind', `<div class="lgk-glass gp-ctl gp-overart gp-cap${k('vrbind')}" data-mat="clear"${lens('vrbind')} style="--dz:${dzC}" data-dz="${o.pop ? '0→10' : '0'}" data-tier="T3 new (Q-A)"><i data-i="vrbind"></i>Controller Bindings</div>`));
    out.push(slot('manage', `<div class="lgk-glass gp-ctl gp-overart gp-circ${k('manage')}" data-mat="clear"${lens('manage')} style="--dz:${dzC}" data-dz="${o.pop ? '0→10' : '0'}" data-tier="T1"><i data-i="gear"></i>${o.private ? '<span class="gp-badge"><i data-i="eye-slash"></i></span>' : ''}</div>`));
    return `<div class="gp-cluster" style="left:${o.left ?? 40}px; top:${o.top ?? 448}px">${out.join('')}</div>`;
  }

  /* ---------------------------------------------------------------- tab row: segmented capsule + paired arrows (§3.3) */
  function tabrow(o) {
    const sel = o.tab || 'activity';
    const seg = (key, txt) => `<span class="gp-seg${sel === key ? ' is-selected' : ''}${o.focus === 'tab' && sel === key ? ' is-focus' : ''}">${txt}</span>`;
    const pinned = !!o.pinned;
    const mat = pinned ? 'liquid' : 'clear';
    const dz = pinned ? 20 : (o.pop ? 10 : 0);
    const top = pinned ? 116 : 548;
    return `<div class="gp-tabrow" style="left:40px; top:${top}px">
      <div class="lgk-glass gp-ctl ${pinned ? '' : 'gp-overart '}gp-tabs" data-mat="${mat}" data-lens style="--dz:${dz}" data-dz="${pinned ? '+20' : (o.pop ? '0→10' : '0')}" data-tier="${pinned ? 'T1 pin + T4 crop + T5 liquid slab' : 'T1; pinned +20 (T4+T5)'}">
        ${seg('activity', 'Activity')}${seg('yourstuff', 'Your Stuff')}${seg('community', 'Community')}${seg('gameinfo', 'Game Info <span class="ok"><i data-i="check" class="bold"></i></span>')}
      </div>
      <div class="lgk-glass gp-ctl ${pinned ? '' : 'gp-overart '}gp-arrows" data-mat="${mat}" data-lens style="--dz:${dz}" data-tier="Steam's %{Arrows}: two 80 px hit halves (laser only)"><span><i data-i="chevron-left" class="bold"></i></span><span><i data-i="chevron-right" class="bold"></i></span></div>
    </div>`;
  }

  function footer(spec) {
    const items = (spec || 'A:Select|B:Back').split('|').map(s => s.split(':'));
    return `<div class="lgk-glass gp-foot" data-mat="liquid" data-lens style="left:640px; translate:-50% 0; top:628px; padding:0 14px; --dz:0" data-dz="0" data-tier="footer: T1 + T5 inset slab">
      ${items.map(([g, t]) => `<span class="lgk-btn capsule plain${/Back|Cancel/.test(t) ? ' nav' : ''}"><span class="lgk-glyph">${g}</span>${esc(t)}</span>`).join('')}</div>`;
  }

  function artLayer(spec, cls) {
    if (spec && spec.startsWith('img:')) return `<div class="${cls}" style="background:center / cover no-repeat url('${spec.slice(4)}')"></div>`;
    return `<div class="${cls} lgk-art" data-art="${spec || 'hero-clean:0:'}"></div>`;
  }

  /* ---------------------------------------------------------------- title scene (§4.1) */
  function titleScene(ov) {
    const d = ov.dataset;
    const o = {
      state: d.state || 'installed', focus: d.focus || 'play', hover: d.hover || '', open: d.open || '', tip: d.tip || '',
      pop: (d.depth || 'pop') === 'pop', vr: d.vr !== '0', private: d.private === '1', tab: d.tab || 'activity',
    };
    const [dl, db, dt] = (d.dim || '.50,.45,.35').split(',').map(Number);
    const logo = d.logo && d.logo.startsWith('img:')
      ? `<img src="${d.logo.slice(4)}" alt="" style="max-width:560px; max-height:124px; object-fit:contain; object-position:left bottom">`
      : `<b>${(d.logo || 'Starfall<br>Drift')}</b>`;
    const stats = (d.stats || (o.state === 'running' ? 'Last Played|Today;Play Time|10.4 hours' : o.state === 'notinstalled' ? 'Space Required|42.1 GB' : 'Last Played|Oct 2;Play Time|10.2 hours'))
      .split(';').map(p => p.split('|')).map(([a, b]) => `<div><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('');
    const chip = d.chip || 'VR Required';
    const html = `
      <div class="lgk-glass gp-win" data-mat="window" data-dz="0" data-tier="window; hero = content (T1 layout, sticky art)" style="--dimL:${dl}; --dimB:${db ?? .45}; --dimT:${dt ?? .35}">
        <div class="gp-hero">${artLayer(d.hero, 'art')}<div class="dim"></div></div>
        <div class="gp-logo" style="left:40px; top:108px; width:560px; height:124px" data-tier="logo box 560 x 124 (T1, GQ2)">${logo}</div>
        <div class="gp-chips" style="left:40px; top:244px"><span class="gp-chip"><span class="disc" style="background:var(--lg-yellow); color:#16161a"><i data-i="vr"></i></span>${esc(chip)}</span></div>
        <div class="gp-syn gp-onart" style="left:40px; top:294px">${esc(d.syn || 'Ride the last light of a dying star through a valley of drifting islands. A rhythm racer built for VR.')}</div>
        <div class="gp-stats gp-onart" style="left:40px; top:358px">${stats}</div>
      </div>
      <div class="lgk-glass gp-ctl gp-overart gp-back" data-mat="clear" data-lens data-dz="0" data-tier="header T1 (window-nav)"><i data-i="chevron-left" class="bold"></i></div>
      <div class="lgk-glass gp-ctl gp-overart" data-mat="clear" data-lens style="left:1196px; top:24px; width:60px; height:60px; --r:30px" data-dz="0" data-tier="search magnifier (window-nav)"><i data-i="search"></i></div>
      ${cluster(o)}
      ${tabrow(o)}
      ${d.cloud === '1' ? `<span class="gp-chip gp-cloud" style="right:40px; top:562px"><span class="disc" style="background:rgb(255 255 255 / .2); --is:18px"><i data-i="cloud"></i></span>Steam Cloud: Up to date</span>` : ''}
      ${footer(d.foot)}`;
    ov.insertAdjacentHTML('afterbegin', html);
  }

  /* ---------------------------------------------------------------- details scene (§4.3–4.7) */
  function detailsScene(ov) {
    const d = ov.dataset;
    const content = [...ov.querySelectorAll(':scope > .gp-content')];
    const html = `
      <div class="lgk-glass gp-win" data-mat="window" data-dz="0" data-tier="T5 window cover (T1 tint)">
        <div class="gp-backdrop">${artLayer(d.hero, 'art')}</div>
        <div class="gp-scroll"></div>
        <span class="lgk-btn circle" style="position:absolute; left:24px; top:24px"><i data-i="chevron-left" class="bold"></i></span>
        <div class="gp-ititle" data-tier="T2 inline title (aria-hidden)">${esc(d.name || 'Starfall Drift')}</div>
        <span class="lgk-btn circle" style="position:absolute; left:1196px; top:24px"><i data-i="search"></i></span>
      </div>
      ${tabrow({ tab: d.tab, pinned: true, focus: d.focus })}
      ${footer(d.foot || 'A:Open|B:Back')}`;
    ov.insertAdjacentHTML('afterbegin', html);
    const sc = ov.querySelector('.gp-scroll');
    content.forEach(c => sc.appendChild(c));
  }

  // annotation mode: kit labels every [data-dz]; stack overlapping labels upward and add a legend line
  if (document.documentElement.hasAttribute('data-annot')) {
    new MutationObserver((m, obs) => {
      if (!document.documentElement.dataset.lgkReady) return;
      obs.disconnect();
      const tags = [...document.querySelectorAll('.lgk-annot')].sort((a, b) => a.offsetLeft - b.offsetLeft);
      const placed = [];
      for (const t of tags) {
        const box = () => ({ l: t.offsetLeft, r: t.offsetLeft + t.offsetWidth, t: t.offsetTop, b: t.offsetTop + t.offsetHeight });
        for (let i = 0; i < 6; i++) {
          const a = box();
          if (!placed.some(p => a.l < p.r + 4 && a.r > p.l - 4 && a.t < p.b && a.b > p.t)) break;
          t.style.top = (t.offsetTop - 21) + 'px';
        }
        placed.push(box());
      }
      const legend = document.createElement('div');
      legend.className = 'lgk-annot';
      legend.style.cssText = 'left:24px; top:1048px; font-size:15px; line-height:22px';
      legend.textContent = 'a→b mm: 0 mm today; b once GQ8 (per-shape fill for the pop hole) lands and AT-HV-OFFAXIS passes. Text, logo, chips and art stay at 0.';
      document.body.append(legend);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lgk-ready'] });
  }

  // a cluster on its own (the variants sheet): <div data-gp="cluster" data-state=… data-left=… data-top=…>
  document.querySelectorAll('[data-gp="cluster"]').forEach(h => {
    const d = h.dataset;
    h.outerHTML = cluster({ state: d.state || 'installed', focus: d.focus || '', hover: d.hover || '', open: d.open || '', tip: d.tip || '',
      pop: (d.depth || 'pop') === 'pop', vr: d.vr !== '0', private: d.private === '1', left: +d.left || 0, top: +d.top || 0 });
  });
  // geometry dump for the concept's tables (open with ?rects): rects in window px of every cluster slot, tooltip,
  // tab-row part and chip, written into <pre id="gp-rects"> once the kit is ready (read with chrome --dump-dom)
  if (/rects/.test(location.search)) {
    new MutationObserver((m, obs) => {
      if (!document.documentElement.dataset.lgkReady) return;
      obs.disconnect();
      const ov = document.querySelector('.lgk-overlay'), o = ov.getBoundingClientRect();
      const r = el => { const b = el.getBoundingClientRect(); return [Math.round(b.left - o.left), Math.round(b.top - o.top), Math.round(b.width), Math.round(b.height)]; };
      const out = {};
      ov.querySelectorAll('.gp-slot').forEach(s => { out[s.dataset.k] = r(s.firstElementChild); const t = s.querySelector('.gp-tip'); if (t) out['tip:' + s.dataset.k] = r(t); });
      ov.querySelectorAll('.gp-tabs, .gp-arrows, .gp-cloud, .gp-logo, .gp-chips .gp-chip, .gp-syn, .gp-stats, .gp-ititle').forEach(e => { out[e.className.split(' ').find(c => /^gp-(tabs|arrows|cloud|logo|chip|syn|stats|ititle)$/.test(c))] = r(e); });
      const pre = document.createElement('pre'); pre.id = 'gp-rects'; pre.textContent = JSON.stringify(out); document.body.append(pre);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lgk-ready'] });
  }

  document.querySelectorAll('.lgk-overlay[data-gp="title"]').forEach(titleScene);
  document.querySelectorAll('.lgk-overlay[data-gp="details"]').forEach(detailsScene);

  /* ---------------------------------------------------------------- scene chrome */
  const view = document.querySelector('.lgk-view');
  if (!view) return;
  const d = view.dataset;
  const html = [];

  // SteamVR frame menu = the visionOS tab-bar ornament (frame.menu popup, its own quad, popup px x 1.10)
  if ((d.tab || 'library') !== 'none') {
    const sel = d.tab || 'library';
    const tab = n => `<div class="lgk-tab${n === sel ? ' is-nav-selected' : ''}"${n === sel ? ' style="background:var(--lg-fill-nav)"' : ''}><i data-i="${n === 'download' ? 'download' : n}"></i></div>`;
    html.push(`<div class="lgk-pop" style="left:212px; top:28px; --pop-scale:1.10" data-dz="25" data-tier="frame.menu T1+T5">
      <div class="lgk-glass lgk-tabbar" data-mat="liquid" data-lens style="position:relative; --r:40px; --dz:25; gap:10px; padding:12px; width:80px; --lg-btn:56px">
        ${['home', 'library', 'store', 'friends', 'media', 'download'].map(tab).join('')}
      </div>
      <div class="lgk-glass lgk-tabbar" data-mat="liquid" data-lens style="position:relative; margin-top:16px; --r:40px; --dz:25; gap:10px; padding:12px; width:80px; --lg-btn:56px">
        ${['gear', 'vr', 'power'].map(tab).join('')}
      </div></div>`);
  }

  // SteamVR frame controls under the window (systemui, 0.023 deg/px = main px x 0.75), idle-dim
  if ((d.fc || 'steam') !== 'none') {
    const game = d.fc === 'game';
    const items = game ? ['float', 'theater', '|', 'more'] : ['keyboard', 'float', 'theater', 'more'];
    const left = game ? 820 : 849;
    html.push(`<div class="lgk-pop" style="left:${left}px; top:802px; --pop-scale:.75; opacity:.72; display:flex; gap:28px" data-tier="vr:systemui T1">
      <div class="lgk-glass lgk-toolbar" data-mat="panel" style="position:relative; height:80px; gap:8px; padding:0 8px; --r:40px">
        ${items.map(n => n === '|' ? '<span style="width:6px"></span>' : `<span class="lgk-btn circle plain" style="--s:64px"><i data-i="${n}"></i></span>`).join('')}
      </div>
      ${game ? `<div class="lgk-glass" data-mat="panel" style="position:relative; width:80px; height:80px; --r:40px; display:grid; place-items:center"><span class="lgk-btn circle plain" style="--s:64px"><i data-i="xmark"></i></span></div>` : ''}
    </div>`);
  }

  // the dashboard bar (system ornament, popup px x 1.20) and the window bar pill
  if ((d.bar || 'idle') !== 'none') {
    const running = d.bar === 'running';
    const left = running ? 624 : 667;
    html.push(`<div class="lgk-pop" style="left:${left}px; top:878px; --pop-scale:1.20; display:flex; gap:16px" data-tier="bar quad">
      <div class="lgk-glass lgk-toolbar" data-mat="liquid" data-lens style="position:relative; height:80px; gap:8px; padding:0 8px; --r:40px">
        <span class="lgk-btn circle" style="--s:64px; background:rgb(255 255 255 / .16)"><i data-i="controller"></i></span>
        ${running ? `<span style="position:relative; display:inline-grid"><span class="lgk-btn circle lgk-art" data-art="${d.barart || 'poster:0:'}" style="--s:64px; background-size:cover; background-position:50% 35%"></span><i style="position:absolute; left:28px; bottom:-7px; width:8px; height:8px; border-radius:4px; background:#fff"></i></span>` : ''}
        <span class="lgk-btn circle plain" style="--s:64px"><i data-i="plus"></i></span>
      </div>
      <div class="lgk-glass lgk-toolbar" data-mat="liquid" data-lens style="position:relative; height:80px; gap:8px; padding:0 8px 0 20px; --r:40px">
        <span class="t-headline t-num" style="font-size:24px">4:56</span>
        <span style="display:inline-flex; align-items:center; gap:6px; height:36px; padding:0 12px; border-radius:18px; background:rgb(255 255 255 / .14); font:600 18px/1 var(--lg-font)" class="t-num">
          <span style="width:22px; height:11px; border-radius:3px; box-shadow:inset 0 0 0 2px rgb(255 255 255 / .8); position:relative; display:inline-block"><span style="position:absolute; left:3px; top:3px; bottom:3px; width:13px; border-radius:1px; background:var(--lg-green)"></span></span>82%</span>
        <span class="lgk-btn circle plain" style="--s:64px"><i data-i="bell"></i></span>
        <span class="lgk-btn circle plain" style="--s:64px"><i data-i="grid"></i></span>
      </div></div>
      <div class="lgk-windowbar" style="left:870px; top:996px"></div>`);
  }
  view.insertAdjacentHTML('beforeend', html.join('\n'));
})();
