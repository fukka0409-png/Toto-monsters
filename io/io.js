/* 魔物サバイバル（試作・ふっかーだけ・2026-10-28）
   ホーム：えらんだ魔物・チェンジ・記録・スタート
   ゲーム：スティックで動く。ふれた相手とレベルで勝負（高い方の勝ち・同じなら押し合うだけ）。武器が多いほど少しずつ速くなる
           勝つとLv+1で体が大きくなる。武器を10個以上集めると脱出できる
           脱出：そのゲームのLvぶん冒険者Lvが上がる。4位以内で脱出すると四天王回数+1
           負け：記録は残らず、そのゲームのLvぶん冒険者Lvが下がる（1より下にはならない） */
(function(){
"use strict";
const IO={ W:3200, H:3200, N:120, WEAP:150, NEED:10, R0:40 };
const $id=id=>document.getElementById(id);
const escH=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rnd=(a,b)=>a+Math.random()*(b-a), ri=(a,b)=>Math.floor(rnd(a,b+1));
// 体の大きさの個体差はなし（2026-10-28）：大きさはレベルだけで決まる
const sf=id=>1;
// 勝ち負け（2026-10-28 変更）：レベルが高い方の勝ち。同じなら押し合うだけ
const cmp=(a,b)=>a.lv-b.lv;
// ポリポリの武器は1個＝0.1レベル（10個で1レベル）。レベルは小数第1位まで
const r1=x=>Math.round(x*10)/10, lvT=x=>{ x=r1(x); return Number.isInteger(x)?String(x):x.toFixed(1); };
// 武器1個ごとに足が3%ずつ速くなる（10個で約30%）
const wSpd=w=>1+0.03*(w||0);   // 2026-10-28：1個ごとに3%（前は1.5%）
// 体の大きさ（2026-10-28）：Lv1はとても小さく、Lv1000でフィールドと同じ大きさ（画面いっぱい）。Lv1=16・Lv10=74・Lv100=345・Lv1000=1600
const LV_MAX=1000, radius=(lv,f)=>16*f*Math.pow(Math.max(1,Math.min(LV_MAX,lv)),2/3);
// 足の速さ：体が大きくなるほど遅くなる（画面の見た目の速さは Lv10で約75%・Lv50で約40%・Lv100で約25%）。敵も同じ
// 2026-10-28：レベルによる速さ。Lv2からは決まった割合でなめらかに遅くなる（Lv2=2.5倍・Lv5=2.0倍・Lv10≈1.6倍・Lv20≈1.4倍・Lv50≈1.2倍）。Lv1だけは特別に速い（4倍）
const lvSpd=lv=>{ const L=Math.floor(r1(lv||1)); return L<=1?4:(1+9/(L+4))*0.75; };   // 2026-10-28：Lv2からはさらに4分の3
const speedOf=(r,lv)=>100*Math.pow(IO.R0/r,0.05)*lvSpd(lv);
// 武器の絵は3種類（io/w1〜w3.png）からランダム
const WEAPONS=[1,2,3].map(n=>{ const im=new Image(); im.src="io/w"+n+".png"; return im; });
// 特別な武器（2026-10-28）：金の武器＝1個で+3レベル（出る確率5%・2026-10-28に1%から変更）・虹の武器＝1個で+10レベル（0.01%）。ふつうの武器は+0.1レベル
const WSP={g:{lv:3,p:0.05,im:(()=>{ const i=new Image(); i.src="io/wg.png"; return i; })()}, r:{lv:10,p:0.0001,im:(()=>{ const i=new Image(); i.src="io/wr.png"; return i; })()}};
const wLv=w=>w.k?WSP[w.k].lv:0;   // 2026-10-28：ふつうの武器を拾ってもレベルは上がらない（金・虹の武器はそのまま）
const imgCache={};
function img(id){ if(imgCache[id]) return imgCache[id]; const m=typeof mon==="function"&&mon(id); const im=new Image(); if(m&&m.img) im.src=m.img; return imgCache[id]=im; }
function enemyPool(){ try{ return (typeof MONSTERS!=="undefined"?MONSTERS:[]).filter(m=>m&&m.img&&m.rank!=="L"&&m.rank!=="F"&&!m.gift).map(m=>m.id); }catch(e){ return [18]; } }
function myMonId(){ try{ const h=homeCfg(); if(typeof h.m==="number") return h.m; }catch(e){} try{ return (S.units[0]||{m:1}).m; }catch(e){ return 1; } }

let G=null;
function open(){ if(G) return;
  const pool=enemyPool(); const pid=myMonId();
  const root=document.createElement("div"); root.id="ioG";
  root.innerHTML=`<style>
#ioG{position:fixed;inset:0;z-index:180;background:#6fbf4a;touch-action:none;user-select:none;-webkit-user-select:none;font-family:var(--f-body,sans-serif);overflow:hidden}
#ioG canvas{position:absolute;inset:0;width:100%;height:100%}
#ioG .hud{position:absolute;left:0;right:0;top:calc(env(safe-area-inset-top,0px) + 6px);display:grid;grid-template-columns:1fr 1fr 48px;gap:6px;padding:0 8px;pointer-events:none}
#ioG .bx{background:#fff;border:4px solid #1d1d1d;box-shadow:0 3px 0 #1d1d1d;height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 10px;font-weight:900;color:#1d1d1d;font-size:16px}
#ioG .bx b{font-size:26px}
#ioG .rk{background:#f2b631}
#ioG .gear{pointer-events:auto;grid-column:3;grid-row:1;height:44px;border:4px solid #1d1d1d;background:#333;color:#fff;font-size:24px;border-radius:6px}
#ioG .esc{pointer-events:auto;grid-column:2/4;background:#bbb;border:4px solid #1d1d1d;box-shadow:0 3px 0 #1d1d1d;height:48px;font-weight:900;font-size:19px;color:#1d1d1d;text-align:right;padding:0 12px;position:relative}
#ioG .esc small{position:absolute;left:6px;top:3px;font-size:11px;color:#e53935;background:#0003;padding:0 3px}
#ioG .esc.ok{background:#f2dc3a;cursor:pointer}
#ioG .esc.ok small{display:none}
#ioG .stick[hidden]{display:none}
#ioG .atk{position:absolute;top:calc(env(safe-area-inset-top,0px) + 130px);width:110px;height:64px;border:4px solid #1d1d1d;border-radius:12px;background:#e53935;color:#fff;font:900 22px/1 var(--f-body,sans-serif);box-shadow:0 4px 0 #1d1d1d;text-shadow:0 2px 0 #0006;z-index:3}
#ioG .atk:active{transform:translateY(3px);box-shadow:0 1px 0 #1d1d1d}
#ioG .atk[disabled]{background:#999;opacity:.7}
#ioG .atk.l{left:10px}#ioG .atk.r{right:10px}
#ioG .stick{position:absolute;right:16px;bottom:calc(env(safe-area-inset-bottom,0px) + 26px);width:150px;height:150px;border-radius:50%;background:#2a4a1a55;pointer-events:none}
#ioG .knob{position:absolute;left:50%;top:50%;width:70px;height:70px;margin:-35px 0 0 -35px;border-radius:50%;background:#ffffffcc}
#ioG .dlg{position:absolute;inset:0;display:grid;place-items:center;background:#0009;z-index:5}
#ioG .dlg>div{background:#fff;border:4px solid #1d1d1d;border-radius:16px;padding:18px;max-width:320px;width:86%;text-align:center;color:#1d1d1d}
#ioG .dlg h3{margin:4px 0 8px;font-size:22px}
#ioG .dlg p{margin:6px 0;font-weight:700;line-height:1.6}
#ioG .dlg button{display:block;width:100%;margin-top:8px;padding:12px;border-radius:12px;border:3px solid #1d1d1d;background:#f2dc3a;font:inherit;font-weight:900;font-size:17px}
#ioG .dlg button.g{background:#eee}
</style>
<canvas id="ioCv"></canvas>
<div class="hud"><div class="bx" style="grid-column:1;justify-content:center"><b id="ioLv" style="font-size:24px">Lv.1</b></div><div class="bx rk"><small>順位</small><b id="ioRk">1</b><small>位</small></div><button class="gear" type="button" id="ioGear" aria-label="設定">⚙</button>
<div class="bx" style="grid-column:1;grid-row:2"><span>武器数</span><b id="ioWp">0</b><span>個<small id="ioAm" style="display:block;font-size:11px;color:#d32f2f;line-height:1">🗡0</small></span></div><button class="esc" type="button" id="ioEsc"><small>武器を${IO.NEED}個以上集めて</small>脱出する</button></div>
<button class="atk l" type="button" data-atk="1">⚔ 武器</button>
<div class="stick" hidden><div class="knob" id="ioKnob"></div></div>`;
  document.body.appendChild(root);
  const cv=root.querySelector("#ioCv"), c=cv.getContext("2d");
  G={root,cv,c,pool,t:performance.now(),over:false,pause:false,
     P:{id:pid,lv:1,w:0,f:sf(pid),x:IO.W/2,y:IO.H/2,me:true}, E:[], WP:[], weap:0, kills:0, dir:{x:0,y:0}, touch:null, keys:{}};
  G.P.r=radius(1,G.P.f); img(pid);
  // 2026-10-28：敵の8割はスライム（Lv10くらいまで）、2割はほかの冒険者の記録（読みこめるまではスライムで待つ）
  // 2026-10-28：敵は基本スライム。ほかの冒険者の最高記録（レベルと武器の数）が、1人1回ずつ出てくる。記録が増えるほどスライムが減る
  for(let i=0;i<IO.N;i++) G.E.push(spawnSlime(true));
  G.maxL=1; G.maxW=0;
  for(let i=0;i<IO.WEAP;i++) G.WP.push(spawnWeapon());
  G.rec=[]; G.recT=0;   // 2026-10-28：ほかの冒険者の記録を出すのは中止（敵はスライムだけ）
  grass();
  const rs=()=>{ const d=Math.min(2,window.devicePixelRatio||1); G.dpr=d; cv.width=Math.round(innerWidth*d); cv.height=Math.round(innerHeight*d); };
  rs(); G.onRs=rs; addEventListener("resize",rs);
  // 操作：画面のどこでも、さわったところから指を動かした方向へ進む（スティックの絵は右下）
  const knob=root.querySelector("#ioKnob");
  // 2026-10-28：ゆっくりオート移動。いつも向いている方向へ進み、画面を指でスライドすると、その方向へ向きを変える
  // 2026-10-28：オート移動はなし。画面をスライドしているあいだだけ動き、指をはなすと進んでいた方向へ武器を1つ投げる
  const AUTO=0.45; G.head={x:1,y:0}; G.dir={x:0,y:0};
  const setDir=(dx,dy)=>{ const l=Math.hypot(dx,dy); if(l<8){ G.dir={x:0,y:0}; return; } G.head={x:dx/l,y:dy/l}; const m=Math.min(1,l/60)*AUTO; G.dir={x:G.head.x*m,y:G.head.y*m}; };
  root.addEventListener("pointerdown",e=>{ if(e.target.closest("button,.dlg")) return; G.touch={id:e.pointerId,x:e.clientX,y:e.clientY}; G.fireOn=false; });
  root.addEventListener("pointermove",e=>{ if(!G||!G.touch||G.touch.id!==e.pointerId) return; setDir(e.clientX-G.touch.x,e.clientY-G.touch.y); });
  const up=e=>{ if(!G||!G.touch||G.touch.id!==e.pointerId) return; G.touch=null; G.dir={x:0,y:0}; if((G.ammo||0)>0){ const g=fireGap(); throwW(); G.fireOn=true; G.fireT=g; } };   // 指をはなすと止まって、すぐ1つ投げ、止まっているあいだは続けて投げる
  root.addEventListener("pointerup",up); root.addEventListener("pointercancel",up);
  G.kd=e=>{ if(!G) return; G.keys[e.key]=e.type==="keydown"; const k=G.keys, dx=(k.ArrowRight?1:0)-(k.ArrowLeft?1:0), dy=(k.ArrowDown?1:0)-(k.ArrowUp?1:0); setDir(dx*60,dy*60); if(e.type==="keyup"&&e.key===" ") throwW(); };
  addEventListener("keydown",G.kd); addEventListener("keyup",G.kd);
  root.querySelector("#ioGear").onclick=()=>{ if(G.over) return; G.pause=true;
    dlg(`<h3>⚙ 一時停止</h3><p>やめると<b>負け</b>になります（冒険者Lvが今のLvぶん下がります）</p><button type="button" data-a="go">つづける</button><button type="button" class="g" data-a="quit">やめる（負け）</button>`,a=>{ if(a==="go"){ G.pause=false; G.t=performance.now(); } else lose("やめました"); }); };
  // 攻撃（2026-10-28）：進んでいる方向へ、拾った武器を1つ投げる（武器数−1）。当たった魔物はレベル−1
  root.querySelectorAll("[data-atk]").forEach(b=>b.addEventListener("pointerdown",e=>{ e.preventDefault(); e.stopPropagation(); throwW(); }));   // 左の武器ボタン：押すたびに1つ投げる
  root.querySelector("#ioEsc").onclick=()=>{ if(G.over||G.weap<IO.NEED) return; escape(); };
  hud(); G.raf=requestAnimationFrame(loop);
  // 始まった直後の説明（読んでから「スタート！」で動き出す）
  G.pause=true;
  dlg(`<h3>⚔️ ルール</h3><p style="text-align:left">・ポリポリの武器を${IO.NEED}個集めて脱出クリアしよう！<br>・武器を${IO.NEED}個以上持っていれば、やられても脱出クリアになります！<br>・自分よりサイズが大きい魔物に触れると即死です！<br>・画面をスライドしているあいだ、魔物が動きます！<br>・指をはなすと、進んでいた方向へ赤い武器を投げ続けます。武器を1つ拾うと赤い武器が5つ補充されます（左上の🗡の数）。拾った武器が多いほど速く投げます！<br>・左の「⚔ 武器」ボタンでも、押すたびに1つ投げられます当たった魔物はレベル−1！Lv1の魔物なら倒せます！<br>・ふつうの武器を拾ってもレベルは上がりません（金・虹の武器は上がります）</p><p style="margin:10px 0 0;padding:10px;border-radius:10px;background:#fff3cd;border:3px solid #e53935;color:#c62828;font-weight:900;line-height:1.6">🔥 脱出に成功すれば、上がったレベルの分だけ冒険者レベルが上昇します！<br>💀 ただ負けてしまうと、レベルの分だけ冒険者レベルが下がります…</p><button type="button" data-a="go">スタート！</button>`,()=>{ if(!G) return; G.pause=false; G.t=performance.now(); });
}
// 2026-10-28：コンピューターの魔物の4割は融合ランクの魔物（融合ランクがまだ読みこめていなければ、ふつうの魔物）
function fusedPool(){ try{ return [...new Set([...Object.keys(FMON_CACHE),...Object.keys((S&&S.fmons)||{})].map(Number))].filter(id=>{ const m=mon(id); return m&&m.img&&m.rank==="F"; }); }catch(e){ return []; } }
const SLIME_MAX=LV_MAX-1;   // 2026-10-28：スライムのレベル上限はなし（自分のレベルに合わせて出てくる）
function slimePool(){ try{ return MONSTERS.filter(m=>m&&m.img&&/スライム/.test(m.name)).map(m=>m.id); }catch(e){ return [18]; } }
function spawnSlime(first){ const P=G.P, pool=G.sp||(G.sp=slimePool()), id=pool[ri(0,pool.length-1)]||18, f=sf(id);
  // 2026-10-28：自分のレベルのまわり。6割は自分と同じか少し低い、4割は自分より少し高い（+1〜+3）
  const pl=Math.floor(r1(P.lv||1)), lv=Math.random()<0.6?Math.max(1,pl-ri(0,3)):pl+ri(1,3);
  let x,y,t=0; do{ x=rnd(60,IO.W-60); y=rnd(60,IO.H-60); t++; }while(t<30&&Math.hypot(x-P.x,y-P.y)<700);
  img(id); const a=rnd(0,Math.PI*2); return {id,f,lv,w:0,x,y,r:radius(lv,f),vx:Math.cos(a),vy:Math.sin(a),turn:rnd(1,3),slime:1,role:"s"}; }
// 倒された・記録が終わった敵を、同じ役割（スライム／冒険者の記録）で出しなおす
function respawn(i){ G.E[i]=spawnSlime(false); }   // 冒険者の記録は1ゲームに1回だけなので、倒されたらスライムになる
function spawnEnemy(first){ const P=G.P, fp=fusedPool(), id=(fp.length&&Math.random()<0.4)?fp[ri(0,fp.length-1)]:(G.pool[ri(0,G.pool.length-1)]||18), f=sf(id);
  let lv; const r=Math.random();
  if(r<0.55) lv=Math.max(1,Math.round(P.lv*rnd(0.3,0.95))+ri(-1,1));
  else if(r<0.9) lv=Math.max(1,Math.round(P.lv*rnd(1,1.6))+ri(0,4));
  else lv=Math.max(1,Math.round(P.lv*rnd(1.6,3))+ri(5,20));
  if(first&&P.lv<=1) lv=r<0.6?1:ri(1,4);
  let x,y,t=0; do{ x=rnd(60,IO.W-60); y=rnd(60,IO.H-60); t++; }while(t<30&&Math.hypot(x-P.x,y-P.y)<700);
  img(id); const a=rnd(0,Math.PI*2);
  const w=(first&&P.lv<=1)?(Math.random()<0.1?1:0):(Math.random()<0.6?0:ri(0,(P.w||0)+2));   // 敵も武器を持っていることがある（はじめはほとんど持っていない）
  lv=Math.min(LV_MAX-1,r1(lv+w*0.1));
  return {id,f,lv,w,x,y,r:radius(lv,f),vx:Math.cos(a),vy:Math.sin(a),turn:rnd(1,3)}; }
// ===== 過去の冒険者の動き（ゴースト）=====
// 1ゲームの動きを0.25秒ごとに「x,y,Lv×10」で記録して ioghost に保存。ほかの冒険者のゲームで、その動きのまま草原を歩く
const REC_DT=0.25, REC_MAX=1200, GHOST_N=6;
const ADV_MAX=Math.round(IO.N*0.8);   // 冒険者の記録は最大で敵の8割まで（2割はいつもスライム）
async function loadAdv(){ if(typeof DB==="undefined"||!DB) return;
  try{ const q=await DB.collection("profiles").where("ioL",">",0).orderBy("ioL","desc").limit(200).get(); if(!G) return;
    const L=q.docs.map(d=>({uid:d.id,...d.data()})).filter(x=>x.uid!==MYID&&x.ioL>0).sort(()=>Math.random()-0.5).slice(0,ADV_MAX);
    L.forEach((x,k)=>{ const lv=Math.min(LV_MAX-1,r1(Number(x.ioL)||1)), id=Number(x.iom)||1, w=Math.max(0,Math.floor(Number(x.ioW)||0)); img(id);
      let px,py,t=0; do{ px=rnd(60,IO.W-60); py=rnd(60,IO.H-60); t++; }while(t<40&&Math.hypot(px-G.P.x,py-G.P.y)<900);
      const a=rnd(0,Math.PI*2); G.E[k]={adv:1, nm:String(x.name||"").slice(0,12), id, f:1, lv, w, x:px, y:py, r:radius(lv,1), vx:Math.cos(a), vy:Math.sin(a), turn:rnd(1,3)}; }); }catch(e){} }
async function loadGhosts(){ if(typeof DB==="undefined"||!DB) return;
  try{ const q=await DB.collection("ioghost").orderBy("at","desc").limit(80).get(); if(!G) return;
    for(const x of q.docs.map(d=>d.data())){ if(!x||x.uid===MYID||typeof x.d!=="string") continue; const a=x.d.split(",").map(Number); const path=[]; for(let i=0;i+2<a.length;i+=3) path.push([a[i],a[i+1],a[i+2]/10]); if(path.length<20) continue;
      G.GR.push({id:Number(x.m)||1, nm:String(x.nm||"").slice(0,12), path}); img(Number(x.m)||1); }
    G.E.forEach((e,i)=>{ if(e.role==="g") respawn(i); }); }catch(e){} }
function newGhost(){ if(!G||!G.GR||!G.GR.length) return null; const R=G.GR[ri(0,G.GR.length-1)];
  const g={ghost:true, role:"g", id:R.id, nm:R.nm, path:R.path, gt:rnd(0,R.path.length*REC_DT*0.4), mx:Math.random()<0.5?-1:1, ox:rnd(-900,900), oy:rnd(-900,900), f:1, w:0, vx:0, vy:0, turn:0, cd:rnd(2,4)};
  ghostPos(g); if(Math.hypot(g.x-G.P.x,g.y-G.P.y)<600){ g.ox+=900*(g.x<G.P.x?-1:1); ghostPos(g); } return g; }
function ghostPos(g){ const t=Math.max(0,g.gt/REC_DT), i=Math.min(g.path.length-1,Math.floor(t)), j=Math.min(g.path.length-1,i+1), u=Math.min(1,t-i), A=g.path[i], B=g.path[j];
  const cx=IO.W/2, cy=IO.H/2, x=A[0]+(B[0]-A[0])*u, y=A[1]+(B[1]-A[1])*u, px=g.x;
  g.x=Math.max(30,Math.min(IO.W-30, cx+(x-cx)*g.mx+g.ox)); g.y=Math.max(30,Math.min(IO.H-30, y+g.oy)); g.lv=Math.max(1,A[2]+(g.dl||0)); g.r=radius(g.lv,g.f);
  if(px!=null){ const dx=g.x-px; if(dx>0.5) g.vx=1; else if(dx<-0.5) g.vx=-1; else g.vx=0; } return i>=g.path.length-1; }
// 自分の最高記録（最高レベル・そのときの武器の数・使った魔物）。プロフィールに載せて、ほかの冒険者のゲームに出てくる
function saveAdv(){ try{ S.io=S.io||{k:0,b:0,s:0}; const L=r1(Math.max(G.maxL||1,G.P.lv)); if(L>(S.io.L||0)){ S.io.L=L; S.io.W=G.P.lv>=(G.maxL||0)?G.weap:(G.maxW||0); S.io.m=G.P.id; } }catch(e){} }
function saveGhost(){ try{ if(typeof DB==="undefined"||!DB||!MYID||!G||G.rec.length<40) return; const d=G.rec.map(v=>v.join(",")).join(",");
  DB.collection("ioghost").add({uid:MYID, nm:String(myName()).slice(0,12), m:G.P.id, d, n:G.rec.length, at:Date.now()}).catch(()=>{}); }catch(e){} }
const RED=[1,2,3].map(n=>{ const im=new Image(); im.src="io/r"+n+".png"; return im; });
// 止まっているあいだの発射の間隔：武器が多いほど早い（2個で1.5秒・3個で1秒・5個で0.6秒・10個で0.3秒。いちばん早くて0.15秒）
const fireGap=()=>Math.max(0.15,3/Math.max(1,G.weap));
// 2026-10-28：投げるのは赤い武器（拾った武器1つで5つ補充）。拾った武器の数（脱出・速さ）は減らない
function throwW(){ if(!G||G.over||G.pause) return; if((G.ammo||0)<=0) return;
  const P=G.P, h=G.head||{x:1,y:0}; G.ammo--;   /* 進んでいた方向へ投げる */ G.TH=G.TH||[];
  const sp=900*(G.dpr||1)/(G.ppu||1);   // 画面の上でいつも同じくらいの速さで飛ぶ
  G.TH.push({x:P.x+h.x*P.r*0.6, y:P.y+h.y*P.r*0.6, vx:h.x*sp, vy:h.y*sp, t:0, a:Math.atan2(h.y,h.x)+Math.PI/2, im:RED[ri(0,RED.length-1)]});
  try{ SFX.tap(); }catch(x){} hud(); }
function stepThrow(dt){ if(!G.TH||!G.TH.length) return; const hitR=26*(G.dpr||1)/(G.ppu||1);
  for(const t of G.TH){ t.t+=dt; t.x+=t.vx*dt; t.y+=t.vy*dt; t.a+=dt*14;
    if(t.own==="g"){ const P=G.P; if(Math.hypot(P.x-t.x,P.y-t.y)<P.r*0.7+hitR){ t.dead=1;   // 冒険者の記録の魔物が投げた武器：当たると自分のレベル−1、Lv1なら倒される
        if(Math.floor(r1(P.lv))<=1){ lose(`${escH(t.nm||"冒険者")}さんの投げた武器に倒された…`); return; }
        P.lv=Math.max(1,r1(P.lv-1)); P.r=radius(P.lv,P.f); P.hitT=0.35; flash("🗡 武器が当たった！ レベル−1"); }
      continue; }
    for(let i=0;i<G.E.length;i++){ const e=G.E[i]; if(Math.hypot(e.x-t.x,e.y-t.y)<e.r*0.7+hitR){ t.dead=1;
      if(Math.floor(r1(e.lv))<=1){ const P=G.P; dropWeapons(e); respawn(i); P.lv=Math.min(LV_MAX,r1(P.lv+1)); P.r=radius(P.lv,P.f); G.kills++; try{ SFX.coin(); }catch(x){} if(P.lv>=LV_MAX){ escape(true); return; } break; }   // Lv1の魔物は倒せる（自分のレベル+1）
      if(e.ghost) e.dl=(e.dl||0)-1; else { e.lv=Math.max(1,r1(e.lv-1)); e.r=radius(e.lv,e.f); } e.hitT=0.35; if(e.ghost) ghostPos(e); break; } } }
  G.TH=G.TH.filter(t=>!t.dead&&t.t<1.4&&t.x>-50&&t.y>-50&&t.x<IO.W+50&&t.y<IO.H+50); }
// 2026-10-28：倒した敵が持っていた武器は、その周りに全部散らばる（拾われたら消える。数のうちには入れない）
function dropWeapons(e){ const n=Math.min(40,Math.floor(e.w||0)); for(let k=0;k<n;k++){ const a=Math.random()*Math.PI*2, d=e.r*0.6+rnd(10,e.r*1.4+60);
  G.WP.push({x:Math.max(20,Math.min(IO.W-20,e.x+Math.cos(a)*d)), y:Math.max(20,Math.min(IO.H-20,e.y+Math.sin(a)*d)), k:null, im:WEAPONS[ri(0,WEAPONS.length-1)], a:rnd(-0.5,0.5), drop:1}); } }
function spawnWeapon(){ const u=Math.random(), k=u<WSP.r.p?"r":u<WSP.r.p+WSP.g.p?"g":null;
  return {x:rnd(40,IO.W-40),y:rnd(40,IO.H-40),k,im:k?WSP[k].im:WEAPONS[ri(0,WEAPONS.length-1)],a:rnd(-0.5,0.5)}; }
// 地面：草原のドット絵をタイルにする
function grass(){ const t=document.createElement("canvas"); t.width=t.height=128; const g=t.getContext("2d");
  g.fillStyle="#7ccf4f"; g.fillRect(0,0,128,128);
  const col=["#6cbf43","#8bd85c","#5fae3a","#94dd68"]; for(let i=0;i<260;i++){ g.fillStyle=col[i%4]; g.fillRect(ri(0,63)*2,ri(0,63)*2,2,2); }
  for(let i=0;i<5;i++){ const x=ri(4,120),y=ri(4,120); g.fillStyle="#3f8f2c"; g.fillRect(x,y,2,6); g.fillRect(x-3,y+2,2,4); g.fillRect(x+3,y+2,2,4); }
  for(let i=0;i<2;i++){ const x=ri(6,118),y=ri(6,118); g.fillStyle="#fff"; g.fillRect(x,y,4,4); g.fillStyle="#f6d44a"; g.fillRect(x+1,y+1,2,2); }
  if(Math.random()<1){ const x=ri(10,110),y=ri(10,110); g.fillStyle="#8d8d8d"; g.fillRect(x,y,10,6); g.fillStyle="#b9b9b9"; g.fillRect(x+2,y,6,3); g.fillStyle="#5c5c5c"; g.fillRect(x,y+6,10,2); }
  G.pat=G.c.createPattern(t,"repeat"); }
function hud(){ $id("ioLv").textContent="Lv."+Math.floor(r1(G.P.lv)); /* 表示は整数だけ（中では0.1刻みで数えている） */ $id("ioWp").textContent=G.weap;
  const rk=1+G.E.filter(e=>cmp(e,G.P)>0).length; G.rank=rk; $id("ioRk").textContent=rk;
  $id("ioEsc").classList.toggle("ok",G.weap>=IO.NEED); const am=$id("ioAm"); if(am) am.textContent="🗡"+(G.ammo||0); G.root.querySelectorAll("[data-atk]").forEach(b=>b.disabled=!(G.ammo>0)); }
function loop(now){ if(!G) return; const dt=Math.max(0,Math.min(0.05,(now-G.t)/1000)); G.t=now; G.fdt=dt;
  if(!G.pause&&!G.over) step(dt); draw(); G.raf=requestAnimationFrame(loop); }
function step(dt){ const P=G.P;
  // 歩く動き：右へ動くときは絵を左右反転して右向きに、左へ動くときはそのまま（絵はもともと左向き）。動いているあいだは少しはねる
  if(G.dir.x>0.15) P.face=1; else if(G.dir.x<-0.15) P.face=-1; P.mv=Math.hypot(G.dir.x,G.dir.y)>0.1; if(P.mv) P.ph=(P.ph||0)+dt*11;
  for(const e of G.E){ if(e.vx>0.15) e.face=1; else if(e.vx<-0.15) e.face=-1; e.mv=true; e.ph=(e.ph||rnd(0,6))+dt*9; }
  const sp=speedOf(P.r,P.lv)*wSpd(P.w); P.x=Math.max(P.r*0.5,Math.min(IO.W-P.r*0.5,P.x+G.dir.x*sp*dt)); P.y=Math.max(P.r*0.5,Math.min(IO.H-P.r*0.5,P.y+G.dir.y*sp*dt));
  if(P.lv>G.maxL){ G.maxL=P.lv; G.maxW=G.weap; }   // このゲームの最高レベルと、そのときの武器の数
  for(let i=0;i<G.E.length;i++){ const g=G.E[i]; if(!g.ghost) continue; g.gt+=dt; if(ghostPos(g)){ respawn(i); continue; }
  }
  for(const e of G.E){ if(e.ghost) continue; e.turn-=dt; const dx=P.x-e.x, dy=P.y-e.y, d=Math.hypot(dx,dy)||1, near=d<Math.max(420,P.r*6);
    if(near&&cmp(e,P)>0){ e.vx=dx/d; e.vy=dy/d; } else if(near&&cmp(e,P)<0){ e.vx=-dx/d; e.vy=-dy/d; }
    else if(e.turn<=0){ const a=rnd(0,Math.PI*2); e.vx=Math.cos(a); e.vy=Math.sin(a); e.turn=rnd(1,3); }
    const es=speedOf(e.r,e.lv)*wSpd(e.w)*0.75*(near&&cmp(e,P)>0?0.8:0.6); e.x+=e.vx*es*dt; e.y+=e.vy*es*dt;
    if(e.x<e.r*0.5||e.x>IO.W-e.r*0.5){ e.vx*=-1; e.x=Math.max(e.r*0.5,Math.min(IO.W-e.r*0.5,e.x)); }
    if(e.y<e.r*0.5||e.y>IO.H-e.r*0.5){ e.vy*=-1; e.y=Math.max(e.r*0.5,Math.min(IO.H-e.r*0.5,e.y)); } }
  // 敵どうし：ふれたら高い方が勝ってLv+1、負けた方は別の場所に出なおす
  for(let i=0;i<G.E.length;i++) for(let j=i+1;j<G.E.length;j++){ const a=G.E[i], b=G.E[j]; if(a.ghost||b.ghost) continue; const d=Math.hypot(a.x-b.x,a.y-b.y);
    if(d<(a.r+b.r)*0.5&&cmp(a,b)!==0){ const w=cmp(a,b)>0?a:b, l=w===a?j:i; w.lv=Math.min(w.slime?SLIME_MAX:LV_MAX-1,r1(w.lv+1)); w.r=radius(w.lv,w.f); respawn(l); } }
  // 自分とふれた敵
  for(let i=0;i<G.E.length;i++){ const e=G.E[i], d=Math.hypot(e.x-P.x,e.y-P.y); if(d>=(e.r+P.r)*0.5) continue;
    const r0=cmp(P,e);
    if(r0>0){ P.lv=r1(P.lv+1); P.r=radius(P.lv,P.f); G.kills++; dropWeapons(e); respawn(i); try{ SFX.coin(); }catch(x){} if(P.lv>=LV_MAX) return escape(true); }
    else if(r0<0){ const mn=escH((typeof mon==="function"&&mon(e.id)||{}).name||"魔物"); return lose((e.ghost||e.adv)?`${escH(e.nm||"冒険者")}さんの${mn}に負けた…`:`${mn}に負けた…`); }
    else if(!e.ghost){ const k=((e.r+P.r)*0.5-d)/(d||1)*0.5; e.x+=(e.x-P.x)*k; e.y+=(e.y-P.y)*k; } }
  for(const e of G.E) if(!e.ghost) for(let i=0;i<G.WP.length;i++){ const w=G.WP[i]; if(Math.abs(w.x-e.x)<e.r&&Math.hypot(w.x-e.x,w.y-e.y)<e.r*0.6+20){ e.w++; e.lv=Math.min(e.slime?SLIME_MAX:LV_MAX-1,r1(e.lv+wLv(w))); e.r=radius(e.lv,e.f); G.WP[i]=w.drop?{dead:1,x:-9999,y:-9999,im:w.im}:spawnWeapon(); } }
  for(let i=0;i<G.WP.length;i++){ const w=G.WP[i]; if(Math.hypot(w.x-P.x,w.y-P.y)<P.r*0.9+30*G.dpr/(G.ppu||1)){ /* 2026-10-28：絵が少しでも重なれば拾えるように（前は真ん中近くまで行かないと拾えなかった） */ G.weap++; P.w=G.weap; G.ammo=(G.ammo||0)+5; P.lv=Math.min(LV_MAX,r1(P.lv+wLv(w))); P.r=radius(P.lv,P.f); G.WP[i]=w.drop?{dead:1,x:-9999,y:-9999,im:w.im}:spawnWeapon(); try{ w.k?SFX.coin():SFX.tap(); }catch(x){} if(w.k) flash(w.k==='r'?'🌈 虹の武器！ +10レベル':'✨ 金の武器！ +3レベル'); else { const b=$id("ioWp"); if(b){ b.style.transition="none"; b.style.transform="scale(1.6)"; b.style.color="#e53935"; setTimeout(()=>{ b.style.transition="transform .3s"; b.style.transform=""; b.style.color=""; },120); } } if(P.lv>=LV_MAX) return escape(true); } }
  G.WP=G.WP.filter(w=>!w.dead);
  if(G.fireOn&&!G.touch){ if((G.ammo||0)<=0) G.fireOn=false; else { G.fireT-=dt; if(G.fireT<=0){ const g=fireGap(); throwW(); G.fireT=g; } } }
  stepThrow(dt); for(const e of G.E) if(e.hitT) e.hitT=Math.max(0,e.hitT-dt); if(P.hitT) P.hitT=Math.max(0,P.hitT-dt);
  hud(); }
function draw(){ const {c,cv,P}=G, d=G.dpr, w=cv.width, h=cv.height;
  // 2026-10-28：体の大きさはそのまま。画面のズームは整数のレベルで決める（武器0.1ぶんでは画面が動かない＝拾った瞬間にカクッとしない）
  for(const e of [...G.E,P]) e.dr=e.r;
  const ppu=G.ppu=d*Math.min(innerWidth,600)/390*0.95*Math.pow(IO.R0/radius(Math.floor(r1(P.lv)),P.f),0.545);   // 2026-10-28：前より少し引いて見える（Lv1000で画面いっぱいはそのまま）   // 1単位あたりの画面のピクセル（大きくなるほど引いて見える）
  c.setTransform(1,0,0,1,0,0); c.fillStyle="#3d6b2a"; c.fillRect(0,0,w,h);
  c.setTransform(ppu,0,0,ppu,w/2-P.x*ppu,h/2-P.y*ppu);
  c.fillStyle=G.pat; c.save(); c.scale(1/ppu*d*1.6,1/ppu*d*1.6); c.fillRect(0,0,IO.W*ppu/d/1.6,IO.H*ppu/d/1.6); c.restore();   // 草のドットは画面上でいつも同じくらいの細かさ
  c.strokeStyle="#2b4d1c"; c.lineWidth=12; c.strokeRect(0,0,IO.W,IO.H);
  c.font="28px sans-serif"; c.textAlign="center"; c.textBaseline="middle";
  const ws=34*d/ppu; c.font=`${ws}px sans-serif`;   // 武器は画面上でいつも同じくらいの大きさ
  c.imageSmoothingEnabled=false; for(const wp of G.WP){ const im=wp.im; if(!im.complete||!im.naturalWidth) continue; const hh=ws*(wp.k?2:1.5), ww=hh*im.naturalWidth/im.naturalHeight; c.save(); c.translate(wp.x,wp.y); c.rotate(wp.a); c.drawImage(im,-ww/2,-hh/2,ww,hh); c.restore(); }
  for(const t of (G.TH||[])){ const im=t.im; if(!im.complete||!im.naturalWidth) continue; const hh=ws*1.6, ww=hh*im.naturalWidth/im.naturalHeight; c.save(); c.translate(t.x,t.y); c.rotate(t.a); c.drawImage(im,-ww/2,-hh/2,ww,hh); c.restore(); }
  const L=[...G.E,P].sort((a,b)=>a.r-b.r);
  for(const e of L){ const im=img(e.id), s=e.dr*2;
    c.fillStyle="#0003"; c.beginPath(); c.ellipse(e.x,e.y+e.dr*0.62,e.dr*0.6,e.dr*0.18,0,0,Math.PI*2); c.fill();
    if(im.complete&&im.naturalWidth){ c.imageSmoothingEnabled=false; const ph=e.ph||0, hop=e.mv?Math.abs(Math.sin(ph))*e.dr*0.1:0, tilt=e.mv?Math.sin(ph)*0.06:0;
      c.save(); if(e.hitT) c.globalAlpha=0.4+0.6*Math.abs(Math.sin(e.hitT*40)); c.translate(e.x,e.y+e.dr); c.rotate(tilt); c.scale(-(e.face||1),e.mv?1-Math.abs(Math.sin(ph))*0.03:1); c.drawImage(im,-e.dr,-s-hop,s,s); c.restore(); }
    // 頭の上にレベル（整数だけ）を出す。武器の数は出さない。過去の冒険者（ゴースト）はその上に名前も出す
    const fs=Math.max(12/ppu*d, e.dr*0.26), y0=e.y-e.dr*0.95; c.font=`900 ${fs}px sans-serif`; c.lineWidth=fs*0.25; c.strokeStyle="#fff";
    const k=cmp(e,P); c.fillStyle=e.me?"#1d6fd1":(k>0?"#d32f2f":k<0?"#2e7d32":"#555"); const t="Lv."+Math.floor(r1(e.lv)); c.strokeText(t,e.x,y0); c.fillText(t,e.x,y0);
    if((e.ghost||e.adv)&&e.nm){ const f2=fs*0.8; c.font=`900 ${f2}px sans-serif`; c.lineWidth=f2*0.25; c.fillStyle="#6a1b9a"; c.strokeText(e.nm,e.x,y0-fs*1.05); c.fillText(e.nm,e.x,y0-fs*1.05); } } }
function flash(t){ const el=document.createElement("div"); el.textContent=t; el.style.cssText="position:absolute;left:50%;top:32%;transform:translateX(-50%);z-index:4;background:#fff;border:4px solid #1d1d1d;border-radius:12px;padding:8px 16px;font-weight:900;font-size:20px;color:#b8860b;pointer-events:none;white-space:nowrap"; G.root.appendChild(el); setTimeout(()=>el.remove(),1600); }
function dlg(html,cb){ const d=document.createElement("div"); d.className="dlg"; d.innerHTML=`<div>${html}</div>`; G.root.appendChild(d);
  d.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>{ d.remove(); cb&&cb(b.dataset.a); }); }
function lose(why){ if(G.over) return; if((G.weap||0)>=IO.NEED){ escape(false,true); return; }   /* 武器を10個以上持って死んだら脱出クリア */
  G.over=true; saveAdv(); const n=Math.floor(G.P.lv), before=S.plv;
  S.plv=Math.max(1,(S.plv||1)-n); try{ save(); queueProfile(true); }catch(e){}
  dlg(`<div style="font-size:48px">💀</div><h3>負けてしまった…</h3><p>${why}</p><p>このゲームのLv <b>${n}</b> ・ 武器 ${G.weap}個<br>記録は残りません</p><p style="color:#d32f2f">冒険者Lv ${before} → <b>${S.plv}</b>（−${before-S.plv}）</p><button type="button" data-a="x">ホームにもどる</button>`,close); }
function escape(auto,died){ if(G.over) return; G.over=true; saveAdv(); const n=Math.floor(G.P.lv), rk=G.rank, before=S.plv;
  S.plv=(S.plv||1)+n; try{ bumpMaxLv(); }catch(e){}
  S.io=S.io||{k:0,b:0,s:0}; S.io.k+=G.kills; if(n>(S.io.b||0)) S.io.b=n; const top=rk<=4; if(top) S.io.s=(S.io.s||0)+1;
  try{ save(); queueProfile(true); }catch(e){}
  dlg(`<div style="font-size:48px">🎉</div><h3>${auto?"Lv.1000に到達！自動で脱出！":died?"やられたけど、武器"+IO.NEED+"個以上で脱出クリア！":"脱出成功！"}</h3><p>このゲームのLv <b>${n}</b> ・ 順位 <b>${rk}位</b><br>倒した敵 ${G.kills}匹 ・ 武器 ${G.weap}個</p>${top?`<p style="color:#b8860b">👑 4位以内で脱出！ 四天王回数 +1</p>`:""}<p style="color:#1d6fd1">冒険者Lv ${before} → <b>${S.plv}</b>（+${n}）</p><button type="button" data-a="x">ホームにもどる</button>`,close); }
function close(){ if(!G) return; cancelAnimationFrame(G.raf); removeEventListener("resize",G.onRs); removeEventListener("keydown",G.kd); removeEventListener("keyup",G.kd); G.root.remove(); G=null; try{ render(); }catch(e){} }

// ホームの記録（全冒険者の中での順位）
const RK={at:0,v:null};
async function ranks(){ const io=S.io||{k:0,b:0,s:0}; if(typeof DB==="undefined"||!DB) return null; if(RK.v&&Date.now()-RK.at<60000) return RK.v;
  const one=async(f,v)=>{ try{ const q=DB.collection("profiles").where(f,">",v||0); const n=q.count?(await q.count().get()).data().count:(await q.get()).size; return n+1; }catch(e){ return null; } };
  const [a,b,c]=await Promise.all([one("iok",io.k),one("iob",io.b),one("io4",io.s)]); RK.v={k:a,b,s:c}; RK.at=Date.now(); return RK.v; }
async function fillStats(){ const el=$id("ioStats"); if(!el) return; const io=S.io||{k:0,b:0,s:0}, r=await ranks()||{};
  const t=(v,u,rk)=>`${(v||0).toLocaleString()}${u}${rk?`（${rk}位）`:""}`;
  if(!$id("ioStats")) return;
  $id("ioStats").innerHTML=`倒した敵 ${t(io.k,"匹",r.k)}<br>最高脱出レベル ${t(io.b,"",r.b)}<br>四天王回数 ${t(io.s,"回",r.s)}`; }
window.ioOpen=open; window.ioFillStats=fillStats; window.__ioG=()=>G;   // テスト用
 window.ioRankReset=()=>{ RK.v=null; };
})();
