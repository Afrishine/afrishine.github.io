// Shared helpers for the Afrishine Store server functions (Vercel). No npm packages needed.
// Needs ONE environment variable on Vercel:  FIREBASE_SERVICE_ACCOUNT  = the whole service-account JSON (Firebase console > Project settings > Service accounts > Generate new private key)
const crypto = require('crypto');
const PROJECT = 'afrishine-hub';
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

function account() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  return JSON.parse(raw);
}
const b64 = (v) => Buffer.from(v).toString('base64url');
function signJwt(payload, key) {
  const head = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64(JSON.stringify(payload));
  const sig = crypto.createSign('RSA-SHA256').update(head + '.' + body).sign(key);
  return head + '.' + body + '.' + b64(sig);
}
let cached = null;
async function accessToken() {
  if (cached && cached.exp > Date.now() + 60000) return cached.token;
  const a = account(), now = Math.floor(Date.now() / 1000);
  const jwt = signJwt({ iss: a.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }, a.private_key);
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt });
  const d = await r.json();
  if (!d.access_token) throw new Error('Google sign-in for the server failed');
  cached = { token: d.access_token, exp: Date.now() + 3500 * 1000 };
  return cached.token;
}
// Firebase custom login token: lets a Pi user sign in to Firebase (uid is "pi_<Pi uid>")
function customToken(uid) {
  const a = account(), now = Math.floor(Date.now() / 1000);
  return signJwt({ iss: a.client_email, sub: a.client_email, aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit', iat: now, exp: now + 3600, uid, claims: { pi_verified: true } }, a.private_key);
}
const enc = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
  return { stringValue: String(v) };
};
const dec = (v) => {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(dec);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, dec(x)]));
  if ('nullValue' in v) return null;
  return undefined;
};
async function getDoc(path) {
  const r = await fetch(`${DOCS}/${path}`, { headers: { Authorization: 'Bearer ' + (await accessToken()) } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Firestore read failed (' + r.status + ')');
  const j = await r.json();
  return Object.fromEntries(Object.entries(j.fields || {}).map(([k, v]) => [k, dec(v)]));
}
// Writes only the listed fields (others stay). createOnly=true fails (returns false) if the document already exists.
async function setDoc(path, data, createOnly) {
  const keys = Object.keys(data);
  const q = createOnly ? 'currentDocument.exists=false' : keys.map((k) => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
  const r = await fetch(`${DOCS}/${path}?${q}`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + (await accessToken()), 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(keys.map((k) => [k, enc(data[k])])) }) });
  if (createOnly && (r.status === 409 || r.status === 400)) return false;
  if (!r.ok) throw new Error('Firestore write failed (' + r.status + ')');
  return true;
}

// ---- Atomic batches (used by Afrishine Security Solutions: orders, PV, commissions, wallet) ----
const ROOT = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents';
const NAME = (p) => 'projects/' + PROJECT + '/databases/(default)/documents/' + p;
const fieldsOf = (d) => Object.fromEntries(Object.keys(d).map((k) => [k, enc(d[k])]));
const W = {
  create: (p, d) => ({ update: { name: NAME(p), fields: fieldsOf(d) }, currentDocument: { exists: false } }),
  set: (p, d) => ({ update: { name: NAME(p), fields: fieldsOf(d) }, updateMask: { fieldPaths: Object.keys(d) } }),
  inc: (p, o, pre) => { const w = { transform: { document: NAME(p), fieldTransforms: Object.keys(o).map((k) => ({ fieldPath: k, increment: enc(o[k]) })) } }; if (pre) w.currentDocument = { updateTime: pre }; return w; },
  del: (p) => ({ delete: NAME(p) })
};
// All writes succeed or none do. Throws an error with .status (409 = a precondition such as "must not exist yet" failed).
async function commit(writes) {
  const r = await fetch(ROOT + ':commit', { method: 'POST', headers: { Authorization: 'Bearer ' + (await accessToken()), 'Content-Type': 'application/json' }, body: JSON.stringify({ writes }) });
  if (!r.ok) { const e = new Error('Firestore commit failed (' + r.status + ')'); e.status = (r.status === 400 || r.status === 409) ? 409 : r.status; throw e; }
  return true;
}
const withMeta = (j) => Object.assign(Object.fromEntries(Object.entries(j.fields || {}).map(([k, v]) => [k, dec(v)])), { _t: j.updateTime });
// Reads many documents at once; returns { path: data|null }
async function batchGet(paths) {
  const out = {};
  for (let i = 0; i < paths.length; i += 100) {
    const part = paths.slice(i, i + 100);
    const r = await fetch(ROOT + ':batchGet', { method: 'POST', headers: { Authorization: 'Bearer ' + (await accessToken()), 'Content-Type': 'application/json' }, body: JSON.stringify({ documents: part.map(NAME) }) });
    if (!r.ok) throw new Error('Firestore read failed (' + r.status + ')');
    const rows = await r.json();
    part.forEach((p) => { out[p] = null; });
    rows.forEach((row) => { if (row.found) out[row.found.name.split('/documents/')[1]] = withMeta(row.found); });
  }
  return out;
}
// Lists a collection page by page (callback gets each page as [{id, ...fields}])
async function listAll(collection, onPage) {
  let token = '';
  do {
    const r = await fetch(ROOT + '/' + collection + '?pageSize=200' + (token ? '&pageToken=' + encodeURIComponent(token) : ''), { headers: { Authorization: 'Bearer ' + (await accessToken()) } });
    if (!r.ok) throw new Error('Firestore list failed (' + r.status + ')');
    const j = await r.json();
    await onPage((j.documents || []).map((d) => Object.assign({ id: d.name.split('/').pop() }, withMeta(d))));
    token = j.nextPageToken || '';
  } while (token);
}
// Checks a Firebase login token (the member's own browser sends it). Returns { uid, email, name, photo } or null.
async function verifyIdToken(idToken) {
  if (!idToken) return null;
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyBnrdoguyhUd_E3I5RHqcQxHNVLa6kIMX4', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) });
  if (!r.ok) return null;
  const j = await r.json(), u = (j.users || [])[0];
  return u ? { uid: u.localId, email: u.email || '', name: u.displayName || '', photo: u.photoUrl || '' } : null;
}
module.exports = { getDoc, setDoc, customToken, accessToken, W, commit, batchGet, listAll, verifyIdToken };
