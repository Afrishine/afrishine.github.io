// Afrishine Security Solutions - plan maths (pure functions, no I/O). Unit-tested in test/sec-plan.test.js
// All money is whole RWF. All PV are whole numbers.
const DEFAULTS = {
  pvValue: 10000,            // 1 PV = 10,000 RWF
  refPct: [10, 5, 2],        // referral commission, level 1 / 2 / 3 (percent of the confirmed order value)
  matchPct: 7,               // binary matching bonus (percent of matched PV value)
  dailyCap: 0,               // max matching bonus per member per day in RWF (0 = no cap)
  minWithdraw: 5000,
  // category -> [[minimum price, PV], ...]; the highest tier whose minimum price the product reaches wins
  tiers: {
    cctv: [[80000, 1], [150000, 2], [350000, 5]],
    phone: [[80000, 1], [150000, 2], [350000, 5]],
    tv: [[120000, 1], [200000, 2]],
    computer: [[150000, 2], [300000, 5]]
  }
};
function mergeConfig(c) {
  c = c || {};
  let tiers = DEFAULTS.tiers;
  if (c.tiers) { try { tiers = typeof c.tiers === 'string' ? JSON.parse(c.tiers) : c.tiers; } catch (e) { tiers = DEFAULTS.tiers; } }
  const n = (v, d) => (v === undefined || v === null || v === '' || isNaN(Number(v))) ? d : Number(v);
  return {
    pvValue: n(c.pvValue, DEFAULTS.pvValue),
    refPct: [n(c.ref1, DEFAULTS.refPct[0]), n(c.ref2, DEFAULTS.refPct[1]), n(c.ref3, DEFAULTS.refPct[2])],
    matchPct: n(c.matchPct, DEFAULTS.matchPct),
    dailyCap: n(c.dailyCap, DEFAULTS.dailyCap),
    minWithdraw: n(c.minWithdraw, DEFAULTS.minWithdraw),
    tiers: tiers
  };
}
function pvFor(price, category, tiers) {
  const list = (tiers && tiers[category]) || [];
  let pv = 0;
  for (const t of list) if (price >= t[0] && t[1] > pv) pv = t[1];
  return pv;
}
// Referral commission for each level, from the confirmed order value
function referralAmounts(total, refPct) { return refPct.map((p) => Math.floor(total * p / 100)); }
// Binary matching: the weaker leg is used up completely, the rest stays on the stronger leg (carry-forward)
function matching(leftBal, rightBal, cfg) {
  const matched = Math.max(0, Math.min(leftBal, rightBal));
  let bonus = Math.floor(matched * cfg.pvValue * cfg.matchPct / 100);
  let capped = false;
  if (cfg.dailyCap > 0 && bonus > cfg.dailyCap) { bonus = cfg.dailyCap; capped = true; }
  return { matched, bonus, capped, leftAfter: leftBal - matched, rightAfter: rightBal - matched };
}
module.exports = { DEFAULTS, mergeConfig, pvFor, referralAmounts, matching };
