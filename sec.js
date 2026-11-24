// Afrishine Security Solutions - server (Vercel). One endpoint, many actions: POST /api/sec { action, ... }
// Needs the same env var as the other server files: FIREBASE_SERVICE_ACCOUNT. Optional: CRON_SECRET (for the daily Vercel Cron call).
// Every balance / PV change is written in ONE atomic batch together with an append-only ledger entry whose id is fixed
// (e.g. pv_<order>_<member>), so confirming an order or running the daily matching twice can never pay twice.
const fb = require('./_firebase');
const plan = require('./_secplan');
const W = fb.W;
const MEDIA = 'https://afrishine-media.usherluckyelie.workers.dev/';

function Fail(msg, status) { const e = new Error(msg); e.status = status || 400; e.user = true; return e; }
const hits = {};
function limit(uid) { const now = Date.now(), a = (hits[uid] || []).filter((t) => now - t < 60000); a.push(now); hits[uid] = a; if (a.length > 40) throw Fail('Too many requests. Please wait a minute and try again.', 429); }
const rid = () => require('crypto').randomBytes(6).toString('hex');
const clean = (s, n) => String(s == null ? '' : s).replace(/[<>]/g, '').trim().slice(0, n);
const isUser = (u) => /^[a-z0-9_]{3,20}$/.test(u);
const legKey = (leg) => (leg === 'L' ? 'leftUid' : 'rightUid');
const day = () => new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);   // Kigali date

async function config() { return plan.mergeConfig(await fb.getDoc('secConfig/main')); }
async function isAdmin(uid) { return (await fb.getDoc('admins/' + uid)) !== null; }
async function needAdmin(uid) { if (!(await isAdmin(uid))) throw Fail('Administrators only.', 403); }
async function memberByUsername(u) {
  const x = await fb.getDoc('secUsernames/' + u);
  if (!x || !x.uid || String(x.uid).indexOf('invite:') === 0) return null;
  const m = await fb.getDoc('secMembers/' + x.uid);
  return m ? Object.assign({ uid: x.uid }, m) : null;
}
function slotFree(parent, leg) { return !parent[legKey(leg)]; }
function inDownline(sponsor, parent) { return parent.uid === sponsor.uid || (parent.ancestors || []).indexOf(sponsor.uid) >= 0; }

// ---------- reading the tree for the "choose Left / Right" picker ----------
async function subtree(rootUid, depth) {
  const nodes = []; let level = [rootUid];
  for (let d = 0; d < depth && level.length; d++) {
    const docs = await fb.batchGet(level.map((u) => 'secMembers/' + u));
    const next = [];
    level.forEach((u) => {
      const m = docs['secMembers/' + u]; if (!m) return;
      nodes.push({ uid: u, username: m.username, name: m.name, photo: m.photo || '', leg: m.leg || '', parentUid: m.parentUid || '', leftUid: m.leftUid || '', rightUid: m.rightUid || '', leftPv: m.leftPv || 0, rightPv: m.rightPv || 0, status: m.status });
      [m.leftUid, m.rightUid].forEach((c) => { if (c && String(c).indexOf('invite:') !== 0) next.push(c); });
    });
    level = next;
  }
  return nodes;
}

// ---------- order (+ first-time registration) ----------
async function createOrder(user, b) {
  const cfg = await config();
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 10);
  if (!items.length) throw Fail('Choose a product first.');
  const docs = await fb.batchGet(items.map((i) => 'secProducts/' + clean(i.id, 40)));
  let total = 0, pv = 0; const lines = [];
  items.forEach((i) => {
    const id = clean(i.id, 40), p = docs['secProducts/' + id], qty = Math.floor(Number(i.qty) || 0);
    if (!p || p.active === false) throw Fail('A product in your order is no longer available.');
    if (qty < 1 || qty > 20) throw Fail('Quantity must be between 1 and 20.');
    if (typeof p.stock === 'number' && p.stock < qty) throw Fail('Not enough stock for "' + p.title + '".');
    const price = Math.floor(Number(p.price) || 0), unitPv = typeof p.pv === 'number' && p.pv >= 0 && p.pvFixed ? p.pv : plan.pvFor(price, p.category, cfg.tiers);
    total += price * qty; pv += unitPv * qty;
    lines.push({ id, title: clean(p.title, 90), price, qty, pv: unitPv, image: (p.images && p.images[0]) || '' });
  });
  const orderId = rid(), writes = [];
  const me = await fb.getDoc('secMembers/' + user.uid);
  const name = clean(b.name, 40) || user.name || 'Member';
  let reg = null;
  if (!me) {
    const phone = clean(b.phone, 20).replace(/[^\d+]/g, '');
    if (name.length < 2) throw Fail('Please write your full name.');
    if (phone.length < 9) throw Fail('Please write your phone number.');
    if (b.inviteCode) {
      const code = clean(b.inviteCode, 20).toUpperCase(), inv = await fb.getDoc('secInvites/' + code);
      if (!inv || inv.status !== 'open') throw Fail('This invite code is not valid or was already used.');
      const parent = await fb.getDoc('secMembers/' + inv.parentUid), sponsor = await fb.getDoc('secMembers/' + inv.sponsorUid);
      if (!parent || !sponsor) throw Fail('This invite is no longer valid.');
      reg = { username: inv.username, sponsorUid: inv.sponsorUid, sponsorUsername: sponsor.username, parentUid: inv.parentUid, leg: inv.leg, parent, invite: code };
      writes.push(W.create('secClaims/' + code, { uid: user.uid, createdAt: new Date() }), W.set('secInvites/' + code, { status: 'claimed', claimedBy: user.uid }), W.set('secUsernames/' + reg.username, { uid: user.uid }), W.set('secMembers/' + inv.parentUid, { [legKey(inv.leg)]: user.uid }));
    } else {
      const username = clean(b.username, 20).toLowerCase(), sponsorName = clean(b.sponsor, 20).toLowerCase();
      if (!isUser(username)) throw Fail('Username must be 3 to 20 letters, numbers or _ (no spaces).');
      const sponsor = await memberByUsername(sponsorName);
      if (!sponsor) throw Fail('We could not find the member whose username you wrote. Check it and try again.');
      if (sponsor.status !== 'active') throw Fail('That member is not active yet and cannot sponsor new members.');
      if (sponsor.uid === user.uid) throw Fail('You cannot sponsor yourself.');
      const parent = await fb.getDoc('secMembers/' + clean(b.parentUid, 60));
      const pu = clean(b.parentUid, 60), leg = b.leg === 'R' ? 'R' : (b.leg === 'L' ? 'L' : '');
      if (!parent || !leg) throw Fail('Choose Left or Right under your sponsor\'s team.');
      parent.uid = pu;
      if (!inDownline(sponsor, parent)) throw Fail('That position is not inside your sponsor\'s team.');
      if (!slotFree(parent, leg)) throw Fail('That position is already taken. Please choose another.');
      reg = { username, sponsorUid: sponsor.uid, sponsorUsername: sponsor.username, parentUid: pu, leg, parent };
      writes.push(W.create('secUsernames/' + username, { uid: user.uid }), W.create('secSlots/' + pu + '_' + leg, { uid: user.uid }), W.set('secMembers/' + pu, { [legKey(leg)]: user.uid }));
    }
    writes.push(W.create('secMembers/' + user.uid, {
      uid: user.uid, username: reg.username, name, phone, photo: clean(user.photo, 400), status: 'pending',
      sponsorUid: reg.sponsorUid, sponsorUsername: reg.sponsorUsername, parentUid: reg.parentUid, leg: reg.leg,
      ancestors: (reg.parent.ancestors || []).concat(reg.parentUid), leftUid: '', rightUid: '', firstOrderId: orderId,
      leftPv: 0, rightPv: 0, leftBal: 0, rightBal: 0, matchedPv: 0, balance: 0, earnedTotal: 0, withdrawn: 0, pendingWd: 0, refL1: 0, refL2: 0, refL3: 0, matchEarned: 0, createdAt: new Date()
    }));
  }
  writes.push(W.create('secOrders/' + orderId, { id: orderId, uid: user.uid, username: me ? me.username : reg.username, name: me ? me.name : name, items: lines, total, pv, payStatus: 'awaiting', pickStatus: 'pending', newMember: !me, createdAt: new Date() }));
  try { await fb.commit(writes); }
  catch (e) {
    if (e.status !== 409) throw e;
    if (reg && !b.inviteCode) {
      if (await fb.getDoc('secUsernames/' + reg.username)) throw Fail('That username is already taken. Please choose another.');
      throw Fail('That position was just taken by someone else. Please choose another.');
    }
    throw Fail('Could not save your order. Please try again.');
  }
  return { ok: true, orderId, total, pv };
}

async function addProof(user, b) {
  const o = await fb.getDoc('secOrders/' + clean(b.orderId, 30));
  if (!o || o.uid !== user.uid) throw Fail('Order not found.', 404);
  if (o.payStatus === 'confirmed') throw Fail('This order is already confirmed.');
  const url = String(b.url || '');
  if (url.indexOf(MEDIA) !== 0 || url.length > 600) throw Fail('Please upload the screenshot again.');
  await fb.setDoc('secOrders/' + o.id, { proofUrl: url, payRef: clean(b.ref, 60), payStatus: 'uploaded', proofAt: new Date() });
  return { ok: true };
}

// ---------- invite / register a new member for someone ----------
async function invite(user, b) {
  const me = await fb.getDoc('secMembers/' + user.uid);
  if (!me || me.status !== 'active') throw Fail('Only active members can register new members.');
  const username = clean(b.username, 20).toLowerCase(), name = clean(b.name, 40), phone = clean(b.phone, 20).replace(/[^\d+]/g, '');
  const pu = clean(b.parentUid, 60), leg = b.leg === 'R' ? 'R' : (b.leg === 'L' ? 'L' : '');
  if (name.length < 2 || phone.length < 9) throw Fail('Write the new member\'s name and phone number.');
  if (!isUser(username)) throw Fail('Username must be 3 to 20 letters, numbers or _ (no spaces).');
  const parent = await fb.getDoc('secMembers/' + pu);
  if (!parent || !leg) throw Fail('Choose a free position.');
  parent.uid = pu; me.uid = user.uid;
  if (!inDownline(me, parent)) throw Fail('That position is not inside your team.');
  if (!slotFree(parent, leg)) throw Fail('That position is already taken.');
  const code = rid().toUpperCase().slice(0, 8);
  try {
    await fb.commit([W.create('secUsernames/' + username, { uid: 'invite:' + code }), W.create('secSlots/' + pu + '_' + leg, { uid: 'invite:' + code }), W.set('secMembers/' + pu, { [legKey(leg)]: 'invite:' + code }),
      W.create('secInvites/' + code, { code, sponsorUid: user.uid, name, phone, username, parentUid: pu, leg, status: 'open', createdAt: new Date() })]);
  } catch (e) {
    if (e.status !== 409) throw e;
    if (await fb.getDoc('secUsernames/' + username)) throw Fail('That username is already taken. Choose another.');
    throw Fail('That position was just taken. Choose another.');
  }
  return { ok: true, code };
}

// ---------- admin: confirm payment (this is where PV and commissions are created) ----------
async function confirm(admin, b) {
  const cfg = await config(), orderId = clean(b.orderId, 30), o = await fb.getDoc('secOrders/' + orderId);
  if (!o) throw Fail('Order not found.', 404);
  if (o.payStatus === 'confirmed') throw Fail('This order was already confirmed.');
  const buyer = await fb.getDoc('secMembers/' + o.uid);
  if (!buyer) throw Fail('The buyer has no member record.');
  const chain = (buyer.ancestors || []).concat(o.uid);
  const docs = await fb.batchGet(chain.map((u) => 'secMembers/' + u));
  const writes = [], now = new Date();
  writes.push(W.set('secOrders/' + orderId, { payStatus: 'confirmed', paidAt: now, confirmedBy: admin }));
  writes.push(W.create('secLedger/ord_' + orderId, { type: 'order', uid: o.uid, orderId, amount: o.total, pv: o.pv, createdAt: now }));
  if (buyer.status !== 'active') writes.push(W.set('secMembers/' + o.uid, { status: 'active', activatedAt: now }));
  (o.items || []).forEach((it) => { /* stock is reduced below once we know it exists */ });
  const pdocs = await fb.batchGet((o.items || []).map((i) => 'secProducts/' + i.id));
  (o.items || []).forEach((i) => { const p = pdocs['secProducts/' + i.id]; if (p && typeof p.stock === 'number') writes.push(W.inc('secProducts/' + i.id, { stock: -i.qty })); });
  // PV: every ancestor gets the PV on the leg the buyer sits under
  if (o.pv > 0) {
    for (let i = 0; i < chain.length - 1; i++) {
      const anc = chain[i], below = docs['secMembers/' + chain[i + 1]];
      if (!docs['secMembers/' + anc] || !below) continue;
      const L = below.leg === 'L';
      writes.push(W.inc('secMembers/' + anc, L ? { leftPv: o.pv, leftBal: o.pv } : { rightPv: o.pv, rightBal: o.pv }));
      writes.push(W.create('secLedger/pv_' + orderId + '_' + anc, { type: 'pv', uid: anc, leg: below.leg, pv: o.pv, orderId, fromUid: o.uid, fromName: buyer.username, createdAt: now }));
    }
  }
  // Referral commission: sponsor line, 3 levels, from the confirmed order value
  const amounts = plan.referralAmounts(o.total, cfg.refPct);
  let cur = buyer;
  for (let lvl = 0; lvl < 3; lvl++) {
    if (!cur.sponsorUid) break;
    const sp = await fb.getDoc('secMembers/' + cur.sponsorUid);
    if (!sp) break;
    if (sp.status === 'active' && amounts[lvl] > 0) {
      writes.push(W.inc('secMembers/' + cur.sponsorUid, { balance: amounts[lvl], earnedTotal: amounts[lvl], ['refL' + (lvl + 1)]: amounts[lvl] }));
      writes.push(W.create('secLedger/com_' + orderId + '_L' + (lvl + 1), { type: 'ref', uid: cur.sponsorUid, level: lvl + 1, amount: amounts[lvl], orderId, fromUid: o.uid, fromName: buyer.username, createdAt: now }));
    }
    cur = sp;
  }
  if (writes.length > 480) throw Fail('This order touches too many members to confirm in one step. Contact the developer.');
  try { await fb.commit(writes); } catch (e) { if (e.status === 409) throw Fail('This order was already confirmed.'); throw e; }
  return { ok: true };
}

async function pick(admin, b) {
  const o = await fb.getDoc('secOrders/' + clean(b.orderId, 30));
  if (!o) throw Fail('Order not found.', 404);
  if (o.payStatus !== 'confirmed') throw Fail('Confirm the payment first.');
  await fb.setDoc('secOrders/' + o.id, { pickStatus: 'picked', pickedAt: new Date(), pickedBy: admin });
  return { ok: true };
}

async function reject(admin, b) {
  const o = await fb.getDoc('secOrders/' + clean(b.orderId, 30));
  if (!o) throw Fail('Order not found.', 404);
  if (o.payStatus === 'confirmed') throw Fail('A confirmed order cannot be rejected.');
  const writes = [W.set('secOrders/' + o.id, { payStatus: 'rejected', rejectReason: clean(b.reason, 200), rejectedAt: new Date() })];
  const m = await fb.getDoc('secMembers/' + o.uid);
  if (m && m.status === 'pending' && m.firstOrderId === o.id) {   // the registration was only reserved: free the username and the position
    writes.push(W.del('secMembers/' + o.uid), W.del('secUsernames/' + m.username), W.del('secSlots/' + m.parentUid + '_' + m.leg), W.set('secMembers/' + m.parentUid, { [legKey(m.leg)]: '' }));
  }
  await fb.commit(writes);
  return { ok: true };
}

// ---------- wallet ----------
async function withdraw(user, b) {
  const cfg = await config(), me = await fb.getDoc('secMembers/' + user.uid);
  if (!me || me.status !== 'active') throw Fail('Only active members can withdraw.');
  const amount = Math.floor(Number(b.amount) || 0), phone = clean(b.phone, 20).replace(/[^\d+]/g, '');
  if (phone.length < 9) throw Fail('Write the MoMo number to receive the money.');
  if (amount < cfg.minWithdraw) throw Fail('The minimum withdrawal is ' + cfg.minWithdraw.toLocaleString('en-US') + ' RWF.');
  if (amount > (me.balance || 0)) throw Fail('You do not have that much available.');
  const id = rid(), now = new Date();
  try {
    await fb.commit([W.create('secWithdrawals/' + id, { id, uid: user.uid, username: me.username, amount, phone, status: 'pending', createdAt: now }),
      W.inc('secMembers/' + user.uid, { balance: -amount, pendingWd: amount }, me._t),
      W.create('secLedger/wd_' + id, { type: 'withdraw', uid: user.uid, amount: -amount, createdAt: now })]);
  } catch (e) { if (e.status === 409) throw Fail('Your balance just changed. Please try again.'); throw e; }
  return { ok: true, id };
}
async function decideWithdraw(admin, b) {
  const id = clean(b.id, 30), w = await fb.getDoc('secWithdrawals/' + id);
  if (!w) throw Fail('Withdrawal not found.', 404);
  if (w.status !== 'pending') throw Fail('This withdrawal was already handled.');
  const now = new Date(), ok = !!b.approve, writes = [W.create('secLedger/wdd_' + id, { type: 'decision', uid: w.uid, createdAt: now })];
  if (ok) { writes.push(W.set('secWithdrawals/' + id, { status: 'paid', paidAt: now, decidedBy: admin }), W.inc('secMembers/' + w.uid, { pendingWd: -w.amount, withdrawn: w.amount })); }
  else { writes.push(W.set('secWithdrawals/' + id, { status: 'rejected', decidedAt: now, decidedBy: admin, note: clean(b.note, 200) }), W.inc('secMembers/' + w.uid, { pendingWd: -w.amount, balance: w.amount }), W.create('secLedger/wdr_' + id, { type: 'refund', uid: w.uid, amount: w.amount, createdAt: now })); }
  try { await fb.commit(writes); } catch (e) { if (e.status === 409) throw Fail('This withdrawal was already handled.'); throw e; }
  return { ok: true };
}

// ---------- daily binary matching (cron or admin button) ----------
async function runMatching() {
  const cfg = await config(), d = day(); let paid = 0, total = 0;
  const items = [];
  await fb.listAll('secMembers', async (page) => { page.forEach((m) => { if (m.status === 'active') { const r = plan.matching(m.leftBal || 0, m.rightBal || 0, cfg); if (r.matched > 0) items.push({ uid: m.id, r }); } }); });
  const mk = (it) => {
    const now = new Date(), w = [W.create('secLedger/match_' + it.uid + '_' + d, { type: 'match', uid: it.uid, pv: it.r.matched, amount: it.r.bonus, capped: it.r.capped, day: d, createdAt: now })];
    w.push(W.inc('secMembers/' + it.uid, { leftBal: -it.r.matched, rightBal: -it.r.matched, matchedPv: it.r.matched, balance: it.r.bonus, earnedTotal: it.r.bonus, matchEarned: it.r.bonus }));
    return w;
  };
  for (let i = 0; i < items.length; i += 100) {
    const part = items.slice(i, i + 100);
    try { await fb.commit([].concat.apply([], part.map(mk))); paid += part.length; part.forEach((p) => { total += p.r.bonus; }); }
    catch (e) {
      if (e.status !== 409) throw e;
      for (const it of part) { try { await fb.commit(mk(it)); paid++; total += it.r.bonus; } catch (e2) { if (e2.status !== 409) throw e2; } }   // already paid today: skipped
    }
  }
  return { ok: true, day: d, members: paid, total };
}

async function seed(admin, b) {
  const username = clean(b.username || 'afrishine', 20).toLowerCase();
  if (!isUser(username)) throw Fail('Bad username.');
  if (await fb.getDoc('secMembers/' + admin)) throw Fail('The company account already exists.');
  await fb.commit([W.create('secUsernames/' + username, { uid: admin }), W.create('secMembers/' + admin, { uid: admin, username, name: 'Afrishine Security Solutions', phone: '', photo: '', status: 'active', root: true, sponsorUid: '', sponsorUsername: '', parentUid: '', leg: '', ancestors: [], leftUid: '', rightUid: '', leftPv: 0, rightPv: 0, leftBal: 0, rightBal: 0, matchedPv: 0, balance: 0, earnedTotal: 0, withdrawn: 0, pendingWd: 0, refL1: 0, refL2: 0, refL3: 0, matchEarned: 0, createdAt: new Date() })]);
  return { ok: true, username };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    // Vercel Cron calls with GET and "Authorization: Bearer <CRON_SECRET>"
    if (req.method === 'GET') {
      if (!process.env.CRON_SECRET || (req.headers.authorization || '') !== 'Bearer ' + process.env.CRON_SECRET) throw Fail('Not allowed.', 403);
      return res.status(200).json(await runMatching());
    }
    if (req.method !== 'POST') throw Fail('POST only.', 405);
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const user = await fb.verifyIdToken(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
    if (!user) throw Fail('Please sign in again.', 401);
    limit(user.uid);
    let out;
    switch (b.action) {
      case 'check': { const u = clean(b.username, 20).toLowerCase(); out = { ok: true, valid: isUser(u), available: isUser(u) && !(await fb.getDoc('secUsernames/' + u)) }; break; }
      case 'tree': {
        const sp = await memberByUsername(clean(b.sponsor, 20).toLowerCase());
        if (!sp) throw Fail('We could not find the member whose username you wrote.');
        if (sp.status !== 'active') throw Fail('That member is not active yet and cannot sponsor new members.');
        out = { ok: true, sponsor: { uid: sp.uid, username: sp.username, name: sp.name }, nodes: await subtree(sp.uid, 4) };
        break;
      }
      case 'myTree': { const me = await fb.getDoc('secMembers/' + user.uid); if (!me) throw Fail('You are not a member yet.'); out = { ok: true, nodes: await subtree(user.uid, 4) }; break; }
      case 'order': out = await createOrder(user, b); break;
      case 'proof': out = await addProof(user, b); break;
      case 'invite': out = await invite(user, b); break;
      case 'withdraw': out = await withdraw(user, b); break;
      case 'confirm': await needAdmin(user.uid); out = await confirm(user.uid, b); break;
      case 'pick': await needAdmin(user.uid); out = await pick(user.uid, b); break;
      case 'reject': await needAdmin(user.uid); out = await reject(user.uid, b); break;
      case 'wdDecide': await needAdmin(user.uid); out = await decideWithdraw(user.uid, b); break;
      case 'matching': await needAdmin(user.uid); out = await runMatching(); break;
      case 'seed': await needAdmin(user.uid); out = await seed(user.uid, b); break;
      default: throw Fail('Unknown action.');
    }
    res.status(200).json(out);
  } catch (e) {
    if (!e.user) console.error('sec error:', e && e.message);
    res.status(e.status || 500).json({ error: e.user ? e.message : 'Something went wrong. Please try again.' });
  }
};
module.exports.runMatching = runMatching;
