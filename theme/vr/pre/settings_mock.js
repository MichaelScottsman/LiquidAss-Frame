/* vr:systemui, run right after settings_open.js with window.__LGS_SET_HOVER
   = 1 (its :hover clone must be in place). Display-only mocks for controls
   the open settings section may not have, built from SteamVR's own classes
   inside its own SettingsMain (so SteamVR's and the theme's rules apply):
   - two slider detents (--detent-value .2 on the white value fill and .85
     on the unfilled track) added to the first slider's Track;
   - a radio row (72 rest, 80 laser-hovered, 90 selected) above the page.
   Never touches a setting; removed after 6 s. */
(async () => {
  const added = [];
  const track = document.querySelector('.SettingsPageContainer .SliderControl:not(.Color):not(.Vertical) .Track');
  if (track) for (const v of [0.2, 0.85]) {
    const d = document.createElement('div'); d.className = 'Detent'; d.style.setProperty('--detent-value', v); track.appendChild(d); added.push(d);
  }
  const page = document.querySelector('.SettingsPageContainer .SettingsItem');
  if (page) {
    const row = document.createElement('div');
    row.className = 'SettingsItem RadioButtons';
    row.innerHTML = '<div class="Label">Refresh Rate (Hz) (mock)</div><div class="RadioButtonsSet">'
      + '<div class="RadioButton"><div class="Label">72</div></div>'
      + '<div class="RadioButton" data-lgs-hover><div class="Label">80</div></div>'
      + '<div class="RadioButton Selected Disabled"><div class="Label">90</div></div>'
      + '<div class="RadioButton"><div class="Label">120</div></div></div>';
    page.parentElement.insertBefore(row, page); added.push(row);
  }
  setTimeout(() => added.forEach((e) => e.remove()), 6000);
  await L.sleep(400);
  const rb = [...document.querySelectorAll('.SettingsItem.RadioButtons .RadioButton')].map((e) => getComputedStyle(e).backgroundColor + ' / ' + getComputedStyle(e).boxShadow.slice(0, 60));
  const dt = added.filter((e) => e.classList.contains('Detent')).map((e) => getComputedStyle(e).backgroundColor + ' ' + getComputedStyle(e).mixBlendMode + ' ' + Math.round(e.getBoundingClientRect().x));
  return 'mock radios: ' + JSON.stringify(rb) + '\ndetents: ' + JSON.stringify(dt);
})()
