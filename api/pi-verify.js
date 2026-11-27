// POST { action: 'plans' }                                   -> prices (Pi) for the three Verified plans (public)
// POST { action: 'submit', idToken, plan, profession, details, email, name, username }
//                                                            -> saves the verification request (admin sees it in Admin > Verification) and returns the price in Pi
// The payment itself goes through api/pi-approve.js and api/pi-complete.js (metadata.kind = "verify").
const { setDoc, verifyIdToken } = require('./_firebase');
const { PLANS, piPerUsd, amountFor, planList } = require('./_verify');

const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const hits = new Map();                                   // simple per-person limit: 8 submissions / 10 minutes
function limited(key) {
  const now = Date.now(), list = (hits.get(key) || []).filter((t) => now - t < 600000);
  list.push(now); hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 8;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const b = req.body || {};
    if (b.action === 'plans') return res.status(200).json(await planList());
    if (b.action !== 'submit') return res.status(400).json({ error: 'Unknown action' });

    const me = await verifyIdToken(String(b.idToken || ''));
    if (!me || !me.uid) return res.status(401).json({ error: 'Please sign in first.' });
    if (limited(me.uid)) return res.status(429).json({ error: 'Too many tries. Please wait a few minutes.' });

    const plan = PLANS[String(b.plan || '')];
    const profession = clean(b.profession, 100), details = clean(b.details, 500), email = clean(b.email, 120).toLowerCase();
    if (!plan) return res.status(400).json({ error: 'Choose a plan.' });
    if (profession.length < 2) return res.status(400).json({ error: 'Write your profession or business.' });
    if (details.length < 10) return res.status(400).json({ error: 'Explain why you are requesting verification (at least 10 characters).' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'Enter a valid e-mail address.' });

    const { rate } = await piPerUsd();
    const amountPi = amountFor(plan, rate);
    const id = 'vr_' + me.uid.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 100);
    await setDoc('verificationRequests/' + id, {
      uid: me.uid, displayName: clean(b.name, 100) || 'Afrishine Member', username: clean(b.username, 60), email,
      profession, details, plan: plan.id, planLabel: plan.label, priceUsd: plan.usd, amountPi,
      status: 'pending', paid: false, source: 'academy', createdAt: new Date()
    });
    return res.status(200).json({ ok: true, requestId: id, plan: plan.id, label: plan.label, amountPi, usd: plan.usd });
  } catch (e) {
    console.error('pi-verify', e);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
