/* =========================================================
   魔物バトル（ミニゲーム）
   メニュー：魔物編成／アイテム購入／ガチャ／魔物BOX／ランダムマッチ／クエストマッチ／フレンドマッチ
   バトル：前半3体が場に出る・後半3体は待機。おたがい戦略を決めて同時に結果。相手の6体を全部倒したら勝ち。
   本体（index.html）のグローバル（S・save・DB・MYID・gnow・renderCoins など）を使う
   ========================================================= */
(()=>{
/* ---------- 中身（魔物・武器・アイテム・ガチャ）：追加するときはここに足す ---------- */
// 魔物：img＝正面（編成・BOX）、back＝後ろ姿（バトルの自分の魔物）。magic＝魔法（なければ null）
//   magic の例：{ name:"ファイア", desc:"敵3体に攻撃力×1.2のダメージ", kind:"all", power:1.2 }   kind: all（敵全体）/ one（1体）/ heal（味方全体を回復）
const MB_MONS = [
  { id:1, name:"スライム", en:"Slime", img:"mb/m1.png", back:"mb/m1b.png", atk:1, hp:3, magic:null },   // 2026-10-24 追加
];
// 武器（装備）：atk・hp を足す。例：{ id:1, name:"木の剣", img:"mb/w1.png", atk:2, hp:0 }
const MB_WEAPONS = [];
// アイテム：price で買える。heal＝体力を回復。例：{ id:1, name:"やくそう", img:"mb/i1.png", price:500, heal:5 }
const MB_ITEMS = [];
// ガチャ：cost＝1回のコイン、pool＝[{id, w（出やすさ）}]。中身が空のあいだは「準備中」
const MB_GACHA = { mon:{ cost:1000, pool:[] }, weapon:{ cost:1000, pool:[] } };

const MB = { SLOTS0:10, SLOT_MAX:500, SLOT_COST:10000, LVUP:10000, GROW:1.5, GUARDS:3, TURN_MS:60000, WIN_COIN:1000 };
const T = (ja,en) => (typeof LANG!=="undefined" && LANG==="en") ? en : ja;
const sfx = (k,a) => { try{ SFX[k](a); }catch(e){} };
const fmt = n => Math.floor(n||0).toLocaleString();
const now = () => { try{ return gnow(); }catch(e){ return Date.now(); } };
const esc2 = t => String(t??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const monOf = id => MB_MONS.find(m=>m.id===id);
const wOf = id => MB_WEAPONS.find(w=>w.id===id);
const iOf = id => MB_ITEMS.find(x=>x.id===id);
const mname = m => m ? (T(m.name, m.en||m.name)) : "?";
function rng(seed){ let a=seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const st = () => { S.mb=S.mb||{}; const b=S.mb; b.slots=b.slots||MB.SLOTS0; b.units=b.units||[]; b.nu=b.nu||1; b.form=b.form||[null,null,null,null,null,null]; b.weap=b.weap||{}; b.items=b.items||{}; b.qlv=b.qlv||1; return b; };
const coinUpd = () => { const el=document.getElementById("mbCoin"); if(el) el.textContent=fmt(S.coins); try{ renderCoins(); }catch(e){} };
// レベルの強さ：1レベル上がるごとに全ステータス1.5倍
const statOf = (id, lv, w) => { const m=monOf(id), k=Math.pow(MB.GROW, Math.max(0,(lv||1)-1)), W=wOf(w); if(!m) return {atk:0,hp:0};
  return { atk: m.atk*k + (W?W.atk||0:0), hp: m.hp*k + (W?W.hp||0:0) }; };
const nf = v => { const r=Math.round(v*10)/10; return Number.isInteger(r)?fmt(r):r.toFixed(1); };

/* ---------- 見た目 ---------- */
const css=document.createElement("style");
css.textContent=`
#mbo{position:fixed;inset:0;z-index:140;overflow:hidden;background:#123;touch-action:manipulation;-webkit-user-select:none;user-select:none;font-family:var(--f-body,sans-serif)}
#mbo .mb-blur{position:absolute;inset:-30px;background-size:cover;background-position:center;filter:blur(18px) brightness(.55)}
#mbo .mb-st{position:absolute;left:0;top:0;transform-origin:0 0;background-size:100% 100%;overflow:hidden}
#mbo .hit{position:absolute;background:transparent;border:0;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent;border-radius:18px}
#mbo .hit:active{background:#0002}
#mbo .mb-back{position:absolute;z-index:3;border:4px solid #3a2306;background:#fff3d6;color:#3a2306;border-radius:999px;padding:10px 22px;font:900 28px/1 var(--f-body,sans-serif)}
#mbo .mb-coin{position:absolute;left:700px;top:96px;width:192px;height:56px;display:flex;align-items:center;justify-content:flex-end;font:900 42px/1 var(--f-pix,monospace);color:#3a2306}
#mbo .mb-cnt{position:absolute;left:72px;top:1300px;width:266px;text-align:center;font:900 26px/1.1 var(--f-body,sans-serif);color:#3a2306}
#mbo .mb-quest{position:absolute;left:338px;top:1290px;width:266px;height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#3a2306;pointer-events:none}
#mbo .mb-quest i{font-style:normal;font-size:70px;line-height:1}
#mbo .mb-quest b{font:900 34px/1 var(--f-body,sans-serif)}
#mbo .mb-quest small{font:900 22px/1 var(--f-body,sans-serif);color:#7a3b00}
/* 編成 */
#mbo .fm-cell{position:absolute;display:flex;align-items:center;justify-content:center}
#mbo .fm-cell img{max-width:92%;max-height:92%;object-fit:contain;image-rendering:pixelated;filter:drop-shadow(0 3px 2px #0008)}
#mbo .fm-st{position:absolute;color:#3a2306;font:900 34px/1.35 var(--f-body,sans-serif);pointer-events:none}
#mbo .fm-st b{font-size:40px}
#mbo .fm-st small{display:block;font-size:24px;color:#7a5520;max-width:250px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* バトル */
#mbo .bt-top{position:absolute;top:148px;width:282px;height:112px;border:4px solid #3a2306;border-radius:14px;background:linear-gradient(#5b3a1a,#3a2306);display:flex;align-items:center;gap:8px;padding:6px;box-shadow:0 4px 0 #1d1206}
#mbo .bt-top img{width:92px;height:92px;object-fit:contain;background:#0004;border-radius:8px}
#mbo .bt-top .tx{flex:1;color:#ffe9a8;font:900 30px/1.2 var(--f-body,sans-serif)}
#mbo .bar{height:20px;border:3px solid #1d1206;border-radius:999px;background:#1d1206;overflow:hidden;margin-top:6px}
#mbo .bar i{display:block;height:100%;background:linear-gradient(#7dff6a,#2fbf2a);transition:width .4s}
#mbo .bar.low i{background:linear-gradient(#ffd75e,#e09b16)}#mbo .bar.crit i{background:linear-gradient(#ff8a8a,#d32f2f)}
#mbo .bt-unit{position:absolute;width:190px;height:190px;margin:-190px 0 0 -95px;display:flex;align-items:flex-end;justify-content:center;pointer-events:none;transition:transform .2s}
#mbo .bt-unit img{max-width:100%;max-height:100%;object-fit:contain;image-rendering:pixelated;filter:drop-shadow(0 6px 3px #0007)}
#mbo .bt-unit.pick{pointer-events:auto;cursor:pointer;animation:btPick .8s ease-in-out infinite}
@keyframes btPick{50%{transform:scale(1.08);filter:drop-shadow(0 0 14px #ff0)}}
#mbo .bt-unit .gd{position:absolute;top:0;right:10px;font-size:44px}
#mbo .bt-unit.hit1{animation:btHit .45s}
@keyframes btHit{20%{transform:translateX(-14px)}40%{transform:translateX(14px)}60%{transform:translateX(-8px)}100%{transform:none}}
#mbo .bt-dmg{position:absolute;z-index:6;font:900 52px/1 var(--f-pix,monospace);color:#fff;text-shadow:0 0 4px #000,0 3px 0 #c00;pointer-events:none;animation:btDmg 1.1s ease-out forwards}
#mbo .bt-dmg.heal{text-shadow:0 0 4px #000,0 3px 0 #090;color:#bfffb0}
@keyframes btDmg{from{transform:translate(-50%,0);opacity:1}to{transform:translate(-50%,-90px);opacity:0}}
#mbo .bt-row{position:absolute;left:75px;width:620px;height:150px;border-radius:16px}
#mbo .bt-row img{position:absolute;left:41px;top:16px;width:102px;height:86px;object-fit:contain;image-rendering:pixelated}
#mbo .bt-row .lv{position:absolute;left:180px;top:28px;font:900 38px/1 var(--f-body,sans-serif);color:#3a2306}
#mbo .bt-row .ac{position:absolute;left:310px;top:30px;width:300px;font:900 30px/1.1 var(--f-body,sans-serif);color:#3a2306;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#mbo .bt-row .ac.set{color:#1d4597}
#mbo .bt-row .bar{position:absolute;left:180px;top:76px;width:410px;margin:0}
#mbo .bt-row.dead{filter:grayscale(1) brightness(.7)}
#mbo .bt-msg{position:absolute;left:50%;top:620px;transform:translateX(-50%);z-index:7;background:#000c;color:#fff;border:4px solid #ffd75e;border-radius:18px;padding:12px 24px;font:900 34px/1.25 var(--f-body,sans-serif);white-space:nowrap;pointer-events:none;transition:opacity .3s;text-align:center}
#mbo .bt-msg[hidden]{display:block;opacity:0}
#mbo .bt-time{position:absolute;left:50%;top:30px;transform:translateX(-50%);background:#000a;color:#fff;border:3px solid #ffd75e;border-radius:999px;padding:8px 24px;font:900 30px/1 var(--f-body,sans-serif);white-space:nowrap}
#mbo .bt-rs{position:absolute;left:728px;top:1500px;width:200px;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px;pointer-events:none}
#mbo .bt-rs img{width:58px;height:50px;object-fit:contain;background:#fff3d6;border:3px solid #3a2306;border-radius:10px}
#mbo .bt-rs img.dead{filter:grayscale(1);opacity:.4}
#mbo .bt-ok.wait{filter:grayscale(.8) brightness(.8)}
#mbo .bt-oklab{position:absolute;left:290px;top:1500px;width:360px;height:124px;display:flex;align-items:center;justify-content:center;font:900 26px/1 var(--f-body,sans-serif);color:#7a3b00;pointer-events:none;padding-top:90px}
/* ページ（BOX・アイテム・ガチャ） */
#mbo.page{background:linear-gradient(#2b5b8a,#1a3550)}
#mbo .pg{position:absolute;inset:0;overflow:auto;-webkit-overflow-scrolling:touch;padding:calc(84px + env(safe-area-inset-top)) 12px 30px;color:#3a2306}
#mbo .pg-h{position:fixed;left:0;right:0;top:0;z-index:4;display:flex;align-items:center;justify-content:center;gap:8px;padding:max(10px,env(safe-area-inset-top)) 120px 10px 70px;min-height:70px;background:#3a2306f2;border-bottom:3px solid #e9b949;color:#ffe9a8;font:900 20px/1.2 var(--f-body,sans-serif);text-align:center}
#mbo .pg-h small{display:block;font-size:11px;color:#f3d79a}
#mbo .pg-x{position:fixed;left:10px;top:max(12px,env(safe-area-inset-top));z-index:5;width:46px;height:46px;border-radius:50%;border:3px solid #3a2306;background:#fff3d6;font:900 20px/1 sans-serif;color:#3a2306}
#mbo .pg-coin{position:fixed;right:10px;top:max(12px,env(safe-area-inset-top));z-index:5;background:#3a2306;border:3px solid #e9b949;border-radius:12px;padding:3px 10px;color:#ffe9a8;font-weight:900;text-align:right;line-height:1.1}
#mbo .pg-coin small{display:block;font-size:10px}
#mbo .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px;max-width:760px;margin:0 auto}
#mbo .card{background:#f6e7c4;border:3px solid #8a5a1e;border-radius:12px;padding:6px;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;text-align:center;color:#3a2306;font-family:inherit}
#mbo .card img{width:80px;height:80px;object-fit:contain;image-rendering:pixelated}
#mbo .card b{font-size:12px}
#mbo .card.empty{background:#0003;border-style:dashed;color:#fff8;min-height:118px;justify-content:center;font-size:22px}
#mbo .note{max-width:760px;margin:0 auto 10px;color:#fff;font-size:12px;line-height:1.5;text-align:center}
#mbo .bigbtn{display:block;width:100%;max-width:520px;margin:8px auto;border:4px solid #3a2306;border-radius:16px;background:linear-gradient(#ffe27a,#f2b84b);color:#3a2306;padding:14px;font:900 18px/1.3 var(--f-body,sans-serif);box-shadow:0 4px 0 #8a5a1e}
#mbo .bigbtn small{display:block;font-size:12px}
#mbo .bigbtn:disabled{filter:grayscale(1);opacity:.6}
.mb-dlg{position:fixed;inset:0;z-index:150;background:#0009;display:flex;align-items:center;justify-content:center;padding:16px}
.mb-dlg>div{background:#fff8e8;color:#3a2306;border:4px solid #3a2306;border-radius:18px;padding:16px;max-width:440px;width:100%;max-height:86vh;overflow:auto;text-align:center;font-size:14px;line-height:1.5}
.mb-dlg h3{margin:0 0 8px;font-size:19px}
.mb-dlg .row{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.mb-dlg .row button{flex:1;min-width:30%;border:0;border-radius:12px;padding:12px;font:900 15px/1.2 var(--f-body,sans-serif);background:#efe2c6;color:#3a2306}
.mb-dlg .row button.go{background:#f2c94c;box-shadow:0 3px 0 #b8902a}
.mb-dlg .al{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;margin-top:8px}
.mb-dlg .al button{border:3px solid #d9bf8a;border-radius:12px;background:#fdf7e6;padding:6px;font:900 12px/1.3 var(--f-body,sans-serif);color:#3a2306;display:flex;flex-direction:column;align-items:center}
.mb-dlg .al button:disabled{opacity:.45}
.mb-dlg .al img{width:64px;height:64px;object-fit:contain;image-rendering:pixelated}
.mb-dlg .acts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
.mb-dlg .acts button{border:3px solid #3a2306;border-radius:12px;background:#f6e7c4;padding:12px 6px;font:900 16px/1.2 var(--f-body,sans-serif);color:#3a2306}
.mb-dlg .acts button small{display:block;font-size:11px;font-weight:700}
.mb-dlg .acts button:disabled{opacity:.4}
.mb-dlg input{width:100%;box-sizing:border-box;border:3px solid #3a2306;border-radius:12px;padding:12px;font:900 18px/1 var(--f-body,sans-serif);text-align:center}
.mg-pick .mg-mb{position:relative;padding:0!important;overflow:hidden;min-height:96px;background:#2b5b8a!important}
.mg-pick .mg-mb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.9}
.mg-pick .mg-mb span{position:relative;z-index:1;background:linear-gradient(90deg,#000c,#0000);color:#fff;padding:10px 12px;align-self:stretch;display:flex;flex-direction:column;justify-content:center;text-shadow:0 2px 3px #000}
.mg-pick .mg-mb span small{color:#ffe9a8}
`;
document.head.appendChild(css);

/* ---------- 共通 ---------- */
const V={};
function closeAll(){ if(V.leave) { const f=V.leave; V.leave=null; f(); } (V.unsubs||[]).forEach(u=>{ try{ u(); }catch(e){} }); V.unsubs=[]; clearInterval(V.tick); clearInterval(V.hb); clearTimeout(V.mt);
  if(V.fit) removeEventListener("resize",V.fit); V.fit=null; document.getElementById("mbo")?.remove(); document.querySelectorAll(".mb-dlg").forEach(x=>x.remove()); }
function shell(W,H,bg){ closeAll(); const el=document.createElement("div"); el.id="mbo"; el.setAttribute("translate","no");
  el.innerHTML=`<div class="mb-blur" style="background-image:url(${bg})"></div><div class="mb-st" style="width:${W}px;height:${H}px;background-image:url(${bg})"></div>`;
  document.body.appendChild(el); const s=el.querySelector(".mb-st");
  const fit=()=>{ const k=Math.min(innerWidth/W, innerHeight/H); s.style.transform=`translate(${(innerWidth-W*k)/2}px,${(innerHeight-H*k)/2}px) scale(${k})`; };
  fit(); V.fit=fit; addEventListener("resize",fit); return s; }
function page(title, sub, back){ closeAll(); const el=document.createElement("div"); el.id="mbo"; el.className="page"; el.setAttribute("translate","no");
  el.innerHTML=`<div class="pg-h"><div>${title}${sub?`<small>${sub}</small>`:""}</div></div><button class="pg-x" type="button" aria-label="${T("もどる","Back")}">←</button><div class="pg-coin"><small>${T("所持コイン","Coins")}</small><b id="mbCoin"></b></div><div class="pg"></div>`;
  document.body.appendChild(el); el.querySelector(".pg-x").onclick=()=>{ sfx("tap"); (back||openMenu)(); }; coinUpd(); return el.querySelector(".pg"); }
function dlg(html, btns=[[T("閉じる","Close"),null]], opt={}){ const bg=document.createElement("div"); bg.className="mb-dlg"; bg.setAttribute("translate","no");
  bg.innerHTML=`<div>${html}${btns.length?`<div class="row">${btns.map((b,i)=>`<button type="button" data-i="${i}" class="${i===btns.length-1&&btns.length>1?"go":""}">${b[0]}</button>`).join("")}</div>`:""}</div>`;
  document.body.appendChild(bg); bg.querySelectorAll("[data-i]").forEach(b=>b.onclick=()=>{ const f=btns[+b.dataset.i][1]; if(f&&f(bg)===true) return; bg.remove(); });
  if(!opt.modal) bg.onclick=e=>{ if(e.target===bg) bg.remove(); }; return bg; }
const hit=(id,x,y,w,h,lab)=>`<button type="button" class="hit" id="${id}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px" aria-label="${lab}"></button>`;
const tw=(ms,f)=>new Promise(res=>{ const t0=performance.now(); const step=t=>{ const k=Math.min(1,(t-t0)/ms); f(k); if(k<1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
const wait=ms=>new Promise(r=>setTimeout(r,ms));

/* ---------- 1：メニュー ---------- */
function openMenu(){ const s=shell(941,1672,"mb/menu.jpg"); st(); sfx("tap");
  s.innerHTML=`<button type="button" class="mb-back" id="mbX" style="left:24px;top:40px">← ${T("もどる","Back")}</button>
    <div class="mb-coin" id="mbCoin"></div>
    ${hit("mbForm",55,238,835,237,T("魔物編成","Formation"))}${hit("mbShop",55,492,835,235,T("アイテム購入","Items"))}${hit("mbGacha",55,748,835,237,T("ガチャ","Gacha"))}${hit("mbBox",55,1003,835,232,T("魔物BOX","Monster BOX"))}
    <div class="mb-cnt" id="mbCnt">${T("（参加人数）","(players)")}</div>
    <div class="mb-quest"><i>⚔️</i><b>${T("クエストマッチ","Quest Match")}</b><small>${T(`クエスト Lv.${st().qlv}`,`Quest Lv.${st().qlv}`)}</small></div>
    ${hit("mbRand",72,1265,266,260,T("ランダムマッチ","Random Match"))}${hit("mbQuest",338,1265,266,260,T("クエストマッチ","Quest Match"))}${hit("mbFriend",604,1265,266,260,T("フレンドマッチ","Friend Match"))}`;
  coinUpd(); const g=id=>document.getElementById(id);
  g("mbX").onclick=()=>{ sfx("tap"); closeAll(); };
  g("mbForm").onclick=()=>openForm(); g("mbShop").onclick=()=>openShop(); g("mbGacha").onclick=()=>openGacha(); g("mbBox").onclick=()=>openBox();
  g("mbRand").onclick=()=>startRandom(); g("mbQuest").onclick=()=>startQuest(); g("mbFriend").onclick=()=>startFriend();
  countPlayers(); }
window.openMB = openMenu;
async function countPlayers(){ const el=document.getElementById("mbCnt"); if(!el||!DB) return;
  try{ const q=await DB.collection("mbq").where("at",">",now()-25000).get(); if(document.getElementById("mbCnt")) el.textContent=T(`待っている人 ${q.size}人`,`${q.size} waiting`); }catch(e){} }

/* ---------- 2：魔物編成 ---------- */
const FROWS=[200,385,570,885,1070,1255];
function teamOf(){ const b=st(); return b.form.map(f=>{ if(!f) return null; const u=b.units.find(x=>x.u===f.u); if(!u||!monOf(u.id)) return null; return {id:u.id, lv:f.lv||1, w:f.w||null, u:f.u}; }); }
function weapFree(id, exceptSlot){ const b=st(); const used=b.form.filter((f,i)=>f&&f.w===id&&i!==exceptSlot).length; return (b.weap[id]||0)-used; }
function openForm(){ const s=shell(1024,1536,"mb/form.jpg"); const b=st(); sfx("tap");
  const tm=teamOf();
  s.innerHTML=`<button type="button" class="mb-back" id="mbX" style="left:20px;top:22px">← ${T("もどる","Back")}</button>`+FROWS.map((top,i)=>{ const t=tm[i], m=t&&monOf(t.id), sv=t&&statOf(t.id,t.lv,t.w), W=t&&wOf(t.w);
      return `<div class="fm-cell" style="left:112px;top:${top+12}px;width:172px;height:156px">${m?`<img src="${m.img}" alt="">`:""}</div>
      <div class="fm-st" style="left:312px;top:${top+26}px">${m?`<b>Lv.${t.lv}</b>　${esc2(mname(m))}<br>⚔ ${T("攻撃力","ATK")} ${nf(sv.atk)}<br>❤ ${T("体力","HP")} ${nf(sv.hp)}`:`<small>${T("＋をタップして魔物をえらぶ","Tap ＋ to pick a monster")}</small>`}</div>
      <div class="fm-cell" style="left:730px;top:${top+12}px;width:194px;height:156px">${W?`<img src="${W.img}" alt="">`:""}</div>
      ${hit("fmM"+i,110,top+8,178,164,T("魔物","Monster"))}${hit("fmA"+i,568,top+92,130,70,T("能力","Ability"))}${hit("fmW"+i,726,top+8,202,164,T("装備","Equip"))}`; }).join("");
  document.getElementById("mbX").onclick=()=>openMenu();
  FROWS.forEach((_,i)=>{ const g=id=>document.getElementById(id);
    g("fmM"+i).onclick=()=>pickMon(i); g("fmW"+i).onclick=()=>pickWeap(i);
    g("fmA"+i).onclick=()=>{ const t=teamOf()[i], m=t&&monOf(t.id); if(!m) return dlg(`<p>${T("魔物がいません","No monster")}</p>`);
      const sv=statOf(t.id,t.lv,t.w);
      dlg(`<img src="${m.img}" alt="" style="width:120px;height:120px;object-fit:contain;image-rendering:pixelated"><h3>${esc2(mname(m))}　Lv.${t.lv}</h3><p>⚔ ${T("攻撃力","ATK")} ${nf(sv.atk)}　❤ ${T("体力","HP")} ${nf(sv.hp)}</p><p><b>✨ ${T("能力","Ability")}</b><br>${m.magic?`${esc2(m.magic.name)}：${esc2(m.magic.desc||"")}`:T("なし（魔法は使えない）","None (can't use magic)")}</p>${t.w?`<p>🗡 ${esc2(wOf(t.w).name)}（⚔+${wOf(t.w).atk||0} ❤+${wOf(t.w).hp||0}）</p>`:""}<p style="font-size:11px">${T("バトルに勝つとレベルは持ちこし、負けると全員Lv1にもどります。","Win and levels carry over; lose and everyone returns to Lv1.")}</p>`); }; }); }
function pickMon(i){ const b=st(); if(!b.units.length) return dlg(`<h3>${T("魔物がいません","No monsters")}</h3><p>${T("ガチャで魔物を手に入れよう！","Get monsters from the gacha!")}</p>`,[[T("閉じる","Close"),null],[T("ガチャへ","Gacha"),()=>openGacha()]]);
  const cur=b.form[i];
  const bg=dlg(`<h3>${T(`${i<3?"前半":"後半"}編成 ${i%3+1}番目`,`${i<3?"Front":"Back"} slot ${i%3+1}`)}</h3><p style="font-size:12px">${T("同じ魔物を何回入れてもOK","The same monster can be used more than once")}</p><div class="al">${b.units.map(u=>{ const m=monOf(u.id); return m?`<button type="button" data-u="${u.u}"><img src="${m.img}" alt=""><span>${esc2(mname(m))}</span><small>⚔${m.atk} ❤${m.hp}${m.magic?" ✨":""}</small></button>`:""; }).join("")}</div>`,
    cur?[[T("閉じる","Close"),null],[T("はずす","Remove"),()=>{ b.form[i]=null; save(); openForm(); }]]:[[T("閉じる","Close"),null]]);
  bg.querySelectorAll("[data-u]").forEach(x=>x.onclick=()=>{ const u=+x.dataset.u; const keepW=cur&&cur.w; b.form[i]={u, lv:1, w:keepW||null}; save(); bg.remove(); sfx("tap"); openForm(); }); }
function pickWeap(i){ const b=st(); if(!b.form[i]) return dlg(`<p>${T("先に魔物をえらんでね","Pick a monster first")}</p>`);
  const own=MB_WEAPONS.filter(w=>(b.weap[w.id]||0)>0);
  if(!own.length) return dlg(`<h3>🗡 ${T("装備がありません","No equipment")}</h3><p>${T("装備ガチャで手に入れよう！","Get equipment from the equipment gacha!")}</p>`,b.form[i].w?[[T("閉じる","Close"),null],[T("はずす","Remove"),()=>{ b.form[i].w=null; save(); openForm(); }]]:[[T("閉じる","Close"),null]]);
  const bg=dlg(`<h3>🗡 ${T("装備をえらぶ","Choose equipment")}</h3><div class="al">${own.map(w=>{ const left=weapFree(w.id,i); return `<button type="button" data-w="${w.id}" ${left>0?"":"disabled"}><img src="${w.img}" alt=""><span>${esc2(w.name)}</span><small>⚔+${w.atk||0} ❤+${w.hp||0}<br>${T(`のこり${left}`,`${left} left`)}</small></button>`; }).join("")}</div>`,
    b.form[i].w?[[T("閉じる","Close"),null],[T("はずす","Remove"),()=>{ b.form[i].w=null; save(); openForm(); }]]:[[T("閉じる","Close"),null]]);
  bg.querySelectorAll("[data-w]").forEach(x=>x.onclick=()=>{ b.form[i].w=+x.dataset.w; save(); bg.remove(); openForm(); }); }

/* ---------- 魔物BOX ---------- */
function openBox(){ const box=page(`📦 ${T("魔物BOX","Monster BOX")}`, T(`枠 ${st().units.length}/${st().slots}（1枠1万コインで増やせる・最大${MB.SLOT_MAX}枠）`,`${st().units.length}/${st().slots} slots (+1 slot for 10,000 coins, max ${MB.SLOT_MAX})`)); const b=st();
  box.innerHTML=`<button type="button" class="bigbtn" id="bxAdd" ${b.slots>=MB.SLOT_MAX?"disabled":""}>➕ ${T("枠を1つ増やす","Add 1 slot")}<small>${b.slots>=MB.SLOT_MAX?T("これ以上増やせません","Max reached"):T(`${fmt(MB.SLOT_COST)}コイン（いま ${b.slots}枠）`,`${fmt(MB.SLOT_COST)} coins (now ${b.slots})`)}</small></button>
    <div class="grid">${b.units.map(u=>{ const m=monOf(u.id); return `<button type="button" class="card" data-u="${u.u}">${m?`<img src="${m.img}" alt=""><b>${esc2(mname(m))}</b><small>⚔${m.atk} ❤${m.hp}${m.magic?" ✨":""}</small>`:"?"}</button>`; }).join("")}${Array.from({length:Math.max(0,Math.min(b.slots,b.units.length+30)-b.units.length)},()=>`<div class="card empty">＋</div>`).join("")}</div>`;
  box.querySelector("#bxAdd").onclick=()=>{ if(b.slots>=MB.SLOT_MAX) return; if((S.coins||0)<MB.SLOT_COST) return dlg(`<p>${T("コインが足りません","Not enough coins")}</p>`);
    dlg(`<p>${T(`${fmt(MB.SLOT_COST)}コインで、BOXの枠を1つ増やしますか？`,`Add 1 BOX slot for ${fmt(MB.SLOT_COST)} coins?`)}</p>`,[[T("やめる","Cancel"),null],[T("増やす","Add"),()=>{ if((S.coins||0)<MB.SLOT_COST) return; S.coins-=MB.SLOT_COST; b.slots=Math.min(MB.SLOT_MAX,b.slots+1); save(); coinUpd(); sfx("coin"); openBox(); }]]); };
  box.querySelectorAll("[data-u]").forEach(c=>c.onclick=()=>{ const u=b.units.find(x=>x.u===+c.dataset.u), m=u&&monOf(u.id); if(!u) return;
    const inForm=b.form.some(f=>f&&f.u===u.u);
    dlg(`${m?`<img src="${m.img}" alt="" style="width:140px;height:140px;object-fit:contain;image-rendering:pixelated"><h3>${esc2(mname(m))}</h3><p>⚔ ${T("攻撃力","ATK")} ${m.atk}　❤ ${T("体力","HP")} ${m.hp}<br>✨ ${T("能力","Ability")}：${m.magic?esc2(m.magic.name):T("なし","None")}</p>`:""}${inForm?`<p style="font-size:12px">${T("編成に入っています","In your formation")}</p>`:""}`,
      [[T("閉じる","Close"),null],[T("お別れする","Release"),()=>{ dlg(`<p>${T("この魔物とお別れしますか？（もどせません）","Release this monster? (can't undo)")}</p>`,[[T("やめる","Cancel"),null],[T("お別れする","Release"),()=>{ releaseUnit(u.u); openBox(); }]]); }]]); }); }
function releaseUnit(uu){ const b=st(); b.units=b.units.filter(x=>x.u!==uu); b.form=b.form.map(f=>f&&f.u===uu?null:f); save(); }

/* ---------- アイテム購入 ---------- */
function openShop(){ const box=page(`🧪 ${T("アイテム購入","Item Shop")}`, T("買ったアイテムは、バトル中に「アイテム使用」で使える","Use items in battle with \"Use item\"")); const b=st();
  box.innerHTML=MB_ITEMS.length?`<div class="grid">${MB_ITEMS.map(x=>`<button type="button" class="card" data-i="${x.id}"><img src="${x.img}" alt=""><b>${esc2(x.name)}</b><small>${x.heal?T(`体力+${x.heal}`,`HP+${x.heal}`):""}</small><small>💰${fmt(x.price)}</small><small>${T(`持っている ${b.items[x.id]||0}`,`Own ${b.items[x.id]||0}`)}</small></button>`).join("")}</div>`:`<p class="note">${T("アイテムは準備中です。","Items are coming soon.")}</p>`;
  box.querySelectorAll("[data-i]").forEach(c=>c.onclick=()=>{ const x=iOf(+c.dataset.i); if(!x) return;
    dlg(`<img src="${x.img}" alt="" style="width:100px;height:100px;object-fit:contain"><h3>${esc2(x.name)}</h3><p>${esc2(x.desc||"")}${x.heal?T(`体力を${x.heal}回復`,`Restores ${x.heal} HP`):""}</p><p>💰 ${fmt(x.price)}</p>`,[[T("やめる","Cancel"),null],[T("買う","Buy"),()=>{ if((S.coins||0)<x.price){ dlg(`<p>${T("コインが足りません","Not enough coins")}</p>`); return; } S.coins-=x.price; b.items[x.id]=(b.items[x.id]||0)+1; save(); coinUpd(); sfx("coin"); openShop(); }]]); }); }

/* ---------- ガチャ ---------- */
function openGacha(){ const box=page(`🎰 ${T("ガチャ","Gacha")}`, ""); const G=MB_GACHA;
  box.innerHTML=`<button type="button" class="bigbtn" id="gcM" ${G.mon.pool.length?"":"disabled"}>🥚 ${T("魔物ガチャ","Monster Gacha")}<small>${G.mon.pool.length?T(`1回 ${fmt(G.mon.cost)}コイン`,`${fmt(G.mon.cost)} coins`):T("準備中","Coming soon")}</small></button>
    <button type="button" class="bigbtn" id="gcW" ${G.weapon.pool.length?"":"disabled"}>🗡 ${T("装備ガチャ","Equipment Gacha")}<small>${G.weapon.pool.length?T(`1回 ${fmt(G.weapon.cost)}コイン`,`${fmt(G.weapon.cost)} coins`):T("準備中","Coming soon")}</small></button>
    <p class="note">${T(`魔物BOXの枠：${st().units.length}/${st().slots}`,`BOX: ${st().units.length}/${st().slots}`)}</p>`;
  box.querySelector("#gcM").onclick=()=>pull("mon"); box.querySelector("#gcW").onclick=()=>pull("weapon"); }
function pick(pool){ const tot=pool.reduce((a,x)=>a+(x.w||1),0); let r=Math.random()*tot; for(const x of pool){ if((r-=(x.w||1))<0) return x.id; } return pool[pool.length-1].id; }
function pull(kind){ const G=MB_GACHA[kind]; if(!G.pool.length) return; if((S.coins||0)<G.cost) return dlg(`<p>${T("コインが足りません","Not enough coins")}</p>`);
  S.coins-=G.cost; coinUpd(); const b=st(); const id=pick(G.pool); sfx("reveal","S");
  if(kind==="weapon"){ const w=wOf(id); b.weap[id]=(b.weap[id]||0)+1; save(); return dlg(`<h3>🗡 ${T("ゲット！","Got it!")}</h3>${w?`<img src="${w.img}" alt="" style="width:140px;height:140px;object-fit:contain"><p><b>${esc2(w.name)}</b><br>⚔+${w.atk||0} ❤+${w.hp||0}</p>`:""}`,[[T("OK","OK"),()=>openGacha()]]); }
  const m=monOf(id), nu={u:b.nu++, id}; save();
  const add=()=>{ b.units.push(nu); save(); openGacha(); };
  const show=`<img src="${m?m.img:""}" alt="" style="width:140px;height:140px;object-fit:contain;image-rendering:pixelated"><p><b>${esc2(mname(m))}</b><br>⚔ ${m?m.atk:0}　❤ ${m?m.hp:0}${m&&m.magic?`<br>✨ ${esc2(m.magic.name)}`:""}</p>`;
  if(b.units.length<b.slots) return dlg(`<h3>🥚 ${T("ゲット！","Got it!")}</h3>${show}`,[[T("OK","OK"),()=>{ add(); }]],{modal:true});
  // 枠がいっぱい：持っている魔物とお別れするか、出た魔物とお別れする
  const bg=dlg(`<h3>📦 ${T("BOXがいっぱい！","Your BOX is full!")}</h3>${show}<p>${T("持っている魔物を1体えらんでお別れするか、出た魔物とお別れしてね。","Release one of your monsters, or release the new one.")}</p><div class="al">${b.units.map(u=>{ const mm=monOf(u.id); return `<button type="button" data-u="${u.u}"><img src="${mm?mm.img:""}" alt=""><span>${esc2(mname(mm))}</span></button>`; }).join("")}</div>`,[[T("出た魔物とお別れ","Release the new one"),()=>{ openGacha(); }]],{modal:true});
  bg.querySelectorAll("[data-u]").forEach(x=>x.onclick=()=>{ releaseUnit(+x.dataset.u); bg.remove(); add(); }); }

/* =========================================================
   バトル
   ========================================================= */
// チームのデータ（6体）：[{id,lv,w}|null]。体力・攻撃力はレベルと装備から計算
function mkSide(team){ const us=[]; (team||[]).forEach((t,slot)=>{ if(!t||!monOf(t.id)) return; const s=statOf(t.id,t.lv,t.w); us.push({id:t.id, lv:t.lv||1, w:t.w||null, slot, atk:s.atk, hp:s.hp, max:s.hp, g:MB.GUARDS}); });
  // 場の3体：前半編成から（いなければ後半から）
  const field=[null,null,null]; const order=us.map((_,i)=>i).sort((a,b)=>us[a].slot-us[b].slot); let k=0;
  for(const i of order){ if(k<3 && us[i].slot<3){ field[k++]=i; } }
  for(const i of order){ if(k<3 && !field.includes(i)){ field[k++]=i; } }
  return {us, field}; }
const alive = u => u && u.hp>0;
const reserves = sd => sd.us.map((u,i)=>i).filter(i=>!sd.field.includes(i));
const sideDead = sd => sd.us.every(u=>u.hp<=0);
// 1ターンの結果（両方の行動から、同じ結果になるように計算する）
function resolve(B, acts, turnSeed){ const R=rng(turnSeed), ev=[]; const sides=[B.a,B.b];
  const A=[acts[0]||[],acts[1]||[]];
  const guard=[new Set(),new Set()], open=[new Set(),new Set()];
  // 1) 交代（交代したターンは何もできず、無防備）
  sides.forEach((sd,s)=>A[s].forEach((a,p)=>{ if(!a||a.t!=="swap") return; const cur=sd.field[p], r=a.r; if(r==null||!alive(sd.us[r])||sd.field.includes(r)) return; sd.field[p]=r; open[s].add(p); ev.push({k:"swap",s,p,from:cur,to:r}); }));
  // 2) レベルアップ・アイテム
  sides.forEach((sd,s)=>A[s].forEach((a,p)=>{ if(!a||open[s].has(p)) return; const ui=sd.field[p], u=sd.us[ui]; if(!alive(u)) return;
    if(a.t==="lvup"){ u.lv++; u.atk*=MB.GROW; u.hp*=MB.GROW; u.max*=MB.GROW; ev.push({k:"lvup",s,p}); }
    if(a.t==="item"){ const it=iOf(a.i); if(it&&it.heal){ const h=Math.min(it.heal, u.max-u.hp); u.hp+=h; ev.push({k:"heal",s,p,v:h,item:a.i}); } else ev.push({k:"item",s,p,item:a.i}); } }));
  // 3) ガード（そのターンのダメージ半分・3回まで）
  sides.forEach((sd,s)=>A[s].forEach((a,p)=>{ if(!a||a.t!=="guard"||open[s].has(p)) return; const u=sd.us[sd.field[p]]; if(!alive(u)||u.g<=0) return; u.g--; guard[s].add(p); ev.push({k:"guard",s,p}); }));
  // 4) 攻撃・魔法（ダメージは同時に入る）
  const dmg=[[0,0,0],[0,0,0]], heal=[[0,0,0],[0,0,0]];
  const liveTargets = s => [0,1,2].filter(p=>alive(sides[s].us[sides[s].field[p]]));
  sides.forEach((sd,s)=>A[s].forEach((a,p)=>{ if(!a||open[s].has(p)) return; const u=sd.us[sd.field[p]]; if(!alive(u)) return; const o=1-s, lt=liveTargets(o);
    if(a.t==="atk"){ if(!lt.length) return; let t=a.tg; if(!lt.includes(t)) t=lt[Math.floor(R()*lt.length)]; const v=u.atk*(0.9+R()*0.2); dmg[o][t]+=v; ev.push({k:"atk",s,p,t,v}); }
    if(a.t==="magic"){ const mg=(monOf(u.id)||{}).magic; if(!mg) return; const v=u.atk*(mg.power||1)*(0.9+R()*0.2);
      if(mg.kind==="heal"){ [0,1,2].forEach(q=>{ if(alive(sd.us[sd.field[q]])) heal[s][q]+=v; }); ev.push({k:"magic",s,p,heal:1}); }
      else if(mg.kind==="one"){ if(!lt.length) return; let t=a.tg; if(!lt.includes(t)) t=lt[Math.floor(R()*lt.length)]; dmg[o][t]+=v; ev.push({k:"magic",s,p,t}); }
      else { lt.forEach(t=>dmg[o][t]+=v); ev.push({k:"magic",s,p,all:1}); } } }));
  const hits=[];
  sides.forEach((sd,s)=>[0,1,2].forEach(p=>{ const u=sd.us[sd.field[p]]; if(!u) return;
    if(heal[s][p]>0&&alive(u)){ const h=Math.min(heal[s][p],u.max-u.hp); u.hp+=h; hits.push({s,p,v:h,heal:1}); }
    if(dmg[s][p]>0){ const v=guard[s].has(p)?dmg[s][p]/2:dmg[s][p]; u.hp=Math.max(0,u.hp-v); hits.push({s,p,v,gd:guard[s].has(p)}); } }));
  // 5) 倒れた魔物は、待機している魔物と自動で入れかわる
  const outs=[];
  sides.forEach((sd,s)=>[0,1,2].forEach(p=>{ const u=sd.us[sd.field[p]]; if(u&&u.hp<=0){ outs.push({s,p,id:u.id}); const r=reserves(sd).find(i=>alive(sd.us[i])); sd.field[p]=r!=null?r:sd.field[p]; if(r!=null) ev.push({k:"in",s,p,to:r}); } }));
  B.turn++;
  const da=sideDead(B.a), db=sideDead(B.b); if(da||db) B.end = da&&db ? "draw" : da ? "b" : "a";
  return {ev, hits, outs}; }
// ボットの作戦
function botActs(B, s, R){ const sd=s?B.b:B.a, o=s?B.a:B.b; const lt=[0,1,2].filter(p=>alive(o.us[o.field[p]]));
  return [0,1,2].map(p=>{ const u=sd.us[sd.field[p]]; if(!alive(u)) return null;
    if(u.hp<u.max*.35 && u.g>0 && R()<.45) return {t:"guard"};
    const mg=(monOf(u.id)||{}).magic; if(mg && R()<.4) return {t:"magic", tg:lt[Math.floor(R()*lt.length)]};
    return {t:"atk", tg:lt[Math.floor(R()*lt.length)]}; }); }
const defaultActs = (sd) => [0,1,2].map(p=>{ const u=sd.us[sd.field[p]]; if(!alive(u)) return null; return u.g>0?{t:"guard"}:null; });

/* ---------- バトル画面 ---------- */
const FIELD={ en:[[282,612],[468,612],[654,612]], me:[[212,948],[468,948],[724,948]] };
const TOPX=[42,342,632], ROWY=[1010,1165,1320];
function openBattle(cfg){ // cfg: {mode:"quest"|"pvp", B, me:0|1, qlv, send(acts), onEnd}
  const s=shell(937,1678,"mb/battle.jpg"); V.B=cfg.B; V.cfg=cfg; V.sel=[null,null,null]; V.submitted=false; V.anim=false; V.turnAt=Date.now();
  s.innerHTML=`<div class="bt-time" id="btTime"></div>${TOPX.map((x,i)=>`<div class="bt-top" id="btT${i}" style="left:${x}px"></div>`).join("")}
    <div id="btField"></div>${ROWY.map((y,i)=>`<div class="bt-row" id="btR${i}" style="top:${y+20}px"></div>${hit("btRH"+i,75,y+20,620,140,T("戦略を立てる","Plan"))}`).join("")}
    <div class="bt-rs" id="btRs"></div>${hit("btSwap",715,1015,180,470,T("待機してる魔物と交代","Swap"))}
    <div class="bt-oklab" id="btOkLab"></div>${hit("btOk",290,1500,360,124,T("準備OK","Ready"))}
    <button type="button" class="mb-back" id="btGiveup" style="left:18px;top:24px;font-size:22px;padding:8px 14px">🏳 ${T("降参","Give up")}</button>
    <div class="bt-msg" id="btMsg" hidden></div>`;
  [0,1,2].forEach(i=>{ document.getElementById("btRH"+i).onclick=()=>planUnit(i); });
  document.getElementById("btSwap").onclick=()=>planSwap();
  document.getElementById("btOk").onclick=()=>ready();
  document.getElementById("btGiveup").onclick=()=>{ if(V.B.end) return; dlg(`<p>${T("降参しますか？（負けになり、編成の魔物は全員Lv1にもどります）","Give up? (You lose and all formation monsters go back to Lv1)")}</p>`,[[T("やめる","Cancel"),null],[T("降参する","Give up"),()=>{ cfg.giveup&&cfg.giveup(); finish(cfg.me?"a":"b", true); }]]); };
  V.leave=()=>{ if(V.B&&!V.B.end){ cfg.giveup&&cfg.giveup(); finish(cfg.me?"a":"b", true, true); } };
  drawBattle(); say(cfg.mode==="quest"?T(`クエスト Lv.${cfg.qlv}`,`Quest Lv.${cfg.qlv}`):T("バトル開始！","Battle start!"),1600);
  V.tick=setInterval(()=>{ const left=Math.max(0, MB.TURN_MS-(Date.now()-V.turnAt)); const el=document.getElementById("btTime"); if(el) el.textContent=V.B.end?"":T(`ターン${V.B.turn+1}　のこり ${Math.ceil(left/1000)}秒`,`Turn ${V.B.turn+1} · ${Math.ceil(left/1000)}s`);
    if(!V.submitted && !V.anim && !V.B.end && left<=0) ready(true); cfg.tick&&cfg.tick(); },500); }
const mySide = () => V.cfg.me ? V.B.b : V.B.a;
const enSide = () => V.cfg.me ? V.B.a : V.B.b;
function barHtml(u){ const p=u?Math.max(0,u.hp/u.max*100):0; return `<div class="bar ${p<25?"crit":p<50?"low":""}"><i style="width:${p.toFixed(1)}%"></i></div>`; }
function actTxt(a){ if(!a) return T("戦略を立てる","Make a plan");
  return a.t==="atk"?T(`⚔ 攻撃 → 敵${a.tg+1}`,`⚔ Attack → Enemy ${a.tg+1}`):a.t==="guard"?T("🛡 ガード","🛡 Guard"):a.t==="magic"?T("✨ 魔法","✨ Magic"):a.t==="lvup"?T("⬆ レベルアップ","⬆ Level up"):a.t==="item"?T(`🧪 ${(iOf(a.i)||{}).name||"アイテム"}`,`🧪 ${(iOf(a.i)||{}).name||"Item"}`):a.t==="swap"?T("🔄 交代","🔄 Swap"):""; }
function drawBattle(){ const me=mySide(), en=enSide();
  TOPX.forEach((x,i)=>{ const el=document.getElementById("btT"+i); if(!el) return; const u=en.us[en.field[i]], m=u&&monOf(u.id);
    el.innerHTML=alive(u)?`<img src="${m.img}" alt=""><div class="tx">Lv.${u.lv}　<small style="font-size:22px">${T("敵","Enemy")}${i+1}</small>${barHtml(u)}<small style="font-size:20px">❤ ${nf(Math.ceil(u.hp*10)/10)}/${nf(u.max)}</small></div>`:`<div class="tx" style="text-align:center;opacity:.6">—</div>`; });
  const f=document.getElementById("btField"); if(f) f.innerHTML=[0,1,2].map(p=>{ const u=en.us[en.field[p]], m=u&&monOf(u.id); const [x,y]=FIELD.en[p];
      return alive(u)?`<div class="bt-unit" id="btE${p}" data-p="${p}" style="left:${x}px;top:${y}px;width:160px;height:160px;margin:-160px 0 0 -80px"><img src="${m.img}" alt=""></div>`:""; }).join("")
    +[0,1,2].map(p=>{ const u=me.us[me.field[p]], m=u&&monOf(u.id); const [x,y]=FIELD.me[p];
      return alive(u)?`<div class="bt-unit" id="btM${p}" style="left:${x}px;top:${y}px"><img src="${m.back||m.img}" alt="">${V.sel[p]&&V.sel[p].t==="guard"?`<span class="gd">🛡</span>`:""}</div>`:""; }).join("");
  [0,1,2].forEach(p=>{ const el=document.getElementById("btR"+p); if(!el) return; const u=me.us[me.field[p]], m=u&&monOf(u.id);
    el.className="bt-row"+(alive(u)?"":" dead");
    el.innerHTML=u?`<img src="${m.img}" alt=""><span class="lv">Lv.${u.lv}</span><span class="ac ${V.sel[p]?"set":""}">${alive(u)?actTxt(V.sel[p]):T("たおれた","Down")}</span>${barHtml(u)}`:""; });
  const rs=document.getElementById("btRs"); if(rs) rs.innerHTML=reserves(me).map(i=>{ const u=me.us[i], m=monOf(u.id); return `<img src="${m.img}" class="${alive(u)?"":"dead"}" alt="">`; }).join("");
  const lab=document.getElementById("btOkLab"), ok=document.getElementById("btOk"); if(lab) lab.textContent=V.submitted?T("相手を待っています…","Waiting for opponent..."):"";
  coinUpd(); }
const msgT={};
function say(t,ms=1500){ const el=document.getElementById("btMsg"); if(!el) return; el.innerHTML=t; el.hidden=false; clearTimeout(msgT.t); msgT.t=setTimeout(()=>{ el.hidden=true; },ms); }
// 戦略を立てる
function planUnit(p){ if(V.submitted||V.anim||V.B.end) return; const me=mySide(), u=me.us[me.field[p]]; if(!alive(u)) return; const m=monOf(u.id), b=st(); sfx("tap");
  const items=MB_ITEMS.filter(x=>(b.items[x.id]||0)-V.sel.filter(a=>a&&a.t==="item"&&a.i===x.id).length>0);
  const lvCost=MB.LVUP*(1+V.sel.filter((a,q)=>a&&a.t==="lvup"&&q!==p).length);
  const bg=dlg(`<h3>${esc2(mname(m))}　Lv.${u.lv}</h3><p style="margin:0">⚔ ${nf(u.atk)}　❤ ${nf(Math.ceil(u.hp*10)/10)}/${nf(u.max)}</p>
    <div class="acts"><button type="button" data-a="atk">⚔ ${T("攻撃","Attack")}<small>${T("敵をえらぶ","Choose a target")}</small></button>
    <button type="button" data-a="guard" ${u.g>0?"":"disabled"}>🛡 ${T("ガード","Guard")}<small>${T(`ダメージ半分・のこり${u.g}回`,`Half damage · ${u.g} left`)}</small></button>
    <button type="button" data-a="magic" ${m.magic?"":"disabled"}>✨ ${T("魔法","Magic")}<small>${m.magic?esc2(m.magic.name):T("使えない魔物","Can't use magic")}</small></button>
    <button type="button" data-a="lvup" ${(S.coins||0)>=lvCost?"":"disabled"}>⬆ ${T("レベルアップ","Level up")}<small>${T(`${fmt(MB.LVUP)}コイン・全ステータス1.5倍`,`${fmt(MB.LVUP)} coins · all stats ×1.5`)}</small></button>
    <button type="button" data-a="item" ${items.length?"":"disabled"} style="grid-column:1/-1">🧪 ${T("アイテム使用","Use item")}<small>${items.length?T(`${items.length}種類`,`${items.length} kinds`):T("持っていない","None")}</small></button></div>`,
    V.sel[p]?[[T("閉じる","Close"),null],[T("戦略を取り消す","Clear"),()=>{ V.sel[p]=null; drawBattle(); }]]:[[T("閉じる","Close"),null]]);
  bg.querySelectorAll("[data-a]").forEach(x=>x.onclick=()=>{ const a=x.dataset.a; bg.remove();
    if(a==="guard"||a==="lvup"){ V.sel[p]={t:a}; drawBattle(); return; }
    if(a==="atk"||(a==="magic"&&m.magic&&m.magic.kind==="one")) return pickTarget(p,a);
    if(a==="magic"){ V.sel[p]={t:"magic"}; drawBattle(); return; }
    if(a==="item"){ const ib=dlg(`<h3>🧪 ${T("アイテムをえらぶ","Choose an item")}</h3><div class="al">${items.map(x=>`<button type="button" data-i="${x.id}"><img src="${x.img}" alt=""><span>${esc2(x.name)}</span><small>×${(b.items[x.id]||0)}</small></button>`).join("")}</div>`);
      ib.querySelectorAll("[data-i]").forEach(y=>y.onclick=()=>{ V.sel[p]={t:"item", i:+y.dataset.i}; ib.remove(); drawBattle(); }); } }); }
function pickTarget(p,a){ const en=enSide(); const lt=[0,1,2].filter(q=>alive(en.us[en.field[q]])); if(!lt.length) return;
  say(T("ねらう敵をタップ！","Tap an enemy to target!"),2500);
  lt.forEach(q=>{ const el=document.getElementById("btE"+q); if(!el) return; el.classList.add("pick"); el.onclick=()=>{ document.querySelectorAll(".bt-unit.pick").forEach(z=>{ z.classList.remove("pick"); z.onclick=null; }); V.sel[p]={t:a, tg:q}; drawBattle(); say(T(`敵${q+1}をねらう`,`Targeting enemy ${q+1}`),900); }; }); }
function planSwap(){ if(V.submitted||V.anim||V.B.end) return; const me=mySide(); const rs=reserves(me).filter(i=>alive(me.us[i])&&!V.sel.some(a=>a&&a.t==="swap"&&a.r===i));
  if(!rs.length) return dlg(`<p>${T("交代できる待機中の魔物がいません","No waiting monsters to swap in")}</p>`);
  const bg=dlg(`<h3>🔄 ${T("待機してる魔物と交代","Swap with a waiting monster")}</h3><p style="font-size:12px">${T("交代したターンは、その場所の魔物は攻撃・ガード・魔法ができず、無防備になります。","On the swap turn, that spot can't attack, guard or use magic, and is defenseless.")}</p>
    <p><b>① ${T("下がる魔物","Who goes out")}</b></p><div class="al">${[0,1,2].map(p=>{ const u=me.us[me.field[p]]; return u?`<button type="button" data-p="${p}"><img src="${monOf(u.id).img}" alt=""><span>Lv.${u.lv}</span></button>`:""; }).join("")}</div>`,[[T("やめる","Cancel"),null]]);
  bg.querySelectorAll("[data-p]").forEach(x=>x.onclick=()=>{ const p=+x.dataset.p; bg.remove();
    const b2=dlg(`<h3>🔄 ${T("出てくる魔物","Who comes in")}</h3><div class="al">${rs.map(i=>{ const u=me.us[i]; return `<button type="button" data-r="${i}"><img src="${monOf(u.id).img}" alt=""><span>Lv.${u.lv}</span><small>❤ ${nf(Math.ceil(u.hp*10)/10)}</small></button>`; }).join("")}</div>`,[[T("やめる","Cancel"),null]]);
    b2.querySelectorAll("[data-r]").forEach(y=>y.onclick=()=>{ V.sel[p]={t:"swap", r:+y.dataset.r}; b2.remove(); drawBattle(); }); }); }
function ready(auto){ if(V.submitted||V.anim||V.B.end) return; const me=mySide(); const acts=[0,1,2].map(p=>{ const u=me.us[me.field[p]]; if(!alive(u)) return null; return V.sel[p] || (auto? (u.g>0?{t:"guard"}:null) : null); });
  if(!auto && acts.some((a,p)=>!a && alive(me.us[me.field[p]]))){ return dlg(`<p>${T("戦略を立てていない魔物は「ガード」になります（のこりがなければ何もしない）。いいですか？","Monsters without a plan will Guard (or do nothing if no guards left). OK?")}</p>`,[[T("やめる","Cancel"),null],[T("準備OK","Ready"),()=>{ V.sel=acts.map((a,p)=>a||(alive(me.us[me.field[p]])&&me.us[me.field[p]].g>0?{t:"guard"}:null)); ready(true); }]]); }
  // レベルアップのコインは、決めたときに払う
  const lv=acts.filter(a=>a&&a.t==="lvup").length; if(lv){ if((S.coins||0)<lv*MB.LVUP){ return dlg(`<p>${T("コインが足りません","Not enough coins")}</p>`); } S.coins-=lv*MB.LVUP; save(); coinUpd(); }
  acts.forEach(a=>{ if(a&&a.t==="item"){ const b=st(); b.items[a.i]=Math.max(0,(b.items[a.i]||0)-1); } }); save();
  V.submitted=true; sfx("tap"); drawBattle(); V.cfg.send(acts); }
// 両方の作戦がそろったら、結果を見せる
async function playTurn(actsA, actsB){ if(V.anim) return; V.anim=true; const B=V.B, before=JSON.parse(JSON.stringify(B));
  const res=resolve(B,[actsA,actsB], (B.seed^(B.turn*2654435761))>>>0);
  // 演出：攻撃した魔物がゆれて、ダメージの数字が出る
  const meIdx=V.cfg.me, pos=(s,p)=>s===meIdx?FIELD.me[p]:FIELD.en[p], el=(s,p)=>document.getElementById((s===meIdx?"btM":"btE")+p);
  const B2=V.B; V.B=before; drawBattle();
  for(const e of res.ev){ if(e.k==="swap") say(e.s===meIdx?T("🔄 交代！","🔄 Swap!"):T("🔄 敵が交代！","🔄 Enemy swapped!"),700);
    if(e.k==="lvup") say(e.s===meIdx?T("⬆ レベルアップ！","⬆ Level up!"):T("⬆ 敵がレベルアップ！","⬆ Enemy leveled up!"),700);
    if(e.k==="magic") say(e.s===meIdx?T("✨ 魔法！","✨ Magic!"):T("✨ 敵の魔法！","✨ Enemy magic!"),700); }
  V.B=B2; drawBattle();
  res.hits.forEach(h=>{ const [x,y]=pos(h.s,h.p); const d=document.createElement("div"); d.className="bt-dmg"+(h.heal?" heal":""); d.style.left=x+"px"; d.style.top=(y-200)+"px"; d.textContent=(h.heal?"+":"-")+nf(h.v)+(h.gd?"🛡":"");
    document.querySelector("#mbo .mb-st")?.appendChild(d); setTimeout(()=>d.remove(),1200); const u=el(h.s,h.p); if(u&&!h.heal){ u.classList.remove("hit1"); void u.offsetWidth; u.classList.add("hit1"); } });
  if(res.hits.some(h=>!h.heal)) sfx("ng");
  await wait(1300); V.sel=[null,null,null]; V.submitted=false; V.anim=false; V.turnAt=Date.now(); drawBattle();
  if(B2.end){ const win=B2.end==="draw"?"draw":(B2.end==="a")===(meIdx===0)?"win":"lose"; finish(win==="draw"?"draw":win==="win"?(meIdx?"b":"a"):(meIdx?"a":"b")); } }
function finish(endSide, giveup, silent){ const B=V.B; if(B.end&&B._done) return; B.end=B.end||endSide; B._done=1; const meIdx=V.cfg.me;
  const res = endSide==="draw" ? "draw" : (endSide==="a")===(meIdx===0) ? "win" : "lose"; const b=st();
  clearInterval(V.tick); V.leave=null;
  if(res==="win"){ // レベルは持ちこし
    mySide().us.forEach(u=>{ if(b.form[u.slot]) b.form[u.slot].lv=u.lv; });
  } else if(res==="lose"){ b.form.forEach(f=>{ if(f) f.lv=1; }); }
  let coin=0; if(res==="win"){ coin=V.cfg.mode==="quest"?questPrize(V.cfg.qlv):MB.WIN_COIN; S.coins+=coin; if(V.cfg.mode==="quest") b.qlv=(b.qlv||1)+1; b.w=(b.w||0)+1; } else if(res==="lose") b.l=(b.l||0)+1;
  save(); coinUpd(); V.cfg.onEnd&&V.cfg.onEnd(res);
  if(silent) return;
  sfx(res==="win"?"reveal":"ng", "S");
  dlg(`<div style="font-size:60px">${res==="win"?"🏆":res==="draw"?"🤝":"💀"}</div><h3>${res==="win"?T("勝利！","Victory!"):res==="draw"?T("引き分け","Draw"):T("敗北…","Defeat...")}</h3>
    <p>${res==="win"?T(`+${fmt(coin)}コイン！<br>編成の魔物のレベルは、次のバトルに持ちこせます。`,`+${fmt(coin)} coins!<br>Your monsters keep their levels for the next battle.`):res==="draw"?T("おたがい全滅しました。レベルはそのままです。","Both sides fell. Levels stay as they are."):T("編成の魔物のレベルが、全員Lv1にもどりました。","All formation monsters went back to Lv1.")}</p>`,[[T("メニューへ","Menu"),()=>openMenu()]],{modal:true}); }
const questPrize = lv => Math.max(1, Math.floor(Math.pow(1.5, (lv||1)-1)));   // Lv1は1コイン。レベルが上がるほど増える

/* ---------- クエストマッチ（ボット） ---------- */
function myTeam(){ const t=teamOf(); return t.map(x=>x?{id:x.id, lv:x.lv, w:x.w}:null); }
function needTeam(){ if(!myTeam().some(Boolean)){ dlg(`<h3>${T("編成に魔物がいません","No monsters in your formation")}</h3><p>${T("「魔物編成」で魔物を入れてね。","Add monsters in Formation.")}</p>`,[[T("閉じる","Close"),null],[T("魔物編成へ","Formation"),()=>openForm()]]); return false; } return true; }
function startQuest(){ if(!needTeam()) return; if(!MB_MONS.length) return; const lv=st().qlv||1, R=rng((Date.now()^lv*7919)>>>0);
  const enemy=Array.from({length:6},()=>({id:MB_MONS[Math.floor(R()*MB_MONS.length)].id, lv, w:null}));
  dlg(`<div style="font-size:50px">⚔️</div><h3>${T(`クエスト Lv.${lv}`,`Quest Lv.${lv}`)}</h3><p>${T(`敵はLv.${lv}の魔物6体。勝つと <b>${fmt(questPrize(lv))}コイン</b>！<br>負けると編成の魔物は全員Lv1にもどります。`,`6 enemies at Lv.${lv}. Win for <b>${fmt(questPrize(lv))} coins</b>!<br>Lose and your monsters return to Lv1.`)}</p>`,[[T("やめる","Cancel"),null],[T("戦う！","Fight!"),()=>{
    const B={a:mkSide(myTeam()), b:mkSide(enemy), turn:0, seed:Math.floor(R()*4e9)};
    openBattle({mode:"quest", B, me:0, qlv:lv, send:acts=>{ const ba=botActs(V.B,1,rng((V.B.seed+V.B.turn*31)>>>0)); setTimeout(()=>playTurn(acts,ba),400); } }); }]]); }

/* ---------- ランダムマッチ・フレンドマッチ（Firestore） ---------- */
// mbq/{uid}：ランダムマッチの待ち（at：最後に生きていた時刻・m：決まった対戦のID）
// mbf/{あいことば}：フレンドマッチの待ち
// mbm/{id}：対戦（a・b：2人のuid、ta・tb：チーム、seed、a0/b0…：ターンごとの作戦、fo：降参した側）
function needLogin(){ if(!DB||!MYID){ dlg(`<p>${T("ログインすると対戦できます","Sign in to battle other players")}</p>`); return false; } return true; }
function waitDlg(txt, onCancel){ const bg=dlg(`<div style="font-size:50px">⏳</div><h3>${txt}</h3><p id="mbWt" style="font-size:12px"></p>`,[[T("やめる","Cancel"),()=>{ onCancel(); }]],{modal:true}); return bg; }
async function startRandom(){ if(!needTeam()||!needLogin()) return; const team=myTeam(), ref=DB.collection("mbq").doc(MYID); let done=false;
  const stop=()=>{ done=true; clearInterval(V.hb); (V.unsubs||[]).forEach(u=>{ try{ u(); }catch(e){} }); V.unsubs=[]; ref.delete().catch(()=>{}); };
  const bg=waitDlg(T("対戦相手をさがしています…","Looking for an opponent..."), stop);
  try{ await ref.set({uid:MYID, at:now(), team, m:null}); }catch(e){ bg.remove(); return dlg(`<p>${T("つながりませんでした","Couldn't connect")} ${esc2(e.code||"")}</p>`); }
  V.hb=setInterval(()=>{ if(!done) ref.update({at:now()}).catch(()=>{}); },8000);
  V.unsubs=[ref.onSnapshot(s=>{ const d=s.data(); if(!done&&d&&d.m){ stop(); bg.remove(); joinMatch(d.m); } },()=>{})];
  // 自分からも相手をさがす
  const seek=async()=>{ if(done) return; try{ const q=await DB.collection("mbq").where("at",">",now()-25000).limit(30).get();
      const c=q.docs.map(x=>x.data()).filter(x=>x.uid!==MYID&&!x.m).sort((a,b)=>a.at-b.at)[0];
      if(c){ const id=await DB.runTransaction(async tx=>{ const r2=DB.collection("mbq").doc(c.uid), s2=await tx.get(r2), s1=await tx.get(ref); if(!s2.exists||s2.data().m||!s1.exists||s1.data().m) return null;
          const mref=DB.collection("mbm").doc(); tx.set(mref,{a:c.uid, b:MYID, ta:s2.data().team, tb:team, seed:Math.floor(Math.random()*4e9), at:now()}); tx.update(r2,{m:mref.id}); tx.update(ref,{m:mref.id}); return mref.id; });
        if(id) return; } }catch(e){}
    if(!done) setTimeout(seek, 3000+Math.random()*2000); };
  seek(); }
function passKey(p){ let h=5381; const s=String(p).trim(); for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return "k"+(h>>>0).toString(36)+"_"+s.length; }
function startFriend(){ if(!needTeam()||!needLogin()) return;
  const bg=dlg(`<h3>🤝 ${T("フレンドマッチ","Friend Match")}</h3><p>${T("おたがい同じあいことばを入れると対戦できます。","Enter the same passphrase as your friend.")}</p><input id="mbPass" maxlength="20" placeholder="${T("あいことば","Passphrase")}">`,[[T("やめる","Cancel"),null],[T("さがす","Search"),b=>{ const p=(b.querySelector("#mbPass").value||"").trim(); if(p.length<2){ return true; } b.remove(); friendGo(p); }]]);
  setTimeout(()=>bg.querySelector("#mbPass")?.focus(),50); }
async function friendGo(pass){ const team=myTeam(), ref=DB.collection("mbf").doc(passKey(pass)); let done=false;
  const stop=()=>{ done=true; (V.unsubs||[]).forEach(u=>{ try{ u(); }catch(e){} }); V.unsubs=[]; clearInterval(V.hb); ref.get().then(s=>{ if(s.exists&&s.data().uid===MYID&&!s.data().m) ref.delete().catch(()=>{}); }).catch(()=>{}); };
  const bg=waitDlg(T(`あいことば「${esc2(pass)}」で待っています…`,`Waiting with passphrase "${esc2(pass)}"...`), stop);
  try{ const id=await DB.runTransaction(async tx=>{ const s=await tx.get(ref); const d=s.exists?s.data():null;
      if(d && d.uid!==MYID && !d.m && d.at>now()-60000){ const mref=DB.collection("mbm").doc(); tx.set(mref,{a:d.uid, b:MYID, ta:d.team, tb:team, seed:Math.floor(Math.random()*4e9), at:now()}); tx.update(ref,{m:mref.id}); return mref.id; }
      tx.set(ref,{uid:MYID, at:now(), team, m:null}); return null; });
    if(id){ stop(); bg.remove(); return joinMatch(id); }
  }catch(e){ bg.remove(); return dlg(`<p>${T("つながりませんでした","Couldn't connect")} ${esc2(e.code||"")}</p>`); }
  V.hb=setInterval(()=>{ if(!done) ref.update({at:now()}).catch(()=>{}); },8000);
  V.unsubs=[ref.onSnapshot(s=>{ const d=s.data(); if(!done&&d&&d.m&&d.uid===MYID){ stop(); bg.remove(); joinMatch(d.m); } },()=>{})]; }
async function joinMatch(id){ const ref=DB.collection("mbm").doc(id); let d; try{ d=(await ref.get()).data(); }catch(e){} if(!d) return dlg(`<p>${T("対戦が見つかりませんでした","Match not found")}</p>`);
  const meIdx=d.a===MYID?0:1, my=meIdx?"b":"a", op=meIdx?"a":"b";
  const B={a:mkSide(d.ta), b:mkSide(d.tb), turn:0, seed:d.seed>>>0}; let pending=null, missed=0;
  const cfg={mode:"pvp", B, me:meIdx,
    send:acts=>{ ref.update({[my+B.turn]:JSON.stringify(acts)}).catch(()=>{}); },
    giveup:()=>{ ref.update({fo:my}).catch(()=>{}); },
    tick:()=>{ // 相手が時間内に作戦を出さなかったら、相手の分をガードで出す（3回続いたら相手の負け）
      if(V.B.end||V.anim||!V.submitted) return; if(Date.now()-V.turnAt>MB.TURN_MS+15000 && pending && pending[op+V.B.turn]==null){
        missed++; if(missed>=3){ ref.update({fo:op}).catch(()=>{}); return; }
        ref.update({[op+V.B.turn]:JSON.stringify(defaultActs(meIdx?V.B.a:V.B.b))}).catch(()=>{}); V.turnAt=Date.now()-MB.TURN_MS; } },
    onEnd:()=>{ (V.unsubs||[]).forEach(u=>{ try{ u(); }catch(e){} }); V.unsubs=[]; } };
  openBattle(cfg);
  const step=()=>{ if(!pending||V.anim||V.B.end) return; if(pending.fo){ const lost=pending.fo; finish(lost==="a"?"b":"a"); if(lost===op) say(T("相手が降参しました","Your opponent gave up"),2500); return; }
    const t=V.B.turn, a=pending["a"+t], b=pending["b"+t]; if(a!=null&&b!=null){ if(pending[op+t]) missed=0; playTurn(JSON.parse(a),JSON.parse(b)).then(()=>setTimeout(step,50)); } };
  V.unsubs=[ref.onSnapshot(s=>{ pending=s.data()||pending; step(); },()=>{})]; }

window.__mb={ openForm, openBox, openGacha, openShop, startQuest, resolve, mkSide, MB_MONS, MB_WEAPONS, MB_ITEMS, MB_GACHA, playTurn };
})();
