// Shared logic for the Afrishine Verified badge (plans, price in Pi, granting the badge).
// Used by api/pi-verify.js (form + prices), api/pi-approve.js and api/pi-complete.js (Pi payments with metadata.kind = "verify").
const { getDoc, setDoc } = require('./_firebase');

const PLANS = {
  verified: { id: 'verified', label: 'Verified', usd: 10, days: 365, period: '1 Year' },
  boost: { id: 'boost', label: 'Verified + Boost', usd: 15, days: 30, period: '30 Days' },
  vip: { id: 'vip', label: 'Verified VIP', usd: 150, days: 30, period: '30 Days' }
};
const DAY = 86400000;

// How many Pi equal 1 US dollar. The admin sets it in Admin > Pi Badges (document verificationSettings/config);
// otherwise the Vercel variable VERIFY_PI_PER_USD is used; otherwise 1.
async function piPerUsd() {
  try {
    const c = await getDoc('verificationSettings/config');
    const n = Number(c && c.piPerUsd);
    if (n > 0 && n < 1000000) return { rate: n, source: 'admin' };
  } catch (e) { /* fall through */ }
  const env = Number(process.env.VERIFY_PI_PER_USD);
  if (env > 0 && env < 1000000) return { rate: env, source: 'env' };
  return { rate: 1, source: 'default' };
}
const amountFor = (plan, rate) => Math.max(0.01, Math.round(plan.usd * rate * 100) / 100);

async function planList() {
  const r = await piPerUsd();
  return { rate: r.rate, rateSource: r.source, plans: Object.values(PLANS).map((p) => Object.assign({}, p, { amountPi: amountFor(p, r.rate) })) };
}

// Pi is about to approve a verification payment: make sure it matches a real request and the real price.
async function checkApprove(pay) {
  const m = pay.metadata || {};
  const plan = PLANS[m.plan];
  const requestId = String(m.requestId || '');
  if (!plan || !/^vr_[A-Za-z0-9_-]{3,100}$/.test(requestId)) return 'This payment does not match a verification request';
  const reqDoc = await getDoc('verificationRequests/' + requestId);
  if (!reqDoc || !reqDoc.uid) return 'Verification request not found';
  if (reqDoc.plan !== plan.id) return 'The selected plan changed. Please start again';
  const { rate } = await piPerUsd();
  if (Math.abs(Number(pay.amount) - amountFor(plan, rate)) > 0.0001) return 'The price changed. Please start again';
  return '';
}

// Pi payment is done: grant the badge (once). Safe to call again for the same payment.
async function grant(pay, paymentId, txid) {
  const m = pay.metadata || {};
  const plan = PLANS[m.plan];
  const requestId = String(m.requestId || '');
  if (!plan || !/^vr_[A-Za-z0-9_-]{3,100}$/.test(requestId)) throw new Error('Bad verification payment');
  const reqDoc = await getDoc('verificationRequests/' + requestId);
  if (!reqDoc || !reqDoc.uid) throw new Error('Verification request not found');
  const uid = String(reqDoc.uid);
  const payPath = 'verificationPayments/' + paymentId;
  let rec = await getDoc(payPath);
  if (rec && rec.granted === true) return { already: true };
  const profile = await getDoc('publicProfiles/' + uid);
  const now = Date.now();
  let until = rec && rec.until ? new Date(rec.until) : null;
  let permanent = !!(rec && rec.permanent);
  if (!rec) {
    const cur = profile && profile.verified === true ? (profile.verifiedUntil ? new Date(profile.verifiedUntil).getTime() : Infinity) : 0;
    if (cur === Infinity) permanent = true;                                  // already verified without an end date: keep it
    else until = new Date(Math.max(now, cur) + plan.days * DAY);
    // record first (with the end date), so a retry gives the same result and never adds time twice
    const created = await setDoc(payPath, { uid, requestId, plan: plan.id, amountPi: Number(pay.amount), txid: String(txid || ''), until: permanent ? null : until, permanent, granted: false, createdAt: new Date() }, true);
    if (!created) rec = await getDoc(payPath);
    if (rec && rec.granted === true) return { already: true };
    if (rec) { until = rec.until ? new Date(rec.until) : null; permanent = !!rec.permanent; }
  }
  const fields = { verified: true, verifiedPlan: plan.id, verifiedAt: new Date() };
  if (!permanent && until) fields.verifiedUntil = until;
  if (!profile) fields.username = String(reqDoc.username || reqDoc.displayName || 'Member').slice(0, 60);
  await setDoc('publicProfiles/' + uid, fields);
  await setDoc(payPath, { granted: true });
  await setDoc('verificationRequests/' + requestId, { status: 'approved', paid: true, paymentId, txid: String(txid || ''), reviewedAt: new Date(), reviewedBy: 'pi-payment' });
  return { ok: true };
}

module.exports = { PLANS, piPerUsd, amountFor, planList, checkApprove, grant };
