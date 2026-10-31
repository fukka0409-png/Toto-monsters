// トトと魔物たち：ランク戦の順位をサーバーで1回だけ決める（2026-10-30）
// 毎日ランク戦が終わったあと（Cloud Scheduler から呼ばれる）に、終わったランク戦の最終順位を rankres/{シーズン} に書く。
// ゲームの画面は、自分で順位を計算しないで、この結果を使って精算する（電波・古い画面・2つの画面でずれないように）
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

// ---- ゲームと同じきまり（index.html と同じ数字） ----
const HOUR_MS = 3600e3, DAY_MS = 24 * HOUR_MS, JST = 9 * HOUR_MS, SEASON_SHIFT = 2 * HOUR_MS;
const SEASON_DAYS = 1, SEASON_DAY0 = 20743;
const LOSE_LV = 2, DRAW_LV = 2, WIN_LV = 4, BOMB_LV = 2;
const EMPTY_STEP_MS = 30 * 60 * 1000;
const RANK_FIX = { 11: { "love": 3, "ｄｒａｇｏｎ": 4 }, 12: { "love": 2 }, 13: { "love": 2 } };   // 運営が決めた順位（index.html と同じ）
const seasonNow = (t = Date.now()) => Math.floor((Math.floor((t + JST + SEASON_SHIFT) / DAY_MS) - SEASON_DAY0) / SEASON_DAYS);
const seasonEnd = s => (SEASON_DAY0 + SEASON_DAYS * (s + 1)) * DAY_MS - JST - SEASON_SHIFT;
const normName = t => String(t || "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");
const emptyDropFor = ms => Math.floor(ms / EMPTY_STEP_MS);

function seasonScore(p, s, now) {
  if (p.sv && p.sv[s] != null) return p.sv[s];
  if ((p.ss ?? 0) !== s) return null;
  let lv = p.lv || 1, exp = p.exp || 0;
  if (!p.gm && p.ge && p.pub) { const t = Math.min(now, seasonEnd(s)); const h = Math.floor((t - p.pub) / HOUR_MS); if (h > 0) { lv = Math.max(1, lv - emptyDropFor(t - p.pub)); exp = 0; } }
  return lv * 1e6 + exp;
}
function finalScore(id, p, s, ev, ticks, now) {
  const base = seasonScore(p, s, now); if (base == null) return null;
  if (p.sv && p.sv[s] != null) return base;
  let lv = Math.floor(base / 1e6), exp = base % 1e6, ch = false;
  const tl = ticks.filter(t => t.at > (p.pub || 0) && (t.t10 || []).includes(id)).length; if (tl) { lv += tl; ch = true; }
  for (const e of ev) { if (e.def !== id || e.at <= (p.pub || 0)) continue;
    if (e.k === "bomb") { lv = Math.max(1, Math.min(lv, Math.max(Math.floor(lv / 10) * 10, lv - BOMB_LV * Math.max(1, e.qty || 1)))); ch = true; }
    else if (e.result === "att") { lv = Math.max(1, Math.min(lv, Math.max(Math.floor(lv / 10) * 10, lv - LOSE_LV))); ch = true; }
    else if (e.result === "def") { lv += WIN_LV; ch = true; }
    else if (e.result === "draw") { lv = Math.max(1, Math.min(lv, Math.max(Math.floor(lv / 10) * 10, lv - DRAW_LV))); ch = true; } }
  return lv * 1e6 + (ch ? 0 : exp);
}

async function settle(ss, force) {
  const ref = db.doc("rankres/" + ss);
  if (!force) { const ex = await ref.get(); if (ex.exists) return { ss, skipped: true }; }
  const now = Date.now(), from = seasonEnd(ss - 1), to = seasonEnd(ss);
  const [pq, bq, tq] = await Promise.all([
    db.collection("profiles").get(),
    db.collection("battles").where("at", ">=", from).get(),
    db.collection("ticks").where("ss", "==", ss).get()]);
  const ev = bq.docs.map(d => ({ ...d.data(), k: "battle" })).filter(e => e.at < to).sort((a, b) => a.at - b.at);
  const ticks = tq.docs.map(d => d.data());
  const fix = RANK_FIX[ss] || {}, fixOf = name => { const k = Object.keys(fix).find(k => normName(k) === normName(name)); return k != null ? fix[k] : null; };
  const L = [];
  pq.docs.forEach(d => { const p = d.data(), fx = fixOf(p.name); const sc = finalScore(d.id, p, ss, ev, ticks, now);
    if (fx != null) L.push({ id: d.id, name: p.name || "", sc: sc ?? 0, fx });
    else if (sc != null) L.push({ id: d.id, name: p.name || "", sc }); });
  // 順位：自分より点が高い人の数＋1（同じ点は同じ順位）。運営が決めた順位の人は、その位置に入れて、ほかの人を1つずつ下げる
  const free = L.filter(x => x.fx == null), fixedVals = Object.values(fix).sort((a, b) => a - b);
  const r = {}, sc = {};
  free.forEach(x => { let k = 1 + free.filter(o => o.sc > x.sc).length; fixedVals.forEach(v => { if (v <= k) k++; }); r[x.id] = k; sc[x.id] = x.sc; });
  L.filter(x => x.fx != null).forEach(x => { r[x.id] = x.fx; sc[x.id] = x.sc; });
  // 貯金ランキング（精算の前の貯金でくらべる。もう税で減った人は減る前の貯金 bkp）
  const bks = pq.docs.map(d => { const p = d.data(); const v = (p.bkpS === ss && p.bkp != null) ? p.bkp : (p.bk || 0); return { id: d.id, v }; }).filter(x => x.v > 0);
  const bk = {}; bks.forEach(x => { bk[x.id] = 1 + bks.filter(o => o.v > x.v).length; });
  const top = Object.keys(r).sort((a, b) => r[a] - r[b]).slice(0, 10).map(id => ({ id, r: r[id], name: (L.find(x => x.id === id) || {}).name, sc: sc[id] }));
  await ref.set({ ss, at: now, n: Object.keys(r).length, r, sc, bk, top, fix, fx: L.filter(x => x.fx != null).map(x => x.id) });   // fix・fx：運営が決めた順位（画面がくらべて、ちがっていたら使わない）
  return { ss, n: Object.keys(r).length, top: top.slice(0, 3) };
}

// Cloud Scheduler から呼ばれる（?ss=13 で指定もできる。?force=1 で作り直し）
exports.rankSettle = async (req, res) => {
  try {
    const cur = seasonNow();
    const ss = req.query && req.query.ss != null ? Math.floor(+req.query.ss) : cur - 1;
    if (!(ss >= 0 && ss < cur)) return res.status(400).send("まだ終わっていないランク戦です");
    const out = await settle(ss, !!(req.query && req.query.force));
    res.json(out);
  } catch (e) { console.error(e); res.status(500).send(String(e && e.message || e)); }
};
