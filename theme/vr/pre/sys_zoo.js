/* vr:systemui, idle (no Now Playing / settings panel open). STATIC MOCKS of
   the systemui panels that have no side-effect-free trigger, built from
   SteamVR's own classes (and, for the toast, its notificationtoast.css) in a
   host absolutely positioned at (560,620) inside <body>, outside vsg-app: no
   panel, no UV change, nothing the compositor shows. Removed after 5 s.
   Hover is emulated with [data-lgs-hover] clones of every :hover rule
   (nested theme rules included). Never wire these to real handlers.
   Two parts (the page is only 2048 px tall): default = systemui panels;
   prefix the expression with  window.__LGS_ZOO_PART = 2,  for the message
   overlay, notification toast and binding callouts. */
(async () => {
  const c = (t) => L.index.selector(t).sel.slice(1);
  const h = (tag, cls, kids, attrs) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    for (const k of [].concat(kids || [])) e.append(k);
    for (const [a, v] of Object.entries(attrs || {})) e.setAttribute(a, v);
    return e;
  };
  const svgNS = 'http://www.w3.org/2000/svg';
  const icon = () => {
    const s = document.createElementNS(svgNS, 'svg');
    s.setAttribute('viewBox', '0 0 36 36');
    s.setAttribute('class', 'Icon');
    const p = document.createElementNS(svgNS, 'circle');
    p.setAttribute('cx', '18'); p.setAttribute('cy', '18'); p.setAttribute('r', '9'); p.setAttribute('fill', 'currentColor');
    s.append(p);
    return s;
  };
  // hover clones (incl. nested html.lgs-on rules)
  const st = document.createElement('style');
  st.id = 'lgs-vr-zoo-style';
  const out = [];
  const walk = (rules, nest) => {
    for (const r of rules) {
      if (r.selectorText && r.cssRules && r.cssRules.length) walk(r.cssRules, (nest || []).concat(r.selectorText));
      if (r.selectorText && r.selectorText.includes(':hover')) {
        let t = r.selectorText.replace(/:hover/g, '[data-lgs-hover]') + '{' + r.style.cssText + '}';
        for (const p of (nest || []).slice().reverse()) t = p + '{' + t + '}';
        out.push(t);
      }
    }
  };
  for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch (e) { continue; } walk(rs, null); }
  // notificationtoast.css is not loaded in systemui: borrow it for the mock (minus body)
  try {
    const page = await (await fetch('/dashboard/notificationtoast.html')).text();
    const href = (page.match(/href="(css\/notificationtoast[^"]+)"/) || [])[1];
    if (href) out.unshift((await (await fetch('/dashboard/' + href)).text()).replace(/body\{[^}]*\}/, '').replace(/\/\*#[^*]*\*\//, ''));
  } catch (e) { /* mock without base css */ }
  st.textContent = out.join('\n');
  document.head.appendChild(st);

  const host = h('div', '', [], { id: 'lgs-vr-zoo', style: 'position:absolute; left:560px; top:620px; width:1290px; display:flex; flex-wrap:wrap; gap:28px; align-items:flex-start; font-size:24px; color:#DEE2E5;' });
  const panel = (kids, style) => h('div', '', kids, { 'vsg-type': 'panel', style: 'position:relative; display:inline-block; ' + (style || '') });
  // More Options popout: row 2 gamepad-focused, row 3 hovered
  const ao = h('div', c('AdditionalOptions'));
  ['Toggle Curvature', 'Dock on Left Controller', 'Dock on Right Controller'].forEach((label, i) => {
    const row = h('div', 'ButtonControl WithIcon LargeIcon ' + c('AdditionalOptionsRow') + (i === 1 ? ' ' + c('GamepadFocused') : ''), [icon(), h('span', c('AdditionalOptionsLabel'), label)]);
    if (i === 2) row.setAttribute('data-lgs-hover', '');
    ao.append(row);
  });
  host.append(panel([ao]));
  // gamepad-mode pills: laser-only (disabled), enter, enter + hover
  const pill = (txt, dis, hov) => {
    const a = h('div', c('ButtonHitArea') + (dis ? ' ' + c('ButtonPill>Disabled') : ''), [h('div', c('ButtonPill'), [txt, h('div', c('GlyphContainer'), [icon()])])]);
    if (hov) a.setAttribute('data-lgs-hover', '');
    return h('div', c('ButtonPill>Container'), [a]);
  };
  host.append(panel([h('div', '', [pill('Use Laser Mouse to Interact', true), pill('Enter Gamepad Mode', false), pill('Enter Gamepad Mode', false, true)])]));
  // tooltip
  host.append(panel([h('div', 'ControlBarButtonTooltip', 'Float in World')]));
  // transition
  host.append(panel([h('div', '', [h('div', 'TransitionAppImage', 'Liquid Glass Frame', { style: 'background-image:none' }),
    h('div', 'TransitionAppLabels', [h('div', 'AppStatus', 'Next Up'), 'Liquid Glass Frame'])])]));
  // IPD
  host.append(panel([h('div', 'IPDParent', [h('div', 'IPDSettingTextDesc', 'IPD'), h('div', 'IPDNumberRow', [h('div', 'IPDNumberText', '63.5'), h('div', 'IPDLabelText', 'mm')])], { style: 'width:300px;text-align:center' })]));
  // framerate + gamepad unsupported
  host.append(panel([h('div', c('FramerateRoot'), [icon(), '90 Hz'])]));
  host.append(panel([h('div', c('GamepadUnsupportedRoot'), [icon(), 'Gamepad not supported here'])]));
  // progress ring
  const ring = document.createElementNS(svgNS, 'svg');
  ring.setAttribute('class', 'CircularProgressbar');
  ring.setAttribute('viewBox', '0 0 100 100');
  ring.innerHTML = '<circle class="CircularProgressbar-background" cx="50" cy="50" r="50"></circle>'
    + '<path class="CircularProgressbar-trail" d="M 50,50 m 0,-46 a 46,46 0 1 1 0,92 a 46,46 0 1 1 0,-92" stroke-width="8" fill-opacity="0"></path>'
    + '<path class="CircularProgressbar-path" d="M 50,50 m 0,-46 a 46,46 0 1 1 0,92 a 46,46 0 1 1 0,-92" stroke-width="8" fill-opacity="0" style="stroke-dasharray: 289px, 289px; stroke-dashoffset: 110px;"></path>';
  host.append(panel([h('div', 'ProgressContainer', [ring])]));
  // room setup prompt ("Later" hovered)
  host.append(panel([h('div', c('RoomSetupContainer'), [h('div', c('RoomSetupContainer>Title'), 'Set up your play area'),
    h('div', c('RoomSetupContainer>Body'), 'Look around to scan the floor.'),
    h('div', c('RoomSetupContainer>ButtonRow'), [h('div', c('RoomSetupContainer>ButtonControl'), 'Later', { 'data-lgs-hover': '' }),
      h('div', c('RoomSetupContainer>ButtonControl') + ' ' + c('RoomSetupContainer>Colorful'), 'Start')])], { style: 'width:420px' })]));
  // Steam loading
  host.append(panel([h('div', c('LoadingRoot'), [h('div', c('LoadingThrobberContainer>Title'), 'Steam is starting'),
    h('div', c('LoadingThrobberContainer>Body'), 'This can take a minute.'),
    h('div', c('LoadingThrobberContainer>ButtonRow'), [h('div', c('LoadingThrobberContainer>ButtonControl'), 'Retry')])])]));
  // persistent notification
  host.append(panel([h('div', c('PersistentNotificationsContainer'), [h('div', c('TrackingDataRecordingNotification'), [icon()])])]));
  // guided tour card
  host.append(panel([h('div', c('TourTooltipContainer'), [h('div', c('TopPanelContainer'), [h('div', c('CenteredContent'),
    [h('div', c('LearningTopicParagraph'), 'Grab the bar to move the window'), h('div', c('BodyText'), 'Point and hold the trigger.')])])])]));
  // message overlay (first button primary, second hovered)
  host.append(panel([h('div', 'MessageOverlayContainer', [h('div', 'MessageOverlayPanel', [
    h('div', 'MessageOverlayTextPanel', [h('h1', '', 'Restart required'), h('p', '', 'The app needs to restart to apply this change.')]),
    h('div', 'MessageOverlayButtonContainer', [h('div', 'ButtonControl', [h('span', '', 'Restart')]),
      h('div', 'ButtonControl', [h('span', '', 'Later')], { 'data-lgs-hover': '' }), h('div', 'ButtonControl', [h('span', '', 'Cancel')])])])])], { style: 'width:560px' }));
  // notification toast (notificationtoast.html's DOM)
  host.append(panel([h('div', 'VRNotificationRoot', [h('div', 'VRNotificationApplicationName', 'SteamVR'),
    h('div', 'VRNotificationFrame', [h('div', 'VRToastImage', '', { style: 'background-image:url(images/notification_steamcog.png)' }),
      h('div', 'VRNotificationTextWrapper', [h('div', 'VRNotificationHeader', 'Controller connected'), h('div', 'VRNotificationText', 'Right controller battery at 24%.')])])])], { style: 'width:560px;height:190px' }));
  // binding callouts (Main selected, Menu hovered, one input pressed)
  host.append(panel([h('div', 'BindingCalloutActionPanel', [h('div', 'BindingCalloutTitle', 'Liquid Glass Frame'), h('div', 'BindingCalloutConfigName', 'Default bindings'),
    h('div', 'BindingCalloutActionList', [h('div', 'ButtonControl ActionSetSelected', 'Main'), h('div', 'ButtonControl', 'Menu', { 'data-lgs-hover': '' }), h('div', 'ButtonControl CloseButton', 'Close')])]),
    h('div', 'BindingCallout', [h('div', 'BindingCalloutContents', [h('div', 'BindingCalloutLabelContainer', [h('div', 'Label', 'Select')])])], { style: 'margin-top:16px' }),
    h('div', 'BindingCallout CalloutInputActive', [h('div', 'BindingCalloutContents', [h('div', 'BindingCalloutLabelContainer', [h('div', 'Label', 'Grab (pressed)')])])], { style: 'margin-top:12px' })]));
  // part 1 = systemui panels, part 2 = the overlay pages (set window.__LGS_ZOO_PART = 2 first)
  const kids = [...host.children];
  const part = window.__LGS_ZOO_PART || 1;
  delete window.__LGS_ZOO_PART;
  kids.forEach((k, i) => { if ((part === 1) !== (i < 12)) k.remove(); });
  document.body.appendChild(host);
  setTimeout(() => { host.remove(); st.remove(); }, 5000);
  await L.sleep(400);
  const r = host.getBoundingClientRect();
  return { host: [r.x, r.y, r.width, r.height], items: host.children.length };
})()
