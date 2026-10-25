/* ===================== トトの戦略（試作・まだ公開しない） =====================
   ① 準備（3分）：赤いマスの中に、図鑑で解放した魔物を置く（魔物ごとに大きさがある・合わせて20体まで）
      マスははじめ横10×縦5。横は最大30・縦は最大40。1列ふやすごとに10万コイン
      魔物を置くのにかかるコイン＝その魔物の売却価格の5倍（取り除いてもコインはもどらない）
   ② 準備完了 → ほかの冒険者の配置（いなければCPU）とバトル（1分）。魔物は自動で動く
      勝ち：相手の魔物をぜんぶ倒す。1分で決まらなければ、のこった体力ゲージの合計が多いほうの勝ち
   ・二本指で拡大・縮小（1本指でドラッグすると画面を動かせる）
   ・攻撃力と体力は、図鑑の全冒険者の獲得数で決まる（売却価格と同じ。めずらしい魔物ほど強い）
   ・移動の速さ・攻撃のとどく距離・大きさ・空を飛ぶかは TS_MON で魔物ごとに決められる（なければランクのきまり）
   データ：S.ts = { cols, rows, units:[{u,id,c,r}] }。Firestore tsp/{uid} に準備完了した配置を保存（相手として使う） */
(function(){
const T = (ja,en) => (typeof LANG!=="undefined" && LANG==="en") ? en : ja;
const esc3 = t => String(t??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = n => Math.round(n).toLocaleString();
const now = () => (typeof gnow==="function" ? gnow() : Date.now());

const TS = { COLS0:10, ROWS0:5, COLS_MAX:30, ROWS_MAX:40, EXPAND_COST:100000, MAX_UNITS:20, COST_MUL:5,
  PREP_MS:3*60000, BATTLE_MS:60000, CS:64, GAP:8 };
// ランクごとのきまり：w×h＝置くときのマスの大きさ、spd＝1秒に進むマス、range＝攻撃がとどく距離（マス）、cd＝攻撃の間かく（秒）
const TS_RANK = {
  C:{w:1,h:1,spd:1.1,range:0.6,cd:1.0}, B:{w:1,h:1,spd:1.0,range:0.8,cd:1.0}, A:{w:2,h:2,spd:0.9,range:1.0,cd:1.1},
  S:{w:2,h:2,spd:0.85,range:1.5,cd:1.1}, Z:{w:3,h:3,spd:0.7,range:2.0,cd:1.2}, L:{w:3,h:3,spd:0.7,range:2.2,cd:1.2} };
// 魔物ごとのきまり（ここに書いた魔物は、ランクのきまりより優先）。例：{ 42:{ fly:true, spd:1.4, range:3 } }
const TS_MON = {};
const cfgOf = id => { const m=mon(id); return Object.assign({fly:false}, TS_RANK[m&&m.rank]||TS_RANK.C, TS_MON[id]||{}); };
// 強さ：売却価格（＝図鑑の全冒険者の獲得数で決まる）から。めずらしいほど強い
const priceOf = id => { try{ const p=dexPrice(id); if(p!=null) return p; }catch(e){} try{ return sellPrice({m:id}); }catch(e){ return 10; } };
const statsOf = id => { const k=Math.pow(Math.max(1,priceOf(id)),0.35), c=cfgOf(id), sz=Math.sqrt(c.w*c.h); return { hp:Math.round(60*k*sz), atk:Math.max(1,Math.round(8*k)) }; };
const costOf = id => { let p=0; try{ p=sellPrice({m:id}); }catch(e){ p=priceOf(id); } return Math.max(1,Math.round(p*TS.COST_MUL)); };

const st = () => { S.ts=S.ts||{}; const t=S.ts; t.cols=t.cols||TS.COLS0; t.rows=t.rows||TS.ROWS0; t.units=(t.units||[]).filter(u=>mon(u.id)); t.nu=t.nu||1; return t; };
const IMGS={}; const imgOf = id => { if(!IMGS[id]){ const im=new Image(); const m=mon(id); im.src=m?m.img:""; IMGS[id]=im; } return IMGS[id]; };
const deco = (()=>{ const im=new Image(); im.src="adv/toto_s.png"; return im; })();
const grave = (()=>{ const im=new Image(); im.src="mb/grave.png"; return im; })();
function sfx(k){ try{ if(k==="tap") SFX.tap(); else if(k==="coin") SFX.coin(); else if(k==="ng") SFX.ng(); else if(k==="win") SFX.reveal("S"); else if(k==="level") SFX.level(); }catch(e){} }

/* ---------- 画面 ---------- */
const css=document.createElement("style");
css.textContent=`
#tso{position:fixed;inset:0;z-index:150;background:#7cc4f5;touch-action:none;user-select:none;-webkit-user-select:none;font-family:var(--f-body,sans-serif);overflow:hidden}
#tso canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
#tso .ts-top{position:absolute;left:0;right:0;top:0;display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:calc(env(safe-area-inset-top,0px) + 8px) max(10px,env(safe-area-inset-right,0px)) 0 max(10px,env(safe-area-inset-left,0px));pointer-events:none}
#tso .ts-top>*{pointer-events:auto}
#tso .ts-b{border:3px solid #3a2306;border-radius:10px;background:#fff8e8;color:#3a2306;font:900 13px/1.2 var(--f-body,sans-serif);padding:6px 10px;cursor:pointer;box-shadow:0 3px 0 #3a2306}
#tso .ts-b:active{transform:translateY(2px);box-shadow:0 1px 0 #3a2306}
#tso .ts-b:disabled{opacity:.5;cursor:default}
#tso .ts-timer{background:#3a3a3aee;color:#fff;border:3px solid #111;border-radius:6px;padding:4px 14px 6px;text-align:center;min-width:120px}
#tso .ts-timer small{display:block;font:700 11px/1.2 var(--f-body,sans-serif);text-align:left;opacity:.9}
#tso .ts-timer b{font:900 24px/1.1 var(--f-body,sans-serif);font-variant-numeric:tabular-nums}
#tso .ts-timer.low b{color:#ff8a6a}
#tso .ts-side{display:flex;flex-direction:column;gap:6px;align-items:flex-end}
#tso .ts-info{background:#0008;color:#fff;border-radius:8px;padding:4px 8px;font:700 11px/1.4 var(--f-body,sans-serif)}
#tso .ts-panel{position:absolute;left:0;right:0;bottom:0;height:min(34vh,calc((100vw - 12px)*270/1280));background:#b98a5f;display:flex;justify-content:center;padding-bottom:env(safe-area-inset-bottom,0px)}
#tso .ts-pin{position:relative;height:100%;aspect-ratio:1280/270;max-width:100%}
#tso .ts-pin img{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
#tso .ts-hit{position:absolute;background:transparent;border:0;padding:0;cursor:pointer;border-radius:8px}
#tso .ts-hit:active{background:#0002}
#tso .ts-coin{position:absolute;left:2%;top:33%;width:26.6%;height:42.6%;display:flex;align-items:center;justify-content:center;color:#ffd75e;font:900 clamp(13px,5.5vw,28px)/1 var(--f-body,sans-serif);font-variant-numeric:tabular-nums;pointer-events:none}
#tso .ts-msg{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 70px);transform:translateX(-50%);background:#000c;color:#fff;border-radius:10px;padding:8px 14px;font:900 13px/1.4 var(--f-body,sans-serif);pointer-events:none;opacity:0;transition:opacity .2s;text-align:center;max-width:86vw}
#tso .ts-msg.on{opacity:1}
#tso .ts-sel{position:absolute;display:flex;gap:6px;transform:translate(-50%,-100%);pointer-events:auto}
.ts-dlg{position:fixed;inset:0;z-index:170;display:grid;place-items:center;background:#0008;padding:16px}
.ts-dlg>div{background:#fff8e8;color:#3a2306;border:4px solid #3a2306;border-radius:16px;padding:14px;max-width:560px;width:100%;max-height:86vh;overflow:auto;text-align:center;font:14px/1.5 var(--f-body,sans-serif)}
.ts-dlg h3{margin:0 0 8px;font-size:17px}
.ts-dlg .row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:10px}
.ts-dlg .row button{border:3px solid #3a2306;border-radius:10px;background:#ffd75e;font:900 14px/1 var(--f-body,sans-serif);padding:10px 16px;cursor:pointer;color:#3a2306}
.ts-dlg .row button.g{background:#fff}
.ts-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px;text-align:left}
.ts-card{border:2px solid #d9bf8a;border-radius:10px;background:#fdf7e6;padding:6px;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;font:700 11px/1.35 var(--f-body,sans-serif);color:#3a2306}
.ts-card img{width:72px;height:72px;object-fit:contain;image-rendering:pixelated}
.ts-card b{font-size:12px;text-align:center}
.ts-card .c{color:#b5420e;font-weight:900}
.ts-card.no{opacity:.5}
`;
document.head.appendChild(css);

let V=null;   // 今の画面
function el(html){ const d=document.createElement("div"); d.innerHTML=html; return d.firstElementChild; }
function dlg(html, btns, opt){ const bg=el(`<div class="ts-dlg"><div>${html}${btns&&btns.length?`<div class="row">${btns.map((b,i)=>`<button type="button" data-i="${i}" class="${b[2]||""}">${b[0]}</button>`).join("")}</div>`:""}</div></div>`);
  document.body.appendChild(bg); bg.querySelectorAll("[data-i]").forEach(b=>b.onclick=()=>{ const f=btns[+b.dataset.i][1]; bg.remove(); if(f) f(); });
  if(!(opt&&opt.modal)) bg.onclick=e=>{ if(e.target===bg) bg.remove(); }; return bg; }
function msg(t){ const m=V&&V.root.querySelector(".ts-msg"); if(!m) return; m.textContent=t; m.classList.add("on"); clearTimeout(m._t); m._t=setTimeout(()=>m.classList.remove("on"),2400); }
function coinView(){ const c=V&&V.root.querySelector(".ts-coin"); if(c) c.textContent=fmt(S.coins||0); try{ renderCoins(); }catch(e){} }
const mmss = ms => { ms=Math.max(0,ms); const s=Math.ceil(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`; };

function openTS(){
  if(V) closeTS();
  try{ if(typeof loadDexStats==="function") loadDexStats(); }catch(e){}
  const root=el(`<div id="tso" role="dialog" aria-label="トトの戦略" translate="no"><canvas></canvas>
    <div class="ts-top"><button type="button" class="ts-b" id="tsX">← ${T("もどる","Back")}</button><div class="ts-timer" id="tsTm"><small id="tsTmL"></small><b id="tsTmV"></b></div><div class="ts-side" id="tsSide"></div></div>
    <div class="ts-msg"></div><div id="tsSel"></div>
    <div class="ts-panel" id="tsPanel"><div class="ts-pin"><img src="ts/panel.jpg" alt="">
      <div class="ts-coin"></div>
      <button type="button" class="ts-hit" id="tsAddM" style="left:34%;top:4%;width:31.4%;height:42%" aria-label="${T("魔物を追加","Add monster")}"></button>
      <button type="button" class="ts-hit" id="tsAddI" style="left:34%;top:50%;width:31.4%;height:46%" aria-label="${T("アイテムを追加","Add item")}"></button>
      <button type="button" class="ts-hit" id="tsGo" style="left:75.6%;top:5%;width:22.8%;height:90%" aria-label="${T("準備完了","Ready")}"></button>
    </div></div></div>`);
  document.body.appendChild(root);
  V={root, cv:root.querySelector("canvas"), mode:"prep", cam:{x:0,y:0,z:1}, ptr:new Map(), placing:null, sel:null, drag:null, prepEnd:now()+TS.PREP_MS, raf:0, last:0};
  V.ctx=V.cv.getContext("2d");
  root.querySelector("#tsX").onclick=()=>{ if(V&&V.mode==="battle") return dlg(`<p>${T("バトル中です。やめると負けになります。","You're in a battle. Leaving counts as a loss.")}</p>`,[[T("つづける","Keep playing"),null,"g"],[T("やめる","Leave"),()=>closeTS()]]); closeTS(); };
  root.querySelector("#tsAddM").onclick=()=>{ sfx("tap"); pickMonster(); };
  root.querySelector("#tsAddI").onclick=()=>{ sfx("tap"); dlg(`<h3>🧰 ${T("アイテム","Items")}</h3><p>${T("アイテムは準備中です。もうすぐ追加されます！","Items are coming soon!")}</p>`,[["OK",null]]); };
  root.querySelector("#tsGo").onclick=()=>{ sfx("tap"); readyGo(); };
  sideView(); coinView();
  resize(); fitPrep(); addEventListener("resize",resize);
  bindPointers();
  V.last=performance.now(); V.raf=requestAnimationFrame(loop);
  setTimeout(()=>msg(T("「魔物を追加」で魔物をえらんで、赤いマスに置こう。二本指で拡大・縮小できます","Pick a monster with “Add monster” and place it on the red grid. Pinch to zoom.")),400);
}
function closeTS(){ if(!V) return; cancelAnimationFrame(V.raf); removeEventListener("resize",resize); V.root.remove(); document.querySelectorAll(".ts-dlg").forEach(x=>x.remove()); V=null; }
window.openTS=openTS;
window.__tsW2S=(x,y)=>{ if(!V) return null; const p=w2s(x,y), r=V.cv.getBoundingClientRect(); return {x:r.left+p.x/V.dpr, y:r.top+p.y/V.dpr}; };   // テスト用

function sideView(){ const s=V&&V.root.querySelector("#tsSide"); if(!s) return; const t=st();
  if(V.mode!=="prep"){ s.innerHTML=V.B?`<div class="ts-info">${T("相手","Opponent")}：${esc3(V.B.enemyName)}</div>`:""; return; }
  s.innerHTML=`<div class="ts-info">${T("配置","Placed")} ${t.units.length}/${TS.MAX_UNITS}　${T("マス","Grid")} ${t.cols}×${t.rows}</div>
    <div style="display:flex;gap:6px"><button type="button" class="ts-b" id="tsEx" ${t.cols>=TS.COLS_MAX?"disabled":""}>${T("横+1","Width +1")}</button><button type="button" class="ts-b" id="tsEy" ${t.rows>=TS.ROWS_MAX?"disabled":""}>${T("縦+1","Height +1")}</button></div>`;
  s.querySelector("#tsEx").onclick=()=>expand("c"); s.querySelector("#tsEy").onclick=()=>expand("r"); }
function expand(k){ const t=st(), max=k==="c"?TS.COLS_MAX:TS.ROWS_MAX, cur=k==="c"?t.cols:t.rows; if(cur>=max) return;
  dlg(`<h3>➕ ${k==="c"?T("マスを横に1列ふやす","Add 1 column"):T("マスを縦に1列ふやす","Add 1 row")}</h3><p>${k==="c"?`${T("横","Width")} ${cur} → <b>${cur+1}</b>`:`${T("縦","Height")} ${cur} → <b>${cur+1}</b>`}（${T("最大","max")} ${max}）<br>💰 <b>${fmt(TS.EXPAND_COST)}</b> ${T("コイン","coins")}（${T("所持","you have")} ${fmt(S.coins||0)}）</p>`,
    [[T("やめる","Cancel"),null,"g"],[T("ふやす","Add"),()=>{ if((S.coins||0)<TS.EXPAND_COST){ sfx("ng"); return msg(T("コインが足りません","Not enough coins")); } S.coins-=TS.EXPAND_COST; if(k==="c") t.cols++; else t.rows++; save(); sfx("coin"); coinView(); sideView(); }]]); }

/* ---------- 魔物をえらぶ ---------- */
function pickMonster(){ const t=st();
  if(t.units.length>=TS.MAX_UNITS) return dlg(`<p>${T(`置けるのは合わせて${TS.MAX_UNITS}体までです`,`You can place up to ${TS.MAX_UNITS}`)}</p>`,[["OK",null]]);
  const L=MONSTERS.filter(m=>(S.got||{})[m.id]).sort((a,b)=>RANKS.indexOf(b.rank)-RANKS.indexOf(a.rank)||a.id-b.id);
  if(!L.length) return dlg(`<p>${T("図鑑で解放した魔物がいません。ガチャで魔物と出会おう！","No monsters unlocked in your Monster Book yet.")}</p>`,[["OK",null]]);
  const bg=dlg(`<h3>👾 ${T("魔物を追加","Add a monster")}</h3><p style="font-size:12px;margin:0 0 8px">${T("図鑑で解放した魔物を置けます。コインは置いたときに払います（取り除いてももどりません）","Unlocked monsters only. You pay when you place it (no refund on removal).")}</p>
    <div class="ts-grid">${L.map(m=>{ const c=cfgOf(m.id), s=statsOf(m.id), cost=costOf(m.id); return `<button type="button" class="ts-card ${(S.coins||0)<cost?"no":""}" data-id="${m.id}"><img src="${m.img}" alt=""><b>${esc3(m.name)}</b><span><span class="rk rk-${m.rank}">${m.rank==="L"?T("限定","LTD"):m.rank}</span> ${c.w}×${c.h}${T("マス","")}${c.fly?" 🪽":""}</span><span>❤ ${fmt(s.hp)}　⚔ ${fmt(s.atk)}</span><span class="c">💰 ${fmt(cost)}</span></button>`; }).join("")}</div>`,[[T("とじる","Close"),null,"g"]]);
  bg.querySelectorAll("[data-id]").forEach(b=>b.onclick=()=>{ const id=+b.dataset.id, cost=costOf(id);
    if((S.coins||0)<cost){ sfx("ng"); return msg(T("コインが足りません","Not enough coins")); }
    bg.remove(); V.placing={id}; V.sel=null; selView(); const c=cfgOf(id); msg(T(`置きたいマスをタップ（${c.w}×${c.h}マス・左下のマスをタップ）`,`Tap a cell to place it (${c.w}×${c.h}, bottom-left cell)`)); });
}

/* ---------- 置く・動かす ---------- */
const fits = (id,c,r,skip) => { const t=st(), k=cfgOf(id); if(c<0||r<0||c+k.w>t.cols||r+k.h>t.rows) return false;
  return !t.units.some(u=>{ if(u===skip) return false; const q=cfgOf(u.id); return c<u.c+q.w && u.c<c+k.w && r<u.r+q.h && u.r<r+k.h; }); };
const cellAt = (wx,wy) => ({ c:Math.floor(wx/TS.CS), r:Math.floor(-wy/TS.CS) });
const unitAt = (wx,wy) => { const t=st(); for(let i=t.units.length-1;i>=0;i--){ const u=t.units[i], k=cfgOf(u.id); const x0=u.c*TS.CS, y1=-u.r*TS.CS, x1=x0+k.w*TS.CS, y0=y1-k.h*TS.CS; if(wx>=x0&&wx<x1&&wy>=y0&&wy<y1) return u; } return null; };
function place(c,r){ const id=V.placing.id, t=st(), cost=costOf(id);
  if(t.units.length>=TS.MAX_UNITS){ V.placing=null; return msg(T(`置けるのは${TS.MAX_UNITS}体までです`,`Up to ${TS.MAX_UNITS}`)); }
  if(!fits(id,c,r)){ sfx("ng"); return msg(T("そこには置けません（マスからはみ出す・ほかと重なる）","Can't place there (off the grid or overlapping)")); }
  if((S.coins||0)<cost){ sfx("ng"); V.placing=null; return msg(T("コインが足りません","Not enough coins")); }
  S.coins-=cost; t.units.push({u:t.nu++, id, c, r}); save(); sfx("coin"); coinView(); sideView(); V.placing=null;
  msg(T(`「${mon(id).name}」を置きました（-${fmt(cost)}コイン）`,`Placed ${mon(id).name} (-${fmt(cost)})`)); }
function selView(){ const box=V&&V.root.querySelector("#tsSel"); if(!box) return; box.innerHTML=""; const u=V.sel; if(!u||V.mode!=="prep") return;
  const k=cfgOf(u.id), s=statsOf(u.id), m=mon(u.id), p=w2s((u.c+k.w/2)*TS.CS, -(u.r+k.h)*TS.CS);
  const d=el(`<div class="ts-sel" style="left:${p.x/V.dpr}px;top:${p.y/V.dpr-6}px"><span class="ts-info">${esc3(m.name)}　❤${fmt(s.hp)} ⚔${fmt(s.atk)}<br>${T("ドラッグで移動","Drag to move")}</span><button type="button" class="ts-b">${T("取り除く","Remove")}</button></div>`);
  d.querySelector("button").onclick=()=>dlg(`<p>${T(`「${esc3(m.name)}」を取り除きますか？<br>置いたときのコインはもどりません。`,`Remove ${esc3(m.name)}? Coins are not refunded.`)}</p>`,[[T("やめる","Cancel"),null,"g"],[T("取り除く","Remove"),()=>{ const t=st(); t.units=t.units.filter(x=>x!==u); save(); V.sel=null; selView(); sideView(); }]]);
  box.appendChild(d); }

/* ---------- カメラ・指の操作 ---------- */
function resize(){ if(!V) return; const dpr=Math.min(2,window.devicePixelRatio||1), r=V.root.getBoundingClientRect(); V.dpr=dpr; V.cv.width=Math.round(r.width*dpr); V.cv.height=Math.round(r.height*dpr); V.W=V.cv.width; V.H=V.cv.height;
  const p=V.root.querySelector("#tsPanel"); V.panelH=p&&!p.hidden?p.getBoundingClientRect().height*dpr:0; selView(); }
const viewH = () => V.H - V.panelH;
const w2s = (x,y) => ({ x:(x-V.cam.x)*V.cam.z + V.W/2, y:(y-V.cam.y)*V.cam.z + viewH()/2 });
const s2w = (x,y) => ({ x:(x-V.W/2)/V.cam.z + V.cam.x, y:(y-viewH()/2)/V.cam.z + V.cam.y });
function fitRect(x0,y0,x1,y1){ const pad=1.15, z=Math.min(V.W/((x1-x0)*pad), viewH()/((y1-y0)*pad)); V.cam.z=Math.max(0.15,Math.min(3,z)); V.cam.x=(x0+x1)/2; V.cam.y=(y0+y1)/2; }
function fitPrep(){ const t=st(); fitRect(-TS.CS*1.5, -t.rows*TS.CS-TS.CS*1.2, t.cols*TS.CS+TS.CS*1.5, TS.CS*0.8); }
function bindPointers(){ const cv=V.cv;
  const pos=e=>{ const r=cv.getBoundingClientRect(); return {x:(e.clientX-r.left)*V.dpr, y:(e.clientY-r.top)*V.dpr}; };
  cv.addEventListener("pointerdown",e=>{ if(!V) return; e.preventDefault(); try{ cv.setPointerCapture(e.pointerId); }catch(_){} const p=pos(e); V.ptr.set(e.pointerId,{...p, x0:p.x, y0:p.y, t0:performance.now()});
    if(V.ptr.size===2){ const [a,b]=[...V.ptr.values()]; V.pinch={d:Math.hypot(a.x-b.x,a.y-b.y), z:V.cam.z, w:s2w((a.x+b.x)/2,(a.y+b.y)/2)}; V.drag=null; return; }
    if(V.mode==="prep" && !V.placing){ const w=s2w(p.x,p.y), u=unitAt(w.x,w.y); if(u){ const k=cfgOf(u.id); V.drag={u, ox:w.x-u.c*TS.CS, oy:w.y+u.r*TS.CS, moved:false, c:u.c, r:u.r}; } } });
  cv.addEventListener("pointermove",e=>{ if(!V||!V.ptr.has(e.pointerId)) return; const p=pos(e), o=V.ptr.get(e.pointerId); const dx=p.x-o.x, dy=p.y-o.y; o.x=p.x; o.y=p.y;
    if(V.ptr.size>=2 && V.pinch){ const [a,b]=[...V.ptr.values()], d=Math.hypot(a.x-b.x,a.y-b.y), mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
      V.cam.z=Math.max(0.15,Math.min(3,V.pinch.z*d/Math.max(1,V.pinch.d))); V.cam.x=V.pinch.w.x-(mx-V.W/2)/V.cam.z; V.cam.y=V.pinch.w.y-(my-viewH()/2)/V.cam.z; selView(); return; }
    if(V.drag){ const w=s2w(p.x,p.y); if(Math.hypot(p.x-o.x0,p.y-o.y0)>8*V.dpr) V.drag.moved=true; if(V.drag.moved){ const c=Math.round((w.x-V.drag.ox)/TS.CS), r=Math.round(-(w.y-V.drag.oy)/TS.CS); V.drag.c=c; V.drag.r=r; } return; }
    V.cam.x-=dx/V.cam.z; V.cam.y-=dy/V.cam.z; if(Math.abs(dx)+Math.abs(dy)>0) selView(); });
  const up=e=>{ if(!V||!V.ptr.has(e.pointerId)) return; const o=V.ptr.get(e.pointerId); V.ptr.delete(e.pointerId); if(V.ptr.size<2) V.pinch=null;
    const tap=Math.hypot(o.x-o.x0,o.y-o.y0)<10*V.dpr && performance.now()-o.t0<400 && V.ptr.size===0;
    if(V.drag){ const d=V.drag; V.drag=null;
      if(d.moved){ if(fits(d.u.id,d.c,d.r,d.u)){ d.u.c=d.c; d.u.r=d.r; save(); sfx("tap"); } else { sfx("ng"); msg(T("そこには動かせません","Can't move there")); } V.sel=d.u; selView(); return; }
      if(tap){ V.sel=V.sel===d.u?null:d.u; selView(); return; } }
    if(tap && V.mode==="prep"){ const w=s2w(o.x,o.y);
      if(V.placing){ const {c,r}=cellAt(w.x,w.y); place(c,r); return; }
      V.sel=null; selView(); } };
  cv.addEventListener("pointerup",up); cv.addEventListener("pointercancel",up);
  cv.addEventListener("wheel",e=>{ e.preventDefault(); const p=pos(e), w=s2w(p.x,p.y); V.cam.z=Math.max(0.15,Math.min(3,V.cam.z*Math.exp(-e.deltaY*0.0015))); V.cam.x=w.x-(p.x-V.W/2)/V.cam.z; V.cam.y=w.y-(p.y-viewH()/2)/V.cam.z; selView(); },{passive:false});
}

/* ---------- 準備完了 → 相手さがし → バトル ---------- */
let busy=false;
async function readyGo(auto){ if(!V||V.mode!=="prep"||busy) return; const t=st();
  if(!t.units.length){ if(auto){ msg(T("魔物を置かなかったので、準備時間をもう一度はじめます","Nothing placed — prep time restarted")); V.prepEnd=now()+TS.PREP_MS; return; } sfx("ng"); return msg(T("魔物を1体以上置いてね","Place at least one monster")); }
  busy=true; V.placing=null; V.sel=null; selView(); msg(T("相手をさがしています…","Finding an opponent…"));
  const mine={cols:t.cols, rows:t.rows, units:t.units.map(u=>({id:u.id,c:u.c,r:u.r}))};
  try{ if(typeof DB!=="undefined" && DB && MYID){ let nm=""; try{ nm=myName(); }catch(e){} DB.collection("tsp").doc(MYID).set({uid:MYID, nm:String(nm).slice(0,24), ...mine, at:now()}).catch(()=>{}); } }catch(e){}
  let opp=null;
  try{ if(typeof DB!=="undefined" && DB && MYID){ const q=await Promise.race([DB.collection("tsp").orderBy("at","desc").limit(40).get(), new Promise((_,ng)=>setTimeout(()=>ng(new Error("to")),6000))]);
      const L=q.docs.map(d=>d.data()).filter(x=>x&&x.uid!==MYID&&Array.isArray(x.units)&&x.units.some(u=>mon(u.id))); if(L.length) opp=L[Math.floor(Math.random()*L.length)]; } }catch(e){}
  if(!opp) opp=cpuLayout(mine);
  busy=false; startBattle(mine, opp);
}
function cpuLayout(mine){ const n=Math.max(3,Math.min(TS.MAX_UNITS,mine.units.length)), cols=mine.cols, rows=mine.rows, L=[], pool=MONSTERS.filter(m=>m.rank!=="L"&&!m.gift);
  const occ=new Set(), ok=(id,c,r)=>{ const k=cfgOf(id); if(c<0||r<0||c+k.w>cols||r+k.h>rows) return false; for(let i=0;i<k.w;i++) for(let j=0;j<k.h;j++) if(occ.has((c+i)+","+(r+j))) return false; return true; };
  for(let tries=0; L.length<n && tries<400; tries++){ const m=pool[Math.floor(Math.random()*pool.length)], k=cfgOf(m.id), c=Math.floor(Math.random()*cols), r=k.fly?Math.floor(Math.random()*rows):0;
    if(!ok(m.id,c,r)) continue; for(let i=0;i<k.w;i++) for(let j=0;j<k.h;j++) occ.add((c+i)+","+(r+j)); L.push({id:m.id,c,r}); }
  return {nm:T("さすらいの戦略家（CPU）","Wandering Tactician (CPU)"), cols, rows, units:L, cpu:1}; }

function mkUnit(u, side, X0, cols){ const k=cfgOf(u.id), s=statsOf(u.id), w=k.w*TS.CS, h=k.h*TS.CS;
  const c = side ? (cols-u.c-k.w) : u.c;   // 相手は左右反対（前が自分のほうを向く）
  return { id:u.id, side, x:X0+c*TS.CS+w/2, y:-u.r*TS.CS, w, h, fly:k.fly, hp:s.hp, max:s.hp, atk:s.atk, spd:k.spd*TS.CS, range:k.range*TS.CS, cd:k.cd, t:Math.random()*0.4, vy:0, dead:false, deadT:0, flash:0, face:side?-1:1, hop:Math.random()*6 }; }
function startBattle(mine, opp){
  const X1=0, X2=mine.cols*TS.CS+TS.GAP*TS.CS;
  const units=[...mine.units.filter(u=>mon(u.id)).map(u=>mkUnit(u,0,X1,mine.cols)), ...opp.units.filter(u=>mon(u.id)).map(u=>mkUnit(u,1,X2,opp.cols))];
  V.B={units, pops:[], end:now()+TS.BATTLE_MS, X1, X2, W:X2+opp.cols*TS.CS, rows:Math.max(mine.rows,opp.rows||mine.rows), mine, opp, enemyName:opp.nm||T("冒険者","Adventurer"), over:false};
  V.mode="battle"; V.root.querySelector("#tsPanel").hidden=true; resize(); sideView();
  fitRect(-TS.CS*2, -V.B.rows*TS.CS-TS.CS*2, V.B.W+TS.CS*2, TS.CS*1);
  sfx("win"); msg(T(`バトル開始！ 相手：${opp.nm||"冒険者"}`,`Battle start! vs ${opp.nm||"Adventurer"}`));
}
function stepBattle(dt){ const B=V.B; if(!B||B.over) return;
  const alive=s=>B.units.filter(u=>u.side===s&&!u.dead);
  for(const u of B.units){ if(u.dead){ u.deadT+=dt; continue; } u.flash=Math.max(0,u.flash-dt); u.t-=dt;
    if(!u.fly){ if(u.y<0){ u.vy+=1800*dt; u.y=Math.min(0,u.y+u.vy*dt); if(u.y>=0) u.vy=0; } }   // 地上の魔物は地面に落ちる
    const foes=alive(1-u.side); if(!foes.length) continue;
    let tg=null, bd=Infinity; for(const f of foes){ const d=Math.hypot(f.x-u.x,(f.y-f.h/2)-(u.y-u.h/2)); if(d<bd){ bd=d; tg=f; } }
    const dx=tg.x-u.x, gap=Math.abs(dx)-(u.w+tg.w)/2, vgap=Math.abs((tg.y-tg.h/2)-(u.y-u.h/2))-(u.h+tg.h)/2;
    u.face=dx>=0?1:-1;
    if(gap>u.range || (vgap>u.range && !u.fly && tg.fly===false)){ u.x+=Math.sign(dx)*u.spd*dt; u.hop+=dt*8; }
    else if(u.fly && vgap>u.range){ const ty=tg.y-tg.h/2+u.h/2; u.y+=Math.sign(ty-u.y)*u.spd*0.8*dt; }
    else if(u.t<=0){ u.t=u.cd; tg.hp=Math.max(0,tg.hp-u.atk); tg.flash=0.15; B.pops.push({x:tg.x,y:tg.y-tg.h,v:u.atk,t:0,side:tg.side});
      if(tg.hp<=0){ tg.dead=true; } }
    if(u.fly && gap>u.range){ const ty=tg.y-tg.h/2+u.h/2; u.y+=Math.sign(ty-u.y)*Math.min(Math.abs(ty-u.y),u.spd*0.5*dt); }
  }
  B.pops.forEach(p=>p.t+=dt); B.pops=B.pops.filter(p=>p.t<0.9);
  const a=alive(0).length, b=alive(1).length, left=B.end-now();
  if(!a||!b||left<=0){ B.over=true; const g=s=>B.units.filter(u=>u.side===s).reduce((t,u)=>t+u.hp/u.max,0), ga=g(0), gb=g(1);
    const res = !b&&a?"win" : !a&&b?"lose" : !a&&!b?"draw" : ga>gb?"win" : ga<gb?"lose" : "draw";
    setTimeout(()=>result(res, ga, gb, !a||!b), 900); }
}
function result(res, ga, gb, ko){ if(!V) return; sfx(res==="win"?"win":"ng");
  const B=V.B, n=s=>B.units.filter(u=>u.side===s&&!u.dead).length;
  dlg(`<div style="font-size:54px">${res==="win"?"🏆":res==="draw"?"🤝":"💀"}</div><h3>${res==="win"?T("勝利！","Victory!"):res==="draw"?T("引き分け","Draw"):T("敗北…","Defeat...")}</h3>
    <p>${ko?T("どちらかの魔物が全滅しました。","One side was wiped out."):T("1分がたったので、のこった体力ゲージの合計で決まりました。","Time's up — decided by the total of remaining HP gauges.")}<br>
    ${T("あなた","You")}：${T("のこり","left")} ${n(0)}${T("体","")}・${T("体力ゲージ合計","HP gauges")} <b>${ga.toFixed(2)}</b><br>${T("相手","Opponent")}：${T("のこり","left")} ${n(1)}${T("体","")}・${T("体力ゲージ合計","HP gauges")} <b>${gb.toFixed(2)}</b></p>`,
    [[T("準備にもどる","Back to setup"),()=>backToPrep()]],{modal:true}); }
function backToPrep(){ if(!V) return; V.mode="prep"; V.B=null; V.prepEnd=now()+TS.PREP_MS; V.root.querySelector("#tsPanel").hidden=false; resize(); sideView(); coinView(); fitPrep(); }

/* ---------- 描く ---------- */
function loop(ts){ if(!V) return; const dt=Math.min(0.05,(ts-V.last)/1000); V.last=ts;
  if(V.mode==="prep"){ const left=V.prepEnd-now(); timerView(T("準備時間","Setup time"),left); if(left<=0) readyGo(true); }
  else if(V.mode==="battle"&&V.B){ stepBattle(dt); timerView(T("制限時間","Time limit"),V.B.end-now()); }
  draw(); V.raf=requestAnimationFrame(loop); }
function timerView(l,ms){ const a=V.root.querySelector("#tsTmL"), b=V.root.querySelector("#tsTmV"), box=V.root.querySelector("#tsTm"); if(a.textContent!==l) a.textContent=l; const t=mmss(ms); if(b.textContent!==t) b.textContent=t; box.classList.toggle("low",ms<10000); }
function drawWorld(g, x0, x1){ const z=V.cam.z, top=s2w(0,0).y, bot=s2w(0,V.H).y;
  // 空
  const sky=g.createLinearGradient(0,0,0,V.H); sky.addColorStop(0,"#6bb8f0"); sky.addColorStop(1,"#a8dcff"); g.fillStyle=sky; g.fillRect(0,0,V.W,V.H);
  // 雲（ドット）
  g.fillStyle="#ffffffd0"; for(let i=-2;i<14;i++){ const wx=i*420+((i*137)%200), wy=-260-((i*73)%5)*70; const p=w2s(wx,wy); const s=8*z; for(const [a,b,c,d] of [[0,1,10,3],[2,0,6,1],[1,-1,4,1]]) g.fillRect(p.x+a*s*4,p.y+b*s*4,c*s*4,d*s*4); }
  // 地面
  const gy=w2s(0,0).y; g.fillStyle="#b98a5f"; g.fillRect(0,gy,V.W,V.H-gy);
  g.fillStyle="#5ec44a"; g.fillRect(0,gy,V.W,Math.max(3,18*z)); g.fillStyle="#3f8f2f"; const step=Math.max(4,16*z);
  for(let x=(-((V.cam.x*z)%step)); x<V.W; x+=step) g.fillRect(x,gy+18*z,step*0.5,Math.max(2,6*z));
  g.fillStyle="#111"; g.fillRect(0,gy-Math.max(1,2*z),V.W,Math.max(1,3*z));
  g.fillStyle="#9b6e47"; for(let i=0;i<60;i++){ const wx=((i*347)%4000)-800, wy=40+((i*97)%220); const p=w2s(wx,wy); g.fillRect(p.x,p.y,8*z,8*z); }
}
function drawGrid(g, X0, cols, rows, col){ const z=V.cam.z; g.strokeStyle=col; g.lineWidth=Math.max(1,2*z);
  for(let c=0;c<=cols;c++){ const a=w2s(X0+c*TS.CS,-rows*TS.CS), b=w2s(X0+c*TS.CS,0); g.beginPath(); g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); g.stroke(); }
  for(let r=0;r<=rows;r++){ const a=w2s(X0,-r*TS.CS), b=w2s(X0+cols*TS.CS,-r*TS.CS); g.beginPath(); g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); g.stroke(); } }
function drawMon(g, id, cx, by, w, h, face, alpha, flash){ const im=imgOf(id); if(!im.complete||!im.naturalWidth) return; const z=V.cam.z;
  const k=Math.min(w/im.naturalWidth, h/im.naturalHeight), dw=im.naturalWidth*k*z, dh=im.naturalHeight*k*z, p=w2s(cx,by);
  g.save(); g.globalAlpha=alpha??1; g.translate(p.x,p.y); if(face<0) g.scale(-1,1); if(flash>0) g.filter="brightness(2.2)"; g.drawImage(im,-dw/2,-dh,dw,dh); g.restore(); }
function draw(){ const g=V.ctx; g.imageSmoothingEnabled=false; drawWorld(g);
  const z=V.cam.z;
  if(V.mode==="prep"){ const t=st();
    // 置ける場所
    const a=w2s(0,-t.rows*TS.CS), b=w2s(t.cols*TS.CS,0); g.fillStyle="#ff5a5a14"; g.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);
    drawGrid(g,0,t.cols,t.rows,"#e0505599");
    for(const u of t.units){ const k=cfgOf(u.id); let c=u.c, r=u.r; const dr=V.drag&&V.drag.u===u&&V.drag.moved; if(dr){ c=V.drag.c; r=V.drag.r; }
      if(dr||V.sel===u){ const ok=!dr||fits(u.id,c,r,u); const p0=w2s(c*TS.CS,-(r+k.h)*TS.CS), p1=w2s((c+k.w)*TS.CS,-r*TS.CS); g.fillStyle=ok?"#ffd75e55":"#ff303055"; g.fillRect(p0.x,p0.y,p1.x-p0.x,p1.y-p0.y); }
      drawMon(g,u.id,(c+k.w/2)*TS.CS,-r*TS.CS,k.w*TS.CS,k.h*TS.CS,1,dr?0.75:1); }
    if(V.placing){ const k=cfgOf(V.placing.id); g.fillStyle="#fff"; g.font=`900 ${Math.round(13*V.dpr)}px sans-serif`; g.textAlign="center"; const p=w2s(t.cols*TS.CS/2,-t.rows*TS.CS); g.fillText(T(`${mon(V.placing.id).name}（${k.w}×${k.h}）を置くマスをタップ`,`Tap a cell for ${mon(V.placing.id).name} (${k.w}×${k.h})`),p.x,p.y-10*V.dpr); }
    const d=w2s(-TS.CS*0.9,0); if(deco.complete){ const h=TS.CS*1.1*z, w=h*deco.width/deco.height; g.drawImage(deco,d.x-w/2,d.y-h,w,h); }
    return; }
  const B=V.B; if(!B) return;
  drawGrid(g,B.X1,B.mine.cols,B.mine.rows,"#e0505530"); drawGrid(g,B.X2,B.opp.cols,B.opp.rows||B.mine.rows,"#5070e030");
  // かざり（両はし）
  if(deco.complete){ const h=TS.CS*1.1*z, w=h*deco.width/deco.height; const L=w2s(B.X1-TS.CS*1.2,0), R=w2s(B.W+TS.CS*1.2,0); g.drawImage(deco,L.x-w/2,L.y-h,w,h); g.save(); g.translate(R.x,R.y); g.scale(-1,1); g.drawImage(deco,-w/2,-h,w,h); g.restore(); }
  const L=[...B.units].sort((a,b)=>b.h-a.h);
  for(const u of L){ if(u.dead){ if(u.deadT<1.2 && grave.complete){ const p=w2s(u.x,u.fly?u.y:0), h=TS.CS*0.7*z, w=h*grave.width/grave.height; g.globalAlpha=1-u.deadT/1.2; g.drawImage(grave,p.x-w/2,p.y-h,w,h); g.globalAlpha=1; } continue; }
    const bob=u.fly?Math.sin(u.hop*0.6)*4:0; drawMon(g,u.id,u.x,u.y+bob,u.w,u.h,u.face,1,u.flash);
    // 体力ゲージ
    const p=w2s(u.x-u.w*0.4,u.y-u.h-10), bw=u.w*0.8*z, bh=Math.max(3,7*z); g.fillStyle="#111"; g.fillRect(p.x-1,p.y-1,bw+2,bh+2); g.fillStyle="#3a1f2a"; g.fillRect(p.x,p.y,bw,bh);
    const r=u.hp/u.max; g.fillStyle=u.side?(r<.3?"#ff7a5a":"#ff9a3d"):(r<.3?"#ff5a5a":"#5ec44a"); g.fillRect(p.x,p.y,bw*r,bh); }
  g.textAlign="center"; g.font=`900 ${Math.round(Math.max(11,16*z))}px sans-serif`;
  for(const q of B.pops){ const p=w2s(q.x,q.y-q.t*40); g.globalAlpha=1-q.t/0.9; g.fillStyle="#000"; g.fillText("-"+fmt(q.v),p.x+1,p.y+1); g.fillStyle=q.side?"#ffd75e":"#ff6a5a"; g.fillText("-"+fmt(q.v),p.x,p.y); } g.globalAlpha=1;
}
})();
