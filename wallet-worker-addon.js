// =============================================================================
// AFRISHINE WALLET (AST) - WORKER ADD-ON
//
// PASTE THIS WHOLE BLOCK AT THE VERY END OF YOUR WORKER FILE (after `export default {...};`).
// Then add the ONE router line shown in the instructions (inside the `try` of `fetch`).
//
// Uses only things your Worker already has: json, fail, run, first, changed, authenticate,
// isAdminMember, isVerifiedMember, fsDoc, fsStr, fsBool, firestoreRead, fcmAccessToken,
// pushConfig, sendToMember, ensureSchema, roleCache, ALLOWED_ORIGINS, PROJECT_ID.
//
// SECURITY MODEL
//  * The balance is NEVER stored as an editable number. Every AST movement is a row in the
//    append-only ledger table `wallet_tx`; balance = SUM(amount). Browsers cannot write to D1.
//  * Every spend is ONE conditional SQL statement ("insert the debit only if the balance covers
//    it"), so two simultaneous requests can never both spend the same AST.
//  * Every action carries an idempotency key (unique per member), so a double tap or a retry can
//    never charge, send or credit twice. Top-ups also have a unique active transaction hash and a
//    unique (top-up id) credit, so a payment can be approved only once.
//  * AST is added to a member ONLY when an administrator approves the request.
//  * Verification is written to publicProfiles/{uid}.verified by the Worker (service account);
//    if that fails, the member is refunded automatically.
// =============================================================================

const AST_UNITS = 100;                           // 1 AST = 100 units (2 decimals, integer maths only)
const W_UID_RE = /^[A-Za-z0-9_-]{5,128}$/;
const W_IDEM_RE = /^[A-Za-z0-9_-]{8,64}$/;
const W_POST_RE = /^[A-Za-z0-9_-]{5,64}$/;
const W_DAY_MS = 24 * 60 * 60 * 1000;

const W_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS wallet_tx (id TEXT PRIMARY KEY, uid TEXT NOT NULL, type TEXT NOT NULL, amount INTEGER NOT NULL, peer TEXT, ref TEXT, meta TEXT, idem TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_idem ON wallet_tx (uid, idem)`,
  `CREATE INDEX IF NOT EXISTS wallet_tx_uid ON wallet_tx (uid, created_at)`,
  `CREATE TABLE IF NOT EXISTS wallet_topups (id TEXT PRIMARY KEY, uid TEXT NOT NULL, idem TEXT NOT NULL, username TEXT, email TEXT, method TEXT NOT NULL, coin TEXT NOT NULL, coin_amount TEXT NOT NULL, tx_hash TEXT NOT NULL, tx_hash_lc TEXT NOT NULL, account_name TEXT NOT NULL, screenshot_url TEXT NOT NULL, status TEXT NOT NULL, ast_units INTEGER, note TEXT, reviewed_by TEXT, reviewed_at INTEGER, created_at INTEGER NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS wallet_topups_idem ON wallet_topups (uid, idem)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS wallet_topups_hash_active ON wallet_topups (tx_hash_lc) WHERE status IN ('pending','approved')`,
  `CREATE INDEX IF NOT EXISTS wallet_topups_status ON wallet_topups (status, created_at)`,
  `CREATE TABLE IF NOT EXISTS wallet_orders (id TEXT PRIMARY KEY, uid TEXT NOT NULL, service TEXT NOT NULL, package TEXT, units INTEGER NOT NULL, target_kind TEXT, target_id TEXT, target_title TEXT, status TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS wallet_orders_status ON wallet_orders (status, created_at)`,
  `CREATE TABLE IF NOT EXISTS wallet_promotions (id TEXT PRIMARY KEY, uid TEXT NOT NULL, kind TEXT NOT NULL, target_kind TEXT NOT NULL, target_id TEXT NOT NULL, target_title TEXT, starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL, order_id TEXT)`,
  `CREATE INDEX IF NOT EXISTS wallet_promotions_end ON wallet_promotions (ends_at)`,
  `CREATE TABLE IF NOT EXISTS wallet_subscriptions (uid TEXT PRIMARY KEY, plan TEXT NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS wallet_config (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS wallet_rate (key TEXT NOT NULL, at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS wallet_rate_key ON wallet_rate (key, at)`
];

const walletReady = new WeakSet();
async function walletSchema(env) {
  if (!env.DB) throw { status: 503, code: "WALLET_NOT_CONFIGURED", message: "The wallet is temporarily unavailable. Please try again later." };
  if (walletReady.has(env.DB)) return;
  await env.DB.batch(W_SCHEMA.map((sql) => env.DB.prepare(sql)));
  walletReady.add(env.DB);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function walletUnits(value) {
  const s = String(value === undefined || value === null ? "" : value).trim();
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) return 0;
  const parts = s.split(".");
  const units = Number(parts[0]) * AST_UNITS + (parts[1] ? Number((parts[1] + "0").slice(0, 2)) : 0);
  return Number.isSafeInteger(units) ? units : 0;
}
const walletAstText = (units) => (units / AST_UNITS).toFixed(2);

function walletBad(code, message, status) { return { status: status || 400, code, message }; }

function walletDefaults() {
  const how = ["Send the exact amount from your exchange account.", "Take a screenshot of the transaction.", 'Click "I Have Sent" below and fill in the form.'];
  return {
    methods: {
      binance: { name: "Binance", enabled: true, address: "", qrUrl: "", network: "USDT (TRC20) or BNB Smart Chain", coins: ["USDT", "BNB"], instructions: how.slice() },
      okx: { name: "OKX", enabled: true, address: "", qrUrl: "", network: "USDT (TRC20)", coins: ["USDT"], instructions: how.slice() },
      pidex: { name: "Pi DEX", enabled: true, address: "", qrUrl: "", network: "Pi Network", coins: ["Pi"], instructions: how.slice() }
    },
    prices: {
      verification: 20,
      premium: { ast: 10, days: 30 },
      ads: [{ id: "ads_s", name: "Starter", ast: 5, days: 3 }, { id: "ads_m", name: "Standard", ast: 10, days: 7 }, { id: "ads_l", name: "Pro", ast: 25, days: 14 }],
      boost: [{ id: "boost_s", name: "Quick boost", ast: 2, days: 1 }, { id: "boost_m", name: "Standard boost", ast: 5, days: 3 }, { id: "boost_l", name: "Power boost", ast: 10, days: 7 }]
    },
    ranks: [{ name: "Rookie", min: 0, bonus: 0 }, { name: "Bronze", min: 10, bonus: 0 }, { name: "Silver", min: 50, bonus: 0 }, { name: "Gold", min: 200, bonus: 0 }, { name: "Platinum", min: 1000, bonus: 0 }],
    gift: { min: 1, max: 5000, verifiedOnly: false },
    verification: { minFollowers: 0 },
    support: { email: "", url: "" }
  };
}

async function walletConfig(env) {
  const base = walletDefaults();
  const row = await first(env, `SELECT value FROM wallet_config WHERE key = 'main'`);
  if (!row) return base;
  try { return walletSanitizeConfig(JSON.parse(row.value), base); } catch (_) { return base; }
}

// Builds a clean config from untrusted input, field by field (never copies unknown keys).
function walletSanitizeConfig(input, base) {
  const out = JSON.parse(JSON.stringify(base));
  if (!input || typeof input !== "object") return out;
  const str = (v, max) => String(v === undefined || v === null ? "" : v).trim().slice(0, max);
  const num = (v, min, max, dflt) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 100) / 100 : dflt; };
  const int = (v, min, max, dflt) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : dflt; };
  const pkgs = (list, dflt) => {
    if (!Array.isArray(list)) return dflt;
    const seen = {}, res = [];
    list.slice(0, 6).forEach((p) => {
      if (!p || typeof p !== "object") return;
      const id = str(p.id, 20);
      if (!/^[a-z0-9_]{1,20}$/.test(id) || seen[id]) return;
      const ast = num(p.ast, 0.01, 100000, 0), days = int(p.days, 1, 365, 0);
      if (!ast || !days) return;
      seen[id] = 1;
      res.push({ id, name: str(p.name, 30) || id, ast, days });
    });
    return res.length ? res : dflt;
  };

  if (input.methods && typeof input.methods === "object") {
    Object.keys(out.methods).forEach((id) => {
      const m = input.methods[id];
      if (!m || typeof m !== "object") return;
      const t = out.methods[id];
      if ("name" in m) t.name = str(m.name, 40) || t.name;
      if ("enabled" in m) t.enabled = m.enabled !== false;
      if ("address" in m) t.address = str(m.address, 200);
      if ("network" in m) t.network = str(m.network, 120);
      if ("qrUrl" in m) { const u = str(m.qrUrl, 500); if (u === "" || /^https:\/\/[^\s]+$/.test(u)) t.qrUrl = u; }
      if (Array.isArray(m.coins)) { const c = m.coins.map((x) => str(x, 12)).filter(Boolean).slice(0, 6); if (c.length) t.coins = c; }
      if (Array.isArray(m.instructions)) t.instructions = m.instructions.map((x) => str(x, 200)).filter(Boolean).slice(0, 8);
    });
  }
  if (input.prices && typeof input.prices === "object") {
    const p = input.prices;
    out.prices.verification = num(p.verification, 0.01, 100000, out.prices.verification);
    if (p.premium && typeof p.premium === "object") {
      out.prices.premium = { ast: num(p.premium.ast, 0.01, 100000, out.prices.premium.ast), days: int(p.premium.days, 1, 365, out.prices.premium.days) };
    }
    out.prices.ads = pkgs(p.ads, out.prices.ads);
    out.prices.boost = pkgs(p.boost, out.prices.boost);
  }
  if (Array.isArray(input.ranks)) {
    const r = input.ranks.slice(0, 8).map((x) => ({ name: str(x && x.name, 20), min: num(x && x.min, 0, 10000000, -1), bonus: num(x && x.bonus, 0, 100000, 0) }))
      .filter((x) => x.name && x.min >= 0).sort((a, b) => a.min - b.min);
    if (r.length && r[0].min === 0) out.ranks = r;
  }
  if (input.gift && typeof input.gift === "object") {
    out.gift.min = num(input.gift.min, 0.01, 100000, out.gift.min);
    out.gift.max = num(input.gift.max, out.gift.min, 1000000, out.gift.max);
    out.gift.verifiedOnly = input.gift.verifiedOnly === true;
  }
  if (input.verification && typeof input.verification === "object") {
    out.verification.minFollowers = int(input.verification.minFollowers, 0, 1000000, out.verification.minFollowers);
  }
  if (input.support && typeof input.support === "object") {
    out.support.email = str(input.support.email, 120);
    const u = str(input.support.url, 300);
    out.support.url = u === "" || /^https:\/\/[^\s]+$/.test(u) ? u : out.support.url;
  }
  return out;
}

function walletRank(cfg, sentUnits) {
  const sorted = cfg.ranks.slice().sort((a, b) => a.min - b.min);
  let idx = 0;
  sorted.forEach((r, i) => { if (sentUnits >= Math.round(r.min * AST_UNITS)) idx = i; });
  const next = sorted[idx + 1] || null;
  return {
    name: sorted[idx].name, level: idx + 1, levels: sorted.length,
    next: next ? { name: next.name, minUnits: Math.round(next.min * AST_UNITS) } : null,
    ladder: sorted.map((r) => ({ name: r.name, minUnits: Math.round(r.min * AST_UNITS), bonusUnits: Math.round(r.bonus * AST_UNITS) }))
  };
}

async function walletRateLimit(env, key, max, windowMs, now) {
  await run(env, `DELETE FROM wallet_rate WHERE at < ?1`, now - W_DAY_MS).catch(() => {});
  const row = await first(env, `SELECT COUNT(*) AS n FROM wallet_rate WHERE key = ?1 AND at >= ?2`, key, now - windowMs);
  if (row && row.n >= max) throw walletBad("RATE_LIMIT", "Too many requests. Please try again in a little while.", 429);
  await run(env, `INSERT INTO wallet_rate (key, at) VALUES (?1, ?2)`, key, now);
}

const walletIsUnique = (e) => /UNIQUE|constraint/i.test(String((e && (e.message || e.cause && e.cause.message)) || e));

async function walletBalance(env, uid) {
  const r = await first(env, `SELECT COALESCE(SUM(amount), 0) AS b FROM wallet_tx WHERE uid = ?1`, uid);
  return r ? r.b : 0;
}

// Sends a push to a member; never lets a notification problem affect money.
async function walletNotify(env, uid, title, body) {
  try {
    await ensureSchema(env);
    await sendToMember(env, uid, { title, body, url: "/#wallet", tag: "af-wallet" });
  } catch (_) { /* optional */ }
}

async function walletFollowerCount(idToken, uid) {
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runAggregationQuery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ structuredAggregationQuery: {
      structuredQuery: { from: [{ collectionId: "follows" }], where: { fieldFilter: { field: { fieldPath: "followingUid" }, op: "EQUAL", value: { stringValue: uid } } } },
      aggregations: [{ alias: "n", count: {} }]
    } })
  });
  if (!response.ok) throw walletBad("FOLLOWERS_UNAVAILABLE", "Your followers could not be checked right now. Please try again.", 503);
  const rows = await response.json().catch(() => []);
  const f = rows && rows[0] && rows[0].result && rows[0].result.aggregateFields && rows[0].result.aggregateFields.n;
  return f && f.integerValue ? Number(f.integerValue) : 0;
}

async function walletSetVerified(env, uid) {
  const access = await fcmAccessToken(env);
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/publicProfiles/${encodeURIComponent(uid)}?updateMask.fieldPaths=verified&currentDocument.exists=true`, {
    method: "PATCH",
    headers: { Authorization: "Bearer " + access, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { verified: { booleanValue: true } } })
  });
  if (!response.ok) throw walletBad("VERIFY_WRITE_FAILED", "The Verified Badge could not be activated.", 502);
  try { roleCache.delete("v:" + uid); } catch (_) { }
}

// ---------------------------------------------------------------------------
// Ledger operations (each is ONE atomic batch)
// ---------------------------------------------------------------------------

const W_TX_INSERT = `INSERT INTO wallet_tx (id, uid, type, amount, peer, ref, meta, idem, created_at)`;

// Move AST from `from` to `to`. Debit is inserted only if the balance covers it; the credit is
// inserted only if the debit exists. Both rows are written together or not at all.
async function walletTransfer(env, from, to, units, sentType, recvType, ref, meta, idem, now) {
  const idD = crypto.randomUUID(), idC = crypto.randomUUID();
  const results = await env.DB.batch([
    env.DB.prepare(`${W_TX_INSERT} SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9 WHERE (SELECT COALESCE(SUM(amount), 0) FROM wallet_tx WHERE uid = ?2) >= ?10`)
      .bind(idD, from, sentType, -units, to, ref, meta, "out:" + idem, now, units),
    env.DB.prepare(`${W_TX_INSERT} SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9 WHERE EXISTS (SELECT 1 FROM wallet_tx WHERE id = ?10)`)
      .bind(idC, to, recvType, units, from, ref, meta, "in:" + from + ":" + idem, now, idD)
  ]);
  return changed(results[0]) === 1 && changed(results[1]) === 1 ? { debitId: idD, creditId: idC } : null;
}

async function walletRefund(env, orderId, uid, units, now) {
  const results = await env.DB.batch([
    env.DB.prepare(`${W_TX_INSERT} SELECT ?1, ?2, 'refund', ?3, NULL, ?4, NULL, ?5, ?6 WHERE EXISTS (SELECT 1 FROM wallet_orders WHERE id = ?4 AND status = 'paid')`)
      .bind(crypto.randomUUID(), uid, units, orderId, "refund:" + orderId, now),
    env.DB.prepare(`UPDATE wallet_orders SET status = 'refunded' WHERE id = ?1 AND status = 'paid'`).bind(orderId)
  ]);
  return changed(results[0]) === 1;
}

async function walletRankBonuses(env, uid, cfg, now) {
  const row = await first(env, `SELECT COALESCE(-SUM(amount), 0) AS s FROM wallet_tx WHERE uid = ?1 AND type IN ('gift_sent', 'talent_sent')`, uid);
  const sent = row ? row.s : 0;
  for (const r of cfg.ranks) {
    const bonus = Math.round(r.bonus * AST_UNITS);
    if (bonus > 0 && sent >= Math.round(r.min * AST_UNITS)) {
      await run(env, `INSERT OR IGNORE INTO wallet_tx (id, uid, type, amount, peer, ref, meta, idem, created_at) VALUES (?1, ?2, 'bonus', ?3, NULL, ?4, NULL, ?5, ?6)`,
        crypto.randomUUID(), uid, bonus, r.name, "rank:" + r.name, now).catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

const W_FILTERS = {
  topup: ["topup"],
  received: ["gift_received", "talent_received", "refund", "bonus"],
  sent: ["gift_sent", "talent_sent"],
  gifts: ["gift_sent", "gift_received", "talent_sent", "talent_received"],
  services: ["service_verification", "service_premium", "service_ads", "service_boost", "refund"]
};

async function walletHealOrders(env, user, now) {
  const rows = (await env.DB.prepare(`SELECT id, units, created_at FROM wallet_orders WHERE uid = ?1 AND service = 'verification' AND status = 'paid' AND created_at < ?2 LIMIT 3`).bind(user.sub, now - 60 * 1000).all()).results || [];
  for (const o of rows) {
    try {
      await walletSetVerified(env, user.sub);
      await run(env, `UPDATE wallet_orders SET status = 'fulfilled' WHERE id = ?1 AND status = 'paid'`, o.id);
    } catch (_) {
      if (now - o.created_at > 15 * 60 * 1000) await walletRefund(env, o.id, user.sub, o.units, now).catch(() => {});
    }
  }
}

async function walletSummary(env, user, cfg, now) {
  await walletHealOrders(env, user, now).catch(() => {});
  const types = (await env.DB.prepare(`SELECT type, COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total FROM wallet_tx WHERE uid = ?1 GROUP BY type`).bind(user.sub).all()).results || [];
  const by = {};
  types.forEach((t) => { by[t.type] = t; });
  const g = (t) => by[t] || { n: 0, total: 0 };
  const balance = types.reduce((a, t) => a + t.total, 0);
  const w7 = await first(env, `SELECT COALESCE(SUM(amount), 0) AS s FROM wallet_tx WHERE uid = ?1 AND created_at >= ?2`, user.sub, now - 7 * W_DAY_MS);
  const sentUnits = -(g("gift_sent").total + g("talent_sent").total);
  const sub = await first(env, `SELECT plan, expires_at FROM wallet_subscriptions WHERE uid = ?1`, user.sub);
  const promos = (await env.DB.prepare(`SELECT id, kind, target_kind, target_id, target_title, ends_at FROM wallet_promotions WHERE uid = ?1 AND ends_at > ?2 ORDER BY ends_at DESC LIMIT 20`).bind(user.sub, now).all()).results || [];
  const admin = await isAdminMember(user.sub, user.token);
  return {
    success: true, scale: AST_UNITS, balance, last7: w7 ? w7.s : 0,
    giftsSent: g("gift_sent").n + g("talent_sent").n, giftsReceived: g("gift_received").n + g("talent_received").n,
    astSent: sentUnits, astReceived: g("gift_received").total + g("talent_received").total,
    rank: walletRank(cfg, sentUnits),
    premium: { active: !!sub && sub.expires_at > now, expiresAt: sub ? sub.expires_at : 0 },
    promotions: promos, admin, now
  };
}

async function walletHistory(env, user, url) {
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit")) || 20));
  const before = Number(url.searchParams.get("before")) || 0;
  const list = W_FILTERS[url.searchParams.get("filter") || ""] || null;
  const args = [user.sub];
  let sql = `SELECT id, type, amount, peer, ref, meta, created_at FROM wallet_tx WHERE uid = ?1`;
  if (list) { sql += ` AND type IN (${list.map((_, i) => "?" + (args.length + 1 + i)).join(",")})`; list.forEach((t) => args.push(t)); }
  if (before) { sql += ` AND created_at < ?${args.length + 1}`; args.push(before); }
  sql += ` ORDER BY created_at DESC, id DESC LIMIT ${limit + 1}`;
  const rows = (await env.DB.prepare(sql).bind(...args).all()).results || [];
  const more = rows.length > limit;
  return { success: true, scale: AST_UNITS, items: rows.slice(0, limit), more };
}

async function walletAnalytics(env, user, now) {
  const since = now - 14 * W_DAY_MS;
  const daily = (await env.DB.prepare(`SELECT CAST(created_at / 86400000 AS INTEGER) AS d, SUM(amount) AS net, SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS inflow, SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS outflow FROM wallet_tx WHERE uid = ?1 AND created_at >= ?2 GROUP BY d ORDER BY d`).bind(user.sub, since).all()).results || [];
  const cats = (await env.DB.prepare(`SELECT type, COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total FROM wallet_tx WHERE uid = ?1 GROUP BY type`).bind(user.sub).all()).results || [];
  return { success: true, scale: AST_UNITS, today: Math.floor(now / W_DAY_MS), daily, categories: cats };
}

async function walletLookup(env, user, url, now) {
  const email = String(url.searchParams.get("email") || "").trim().toLowerCase();
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email) || email.length > 254) throw walletBad("BAD_EMAIL", "Enter a valid email address.");
  await walletRateLimit(env, "lookup:" + user.sub, 20, 3600 * 1000, now);
  let uid = "";
  try {
    pushConfig(env);
    const access = await fcmAccessToken(env);
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:lookup`, {
      method: "POST", headers: { Authorization: "Bearer " + access, "Content-Type": "application/json" }, body: JSON.stringify({ email: [email] })
    });
    if (!response.ok) throw new Error("lookup");
    const data = await response.json().catch(() => ({}));
    uid = data && data.users && data.users[0] && data.users[0].localId || "";
  } catch (_) {
    throw walletBad("EMAIL_SEARCH_UNAVAILABLE", "Email search is not available right now. Please search by username.", 503);
  }
  const profile = uid ? await fsDoc(`publicProfiles/${encodeURIComponent(uid)}`, user.token) : null;
  if (!uid || !profile || uid === user.sub) throw walletBad("MEMBER_NOT_FOUND", "No member found with this email address.", 404);
  return { success: true, member: { uid, username: fsStr(profile, "username"), photoURL: fsStr(profile, "photoURL"), verified: fsBool(profile, "verified") } };
}

async function walletGift(env, user, body, cfg, now) {
  const to = String(body.toUid || ""), idem = String(body.idem || ""), units = walletUnits(body.amount);
  const talent = body.kind === "talent";
  if (!W_UID_RE.test(to) || !W_IDEM_RE.test(idem)) throw walletBad("BAD_REQUEST", "Invalid request.");
  if (to === user.sub) throw walletBad("SELF_GIFT", "You cannot send a gift to yourself.");
  const min = Math.round(cfg.gift.min * AST_UNITS), max = Math.round(cfg.gift.max * AST_UNITS);
  if (!units || units < min || units > max) throw walletBad("BAD_AMOUNT", `Enter an amount between ${cfg.gift.min} and ${cfg.gift.max} AST.`);
  const postId = body.postId && W_POST_RE.test(String(body.postId)) ? String(body.postId) : "";
  const sentType = talent ? "talent_sent" : "gift_sent", recvType = talent ? "talent_received" : "gift_received";

  const dup = await first(env, `SELECT id, created_at FROM wallet_tx WHERE uid = ?1 AND idem = ?2`, user.sub, "out:" + idem);
  if (dup) return { success: true, duplicate: true, balance: await walletBalance(env, user.sub) };

  const profile = await fsDoc(`publicProfiles/${encodeURIComponent(to)}`, user.token);
  if (!profile) throw walletBad("MEMBER_NOT_FOUND", "This member could not be found.", 404);
  if (cfg.gift.verifiedOnly && !fsBool(profile, "verified")) throw walletBad("RECEIVER_NOT_VERIFIED", "Only verified members can receive AST gifts.", 403);
  await walletRateLimit(env, "gift:" + user.sub, 30, 3600 * 1000, now);

  let ok = null;
  try {
    ok = await walletTransfer(env, user.sub, to, units, sentType, recvType, postId || null, JSON.stringify(postId ? { postId } : {}), idem, now);
  } catch (e) {
    if (walletIsUnique(e)) return { success: true, duplicate: true, balance: await walletBalance(env, user.sub) };
    throw e;
  }
  if (!ok) throw walletBad("INSUFFICIENT_FUNDS", "You do not have enough AST in your wallet.", 402);
  await walletRankBonuses(env, user.sub, cfg, now).catch(() => {});
  const who = String(user.claims && user.claims.name || "A member").slice(0, 40);
  await walletNotify(env, to, talent ? "You received a Talent Gift" : "You received an AST gift", `${who} sent you ${walletAstText(units)} AST.`);
  return { success: true, balance: await walletBalance(env, user.sub), units };
}

async function walletTopupCreate(env, user, body, cfg, url, now) {
  const method = String(body.method || ""), m = cfg.methods[method];
  if (!m || m.enabled === false || !m.address) throw walletBad("METHOD_UNAVAILABLE", "This payment method is not available yet.");
  const coin = String(body.coin || "");
  if (m.coins.indexOf(coin) < 0) throw walletBad("BAD_COIN", "Choose a coin supported by this payment method.");
  const coinAmount = String(body.coinAmount === undefined ? "" : body.coinAmount).trim();
  if (!/^\d{1,9}(\.\d{1,8})?$/.test(coinAmount) || !(Number(coinAmount) > 0)) throw walletBad("BAD_AMOUNT", "Enter the amount you sent.");
  const hash = String(body.txHash || "").trim();
  if (!/^[A-Za-z0-9:_.\-]{10,200}$/.test(hash)) throw walletBad("BAD_HASH", "Enter a valid transaction hash.");
  const account = String(body.accountName || "").trim();
  if (account.length < 2 || account.length > 100) throw walletBad("BAD_ACCOUNT", "Enter the account name you used on the exchange.");
  const shot = String(body.screenshotUrl || "");
  if (shot.length > 500 || shot.indexOf(`${url.origin}/media/${user.sub}/`) !== 0) throw walletBad("BAD_SCREENSHOT", "Please upload a screenshot of your payment.");
  const idem = String(body.idem || "");
  if (!W_IDEM_RE.test(idem)) throw walletBad("BAD_REQUEST", "Invalid request.");

  const dup = await first(env, `SELECT id, status FROM wallet_topups WHERE uid = ?1 AND idem = ?2`, user.sub, idem);
  if (dup) return { success: true, duplicate: true, id: dup.id, status: dup.status };
  const pending = await first(env, `SELECT COUNT(*) AS n FROM wallet_topups WHERE uid = ?1 AND status = 'pending'`, user.sub);
  if (pending && pending.n >= 5) throw walletBad("TOO_MANY_PENDING", "You already have several top-up requests waiting for review. Please wait for an administrator.", 429);

  const profile = await fsDoc(`publicProfiles/${encodeURIComponent(user.sub)}`, user.token);
  const username = (profile && fsStr(profile, "username")) || String(user.claims && user.claims.name || "").trim() || String(user.claims && user.claims.email || "").split("@")[0] || "Member";
  const email = String(user.claims && user.claims.email || "").slice(0, 254);
  const id = crypto.randomUUID();
  try {
    await run(env, `INSERT INTO wallet_topups (id, uid, idem, username, email, method, coin, coin_amount, tx_hash, tx_hash_lc, account_name, screenshot_url, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'pending', ?13)`,
      id, user.sub, idem, username.slice(0, 60), email, method, coin, coinAmount, hash, hash.toLowerCase(), account, shot, now);
  } catch (e) {
    if (walletIsUnique(e)) throw walletBad("DUPLICATE_HASH", "This transaction hash has already been submitted.", 409);
    throw e;
  }
  return { success: true, id, status: "pending" };
}

async function walletBuy(env, user, body, cfg, now) {
  const service = String(body.service || ""), idem = String(body.idem || "");
  if (["verification", "premium", "ads", "boost"].indexOf(service) < 0 || !W_IDEM_RE.test(idem)) throw walletBad("BAD_REQUEST", "Invalid request.");

  const dup = await first(env, `SELECT id FROM wallet_tx WHERE uid = ?1 AND idem = ?2`, user.sub, "buy:" + idem);
  if (dup) return { success: true, duplicate: true, balance: await walletBalance(env, user.sub) };

  let units = 0, days = 0, pkgId = null, tKind = null, tId = null, tTitle = null;
  if (service === "verification") {
    units = Math.round(cfg.prices.verification * AST_UNITS);
    if (await isVerifiedMember(user.sub, user.token)) throw walletBad("ALREADY_VERIFIED", "Your account is already verified.", 409);
    const profile = await fsDoc(`publicProfiles/${encodeURIComponent(user.sub)}`, user.token);
    if (!profile) throw walletBad("PROFILE_REQUIRED", "Please complete your public profile before getting verified.", 403);
    if (fsBool(profile, "verified")) throw walletBad("ALREADY_VERIFIED", "Your account is already verified.", 409);
    const need = cfg.verification.minFollowers;
    if (need > 0) {
      const have = await walletFollowerCount(user.token, user.sub);
      if (have < need) throw walletBad("REQUIREMENTS_NOT_MET", `You need at least ${need} followers to get verified. You have ${have}.`, 403);
    }
  } else if (service === "premium") {
    units = Math.round(cfg.prices.premium.ast * AST_UNITS); days = cfg.prices.premium.days; pkgId = "premium";
  } else {
    const pkg = cfg.prices[service].filter((p) => p.id === String(body.packageId || ""))[0];
    if (!pkg) throw walletBad("BAD_PACKAGE", "Choose a package.");
    units = Math.round(pkg.ast * AST_UNITS); days = pkg.days; pkgId = pkg.id;
    if (body.targetKind === "profile") {
      tKind = "profile"; tId = user.sub; tTitle = "My profile";
    } else {
      const pid = String(body.targetId || "");
      if (!W_POST_RE.test(pid)) throw walletBad("BAD_TARGET", "Choose what you want to promote.");
      const post = await fsDoc(`posts/${encodeURIComponent(pid)}`, user.token);
      if (!post || fsStr(post, "uid") !== user.sub) throw walletBad("BAD_TARGET", "You can only promote your own posts.", 403);
      if (fsStr(post, "visibility") === "private") throw walletBad("BAD_TARGET", "Private posts cannot be promoted.");
      tKind = "post"; tId = pid; tTitle = (fsStr(post, "title") || fsStr(post, "linkTitle") || fsStr(post, "text") || "Post").replace(/\s+/g, " ").trim().slice(0, 80);
    }
  }
  if (!units) throw walletBad("PRICE_NOT_SET", "This service is not available right now.");

  const orderId = crypto.randomUUID(), debitId = crypto.randomUUID();
  const status = service === "verification" ? "paid" : "fulfilled";
  const stmts = [
    env.DB.prepare(`${W_TX_INSERT} SELECT ?1, ?2, ?3, ?4, NULL, ?5, ?6, ?7, ?8 WHERE (SELECT COALESCE(SUM(amount), 0) FROM wallet_tx WHERE uid = ?2) >= ?9`)
      .bind(debitId, user.sub, "service_" + service, -units, orderId, JSON.stringify({ package: pkgId, target: tId }), "buy:" + idem, now, units),
    env.DB.prepare(`INSERT INTO wallet_orders (id, uid, service, package, units, target_kind, target_id, target_title, status, created_at) SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10 WHERE EXISTS (SELECT 1 FROM wallet_tx WHERE id = ?11)`)
      .bind(orderId, user.sub, service, pkgId, units, tKind, tId, tTitle, status, now, debitId)
  ];
  if (service === "premium") {
    stmts.push(env.DB.prepare(`INSERT INTO wallet_subscriptions (uid, plan, expires_at) SELECT ?1, 'premium', ?2 WHERE EXISTS (SELECT 1 FROM wallet_orders WHERE id = ?5) ON CONFLICT(uid) DO UPDATE SET expires_at = (CASE WHEN wallet_subscriptions.expires_at > ?3 THEN wallet_subscriptions.expires_at ELSE ?3 END) + ?4`)
      .bind(user.sub, now + days * W_DAY_MS, now, days * W_DAY_MS, orderId));
  } else if (service === "ads" || service === "boost") {
    stmts.push(env.DB.prepare(`INSERT INTO wallet_promotions (id, uid, kind, target_kind, target_id, target_title, starts_at, ends_at, order_id) SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9 WHERE EXISTS (SELECT 1 FROM wallet_orders WHERE id = ?9)`)
      .bind(crypto.randomUUID(), user.sub, service, tKind, tId, tTitle, now, now + days * W_DAY_MS, orderId));
  }
  let results;
  try { results = await env.DB.batch(stmts); }
  catch (e) {
    if (walletIsUnique(e)) return { success: true, duplicate: true, balance: await walletBalance(env, user.sub) };
    throw e;
  }
  if (changed(results[0]) !== 1) throw walletBad("INSUFFICIENT_FUNDS", "You do not have enough AST in your wallet.", 402);

  if (service === "verification") {
    try {
      await walletSetVerified(env, user.sub);
      await run(env, `UPDATE wallet_orders SET status = 'fulfilled' WHERE id = ?1 AND status = 'paid'`, orderId);
    } catch (e) {
      await walletRefund(env, orderId, user.sub, units, Date.now()).catch(() => {});
      throw walletBad("VERIFY_FAILED", "We could not activate your Verified Badge, so your AST has been returned to your wallet. Please make sure your public profile is complete, then try again.", 502);
    }
  }
  return { success: true, service, orderId, balance: await walletBalance(env, user.sub), days };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

async function walletAdminList(env, url) {
  const status = String(url.searchParams.get("status") || "pending");
  const where = ["pending", "approved", "rejected"].indexOf(status) >= 0 ? `WHERE status = '${status}'` : "";
  const rows = (await env.DB.prepare(`SELECT id, uid, username, email, method, coin, coin_amount, tx_hash, account_name, screenshot_url, status, ast_units, note, reviewed_by, reviewed_at, created_at FROM wallet_topups ${where} ORDER BY created_at DESC LIMIT 60`).all()).results || [];
  const pending = await first(env, `SELECT COUNT(*) AS n FROM wallet_topups WHERE status = 'pending'`);
  const supply = await first(env, `SELECT COALESCE(SUM(amount), 0) AS s FROM wallet_tx`);
  return { success: true, scale: AST_UNITS, items: rows, pending: pending ? pending.n : 0, circulation: supply ? supply.s : 0 };
}

async function walletAdminDecide(env, admin, body, now) {
  const id = String(body.id || ""), decision = String(body.decision || "");
  if (!/^[0-9a-f-]{36}$/.test(id)) throw walletBad("BAD_REQUEST", "Invalid request.");
  const note = String(body.note || "").trim().slice(0, 300);
  const req = await first(env, `SELECT uid, status FROM wallet_topups WHERE id = ?1`, id);
  if (!req) throw walletBad("NOT_FOUND", "Request not found.", 404);
  if (req.status !== "pending") throw walletBad("ALREADY_DONE", "This request has already been reviewed.", 409);

  if (decision === "approve") {
    const units = walletUnits(body.astAmount);
    if (!units || units > 1000000 * AST_UNITS) throw walletBad("BAD_AMOUNT", "Enter the AST amount to add (for example 25 or 25.50).");
    const results = await env.DB.batch([
      env.DB.prepare(`${W_TX_INSERT} SELECT ?1, uid, 'topup', ?2, NULL, ?3, ?4, ?5, ?6 FROM wallet_topups WHERE id = ?3 AND status = 'pending'`)
        .bind(crypto.randomUUID(), units, id, JSON.stringify({ by: admin.sub, self: req.uid === admin.sub }), "topup:" + id, now),
      env.DB.prepare(`UPDATE wallet_topups SET status = 'approved', ast_units = ?2, note = ?3, reviewed_by = ?4, reviewed_at = ?5 WHERE id = ?1 AND status = 'pending'`)
        .bind(id, units, note, admin.sub, now)
    ]);
    if (changed(results[0]) !== 1) throw walletBad("ALREADY_DONE", "This request has already been reviewed.", 409);
    await walletNotify(env, req.uid, "Top-up approved", `${walletAstText(units)} AST was added to your wallet.`);
    return { success: true, status: "approved", units };
  }
  if (decision === "reject") {
    const res = await run(env, `UPDATE wallet_topups SET status = 'rejected', note = ?2, reviewed_by = ?3, reviewed_at = ?4 WHERE id = ?1 AND status = 'pending'`, id, note, admin.sub, now);
    if (changed(res) !== 1) throw walletBad("ALREADY_DONE", "This request has already been reviewed.", 409);
    await walletNotify(env, req.uid, "Top-up not approved", note || "Your payment could not be verified. Please check your details and try again.");
    return { success: true, status: "rejected" };
  }
  throw walletBad("BAD_REQUEST", "Invalid request.");
}

// ---------------------------------------------------------------------------
// Router for /wallet/*
// ---------------------------------------------------------------------------

async function handleWallet(request, env, url, origin, corsHeaders) {
  if (!ALLOWED_ORIGINS.includes(origin)) return fail("ORIGIN_NOT_ALLOWED", "This action is not allowed from this website.", 403, corsHeaders);
  const user = await authenticate(request, env);
  await walletSchema(env);
  const now = Date.now(), path = url.pathname, get = request.method === "GET", post = request.method === "POST";
  const body = async () => { try { const b = await request.json(); return b && typeof b === "object" ? b : {}; } catch (_) { throw walletBad("BAD_REQUEST", "Invalid request."); } };
  const needAdmin = async () => { if (!(await isAdminMember(user.sub, user.token))) throw walletBad("NOT_ADMIN", "Administrators only.", 403); };

  if (get && path === "/wallet/summary") return json(await walletSummary(env, user, await walletConfig(env), now), 200, corsHeaders);
  if (get && path === "/wallet/config") { const cfg = await walletConfig(env); return json({ success: true, scale: AST_UNITS, config: cfg }, 200, corsHeaders); }
  if (get && path === "/wallet/history") return json(await walletHistory(env, user, url), 200, corsHeaders);
  if (get && path === "/wallet/analytics") return json(await walletAnalytics(env, user, now), 200, corsHeaders);
  if (get && path === "/wallet/lookup") return json(await walletLookup(env, user, url, now), 200, corsHeaders);
  if (get && path === "/wallet/topups") {
    const rows = (await env.DB.prepare(`SELECT id, method, coin, coin_amount, tx_hash, status, ast_units, note, created_at, reviewed_at FROM wallet_topups WHERE uid = ?1 ORDER BY created_at DESC LIMIT 20`).bind(user.sub).all()).results || [];
    return json({ success: true, scale: AST_UNITS, items: rows }, 200, corsHeaders);
  }
  if (get && path === "/wallet/promotions/active") {
    const rows = (await env.DB.prepare(`SELECT kind, target_kind, target_id, ends_at FROM wallet_promotions WHERE ends_at > ?1 ORDER BY ends_at DESC LIMIT 100`).bind(now).all()).results || [];
    return json({ success: true, items: rows }, 200, corsHeaders);
  }

  if (post && path === "/wallet/gift") return json(await walletGift(env, user, await body(), await walletConfig(env), now), 200, corsHeaders);
  if (post && path === "/wallet/topup") return json(await walletTopupCreate(env, user, await body(), await walletConfig(env), url, now), 201, corsHeaders);
  if (post && path === "/wallet/buy") return json(await walletBuy(env, user, await body(), await walletConfig(env), now), 200, corsHeaders);

  if (get && path === "/wallet/admin/topups") { await needAdmin(); return json(await walletAdminList(env, url), 200, corsHeaders); }
  if (post && path === "/wallet/admin/decide") { await needAdmin(); return json(await walletAdminDecide(env, user, await body(), now), 200, corsHeaders); }
  if (post && path === "/wallet/admin/config") {
    await needAdmin();
    const cfg = walletSanitizeConfig(await body(), await walletConfig(env));
    await run(env, `INSERT INTO wallet_config (key, value) VALUES ('main', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, JSON.stringify(cfg));
    return json({ success: true, config: cfg }, 200, corsHeaders);
  }
  return fail("NOT_FOUND", "Not found.", 404, corsHeaders);
}
