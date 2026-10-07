/* Builds the Steam VR keyboard (58 keys, Steam's own layout and hit-area widths from inventory/hud.md §5.3)
 * with the visionOS skin of docs/phase2/concepts/controls.md §7. Runs before kit.js so kit.js renders the icons.
 * <div class="kb-keys" data-state='{"hover":"s","pressed":"","shift":false,"enter":"Search","badges":true}'></div> */
(() => {
  const H = 3.3, BS = 11.7, TAB = 7, CAPS = 9.4, ENT = 11.7, SH = 14, META = 8.2;
  const L0 = (100 - H - BS) / 12, L1 = (100 - TAB) / 13, L2 = (100 - CAPS - ENT) / 11, L3 = (100 - 2 * SH) / 10;
  const ROWS = [
    [['`', H, '~'], ...'1234567890-='.split('').map((c, i) => [c, L0, '!@#$%^&*()_+'[i]]), ['⌫', BS, null, 'mod del']],
    [['Tab', TAB, null, 'mod'], ...'qwertyuiop[]\\'.split('').map((c, i) => [c, L1, i > 9 ? '{}|'[i - 10] : null])],
    [['Caps', CAPS, null, 'mod caps'], ...'asdfghjkl;\''.split('').map((c, i) => [c, L2, i > 8 ? ':"'[i - 9] : null]), ['⏎', ENT, null, 'enter']],
    [['⇧', SH, null, 'mod shift'], ...'zxcvbnm,./'.split('').map((c, i) => [c, L3, i > 6 ? '<>?'[i - 7] : null]), ['⇧', SH, null, 'mod shift r']],
    [['☺', META, null, 'mod emoji'], [' ', 100 - 4 * META, null, 'space'], ['←', META, null, 'mod left'], ['→', META, null, 'mod right'], ['▾', META, null, 'mod close']],
  ];
  const ICON = { '⌫': 'deleteleft', '⇧': 'shift', '☺': 'emoji', '←': 'caretleft', '→': 'caretright', '▾': 'kbdown' };
  document.querySelectorAll('.kb-keys[data-state]').forEach(host => {
    const st = JSON.parse(host.dataset.state);
    const up = !!st.shift;
    host.innerHTML = ROWS.map((row, r) => '<div class="kb-row">' + row.map(([label, w, shifted, cls]) => {
      const key = label === ' ' ? 'space' : label;
      let inner;
      if (cls && cls.includes('enter')) inner = `<span>${st.enter || 'Enter'}</span>`;
      else if (ICON[label]) inner = `<i data-i="${label === '⇧' && up ? 'shiftfill' : ICON[label]}"></i>`;
      else if (cls && cls.includes('mod')) inner = `<span>${label}</span>`;
      else if (label === ' ') inner = '';
      else inner = (shifted ? `<span class="sh">${shifted}</span>` : '') + `<span>${up && /[a-z]/.test(label) ? label.toUpperCase() : label}</span>`;
      const states = [];
      if (st.hover === key) states.push('is-hover');
      if (st.focus === key) states.push('is-focus');
      if (st.pressed === key) states.push('is-pressed');
      if (label === '⇧' && up && !(cls || '').includes(' r')) states.push('on');
      let badge = '';
      if (st.badges) {
        const b = { '⌫': 'X', ' ': 'Y', '⏎': 'RT', '⇧': (cls || '').includes(' r') ? '' : 'LT' }[label];
        if (b) badge = `<span class="glyphbadge${label === '⏎' ? ' inline' : ''}"${b.length > 1 ? ' style="width:28px; border-radius:11px; font-size:12.5px"' : ''}>${b}</span>`;
      }
      const style = `flex:${w} 1 0;` + (st.hover === key ? `--hx:${st.hx || '50%'}; --hy:${st.hy || '45%'};` : '');
      return `<span class="c-key ${cls || ''} ${shifted && !(cls || '').includes('mod') ? 'num' : ''} ${states.join(' ')}" data-key="${key}" style="${style}">${inner}${badge}</span>`;
    }).join('') + '</div>').join('');
  });
})();
