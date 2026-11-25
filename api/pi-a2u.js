// Pi App-to-User (A2U) payments - ADMIN ONLY. POST /api/pi-a2u { action, ... } with the admin's Firebase login token.
// Used to send small TEST payments from the app wallet to Pi members (Pi asks for A2U payments to 5 unique wallets on the
// paired Testnet app before it grants a Mainnet app wallet).
//
// Vercel environment variables (names only - you type the values yourself in Vercel, never in chat or GitHub):
//   PI_TESTNET_API_KEY   API key of the paired TESTNET app (used only by this payout tool). PI_NETWORK_API_KEY stays for normal payments.
//   PI_WALLET_SEED       the app wallet's secret seed (starts with S...). Server only. Never put it in GitHub or the browser.
//   FIREBASE_SERVICE_ACCOUNT  (already set)
//   PI_NETWORK_MODE      optional: "testnet" (default) or "mainnet"
// Needs the npm package @stellar/stellar-sdk (see package.json in the Hub root).
//
// Safety: one payment per member per tool use (create-only claim document piA2U/<id>), the Pi payment id is saved before the
// money moves, and a payment that stopped half-way is RESUMED, never created twice.
const fb = require('./_firebase');
const W = fb.W;
const PI = 'https://api.minepi.com/v2';
const MAX_AMOUNT = 1;     // safety cap per payment (Pi)

function Fail(msg, status) { const e = new Error(msg); e.status = status || 400; e.user = true; return e; }
const clean = (s, n) => String(s == null ? '' : s).replace(/[<>]/g, '').trim().slice(0, n);
// the payout tool has its OWN key (PI_TESTNET_API_KEY) so the normal Mainnet payments keep working with PI_NETWORK_API_KEY
const key = () => process.env.PI_TESTNET_API_KEY || process.env.PI_NETWORK_API_KEY || process.env.PI_API_KEY || '';
const auth = () => ({ Authorization: 'Key ' + key(), 'Content-Type': 'application/json' });
const mode = () => (String(process.env.PI_NETWORK_MODE || 'testnet').toLowerCase() === 'mainnet' ? 'mainnet' : 'testnet');
const HORIZON = { testnet: 'https://api.testnet.minepi.com', mainnet: 'https://api.mainnet.minepi.com' };
const PASSPHRASE = { testnet: 'Pi Testnet', mainnet: 'Pi Network' };
let sdkCache = null;
function sdk() {
  if (sdkCache) return sdkCache;
  try { sdkCache = require('@stellar/stellar-sdk'); } catch (e) {
    try { sdkCache = require('stellar-sdk'); } catch (e2) { throw Fail('The server is missing the package @stellar/stellar-sdk. Add package.json to the Hub root and redeploy.', 500); }
  }
  return sdkCache;
}
async function needAdmin(uid) { if ((await fb.getDoc('admins/' + uid)) === null) throw Fail('Administrators only.', 403); }
function readiness() {
  let hasSdk = true, publicKey = '', seedOk = false;
  try { sdk(); } catch (e) { hasSdk = false; }
  const seed = process.env.PI_WALLET_SEED || '';
  if (hasSdk && seed) {
    try { const S = sdk(); seedOk = S.StrKey.isValidEd25519SecretSeed(seed); if (seedOk) publicKey = S.Keypair.fromSecret(seed).publicKey(); } catch (e) { seedOk = false; }
  }
  // values are NEVER returned - only yes/no and the wallet's PUBLIC address (safe to show; it is on the blockchain)
  return { mode: mode(), hasApiKey: !!key(), hasSeed: !!seed, seedValid: seedOk, hasSdk, walletPublic: publicKey, explorer: publicKey ? 'https://blockexplorer.minepi.com/' + (mode() === 'testnet' ? 'testnet/' : '') + 'accounts/' + publicKey : '' };
}

async function piPost(path, body) {
  const r = await fetch(PI + path, { method: 'POST', headers: auth(), body: JSON.stringify(body || {}) });
  let d = null; try { d = await r.json(); } catch (e) { d = null; }
  return { ok: r.ok, status: r.status, data: d };
}

// the money step: sign and submit the Pi blockchain transaction from the app wallet
async function submitToChain(payment) {
  const S = sdk(), m = mode();
  const Server = (S.Horizon && S.Horizon.Server) || S.Server;
  const server = new Server(HORIZON[m]);
  const kp = S.Keypair.fromSecret(process.env.PI_WALLET_SEED);
  const account = await server.loadAccount(kp.publicKey());
  const fee = await server.fetchBaseFee();
  const dest = payment.to_address || (payment.transaction && payment.transaction.to_address);
  if (!dest) throw Fail('Pi did not send the member wallet address for this payment.', 502);
  const tx = new S.TransactionBuilder(account, { fee: String(fee), networkPassphrase: PASSPHRASE[m], timebounds: await server.fetchTimebounds(180) })
    .addOperation(S.Operation.payment({ destination: dest, asset: S.Asset.native(), amount: String(payment.amount) }))
    .addMemo(S.Memo.text(String(payment.identifier)))
    .build();
  tx.sign(kp);
  const res = await server.submitTransaction(tx);
  return res.hash || res.id;
}

async function pay(admin, b) {
  const rd = readiness();
  if (!rd.hasApiKey) throw Fail('PI_TESTNET_API_KEY is not set in Vercel.');
  if (!rd.hasSeed || !rd.seedValid) throw Fail('PI_WALLET_SEED is missing or not a valid wallet seed in Vercel.');
  const uid = clean(b.uid, 80), piUid = uid.replace(/^pt_/, '');
  if (!/^pt_[A-Za-z0-9-]{8,70}$/.test(uid)) throw Fail('Choose a tester from the list.');
  if (!(await fb.getDoc('piTesters/' + piUid))) throw Fail('This tester is not registered. Ask them to open the tester page in Pi Sandbox.');
  const amount = Math.round(Number(b.amount) * 1e7) / 1e7;
  if (!(amount > 0) || amount > MAX_AMOUNT) throw Fail('Amount must be more than 0 and at most ' + MAX_AMOUNT + ' Pi.');
  const memo = clean(b.memo, 28) || 'Afrishine test payment';
  const docId = 'a2u_' + piUid;
  const now = new Date();
  let rec = await fb.getDoc('piA2U/' + docId);
  if (rec && rec.status === 'completed') throw Fail('This member was already paid (' + (rec.txid || '') + ').');
  if (!rec) {
    try { await fb.commit([W.create('piA2U/' + docId, { uid, piUid, amount, memo, status: 'creating', mode: mode(), by: admin, createdAt: now })]); }
    catch (e) { throw Fail('A payment for this member is already being processed. Refresh and try again.', 409); }
    rec = { status: 'creating' };
  }
  let identifier = rec.paymentId || '';
  let payment = null;
  if (!identifier) {
    const c = await piPost('/payments', { payment: { amount, memo, metadata: { kind: 'a2u-test', by: 'afrishine-admin' }, uid: piUid } });
    if (!c.ok || !c.data || !c.data.identifier) {
      const why = clean((c.data && (c.data.error_message || c.data.message || c.data.error)) || ('Pi answered ' + c.status), 160);
      await fb.setDoc('piA2U/' + docId, { status: 'failed', error: why, updatedAt: new Date() });
      throw Fail('Pi refused to create the payment: ' + why);
    }
    payment = c.data; identifier = payment.identifier;
    await fb.setDoc('piA2U/' + docId, { status: 'created', paymentId: identifier, updatedAt: new Date() });   // saved BEFORE any money moves
  } else {
    const g = await fetch(PI + '/payments/' + encodeURIComponent(identifier), { headers: auth() });
    if (!g.ok) throw Fail('Could not read the unfinished payment from Pi. Try again in a minute.', 502);
    payment = await g.json();
  }
  const st = payment.status || {};
  let txid = (payment.transaction && payment.transaction.txid) || rec.txid || '';
  if (st.cancelled || st.user_cancelled) { await fb.setDoc('piA2U/' + docId, { status: 'failed', error: 'cancelled', updatedAt: new Date() }); throw Fail('This payment was cancelled by Pi.'); }
  if (!txid) {
    try { txid = await submitToChain(payment); }
    catch (e) {
      if (e && e.user) throw e;
      const extra = e && e.response && e.response.data && e.response.data.extras && e.response.data.extras.result_codes ? JSON.stringify(e.response.data.extras.result_codes) : '';
      console.error('a2u chain error:', e && e.message, extra);
      await fb.setDoc('piA2U/' + docId, { status: 'created', error: clean((e && e.message) + ' ' + extra, 200), updatedAt: new Date() });
      throw Fail('The blockchain step failed: ' + clean((e && e.message) + ' ' + extra, 160) + ' (press Pay again to resume it).', 502);
    }
    await fb.setDoc('piA2U/' + docId, { status: 'submitted', txid, updatedAt: new Date() });
  }
  if (!(st.developer_completed)) {
    const done = await piPost('/payments/' + encodeURIComponent(identifier) + '/complete', { txid });
    if (!done.ok) {
      const why = clean((done.data && (done.data.error_message || done.data.message || done.data.error)) || ('Pi answered ' + done.status), 160);
      throw Fail('Money was sent but Pi could not complete the record: ' + why + ' (press Pay again to resume it).', 502);
    }
  }
  await fb.setDoc('piA2U/' + docId, { status: 'completed', txid, completedAt: new Date(), error: '' });
  return { ok: true, txid, paymentId: identifier };
}

// A tester opens /pi-tester.html in Pi Sandbox, signs in with Pi, and the page sends the Pi access token here.
// We ask Pi (GET /v2/me) who that is. The uid Pi returns belongs to THIS app, which is what A2U payments need.
const seenIp = {};
async function tester(req, b) {
  const ip = String((req.headers['x-forwarded-for'] || '')).split(',')[0].trim() || 'x', now = Date.now();
  seenIp[ip] = (seenIp[ip] || []).filter((t) => now - t < 60000); seenIp[ip].push(now);
  if (seenIp[ip].length > 10) throw Fail('Too many tries. Wait a minute.', 429);
  const t = String(b.accessToken || '');
  if (t.length < 10 || t.length > 4000) throw Fail('Missing Pi access token.');
  const r = await fetch(PI + '/me', { headers: { Authorization: 'Bearer ' + t } });
  if (!r.ok) throw Fail('Pi could not verify this sign-in (status ' + r.status + ').', 401);
  const me = await r.json(), uid = String(me.uid || '');
  if (!/^[A-Za-z0-9-]{8,70}$/.test(uid)) throw Fail('Pi did not send a user id.', 502);
  const username = clean(me.username, 40);
  await fb.setDoc('piTesters/' + uid, { uid, username, seenAt: new Date() });
  return { ok: true, username };
}

async function overview() {
  const rd = readiness();
  const members = [], paid = {};
  await fb.listAll('piA2U', async (rows) => rows.forEach((r) => { paid[r.id] = r; }));
  let seen = 0;
  await fb.listAll('piTesters', async (rows) => rows.forEach((r) => {
    if (seen >= 200) return; seen++;
    const p = paid['a2u_' + r.id];
    members.push({ uid: 'pt_' + r.id, username: String(r.username || '').slice(0, 40), status: p ? p.status : '', txid: p && p.txid || '', error: p && p.error || '' });
  }));
  const completed = Object.keys(paid).filter((k) => paid[k].status === 'completed').length;
  return { ok: true, ready: rd, completed, needed: 5, members };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') throw Fail('POST only.', 405);
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (b.action === 'tester') return res.status(200).json(await tester(req, b));
    const user = await fb.verifyIdToken(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
    if (!user) throw Fail('Please sign in again.', 401);
    await needAdmin(user.uid);
    let out;
    switch (b.action) {
      case 'overview': out = await overview(); break;
      case 'pay': out = await pay(user.uid, b); break;
      default: throw Fail('Unknown action.');
    }
    res.status(200).json(out);
  } catch (e) {
    if (!e.user) console.error('pi-a2u error:', e && e.message);
    res.status(e.status || 500).json({ error: e.user ? e.message : 'Something went wrong. Please try again.' });
  }
};
module.exports._readiness = readiness;
