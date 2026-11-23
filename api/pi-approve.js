// POST { paymentId }  -> approves a Pi payment for an Afrishine Store product.
// Needs on Vercel: PI_API_KEY (Pi Developer Portal) and FIREBASE_SERVICE_ACCOUNT.
const { getDoc } = require('./_firebase');
const PI = 'https://api.minepi.com/v2';
const auth = () => ({ Authorization: 'Key ' + process.env.PI_API_KEY, 'Content-Type': 'application/json' });

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const paymentId = String((req.body && req.body.paymentId) || '');
    if (!/^[A-Za-z0-9_-]{6,80}$/.test(paymentId)) return res.status(400).json({ error: 'Bad payment id' });
    const pr = await fetch(`${PI}/payments/${paymentId}`, { headers: auth() });
    if (!pr.ok) return res.status(400).json({ error: 'Payment not found' });
    const pay = await pr.json();
    const productId = pay.metadata && pay.metadata.productId;
    const product = productId && /^[A-Za-z0-9_-]{6,64}$/.test(productId) ? await getDoc('academyProducts/' + productId) : null;
    if (!product || product.status !== 'active') return res.status(400).json({ error: 'This product is no longer available' });
    if (Number(pay.amount) !== Number(product.price)) return res.status(400).json({ error: 'Amount does not match the price' });
    if (product.uid === 'pi_' + pay.user_uid) return res.status(400).json({ error: 'You cannot buy your own product' });
    const ar = await fetch(`${PI}/payments/${paymentId}/approve`, { method: 'POST', headers: auth() });
    if (!ar.ok) return res.status(502).json({ error: 'Pi could not approve the payment' });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('pi-approve', e);
    return res.status(500).json({ error: 'Server error' });
  }
};
