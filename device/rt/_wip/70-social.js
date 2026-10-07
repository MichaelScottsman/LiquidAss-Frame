// Glass Shell runtime module "social" (package C7): People, Photos, Downloads, Store T2.
// Concept: docs/phase2/concepts/social-media.md (SM) §3.1, §3.5, §3.6, §3.9; PLAN §1.2, §1.11, §2.4 C7.
// Contracts: runtime.md (P1: define, rt.*), reporter.md §2.2 (plates), C1a's More helper (more.register).
// Behind flag wp.c7 (PLAN §2.1). The More helper is optional (rt.has('more'): it needs wp.c1a).
// The DOM hooks are the contract with theme/70-social.css (its header lists them).
//
// What it does while installed:
//   - /chat: marks the friend row of the open conversation `data-lgs-current` (SM §3.1: the one
//     navigation-selected row; CSS draws the white .18 pill + arc + Semibold name). The open
//     conversation is read from the chat header's own friend name; nothing is called on Steam;
//   - /invites on a `windowless` route (C1a's route map): the page becomes one `panel` plate
//     (data-lgs-plate on %{HiddenFrame>InvitesList}, id c7-invites, radius 44: PLAN §1.6, reporter §2.2),
//     so native mode draws the card as real glass; CSS-only draws the plate tint (70-social.css §2);
//   - registers More hosts with C1a's helper (PLAN §1.11, SM-D15): friend rows and download rows
//     ('row'); the helper dispatches each host's own onMenuButton. Media tiles are not registered: the
//     circle's 80 px hit reached into the tile's own P-08 band (gates 2026-10-07); their menu stays on
//     Steam's ≡ legend and, under the laser, on C1a's Options member (frozen target).
// It never calls a Steam setter, never sends, buys, pauses or removes anything, never moves a React
// node and adds no nodes of its own. Every attribute it sets is removed on remove().

/* eslint-disable no-var */
__LGS_RT.define({
  name: 'social',
  deps: [],
  flag: 'wp.c7',
  install(rt) { return smInstall(rt); },
  remove() { return smRemove(); },
});

var SM = null;
var SM_TICK_MS = 300;

function smInstall(rt) {
  var S = SM = { rt: rt, regs: [], marks: new Map(), sel: null };
  S.sel = {
    chats: rt.sel('%{FriendsChats}'),
    friend: '.friendlistListContainer .friend',
    name: rt.sel('%{playerName}'),
    chatTab: rt.sel('%{ChatTab}'),
    invites: rt.sel('%{HiddenFrame>InvitesList}'),
    root: rt.sel('%{BasicUiRoot}'),
  };
  if (rt.has('more')) {
    var more = rt.use('more');
    S.regs.push(more.register('%{FriendsChats} .friendlistListContainer .friend', { placement: 'row' }));
    S.regs.push(more.register('%{DownloadsPage} %{SectionItemWrapper}', { placement: 'row' }));
  }
  rt.setInterval(function () { smTick(S); }, SM_TICK_MS);
  smTick(S);
  return {
    status: function () { return smStatus(S); },
  };
}

function smRemove() {
  var S = SM;
  SM = null;
  if (!S) return { patchedLeft: 0 };
  for (var i = 0; i < S.regs.length; i++) { try { S.regs[i].remove(); } catch (_) { /* gone */ } }
  S.regs.length = 0;
  smClear(S, null);
  return { patchedLeft: 0 };
}

// ------------------------------------------------------------------ attributes we own
function smMark(S, el, name, value) {
  if (!el) return;
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
  var set = S.marks.get(el);
  if (!set) { set = new Set(); S.marks.set(el, set); }
  set.add(name);
}

// clear every mark except those listed in `keep` (Map el -> Set(names)), or all of them
function smClear(S, keep) {
  S.marks.forEach(function (names, el) {
    names.forEach(function (name) {
      if (keep && keep.has(el) && keep.get(el).has(name)) return;
      try { el.removeAttribute(name); } catch (_) { /* gone */ }
      names.delete(name);
    });
    if (!names.size || !el.isConnected) S.marks.delete(el);
  });
}

function smText(el) {
  return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
}

// ------------------------------------------------------------------ the tick
function smTick(S) {
  if (SM !== S) return;
  var main = S.rt.windows.main();
  if (!main || !main.doc) return;
  var doc = main.doc;
  var want = new Map();
  function keep(el, name, value) {
    smMark(S, el, name, value);
    var s = want.get(el);
    if (!s) { s = new Set(); want.set(el, s); }
    s.add(name);
  }

  // /chat: the open conversation's row
  var chats = doc.querySelector(S.sel.chats);
  if (chats) {
    var tab = chats.querySelector(S.sel.chatTab);
    var who = tab ? smText(tab.querySelector(S.sel.name)) : '';
    if (who) {
      var rows = chats.querySelectorAll(S.sel.friend);
      var hit = null;
      var n = 0;
      for (var i = 0; i < rows.length && i < 400; i++) {
        if (smText(rows[i].querySelector(S.sel.name)) === who) { hit = rows[i]; n++; }
      }
      if (hit && n === 1) keep(hit, 'data-lgs-current', '');
    }
  }

  // /invites: one panel plate while the route is windowless
  var inv = doc.querySelector(S.sel.invites);
  if (inv) {
    var root = doc.querySelector(S.sel.root);
    if (root && root.getAttribute('data-lgs-glass') === 'windowless') {
      keep(inv, 'data-lgs-plate', 'panel');
      keep(inv, 'data-lgs-plate-id', 'c7-invites');
      keep(inv, 'data-lgs-plate-r', '44');
    }
  }
  smClear(S, want);
}

function smStatus(S) {
  var main = S.rt.windows.main();
  var doc = main && main.doc;
  var cur = doc ? doc.querySelector('[data-lgs-current]') : null;
  var inv = doc ? doc.querySelector(S.sel.invites) : null;
  return {
    more: S.regs.length,
    current: !!cur,
    invitesPlate: inv ? inv.getAttribute('data-lgs-plate') : null,
    marks: S.marks.size,
  };
}
