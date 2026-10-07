/* Glass Shell Phase 2 — concept "People, Photos, Downloads, Store": mockup helpers.
 * Script order at the end of <body>: kit.js, social-media.js, window-nav-shared.js.
 *   kit.js defines window.LGK at once and boots on DOMContentLoaded, so everything added here (icons,
 *   the People window, ornaments, keyboard keys, the data-wn chrome placeholders) is in place before the
 *   kit renders icons, paints art, adapts the glass to the room and builds the lens filters.
 *   window-nav-shared.js (owned by C1a) then builds the shared chrome placeholders this file emits.
 *
 *  - more icons in the kit's 24-unit SF-like sprite (LGK.ICONS)
 *  - <i data-sm="back10"> raw icons the sprite format cannot express (digits)
 *  - data-tab="friends|media|downloads|store|library" on the chrome host: the device's tab-bar ornament
 *    (window-nav-shared "tabbar", Steam's frame.menu popup) with that section selected
 *  - data-chrome="bar" on the chrome host: SteamVR frame controls, the dashboard bar, the grab pill
 *    (window-nav-shared "frame", "bar", "pill"; SteamVR's own positions until WN AT-17 passes, PLAN S10)
 *  - [data-sm-orn="spec"]: the bottom ornament (PLAN §1.10), see orn() below
 *  - [data-sm-people="hover|menu|compose"]: the People window (concept §3.1)
 *  - .sm-kb[data-kb]: Steam's VR keyboard keys (854 x 280 keyboard px, CTL §12), built from a row table
 *
 * Revision 3 (PLAN §1 conformance, M0): focus add .28 (§1.4), navigation selection = white .18 + top arc +
 * Semibold, the More circle helper look (§1.11), the ornament by content (§1.10), glyph badges in gamepad
 * mode only (§1.4, VP P-26), 24 px clear between 60 px targets (§1.3), menus by count (§1.12), depth §1.7.
 */
(() => {
  'use strict';
  const K = window.LGK;
  Object.assign(K.ICONS, {
    'person-add': { s: ['M3.4 19.8c.8-3.7 3.6-5.8 7-5.8 1.4 0 2.7.3 3.8 1', 'M18.6 13.2v6.4', 'M15.4 16.4h6.4'], c: ['10.4 8.4 3.7'] },
    'friends-plus': { s: ['M2.8 19.6c.7-3.4 3.2-5.3 6.2-5.3s5.5 1.9 6.2 5.3', 'M19 5.8v6.4', 'M15.8 9h6.4'], c: ['9 8.6 3.4'] },
    bubble: { s: ['M12 4.6c4.5 0 8.1 2.9 8.1 6.6s-3.6 6.6-8.1 6.6c-.9 0-1.8-.1-2.6-.3L5.2 19.3l1.1-3.3c-1.5-1.2-2.4-2.9-2.4-4.8 0-3.7 3.6-6.6 8.1-6.6z'] },
    bubbles: { s: ['M9.4 4.4c3.6 0 6.6 2.4 6.6 5.4s-3 5.4-6.6 5.4c-.7 0-1.4-.1-2-.2l-3.2 1.6.9-2.6c-1.2-1-1.9-2.5-1.9-4.2 0-3 3-5.4 6.2-5.4z', 'M18.4 9.6c1.4.9 2.3 2.2 2.3 3.8 0 1.5-.7 2.8-1.9 3.7l.8 2.4-2.9-1.2c-.6.2-1.3.2-2 .2-1.6 0-3.1-.5-4.2-1.3'] },
    group: { s: ['M7.2 19.4c.6-3 2.6-4.6 4.8-4.6s4.2 1.6 4.8 4.6', 'M2.4 17.8c.4-2.2 1.8-3.4 3.4-3.6', 'M21.6 17.8c-.4-2.2-1.8-3.4-3.4-3.6'], c: ['12 9.4 2.9', '5.8 9.8 2.1', '18.2 9.8 2.1'] },
    headset: { s: ['M4.6 14.2v-2.4a7.4 7.4 0 0 1 14.8 0v2.4', 'M4.6 13.6h2.2c.6 0 1 .4 1 1v3.2c0 .6-.4 1-1 1H5.6c-.6 0-1-.4-1-1z', 'M19.4 13.6h-2.2c-.6 0-1 .4-1 1v3.2c0 .6.4 1 1 1h1.2c.6 0 1-.4 1-1z'] },
    'arrow-up': { s: ['M12 18.6V5.8', 'M6.8 11 12 5.8l5.2 5.2'] },
    'arrow-down': { s: ['M12 5.4v13', 'M6.8 13.2 12 18.4l5.2-5.2'] },
    external: { s: ['M9.2 6.4h8.4v8.4', 'M17.4 6.6 6.6 17.4'] },
    'arrows-lr': { s: ['M4.6 8.6h14', 'M15.4 5.2l3.4 3.4-3.4 3.4', 'M19.4 15.4h-14', 'M8.6 12l-3.4 3.4 3.4 3.4'] },
    'person-gear': { s: ['M3.6 19.6c.8-3.6 3.6-5.6 6.9-5.6'], c: ['10.5 8.4 3.6', '17.6 17 2.7'], cf: ['17.6 17 .9'] },
    lock: { s: ['M8 10.4V8.2a4 4 0 0 1 8 0v2.2'], f: ['M6.6 10.4h10.8c.9 0 1.6.7 1.6 1.6v6.4c0 .9-.7 1.6-1.6 1.6H6.6c-.9 0-1.6-.7-1.6-1.6V12c0-.9.7-1.6 1.6-1.6z'] },
    reload: { s: ['M18.8 12.4a6.8 6.8 0 1 1-2.1-5.3', 'M17.6 3.6v4.2h-4.2'] },
    cart: { s: ['M3.4 4.6h2.2l2 10.2c.1.6.6 1 1.2 1h8.4c.6 0 1.1-.4 1.2-.9l1.4-6.5H6.4'], cf: ['9.2 19.2 1.4', '16.8 19.2 1.4'] },
    pause: { f: ['M7.6 5.2h2.6c.4 0 .8.4.8.8v12c0 .4-.4.8-.8.8H7.6c-.4 0-.8-.4-.8-.8V6c0-.4.4-.8.8-.8z', 'M13.8 5.2h2.6c.4 0 .8.4.8.8v12c0 .4-.4.8-.8.8h-2.6c-.4 0-.8-.4-.8-.8V6c0-.4.4-.8.8-.8z'] },
    'frame-back': { f: ['M17.4 6.4 9.6 12l7.8 5.6z'], s: ['M6.6 6.2v11.6'] },
    'frame-fwd': { f: ['M6.6 6.4 14.4 12l-7.8 5.6z'], s: ['M17.4 6.2v11.6'] },
    scissors: { s: ['M8.4 9.2 19.6 16.8', 'M8.4 14.8 19.6 7.2'], c: ['6.2 7.4 2.4', '6.2 16.6 2.4'] },
    pin: { s: ['M12 20.6s-6-5.4-6-10.2a6 6 0 0 1 12 0c0 4.8-6 10.2-6 10.2z'], c: ['12 10.4 2.2'] },
    film: { s: ['M5.6 4.6h12.8c.6 0 1 .4 1 1v12.8c0 .6-.4 1-1 1H5.6c-.6 0-1-.4-1-1V5.6c0-.6.4-1 1-1z', 'M8.2 4.8v14.4', 'M15.8 4.8v14.4', 'M4.8 12h3.4', 'M15.8 12h3.4'] },
    trophy: { s: ['M7.6 4.6h8.8v4.2a4.4 4.4 0 0 1-8.8 0z', 'M7.6 6.4H4.8c0 2.6 1.2 4 3.2 4.2', 'M16.4 6.4h2.8c0 2.6-1.2 4-3.2 4.2', 'M12 13.2v3.4', 'M9.6 16.6h4.8v2.8H9.6z'] },
    wallet: { s: ['M4.4 7.4h13.8c.8 0 1.4.6 1.4 1.4v9c0 .8-.6 1.4-1.4 1.4H5.8c-.8 0-1.4-.6-1.4-1.4z', 'M4.4 7.4l10.2-2.8c.6-.2 1.2.3 1.2.9v1.9', 'M15.4 13.2h4.2'] },
    'eye-slash': { s: ['M3.4 12s3.2-5.6 8.6-5.6 8.6 5.6 8.6 5.6-3.2 5.6-8.6 5.6S3.4 12 3.4 12z', 'M4.6 4.6l14.8 14.8'], c: ['12 12 2.6'] },
    display: { s: ['M4.6 5.4h14.8c.6 0 1 .4 1 1v8.8c0 .6-.4 1-1 1H4.6c-.6 0-1-.4-1-1V6.4c0-.6.4-1 1-1z', 'M9 19.4h6', 'M12 16.2v3.2'] },
    menu3: { s: ['M6 8.2h12', 'M6 12h12', 'M6 15.8h12'] },
    envelope: { s: ['M4.6 6.2h14.8c.6 0 1 .4 1 1v9.6c0 .6-.4 1-1 1H4.6c-.6 0-1-.4-1-1V7.2c0-.6.4-1 1-1z', 'M4.2 7.2 12 13l7.8-5.8'] },
    'chevron-right-sm': { s: ['M10 6.5 15.5 12 10 17.5'] },
    globe: { s: ['M3.6 12h16.8', 'M12 3.6c2.4 2.4 3.4 5.2 3.4 8.4s-1 6-3.4 8.4c-2.4-2.4-3.4-5.2-3.4-8.4s1-6 3.4-8.4z'], c: ['12 12 8.4'] },
    gauge: { s: ['M12 13.4l3.6-3.6', 'M4.6 16.4a8 8 0 1 1 14.8 0'], cf: ['12 13.4 1.4'] },
    'xmark-circle': { s: ['M9.2 9.2l5.6 5.6', 'M14.8 9.2l-5.6 5.6'], c: ['12 12 8.4'] },
  });

  /* ------------------------------------------------------------------ the bottom ornament (PLAN §1.10, WN §3.4)
   * [data-sm-orn="g:Label[:cls]|…"] with data-mode="laser|pad" (default laser) and optional data-top.
   *   g     = a controller letter (A, B, X, Y, LB …) or an icon name prefixed with "@" (e.g. "@menu3" for ≡)
   *   Label = Steam's legend text; label first, the glyph badge trailing (WN §3.4.1)
   *   cls   = extra classes: danger (red label), open (white: its menu is open), hover, focus
   * A and B are the navigation members: always present, quiet, trailing, in both input modes.
   * Material by content: a capsule (liquid, 84 px, ≤ 960 wide) when any member is not A or B; otherwise the
   * quiet legend (no capsule, no slab: the same 84 px box, items 60 tall, Medium white .70). data-onroom: the legend's labels
 * sit over the room (glass mode window: the margin below 656), so they carry the on-room text shadow (VP P-41).
   * Glyph badges show only in gamepad mode (§1.4, VP P-26); in laser mode members are labels only. */
  const glyph = g => g.startsWith('@') ? `<span class="lgk-glyph"><i data-i="${g.slice(1)}" style="--is:16px"></i></span>` : `<span class="lgk-glyph">${g}</span>`;
  function orn(spec, mode = 'laser', top = 628, extra = '', onRoom = false) {
    const pad = mode === 'pad';
    const items = spec.split('|').filter(Boolean).map(it => {
      const [g, label, cls = ''] = it.split(':');
      return { g, label, cls, nav: g === 'A' || g === 'B' };
    });
    const capsule = items.some(it => !it.nav);
    let html = '', prev = null;
    for (const it of items) {
      if (prev !== null && prev !== it.nav) html += '<span class="gsep"></span>';
      prev = it.nav;
      const cls = ['wn-leg', 'sm-leg'];
      if (it.nav) cls.push('nav');
      it.cls.split(' ').filter(Boolean).forEach(c => cls.push(c === 'open' ? 'is-open' : c === 'hover' ? 'is-hover' : c === 'focus' ? 'is-focus' : c));
      html += `<span class="${cls.join(' ')}" style="--hx:40%;--hy:35%">${it.label}${pad ? glyph(it.g) : ''}</span>`;
    }
    const tier = capsule
      ? 'ornament: capsule (an action other than A/B); T1 #Footer + T5 liquid slab behind (inset), 0 mm, never a crop'
      : 'ornament: quiet legend (A/B only); no capsule, no slab; same box, 0 mm';
    return capsule
      ? `<div class="lgk-glass lgk-toolbar wn-orn sm-orn" data-mat="liquid" data-lens data-id="ornament" style="--dz:18; top:${top}px${extra}" data-dz="0" data-tier="${tier}">${html}</div>`
      : `<div class="sm-quiet${onRoom ? ' room' : ''}" data-id="ornament" style="top:${top}px${extra}" data-dz="0" data-tier="${tier}">${html}</div>`;
  }
  K.smOrn = orn;
  document.querySelectorAll('[data-sm-orn]').forEach(el => {
    let html = orn(el.dataset.smOrn, el.dataset.mode || 'laser', el.dataset.top || 628, el.dataset.style ? '; ' + el.dataset.style : '', el.dataset.onroom !== undefined);
    if (el.dataset.mat) html = html.replace('data-mat="liquid"', `data-mat="${el.dataset.mat}"`);   /* e.g. clear over media (PLAN §1.6) */
    el.outerHTML = html;
  });

  /* ------------------------------------------------------------------ People (concept §3.1, revision 3)
   * Sidebar 512 (four equal segments of 121 x 60 in a 488 x 64 track, E-SEG compact), conversation pane x 512-1280. */
  const ava = (st, art, size) => `<div class="sm-ava" data-st="${st}"${size ? ` style="--av:${size}px"` : ''}><div class="lgk-art" data-art="${art}"></div></div>`;
  function people(state) {
    const hover = state === 'hover', menu = state === 'menu', compose = state === 'compose';
    const rinCls = hover ? ' is-spot' : '';
    const more = (hover || menu)
      ? `<span class="lgk-btn circle sm-more${menu ? ' is-selected' : ''}" style="position:absolute; right:24px; top:6px" data-id="more" data-tier="C1a More helper (PLAN §1.11): 60 visible / 80 hit, row trailing inset 24; calls the row's own onMenuButton"><i data-i="more"></i></span>`
      : '';
    const typed = compose
      ? '<div class="lgk-search sm-compose is-focus" data-id="compose"><span class="typed">See you at 8, bringing snacks<span style="display:inline-block; width:2px; height:28px; background:var(--lg-blue); vertical-align:-6px; margin-left:3px"></span></span><span class="lgk-btn circle sm-send" data-id="send"><i data-i="arrow-up" class="bold"></i></span></div>'
      : '<div class="lgk-search sm-compose" data-id="compose"><span class="typed ph">Message</span><span class="lgk-btn circle sm-send off" data-id="send"><i data-i="arrow-up" class="bold"></i></span></div>';
    const leg = menu ? 'A:Select|B:Back' : compose ? 'Y:Start Voice Chat|A:Select|B:Back' : '@menu3:Options|A:Send Message|B:Back';
    return `
    <div class="lgk-glass sm-win" data-mat="window" data-dz="0" data-id="window" data-tier="glass mode window (PLAN §1.2): T5 window cover / T1 smoky tint">
      <div class="lgk-sidebar sm-side" data-id="sidebar"></div>

      <!-- sidebar toolbar row: Steam's header nodes laid out here on /chat (route-scoped position rules).
           Back (laser only; B is the gamepad path), section root = borderless. The global search collapsed to a
           60 px magnifier circle in its 80 x 80 box at the sidebar's trailing end (418, 14): it opens Steam's search. -->
      <span class="lgk-btn circle sm-back root" data-id="back"><i data-i="chevron-left"></i></span>
      <span class="lgk-btn circle" style="position:absolute; left:428px; top:24px" data-id="search"><i data-i="search"></i></span>

      <!-- title row: Steam's TabPanelHeader (names the tab) with its FriendActionsContainer circles trailing,
           centres 84 apart (24 px clear, PLAN §1.3); Add a Friend sits directly under the search circle -->
      <div class="sm-stitle t-title1">Friends</div>
      <span class="lgk-btn circle" style="position:absolute; left:344px; top:104px" data-id="invites"><i data-i="envelope"></i><span class="lgk-badge" style="right:-6px; top:-4px">2</span></span>
      <span class="lgk-btn circle" style="position:absolute; left:428px; top:104px" data-id="addfriend"><i data-i="person-add"></i></span>

      <!-- FriendsListSteamDeckTabs: four equal contiguous labelled segments (T2 labels) in a 64 px track, padding 2.
           Steam's bumper glyphs (L1/R1) show as badges on the track's ends in gamepad mode only (VP P-26). -->
      <div class="sm-seg" style="left:12px; top:180px; width:488px" data-id="tabs"><span>Favorites</span><span class="is-selected">Friends</span><span>Groups</span><span>Recent</span></div>

      <!-- friend list (not virtualized: module 20447) -->
      <div class="sm-scroll" style="left:0; top:260px; width:512px; height:396px; -webkit-mask-image:linear-gradient(180deg, transparent 0, #000 10px, #000 calc(100% - 56px), transparent 100%)">
        <div class="sm-grp" style="top:6px"><span class="gicon lgk-art" data-art="poster:1:"></span>Hollow Peaks <span class="count">1</span><i data-i="chevron-down" class="chev"></i></div>
        <div class="lgk-row sm-frow${rinCls}" style="top:86px; --hx:89%; --hy:50%" data-id="row-hover">${ava('game', 'avatar:4:RS')}
          <div class="lines"><span class="nm">Rin Sato</span><span class="pr">Hollow Peaks · In a party of 3</span></div>${more}</div>
        <div class="sm-grp" style="top:166px">Online <span class="count">3</span><i data-i="chevron-down" class="chev"></i></div>
        <div class="lgk-row sm-frow cur is-nav-selected" style="top:246px" data-id="row-current">${ava('online', 'avatar:6:AV')}
          <div class="lines"><span class="nm">Aster Vale</span><span class="pr">Online</span></div></div>
        <div class="lgk-row sm-frow" style="top:326px">${ava('away', 'avatar:8:JP')}
          <div class="lines"><span class="nm">Juno Park<span class="zz">zZ</span></span><span class="pr">Away</span></div></div>
        <div class="lgk-row sm-frow" style="top:406px">${ava('online', 'avatar:2:MO')}
          <div class="lines"><span class="nm">Mika Oduya</span><span class="pr">Online</span></div></div>
      </div>

      <!-- conversation header: Steam's %{ChatTab} (role=button) as a lockup centred on the pane (x 896);
           voice + invite as corner circles, centres 84 apart -->
      <div class="sm-chattab" data-id="chattab">${ava('online', 'avatar:6:AV', 52)}
        <div style="display:flex; flex-direction:column"><span class="nm">Aster Vale</span><span class="pr">Online</span></div></div>
      <span class="lgk-btn circle" style="position:absolute; left:1112px; top:24px" data-id="voice"><i data-i="headset"></i></span>
      <span class="lgk-btn circle" style="position:absolute; left:1196px; top:24px" data-id="invite"><i data-i="friends-plus"></i></span>

      <!-- history as bubbles (T1 on .ChatMessageBlock/.msg/.isCurrentUser) -->
      <div class="sm-scroll sm-hist top-only">
        <div class="sm-hist-in">
          <div class="sm-day">Wednesday, October 7</div>
          <div class="sm-who">Aster Vale · 6:12 PM</div>
          <div class="sm-msg first"><div class="sm-ava ghost"></div><div class="sm-bub">Are you hopping on Starfall Drift tonight?</div></div>
          <div class="sm-msg">${ava('online', 'avatar:6:AV')}<div class="sm-bub">The new season just dropped</div></div>
          <div class="sm-who me">You · 6:14 PM</div>
          <div class="sm-msg me"><div class="sm-bub">Yes! After dinner, around 8?</div></div>
          <div class="sm-msg me first"><div class="sm-bub">I'll bring Mika too</div></div>
          <div class="sm-who">Aster Vale · 6:15 PM</div>
          <div class="sm-msg first">${ava('online', 'avatar:6:AV')}<div class="sm-bub">Perfect. I'll set up the lobby</div></div>
          <div class="sm-msg"><div class="sm-ava ghost"></div><span class="sm-typing">Aster Vale is typing a message…</span></div>
        </div>
      </div>

      <!-- RadialMenuExplainerText as a caption (its inline glyph is Steam's text content, not a button badge, so it stays in
           both input modes), then the compose capsule (recessed) with the 60 px send circle -->
      <div class="sm-hint">Hold <span class="lgk-glyph"><i data-i="menu3" style="--is:16px"></i></span> to send a quick message</div>
      ${typed}
    </div>

    <!-- bottom ornament: Steam's #Footer legend (PLAN §1.10): y 628-712, centred, 0 mm, never a crop -->
    ${orn(leg, 'laser', 628, '', menu)}`;
  }
  document.querySelectorAll('[data-sm-people]').forEach(el => { el.outerHTML = people(el.dataset.smPeople); });

  /* raw icons: digits inside arrows (gobackward.10 / goforward.10) */
  const RAW = {
    back10: '<path d="M5.2 12.2a6.8 6.8 0 1 0 2-4.9" fill="none" stroke="currentColor"/><path d="M7.2 3.4v4h4" fill="none" stroke="currentColor"/><text x="12.2" y="15.1" font-size="7.4" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none" font-family="LGS Inter, sans-serif">10</text>',
    fwd10: '<path d="M18.8 12.2a6.8 6.8 0 1 1-2-4.9" fill="none" stroke="currentColor"/><path d="M16.8 3.4v4h-4" fill="none" stroke="currentColor"/><text x="11.8" y="15.1" font-size="7.4" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none" font-family="LGS Inter, sans-serif">10</text>',
  };
  document.querySelectorAll('i[data-sm]').forEach(el => {
    const t = document.createElement('span');
    t.innerHTML = `<svg class="smi" viewBox="0 0 24 24" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${RAW[el.dataset.sm] || ''}</svg>`;
    const svg = t.firstChild; if (el.style.cssText) svg.style.cssText = el.style.cssText; el.replaceWith(svg);
  });

  /* ------------------------------------------------------------------ shared chrome: emitted as window-nav-shared placeholders
   * (the device's tab bar with Console, live pitch 58 at r = 1; SteamVR frame controls; the dashboard bar; the grab pill) */
  const host = document.querySelector('[data-chrome-host]') || document.querySelector('.lgk-view');
  if (host) {
    const tab = host.dataset.tab;
    const dy = +host.dataset.shift || 0;
    if (tab) {
      const sel = { friends: 'friends', media: 'media', downloads: 'downloads', store: 'store', library: 'library', home: 'home' }[tab] || '';
      host.insertAdjacentHTML('afterbegin', `<div data-wn="tabbar" data-right="302" data-cy="${426 + dy}" data-sel="${sel}"></div>`);
    }
    if ((host.dataset.chrome || '').includes('bar')) {
      host.insertAdjacentHTML('beforeend', `
        <div data-wn="frame" data-cx="960" data-y="${806 + dy}" data-dim=".72"></div>
        <div data-wn="bar" data-cx="960" data-y="${904 + dy}"></div>
        <div data-wn="pill" data-cx="960" data-y="${1018 + dy}"></div>`);
    }
  }

  /* ------------------------------------------------------------------ Steam's VR keyboard (CTL §12; owner C4b)
   * 854 x 280 keyboard px; echo row 33 px at y 5-38 (T2), the key block moved down 41 px; keys from y 46 at a 47 px pitch.
   * data-go = the context Enter label (CTL §12.5); data-hot = the key under the laser (Focused: white .32 + spot + arc). */
  document.querySelectorAll('.sm-kb[data-kb]').forEach(kb => {
    const go = kb.dataset.go || 'Enter', hot = kb.dataset.hot || '';
    const rows = [
      [['`', '~'], ['1', '!'], ['2', '@'], ['3', '#'], ['4', '$'], ['5', '%'], ['6', '^'], ['7', '&'], ['8', '*'], ['9', '('], ['0', ')'], ['-', '_'], ['=', '+'], ['@delete', '', 1.6, 'mod']],
      [['Tab', '', 1.5, 'mod'], ['q'], ['w'], ['e'], ['r'], ['t'], ['y'], ['u'], ['i'], ['o'], ['p'], ['[', '{'], [']', '}'], ['\\', '|', 1.1]],
      [['Caps', '', 1.8, 'mod'], ['a'], ['s'], ['d'], ['f'], ['g'], ['h'], ['j'], ['k'], ['l'], [';', ':'], ["'", '"'], [go, '', 1.8, 'go']],
      [['Shift', '', 2.3, 'mod'], ['z'], ['x'], ['c'], ['v'], ['b'], ['n'], ['m'], [',', '<'], ['.', '>'], ['/', '?'], ['Shift', '', 2.3, 'mod']],
      [['@steam', '', 1.5, 'mod'], ['', '', 9.6, 'space'], ['@left', '', 1, 'mod'], ['@right', '', 1, 'mod'], ['@close', '', 1.5, 'mod']],
    ];
    const W = 826, X0 = 14, Y0 = 46, P = 47;
    let html = '';
    rows.forEach((r, ri) => {
      const units = r.reduce((a, k) => a + (k[2] || 1), 0), u = W / units;
      let x = X0;
      r.forEach(k => {
        const w = (k[2] || 1) * u;
        let label = k[0];
        if (label === '@steam') label = '<i data-i="sparkle"></i>';
        else if (label === '@left') label = '<i data-i="chevron-left"></i>';
        else if (label === '@right') label = '<i data-i="chevron-right"></i>';
        else if (label === '@close') label = '<i data-i="keyboard"></i>';
        else if (label === '@delete') label = 'Delete';
        const cls = ['sm-key', k[3] || '', (k[0] === hot ? 'hot' : '')].join(' ');
        html += `<div class="${cls}" style="left:${x.toFixed(1)}px; top:${Y0 + ri * P}px; width:${(w - 3).toFixed(1)}px">${k[1] ? `<span class="sh">${k[1]}</span>` : ''}${label}</div>`;
        x += w;
      });
    });
    kb.insertAdjacentHTML('beforeend', html);
  });
})();
