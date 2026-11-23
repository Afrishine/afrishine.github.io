// POST { paymentId, txid } -> completes the Pi payment, records the order (5% commission) and marks the product sold.
const { getDoc, setDoc } = require('./_firebase');
const PI = 'https://api.minepi.com/v2';
const COMMISSION = 0.05;
const auth = () => ({ Authorization: 'Key ' + process.env.PI_API_KEY, 'Content-Type': 'application/json' });
const round7 = (n) => Math.round(n * 1e7) / 1e7;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const paymentId = String((req.body && req.body.paymentId) || '');
    const txid = String((req.body && req.body.txid) || '');
    if (!/^[A-Za-z0-9_-]{6,80}$/.test(paymentId) || !/^[A-Za-z0-9]{6,100}$/.test(txid)) return res.status(400).json({ error: 'Bad request' });
    const pr = await fetch(`${PI}/payments/${paymentId}`, { headers: auth() });
    if (!pr.ok) return res.status(400).json({ error: 'Payment not found' });
    const pay = await pr.json();
    if (!pay.status || !pay.status.developer_approved || pay.status.cancelled) return res.status(400).json({ error: 'Payment was not approved' });
    if (!pay.status.developer_completed) {
      const cr = await fetch(`${PI}/payments/${paymentId}/complete`, { method: 'POST', headers: auth(), body: JSON.stringify({ txid }) });
      if (!cr.ok) return res.status(502).json({ error: 'Pi could not complete the payment' });
    }
    const productId = pay.metadata && pay.metadata.productId;
    const product = productId && /^[A-Za-z0-9_-]{6,64}$/.test(productId) ? await getDoc('academyProducts/' + productId) : null;
    if (product) {
      const amount = Number(pay.amount), commission = round7(amount * COMMISSION);
      await setDoc('academyOrders/' + paymentId, {
        productId, title: String(product.title || ''), buyerUid: 'pi_' + pay.user_uid, sellerUid: String(product.uid || ''),
        amount, commission, sellerAmount: round7(amount - commission), txid, payoutStatus: 'pending', createdAt: new Date()
      }, true);
      await setDoc('academyProducts/' + productId, { status: 'sold', soldTo: 'pi_' + pay.user_uid });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('pi-complete', e);
    return res.status(500).json({ error: 'Server error' });
  }
};
