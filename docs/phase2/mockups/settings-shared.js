/* Settings concept (docs/phase2/concepts/settings.md): builds the parts every settings mockup shares,
 * so the sidebar, the detail toolbar and the SteamVR sidebar are identical in every render.
 * Runs synchronously after settings-icons.js and before window-nav-shared.js and kit.js.
 *
 *   <div data-st="sidebar" data-sel="system" data-hover="internet" data-scroll="0"></div>
 *       Steam's PageListColumn (x 0..400). data-focus="<key>" draws gamepad focus (= selection in Steam's sidebar).
 *       data-dim makes it inert-looking while a modal list page is open.
 *   <div data-st="toolbar" data-title="Software Update" data-back data-search="circle|none" data-lead="Cancel"></div>
 *       The detail pane's part of the 108 px toolbar row (x 400..1280): Back circle (sub-views), inline title
 *       (Title 2, centred over the detail pane), Steam's search collapsed to a 60 px magnifier circle (trailing).
 *   <div data-st="vrside" data-sel="general" data-hover="dashboard"></div>
 *       SteamVR's sidebar, authored in SteamVR px (x 1.44 of main px).
 */
(() => {
  'use strict';
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content; };

  // Steam's settings pages in Steam's order, with the new VR Settings group after the first group.
  // [key, label, colour, icon (i = kit icon, si = settings icon)]
  const PAGES = [
    ['system', 'System', 'gray', 'i:gear'], ['internet', 'Internet', 'blue', 'i:wifi'], ['storage', 'Storage', 'gray', 'si:drive'], ['bluetooth', 'Bluetooth', 'blue', 'i:bluetooth'],
    null,
    ['vr', 'VR Settings', 'purple', 'i:vr'],
    null,
    ['display', 'Display', 'blue', 'si:display'], ['power', 'Power', 'green', 'si:bolt'], ['audio', 'Audio', 'pink', 'i:speaker'], ['controller', 'Controller', 'orange', 'i:controller'],
    ['keyboard', 'Keyboard', 'gray', 'i:keyboard'], ['accessibility', 'Accessibility', 'blue', 'si:access'], ['security', 'Security', 'blue', 'si:lock'],
    null,
    ['notifications', 'Notifications', 'red', 'i:bell'], ['friends', 'Friends & Chat', 'green', 'i:friends'], ['downloads', 'Downloads', 'teal', 'i:download'],
    ['cloud', 'Cloud', 'blue', 'i:cloud'], ['ingame', 'In Game', 'indigo', 'si:overlay'], ['compatibility', 'Compatibility', 'purple', 'si:wrench'],
    ['family', 'Family', 'orange', 'si:house'], ['remoteplay', 'Remote Play', 'purple', 'si:stream'], ['gamerecording', 'Game Recording', 'red', 'si:record'],
    null,
    ['home', 'Home', 'indigo', 'i:home'], ['library', 'Library', 'orange', 'i:library'], ['store', 'Store', 'blue', 'i:store'], ['developer', 'Developer', 'gray', 'si:hammer'],
  ];
  const icon = (spec) => { const [ns, name] = spec.split(':'); return ns === 'si' ? `<i data-si="${name}"></i>` : `<i data-i="${name}"></i>`; };
  window.ST_CHIP = (key, cls = '') => {
    const p = PAGES.find((x) => x && x[0] === key);
    return `<span class="st-chip ${cls}" data-c="${p[2]}">${icon(p[3])}</span>`;
  };

  function buildSidebar(el) {
    const d = el.dataset;
    const rows = PAGES.map((p) => {
      if (!p) return '<div class="st-gap"></div>';
      const [key, label] = p;
      const cls = ['st-nav', 'lgk-row'];
      if (key === d.sel) cls.push('is-nav-selected');
      if (key === d.hover) cls.push('is-hover');
      if (key === d.focus) cls.push('is-focus');
      const badge = key === 'system' && d.badge !== 'none' ? '<span class="trail"><span class="st-badge">1</span></span>' : '';
      const style = key === d.hover ? ` style="--hx:${d.hx || '70%'}; --hy:${d.hy || '45%'}"` : '';
      return `<div class="${cls.join(' ')}"${style}>${window.ST_CHIP(key)}<span class="lab">${label}</span>${badge}</div>`;
    }).join('');
    const scroll = parseFloat(d.scroll || '0');
    el.replaceWith(h(`<div class="st-side${d.dim !== undefined ? ' st-inert' : ''}">
      <span class="lgk-btn circle st-back"><i data-si="back" style="--is:28px"></i></span>
      <div class="st-side-title t-large">Settings</div>
      <div class="st-list${scroll ? '' : ' top'}"><div class="st-list-inner" style="top:${-scroll}px">${rows}</div></div>
    </div>`));
  }

  function buildToolbar(el) {
    const d = el.dataset;
    let out = '';
    if (d.lead) out += `<span class="lgk-btn capsule st-tb-lead">${d.lead}</span>`;
    else if (d.back !== undefined) out += `<span class="lgk-btn circle st-tb-back${d.backfocus !== undefined ? ' is-focus' : ''}"><i data-si="back" style="--is:28px"></i></span>`;
    if (d.title) out += `<div class="st-tb-title t-title2">${d.title}</div>`;
    if ((d.search || 'circle') === 'circle') out += '<span class="lgk-btn circle st-tb-find"><i data-i="search" style="--is:26px"></i></span>';
    el.replaceWith(h(`<div class="st-tb${d.dim !== undefined ? ' st-inert' : ''}">${out}</div>`));
  }

  const VRPAGES = [['general', 'General', 'gray', 'si:sliders'], ['playarea', 'Play Area', 'green', 'si:playarea'], ['dashboard', 'Dashboard', 'blue', 'si:panel'],
    ['controllers', 'Controllers', 'orange', 'i:controller'], ['video', 'Video', 'indigo', 'si:film'], ['camera', 'Camera', 'teal', 'si:camera'],
    ['startup', 'Startup / Shutdown', 'red', 'i:power'], ['developer', 'Developer', 'gray', 'si:hammer']];
  window.ST_VRCHIP = (key, cls = '') => { const p = VRPAGES.find((x) => x[0] === key); return `<span class="st-chip ${cls}" data-c="${p[2]}">${icon(p[3])}</span>`; };
  window.ST_VRPAGES = VRPAGES;
  function buildVrSide(el) {
    const d = el.dataset;
    const rows = VRPAGES.map(([key, label]) => {
      const cls = ['nav'];
      if (key === d.sel) cls.push('is-nav-selected');
      if (key === d.hover) cls.push('is-hover');
      return `<div class="${cls.join(' ')}"${key === d.hover ? ' style="--hx:62%; --hy:50%"' : ''}>${window.ST_VRCHIP(key)}<span class="lab">${label}</span></div>`;
    }).join('');
    el.replaceWith(h(`<div class="side">
      <span class="back"><i data-si="back"></i></span>
      <div class="side-title">SteamVR</div>
      <div class="list"><div class="list-inner" style="top:${-(parseFloat(d.scroll || '0'))}px">${rows}</div></div>
    </div>`));
  }

  document.querySelectorAll('[data-st="sidebar"]').forEach(buildSidebar);
  document.querySelectorAll('[data-st="toolbar"]').forEach(buildToolbar);
  document.querySelectorAll('[data-st="vrside"]').forEach(buildVrSide);
  // chips written inline by mockups: <span data-chip="system" data-cls="lg"></span>
  document.querySelectorAll('[data-chip]').forEach((e) => e.replaceWith(h(window.ST_CHIP(e.dataset.chip, e.dataset.cls || ''))));
  document.querySelectorAll('[data-vrchip]').forEach((e) => e.replaceWith(h(window.ST_VRCHIP(e.dataset.vrchip, e.dataset.cls || ''))));
})();
