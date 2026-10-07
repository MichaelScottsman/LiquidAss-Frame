/* vr:systemui, Now Playing states (C5b). With Now Playing open (a scene app
   runs, docs/inventory/steamvr-pre/np_open.js) it marks the real panel;
   with no scene app (the usual case: agents never launch anything) it
   builds a display-only MOCK of the panel from SteamVR's own global classes
   and localized strings, absolutely placed at (0, 700) of the atlas, where
   no idle panel's UV rect lies (docs/inventory/steamvr.md §2.2), so the
   headset never shows it. Its buttons carry role=button only so G-SIZE
   judges them (SteamVR's own buttons have no role). Then it puts SteamVR's own .gpfocus on one action
   and an emulated laser hover on another (every :hover rule cloned to
   [data-lgs-hover]). Everything is removed after `keep` ms (default 6000).
   Options, set in the same expression:
     window.__LGS_NP = { focus: 1, hover: 3, mock: 'normal'|'arcade'|'noquit'|'perf'|'off', keep: 6000, waitKeys: false }
   focus / hover index the action buttons (0 Resume, 1 VR Controller
   Bindings, 2 VR Video Settings, 3 Exit Game in 'normal'; -1 = none).
   mock 'off' never builds one. Never clicks anything. */
(async () => {
  const opt = Object.assign({ focus: 1, hover: 3, mock: 'normal', keep: 6000 }, window.__LGS_NP || {});
  // the options stay set: gates run the pre twice (theme off, then on)
  const added = [];
  for (const old of document.querySelectorAll('#c5b-np-mock')) old.remove();
  const loc = (t, en) => { try { const v = window.LocalizationManager.LocalizeString(t); return v && v !== t ? v : en; } catch (e) { return en; } };
  let real = document.querySelector('.NowPlaying .InfoColumn .GamepadUIButton');
  if (!real && opt.mock !== 'off') {
    // SteamVR's hashed module classes for the button (so its own base rules apply too)
    const hashed = new Set();
    for (const sh of document.styleSheets) {
      let rs; try { rs = sh.cssRules; } catch (e) { continue; }
      for (const r of rs) {
        const m = r.selectorText && r.selectorText.match(/\.(gamepaduibutton_GamepadUIButton_\w+|gamepaduibutton_FocusRing_\w+|[a-z]+_FocusRing_\w+)/);
        if (m) hashed.add(m[1]);
        if (hashed.size >= 2) break;
      }
      if (hashed.size >= 2) break;
    }
    const cls = 'GamepadUIButton ' + [...hashed].join(' ');
    const v = opt.mock;
    const rows = [['ResumeButton', loc('#Return_To_Game', 'Resume Game'), false]];
    if (v !== 'arcade') {
      rows.push(['', loc('#VR_Controller_Bindings', 'VR Controller Bindings'), true]);
      rows.push(['', loc('#VR_App_Video_Settings', 'VR Video Settings'), true]);
    }
    if (v === 'perf') rows.push(['', loc('#Clear_PerfCriteria_Status', 'Clear Performance Assessment Status'), true]);
    if (v !== 'noquit') rows.push(['', loc('#Exit_Game', 'Exit Game'), false]);
    const root = document.createElement('div');
    root.id = 'c5b-np-mock';   // not 'lgs-*': the gates skip our own nodes, and the mock must be judged
    root.className = 'DashboardMain';
    root.style.cssText = 'position:absolute;left:0;top:700px;width:1858px;height:1045px;z-index:1;';
    root.innerHTML = '<div class="ScrollPanel DashboardPanel NowPlaying" style="width:1858px;height:1045px;box-sizing:border-box;">'
      + '<div class="ArtworkColumn"><div class="PortraitAppImageContainer Fallback"><div class="IconBackgroundBlur"></div><div class="Icon"></div><div class="Title">Liquid Glass Frame</div></div></div>'
      + '<div class="InfoColumn"><div class="NowPlayingAppTitle">Liquid Glass Frame</div>'
      + rows.map(([c, t, span]) => '<div role="button" class="' + cls + (c ? ' ' + c : '') + '">' + (span ? '<span>' + t + '</span>' : t) + '</div>').join('')
      + (v === 'normal' ? '<div class="SettingsModal" style="display:none"></div><div class="SettingsModal" style="display:none"></div>' : '')
      + '</div></div>';
    document.body.appendChild(root);
    added.push(root);
    // waitKeys: give the T2 keyer (flag wp.c5b, injected by the daemon a moment
    // after the step's flags land) up to 4 s to key the mock
    if (opt.waitKeys) for (let i = 0; i < 16 && !root.querySelector('[data-lgs-np]'); i++) await new Promise((r) => setTimeout(r, 250));
    // the T2 keyer, if installed, keys the mock like the real panel
    try { const x = window.__LGS_VRX && window.__LGS_VRX.nowplaying; if (x && x.api && x.api.apply) x.api.apply(); } catch (e) {}
  }
  const st = document.createElement('style'); st.id = 'lgs-vr-np-hover';
  const out = [];
  const walk = (rules, nest) => {
    for (const r of rules) {
      if (r.selectorText && r.cssRules && r.cssRules.length) walk(r.cssRules, (nest || []).concat(r.selectorText));
      if (r.selectorText && r.selectorText.includes(':hover') && r.style && r.style.length) {
        let t = r.selectorText.replace(/:hover/g, '[data-lgs-hover]') + '{' + r.style.cssText + '}';
        for (const p of (nest || []).slice().reverse()) t = p + '{' + t + '}';
        out.push(t);
      }
    }
  };
  for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch (e) { continue; } walk(rs, null); }
  st.textContent = out.join('\n'); document.head.appendChild(st);
  const btns = [...document.querySelectorAll('.NowPlaying .InfoColumn > .GamepadUIButton')];
  if (!btns.length) { st.remove(); return 'Now Playing is not open (mock off)'; }
  const before = btns.map((b) => b.className);
  btns.forEach((b) => b.classList.remove('gpfocus'));
  if (btns[opt.focus]) btns[opt.focus].classList.add('gpfocus');
  if (btns[opt.hover]) btns[opt.hover].setAttribute('data-lgs-hover', '');
  setTimeout(() => {
    st.remove();
    btns.forEach((b, i) => { if (b.isConnected) { b.className = before[i]; b.removeAttribute('data-lgs-hover'); } });
    added.forEach((e) => e.remove());
    delete window.__LGS_NP;
  }, opt.keep);
  await new Promise((r) => setTimeout(r, 450));
  return {
    mock: added.length ? opt.mock : null, focus: opt.focus, hover: opt.hover,
    buttons: btns.map((b) => { const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); return [b.textContent, b.getAttribute('data-lgs-np'), Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height), cs.color]; }),
  };
})()
