/* 魔物サバイバル（試作・ふっかーだけ・2026-10-28）
   ホーム：えらんだ魔物・チェンジ・記録・スタート
   ゲーム：スティックで動く。ふれた相手と勝負：①武器の数が多い方の勝ち ②同じならレベル（サイズ）が高い方の勝ち（両方同じなら押し合うだけ）
           勝つとLv+1で体が大きくなる。武器を10個以上集めると脱出できる
           脱出：そのゲームのLvぶん冒険者Lvが上がる。4位以内で脱出すると四天王回数+1
           負け：記録は残らず、そのゲームのLvぶん冒険者Lvが下がる（1より下にはならない） */
(function(){
"use strict";
const IO={ W:3200, H:3200, N:70, WEAP:60, NEED:10, R0:40 };
const $id=id=>document.getElementById(id);
const escH=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rnd=(a,b)=>a+Math.random()*(b-a), ri=(a,b)=>Math.floor(rnd(a,b+1));
// 魔物の種類ごとの体の大きさの個体差（0.5〜2.0倍）：番号から決める。小さい魔物も大きい魔物もいる
const sf=id=>{ let h=(Number(id)||7)*2654435761>>>0; h^=h>>>13; return 0.5*Math.pow(4,(h%1000)/1000); };
// 勝ち負け：①武器の数が多い方 → ②同じならレベル（サイズ）が高い方。どちらも同じなら押し合うだけ
const cmp=(a,b)=>((a.w||0)-(b.w||0))||(a.lv-b.lv);
const radius=(lv,f)=>IO.R0*f*(1+0.09*(lv-1));   // Lv100で約10倍の大きさ
// 足の速さ：体が大きくなるほど遅くなる（画面の見た目の速さは Lv10で約75%・Lv50で約40%・Lv100で約25%）。敵も同じ
const speedOf=(r,lv)=>170*Math.pow(IO.R0/r,0.05);
// 武器の絵は3種類（io/w1〜w3.png）からランダム
const WEAPONS=[1,2,3].map(n=>{ const im=new Image(); im.src="io/w"+n+".png"; return im; });
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
<div class="hud"><div class="bx" style="grid-column:1"><span id="ioLv">Lv.1</span></div><div class="bx rk"><small>順位</small><b id="ioRk">1</b><small>位</small></div><button class="gear" type="button" id="ioGear" aria-label="設定">⚙</button>
<div class="bx" style="grid-column:1;grid-row:2"><span>武器数</span><b id="ioWp">0</b><span>個</span></div><button class="esc" type="button" id="ioEsc"><small>武器を${IO.NEED}個以上集めて</small>脱出する</button></div>
<div class="stick"><div class="knob" id="ioKnob"></div></div>`;
  document.body.appendChild(root);
  const cv=root.querySelector("#ioCv"), c=cv.getContext("2d");
  G={root,cv,c,pool,t:performance.now(),over:false,pause:false,
     P:{id:pid,lv:1,w:0,f:sf(pid),x:IO.W/2,y:IO.H/2,me:true}, E:[], WP:[], weap:0, kills:0, dir:{x:0,y:0}, touch:null, keys:{}};
  G.P.r=radius(1,G.P.f); img(pid);
  for(let i=0;i<IO.N;i++) G.E.push(spawnEnemy(true));
  for(let i=0;i<IO.WEAP;i++) G.WP.push(spawnWeapon());
  grass();
  const rs=()=>{ const d=Math.min(2,window.devicePixelRatio||1); G.dpr=d; cv.width=Math.round(innerWidth*d); cv.height=Math.round(innerHeight*d); };
  rs(); G.onRs=rs; addEventListener("resize",rs);
  // 操作：画面のどこでも、さわったところから指を動かした方向へ進む（スティックの絵は右下）
  const knob=root.querySelector("#ioKnob");
  const setDir=(dx,dy)=>{ const l=Math.hypot(dx,dy), m=60; const k=l>m?m/l:1; knob.style.transform=`translate(${dx*k}px,${dy*k}px)`; G.dir=l<6?{x:0,y:0}:{x:dx/Math.max(l,m),y:dy/Math.max(l,m)}; };
  root.addEventListener("pointerdown",e=>{ if(e.target.closest("button,.dlg")) return; G.touch={id:e.pointerId,x:e.clientX,y:e.clientY}; });
  root.addEventListener("pointermove",e=>{ if(!G||!G.touch||G.touch.id!==e.pointerId) return; setDir(e.clientX-G.touch.x,e.clientY-G.touch.y); });
  const up=e=>{ if(!G||!G.touch||G.touch.id!==e.pointerId) return; G.touch=null; setDir(0,0); };
  root.addEventListener("pointerup",up); root.addEventListener("pointercancel",up);
  G.kd=e=>{ if(!G) return; G.keys[e.key]=e.type==="keydown"; const k=G.keys, dx=(k.ArrowRight?1:0)-(k.ArrowLeft?1:0), dy=(k.ArrowDown?1:0)-(k.ArrowUp?1:0); if(!G.touch) G.dir=(dx||dy)?{x:dx/Math.hypot(dx,dy),y:dy/Math.hypot(dx,dy)}:{x:0,y:0}; };
  addEventListener("keydown",G.kd); addEventListener("keyup",G.kd);
  root.querySelector("#ioGear").onclick=()=>{ if(G.over) return; G.pause=true;
    dlg(`<h3>⚙ 一時停止</h3><p>やめると<b>負け</b>になります（冒険者Lvが今のLvぶん下がります）</p><button type="button" data-a="go">つづける</button><button type="button" class="g" data-a="quit">やめる（負け）</button>`,a=>{ if(a==="go"){ G.pause=false; G.t=performance.now(); } else lose("やめました"); }); };
  root.querySelector("#ioEsc").onclick=()=>{ if(G.over||G.weap<IO.NEED) return; escape(); };
  hud(); G.raf=requestAnimationFrame(loop);
}
function spawnEnemy(first){ const P=G.P, id=G.pool[ri(0,G.pool.length-1)]||18, f=sf(id);
  let lv; const r=Math.random();
  if(r<0.55) lv=Math.max(1,Math.round(P.lv*rnd(0.3,0.95))+ri(-1,1));
  else if(r<0.9) lv=Math.max(1,Math.round(P.lv*rnd(1,1.6))+ri(0,4));
  else lv=Math.max(1,Math.round(P.lv*rnd(1.6,3))+ri(5,20));
  if(first&&P.lv<=1) lv=r<0.6?1:ri(1,4);
  let x,y,t=0; do{ x=rnd(60,IO.W-60); y=rnd(60,IO.H-60); t++; }while(t<30&&Math.hypot(x-P.x,y-P.y)<700);
  img(id); const a=rnd(0,Math.PI*2);
  const w=(first&&P.lv<=1)?(Math.random()<0.1?1:0):(Math.random()<0.6?0:ri(0,(P.w||0)+2));   // 敵も武器を持っていることがある（はじめはほとんど持っていない）
  return {id,f,lv,w,x,y,r:radius(lv,f),vx:Math.cos(a),vy:Math.sin(a),turn:rnd(1,3)}; }
function spawnWeapon(){ return {x:rnd(40,IO.W-40),y:rnd(40,IO.H-40),im:WEAPONS[ri(0,WEAPONS.length-1)],a:rnd(-0.5,0.5)}; }
// 地面：草原のドット絵をタイルにする
function grass(){ const t=document.createElement("canvas"); t.width=t.height=128; const g=t.getContext("2d");
  g.fillStyle="#7ccf4f"; g.fillRect(0,0,128,128);
  const col=["#6cbf43","#8bd85c","#5fae3a","#94dd68"]; for(let i=0;i<260;i++){ g.fillStyle=col[i%4]; g.fillRect(ri(0,63)*2,ri(0,63)*2,2,2); }
  for(let i=0;i<5;i++){ const x=ri(4,120),y=ri(4,120); g.fillStyle="#3f8f2c"; g.fillRect(x,y,2,6); g.fillRect(x-3,y+2,2,4); g.fillRect(x+3,y+2,2,4); }
  for(let i=0;i<2;i++){ const x=ri(6,118),y=ri(6,118); g.fillStyle="#fff"; g.fillRect(x,y,4,4); g.fillStyle="#f6d44a"; g.fillRect(x+1,y+1,2,2); }
  if(Math.random()<1){ const x=ri(10,110),y=ri(10,110); g.fillStyle="#8d8d8d"; g.fillRect(x,y,10,6); g.fillStyle="#b9b9b9"; g.fillRect(x+2,y,6,3); g.fillStyle="#5c5c5c"; g.fillRect(x,y+6,10,2); }
  G.pat=G.c.createPattern(t,"repeat"); }
function hud(){ $id("ioLv").textContent="Lv."+G.P.lv; $id("ioWp").textContent=G.weap;
  const rk=1+G.E.filter(e=>cmp(e,G.P)>0).length; G.rank=rk; $id("ioRk").textContent=rk;
  $id("ioEsc").classList.toggle("ok",G.weap>=IO.NEED); }
function loop(now){ if(!G) return; const dt=Math.min(0.05,(now-G.t)/1000); G.t=now;
  if(!G.pause&&!G.over) step(dt); draw(); G.raf=requestAnimationFrame(loop); }
function step(dt){ const P=G.P;
  // 歩く動き：右へ動くときはそのまま、左へ動くときは絵を左右反転。動いているあいだは少しはねる
  if(G.dir.x>0.15) P.face=1; else if(G.dir.x<-0.15) P.face=-1; P.mv=Math.hypot(G.dir.x,G.dir.y)>0.1; if(P.mv) P.ph=(P.ph||0)+dt*11;
  for(const e of G.E){ if(e.vx>0.15) e.face=1; else if(e.vx<-0.15) e.face=-1; e.mv=true; e.ph=(e.ph||rnd(0,6))+dt*9; }
  const sp=speedOf(P.r,P.lv); P.x=Math.max(P.r*0.5,Math.min(IO.W-P.r*0.5,P.x+G.dir.x*sp*dt)); P.y=Math.max(P.r*0.5,Math.min(IO.H-P.r*0.5,P.y+G.dir.y*sp*dt));
  for(const e of G.E){ e.turn-=dt; const dx=P.x-e.x, dy=P.y-e.y, d=Math.hypot(dx,dy)||1, near=d<Math.max(420,P.r*6);
    if(near&&cmp(e,P)>0){ e.vx=dx/d; e.vy=dy/d; } else if(near&&cmp(e,P)<0){ e.vx=-dx/d; e.vy=-dy/d; }
    else if(e.turn<=0){ const a=rnd(0,Math.PI*2); e.vx=Math.cos(a); e.vy=Math.sin(a); e.turn=rnd(1,3); }
    const es=speedOf(e.r,e.lv)*(near&&cmp(e,P)>0?0.8:0.6); e.x+=e.vx*es*dt; e.y+=e.vy*es*dt;
    if(e.x<e.r*0.5||e.x>IO.W-e.r*0.5){ e.vx*=-1; e.x=Math.max(e.r*0.5,Math.min(IO.W-e.r*0.5,e.x)); }
    if(e.y<e.r*0.5||e.y>IO.H-e.r*0.5){ e.vy*=-1; e.y=Math.max(e.r*0.5,Math.min(IO.H-e.r*0.5,e.y)); } }
  // 敵どうし：ふれたら高い方が勝ってLv+1、負けた方は別の場所に出なおす
  for(let i=0;i<G.E.length;i++) for(let j=i+1;j<G.E.length;j++){ const a=G.E[i], b=G.E[j], d=Math.hypot(a.x-b.x,a.y-b.y);
    if(d<(a.r+b.r)*0.5&&cmp(a,b)!==0){ const w=cmp(a,b)>0?a:b, l=w===a?j:i; w.lv++; w.r=radius(w.lv,w.f); G.E[l]=spawnEnemy(false); } }
  // 自分とふれた敵
  for(let i=0;i<G.E.length;i++){ const e=G.E[i], d=Math.hypot(e.x-P.x,e.y-P.y); if(d>=(e.r+P.r)*0.5) continue;
    const r0=cmp(P,e);
    if(r0>0){ P.lv++; P.r=radius(P.lv,P.f); G.kills++; G.E[i]=spawnEnemy(false); try{ SFX.coin(); }catch(x){} }
    else if(r0<0){ return lose(`${escH((typeof mon==="function"&&mon(e.id)||{}).name||"魔物")}（Lv.${e.lv}・武器${e.w}個）に負けた…`); }
    else { const k=((e.r+P.r)*0.5-d)/(d||1)*0.5; e.x+=(e.x-P.x)*k; e.y+=(e.y-P.y)*k; } }
  for(const e of G.E) for(let i=0;i<G.WP.length;i++){ const w=G.WP[i]; if(Math.abs(w.x-e.x)<e.r&&Math.hypot(w.x-e.x,w.y-e.y)<e.r*0.6+20){ e.w++; G.WP[i]=spawnWeapon(); } }
  for(let i=0;i<G.WP.length;i++){ const w=G.WP[i]; if(Math.hypot(w.x-P.x,w.y-P.y)<P.r*0.6+17*G.dpr/G.ppu){ G.weap++; P.w=G.weap; G.WP[i]=spawnWeapon(); try{ SFX.tap(); }catch(x){} } }
  hud(); }
function draw(){ const {c,cv,P}=G, d=G.dpr, w=cv.width, h=cv.height;
  const ppu=G.ppu=d*Math.min(innerWidth,600)/390*1.25*Math.pow(IO.R0/P.r,0.65);   // 1単位あたりの画面のピクセル（大きくなるほど引いて見える）
  c.setTransform(1,0,0,1,0,0); c.fillStyle="#3d6b2a"; c.fillRect(0,0,w,h);
  c.setTransform(ppu,0,0,ppu,w/2-P.x*ppu,h/2-P.y*ppu);
  c.fillStyle=G.pat; c.save(); c.scale(1/ppu*d*1.6,1/ppu*d*1.6); c.fillRect(0,0,IO.W*ppu/d/1.6,IO.H*ppu/d/1.6); c.restore();   // 草のドットは画面上でいつも同じくらいの細かさ
  c.strokeStyle="#2b4d1c"; c.lineWidth=12; c.strokeRect(0,0,IO.W,IO.H);
  c.font="28px sans-serif"; c.textAlign="center"; c.textBaseline="middle";
  const ws=34*d/ppu; c.font=`${ws}px sans-serif`;   // 武器は画面上でいつも同じくらいの大きさ
  c.imageSmoothingEnabled=false; for(const wp of G.WP){ const im=wp.im; if(!im.complete||!im.naturalWidth) continue; const hh=ws*1.5, ww=hh*im.naturalWidth/im.naturalHeight; c.save(); c.translate(wp.x,wp.y); c.rotate(wp.a); c.drawImage(im,-ww/2,-hh/2,ww,hh); c.restore(); }
  const L=[...G.E,P].sort((a,b)=>a.r-b.r);
  for(const e of L){ const im=img(e.id), s=e.r*2;
    c.fillStyle="#0003"; c.beginPath(); c.ellipse(e.x,e.y+e.r*0.62,e.r*0.6,e.r*0.18,0,0,Math.PI*2); c.fill();
    if(im.complete&&im.naturalWidth){ c.imageSmoothingEnabled=false; const ph=e.ph||0, hop=e.mv?Math.abs(Math.sin(ph))*e.r*0.1:0, tilt=e.mv?Math.sin(ph)*0.06:0;
      c.save(); c.translate(e.x,e.y+e.r); c.rotate(tilt); c.scale(e.face||1,e.mv?1-Math.abs(Math.sin(ph))*0.03:1); c.drawImage(im,-e.r,-s-hop,s,s); c.restore(); }
    const fs=Math.max(12/ppu*d, e.r*0.28); c.font=`900 ${fs}px sans-serif`; c.lineWidth=fs*0.25; c.strokeStyle="#fff"; const k=cmp(e,P); c.fillStyle=e.me?"#1d6fd1":(k>0?"#d32f2f":k<0?"#2e7d32":"#555");
    const t="Lv."+e.lv+(e.w?" ⚔"+e.w:""); c.strokeText(t,e.x,e.y-e.r*0.95); c.fillText(t,e.x,e.y-e.r*0.95); } }
function dlg(html,cb){ const d=document.createElement("div"); d.className="dlg"; d.innerHTML=`<div>${html}</div>`; G.root.appendChild(d);
  d.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>{ d.remove(); cb&&cb(b.dataset.a); }); }
function lose(why){ if(G.over) return; G.over=true; const n=G.P.lv, before=S.plv;
  S.plv=Math.max(1,(S.plv||1)-n); try{ save(); queueProfile(true); }catch(e){}
  dlg(`<div style="font-size:48px">💀</div><h3>負けてしまった…</h3><p>${why}</p><p>このゲームのLv <b>${n}</b> ・ 武器 ${G.weap}個<br>記録は残りません</p><p style="color:#d32f2f">冒険者Lv ${before} → <b>${S.plv}</b>（−${before-S.plv}）</p><button type="button" data-a="x">ホームにもどる</button>`,close); }
function escape(){ if(G.over) return; G.over=true; const n=G.P.lv, rk=G.rank, before=S.plv;
  S.plv=(S.plv||1)+n; try{ bumpMaxLv(); }catch(e){}
  S.io=S.io||{k:0,b:0,s:0}; S.io.k+=G.kills; if(n>(S.io.b||0)) S.io.b=n; const top=rk<=4; if(top) S.io.s=(S.io.s||0)+1;
  try{ save(); queueProfile(true); }catch(e){}
  dlg(`<div style="font-size:48px">🎉</div><h3>脱出成功！</h3><p>このゲームのLv <b>${n}</b> ・ 順位 <b>${rk}位</b><br>倒した敵 ${G.kills}匹 ・ 武器 ${G.weap}個</p>${top?`<p style="color:#b8860b">👑 4位以内で脱出！ 四天王回数 +1</p>`:""}<p style="color:#1d6fd1">冒険者Lv ${before} → <b>${S.plv}</b>（+${n}）</p><button type="button" data-a="x">ホームにもどる</button>`,close); }
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
