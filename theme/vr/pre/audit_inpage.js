/* In-page audit for SteamVR pages, immune to the lgs-vr watcher stripping
   the theme mid-step: snapshots with html.lgs-on removed (every theme rule
   and token is scoped under it, so this is stock), puts it back, snapshots
   again and diffs with the lab's own L.snap/L.diff. Run it as the --pre of
   a "shot --theme on" (that applies the theme first), e.g.
     --pre "(async()=>{ await <state pre>; return await <this> })()"
   Reports themeApplied (the theme style was present at the themed snap). */
(async () => {
  const S = 'vr:' + (document.title || 'page');
  const html = document.documentElement;
  if (!document.getElementById('lgs-theme')) return 'theme not applied';
  html.classList.remove('lgs-on');
  await L.sleep(500);
  const a = L.snap(S);
  html.classList.add('lgs-on');
  await L.sleep(900);
  const themeApplied = !!document.getElementById('lgs-theme') && html.classList.contains('lgs-on');
  const b = L.snap(S);
  const d = L.diff(a, b);
  return 'AUDIT ' + S + ': ' + d.controls + ' controls, ' + d.texts + ' text runs, ' + d.issues.length + ' issues, ' + d.movedCount + ' moved >24px, themeApplied=' + themeApplied + (d.issues.length ? '\n  ' + d.issues.join('\n  ') : '');
})()
