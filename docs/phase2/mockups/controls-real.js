/* Real-page cases for the control vocabulary (docs/phase2/concepts/controls.md §19, critique revision 2).
 * The chrome comes from the sibling concepts (settings-shared.js: sidebar and toolbar; window-nav-shared.js: tab bar,
 * frame controls, bar, pill, laser); everything inside the content column is this concept's vocabulary (controls.css).
 * Runs synchronously before settings-shared.js, window-nav-shared.js and kit.js.
 *
 *   <div data-cr="system" data-focus="switch|popup|disabled|open"></div>   Settings > System, scrolled to System Settings
 *   <div data-cr="notifications" data-focus="mobile"></div>                 Settings > Notifications, the check matrix
 *   <div data-cr="tzmenu"></div>                                             a long value menu (64 options): one scrolling column, right-aligned over its source
 */
(() => {
  'use strict';
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content; };
  const sw = (on, cls = '') => `<span class="c-switch${on ? ' on' : ''} ${cls}"><span class="knob"></span></span>`;
  const row = (label, trail, o = {}) => {
    const cls = ['c-row'];
    if (o.sub) cls.push('tall');
    if (o.cls) cls.push(o.cls);
    const lab = o.sub ? `<span class="two"><span>${label}</span><span class="sub">${o.sub}</span></span>` : `<span class="lab">${label}</span>`;
    return `<div class="${cls.join(' ')}"${o.style ? ` style="${o.style}"` : ''}${o.id ? ` data-id="${o.id}"` : ''}><span class="pill"></span>${lab}<span class="trail">${trail}</span></div>`;
  };

  function system(el) {
    const f = el.dataset.focus || 'switch';
    const tzOpen = f === 'open';
    const tz = `<span class="c-popup rich${f === 'popup' ? ' is-lifted' : ''}${tzOpen ? ' is-open' : ''}" id="tzsrc" style="min-width:330px">
        <span class="val"><span style="display:block">Eastern Standard Time</span><span class="t2">UTC −04:00 · New York</span></span><i data-i="updown"></i></span>`;
    const crash = ['Enable Application Crash Report Collection', 'Enable Kernel Crash Report Collection', 'Enable GPU Crash Report Collection',
      'Enable SteamOS Service Log Collection', 'Enable System Info Collection', 'Enable Driver Crash Report Collection'];
    el.replaceWith(h(`<div class="cr-col" style="top:${f === 'disabled' ? -330 : 0}px">
      <div class="cr-sh" style="margin-top:120px">System Settings</div>
      <div class="cr-plat">
        ${row('24-Hour Clock', sw(false), { sub: 'Show the time in 24-hour format' })}
        ${row('Timezone', tz, { cls: (f === 'popup' ? 'is-within ' : '') + 'cr-r96', id: f === 'popup' ? 'row-focus' : 'row-tz' })}
        ${row('Default to Desktop Mode on Startup', sw(false, f === 'switch' ? 'is-lifted' : ''), { cls: f === 'switch' ? 'is-within' : '', id: f === 'switch' ? 'row-focus' : 'row-desktop' })}
        ${row('Enable Developer Mode', sw(true), { id: 'row-rest' })}
      </div>
      <div class="cr-sh">SteamOS Crash Report</div>
      <div class="cr-plat">
        ${row('Enable SteamOS Crash Reports', sw(false), { sub: 'Help improve SteamOS by sharing crash reports.' })}
        ${crash.map((c, i) => row(c, sw(false, 'is-disabled dis-soft'), { cls: 'is-disabled' + (f === 'disabled' && i === 2 ? ' is-focus' : ''),
          id: f === 'disabled' && i === 2 ? 'row-focus' : (f === 'disabled' && i === 3 ? 'row-rest' : '') })).join('')}
      </div>
    </div>`));
  }

  /* Timezone: 64 rich options. On settings routes Steam's menu becomes the settings list page (PLAN §1.12); this slab is the form a
   * list of 15 or more takes on other routes and the list page's fallback: one scrolling column of two-line rows (controls.md §8.2) */
  const TZ = [
    ['Mountain Standard Time', 'UTC −06:00 · Alberta, Denver, Salt Lake City'], ['Mountain Standard Time (Mexico)', 'UTC −06:00 · Baja California Sur, Chihuahua'],
    ['Central America', 'UTC −06:00 · Guatemala, Managua, San José'], ['Central Standard Time', 'UTC −06:00 · Saskatchewan'],
    ['Central Standard Time', 'UTC −05:00 · Chicago, Dallas, Mexico City'], ['South America Pacific', 'UTC −05:00 · Bogotá, Lima'],
    ['Eastern Standard Time', 'UTC −04:00 · Miami, Montreal, New York'], ['Eastern Standard Time (Indiana)', 'UTC −04:00 · Indiana'],
    ['Venezuela', 'UTC −04:00 · Caracas'],
  ];
  function tzmenu(el) {
    const cur = 6;               // Steam opens the menu with focus on the current value, scrolled into view
    // the current value's check sits in the leading 28 px slot every row reserves (C1c's menu rule; PLAN §1.12)
    const rows = TZ.map(([t, s], i) => `<div class="vr${i === cur ? ' is-focus' : ''}"${i === cur ? ' data-id="row-current"' : ''}><span class="lead">${i === cur ? '<i data-i="check"></i>' : ''}</span><span class="two"><span class="t">${t}</span><span class="s">${s}</span></span></div>`).join('');
    // index of the first visible row = 20 of 64 (Steam's list from UTC -12): rail position and length from the real count
    const visible = 3.75, total = 64, top = 20;
    el.replaceWith(h(`<div class="lgk-glass c-vmenu cr-tzmenu" id="tzmenu" data-id="menu" data-mat="thick" data-lens style="--dz:10" data-dz="10" data-tier="T1 in-page thick glass; T5 +10 mm non-interactive crop + thick slab (0 -> +10 on depth)">
      <div class="hdr">Timezone</div>
      <div class="scr"><div class="in" style="top:${200 - cur * 106}px">${rows}</div>
        <span class="rail" style="top:${(top / total) * 100}%; height:${(visible / total) * 100}%; opacity:0" title="shown only while the list scrolls (VP P-72)"></span></div>
      <span class="cancel">Cancel</span>
    </div>`));
  }

  /* Notifications: the check matrix (Email / Toast / Mobile / Feed), sticky column header, long two- and three-line labels */
  const NCOLS = ['Email', 'Toast', 'Mobile', 'Feed'];
  function nhead(el) {
    el.replaceWith(h(`<div class="cr-sticky"><span class="via">Notify Me Via</span>${NCOLS.map((c) => `<span class="cr-colh">${c}</span>`).join('')}</div>`));
  }
  function notifications(el) {
    const f = el.dataset.focus || 'mobile';
    // cells: 1 on, 0 off, d on + disabled, '' no checkbox in that column
    const S = [
      ['Wishlist Activity', [
        ['An item on my wishlist is on sale', ['1', '0', '1', 'd']],
        ['An item on my wishlist has released (including full release or Early Access), or has transitioned from Early Access to full release', ['1', '', '', '']],
        ['A demo for an item on my wishlist has been released', ['', '0', '1', 'd']],
      ]],
      ['Steam Community', [
        ['I receive a friend invite', ['0', '1', '1', 'd']],
        ['I receive a comment on my profile or content', ['0', '0', '1', 'd']],
        ['I receive a gift', ['1', '1', '1', 'd']],
      ]],
    ];
    const cell = (c, ci, foc) => {
      if (!c) return '<span class="cr-cell"></span>';
      const on = c === '1' || c === 'd', dis = c === 'd';
      const isF = foc && NCOLS[ci].toLowerCase() === f;
      const id = isF ? ' data-id="check-focus"' : (foc && ci === 0 && on ? ' data-id="check-on"' : '');
      return `<span class="cr-cell"><span class="c-check${on ? ' on' : ''}${dis ? ' is-disabled' : ''}${isF ? ' is-focus' : ''}"${id}>${on ? '<i data-i="check"></i>' : ''}</span></span>`;
    };
    el.replaceWith(h(`<div class="cr-col" style="top:${el.dataset.top || 150}px">${S.map(([sec, R], si) => `
      <div class="cr-sh"${si === 0 ? ' style="margin-top:0"' : ''}>${sec}</div>
      <div class="cr-plat">
        ${R.map(([lab, cells], ri) => { const foc = si === 0 && ri === 0; return `<div class="c-row cr-mrow${foc ? ' is-within-multi' : ''}"><span class="pill"></span><span class="lab">${lab}</span><span class="cr-cells">${cells.map((c, ci) => cell(c, ci, foc)).join('')}</span></div>`; }).join('')}
      </div>`).join('')}
    </div>`));
  }

  const B = { system, tzmenu, notifications, nhead };
  document.querySelectorAll('[data-cr]').forEach((el) => { const f = B[el.dataset.cr]; if (f) f(el); });
})();
