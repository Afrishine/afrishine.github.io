// POST { accessToken }  ->  { token, username, uid }
// Checks the Pi access token with Pi Network, then returns a Firebase login token so a Pi user
// can chat, bid and sell in Afrishine Store. The uid is "pi_<Pi uid>".
const { getDoc, setDoc, customToken } = require('./_firebase');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const accessToken = String((req.body && req.body.accessToken) || '');
    if (!accessToken) return res.status(400).json({ error: 'Missing Pi access token' });
    const r = await fetch('https://api.minepi.com/v2/me', { headers: { Authorization: 'Bearer ' + accessToken } });
    if (!r.ok) return res.status(401).json({ error: 'Pi sign-in could not be verified' });
    const me = await r.json();
    if (!me || !me.uid) return res.status(401).json({ error: 'Pi sign-in could not be verified' });
    const uid = 'pi_' + String(me.uid).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
    const username = String(me.username || '').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 40) || 'PiMember';
    const profile = await getDoc('publicProfiles/' + uid);        // never touches "verified"
    if (!profile || !profile.username) await setDoc('publicProfiles/' + uid, { username: username, piUsername: username });
    return res.status(200).json({ token: customToken(uid), username: (profile && profile.username) || username, uid });
  } catch (e) {
    console.error('pi-login', e);
    return res.status(500).json({ error: 'Server is not ready for Pi sign-in' });
  }
};
