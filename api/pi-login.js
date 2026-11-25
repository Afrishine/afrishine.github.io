// POST { accessToken }  ->  { token, username, uid }
// Pi sign-in, as required by Pi App Studio: the Pi access token from Pi.authenticate() is exchanged
// with App Studio, which checks it with the Pi Platform. The uid and username it returns are the ONLY
// identity we trust (never the uid / username sent by the browser). We then issue our own Firebase
// login token for the member (uid = "pi_<Pi uid>"). One exchange per sign-in, done here on the server.
const { getDoc, setDoc, customToken } = require('./_firebase');

const APPSTUDIO_LOGIN = 'https://backend.appstudio-u7cm9zhmha0ruwv8.piappengine.com/pi/auth/v1/login';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  let stage = 'start';
  try {
    const accessToken = String((req.body && req.body.accessToken) || '');
    if (!accessToken || accessToken.length > 4000) return res.status(400).json({ error: 'Missing Pi access token' });
    stage = 'App Studio exchange';
    const r = await fetch(APPSTUDIO_LOGIN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken }) });
    if (!r.ok) { console.error('pi-login: App Studio answered', r.status); return res.status(401).json({ error: 'Pi sign-in could not be verified by App Studio (status ' + r.status + ')' }); }
    const data = await r.json();
    const me = data && data.user;
    if (!me || !me.uid) return res.status(401).json({ error: 'Pi sign-in could not be verified (App Studio sent no user)' });
    stage = 'Firebase setup';
    const uid = 'pi_' + String(me.uid).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
    const username = String(me.username || '').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 40) || 'PiMember';
    const profile = await getDoc('publicProfiles/' + uid);        // never touches "verified"
    if (!profile || !profile.username) await setDoc('publicProfiles/' + uid, { username: username, piUsername: username });
    return res.status(200).json({ token: customToken(uid), username: (profile && profile.username) || username, uid });
  } catch (e) {
    console.error('pi-login', e);
    // the reason is safe to show (it never contains secrets) and tells us exactly what to fix
    return res.status(500).json({ error: 'Server is not ready for Pi sign-in (' + stage + ': ' + String((e && e.message) || 'unknown').replace(/[^\w .:()\/-]/g, '').slice(0, 120) + ')' });
  }
};
