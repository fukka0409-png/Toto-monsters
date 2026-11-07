/* トトの3Dサバイバル（2026-11-07・まだ公開しない：ふっかーだけ）
   その場でどれだけ強くなって生き残れるか。three.js（lib/three.min.js）は開いたときだけ読み込む */
(function(){
"use strict";
const LIB="lib/three.min.js?v=149";
let T=null;               // THREE
let G=null;               // 今のゲーム
const L=()=>typeof LANG!=="undefined"&&LANG==="en";
const tx=(ja,en)=>L()?en:ja;

function loadThree(){ if(window.THREE) return Promise.resolve(window.THREE);
  return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=LIB; s.onload=()=>res(window.THREE); s.onerror=rej; document.head.appendChild(s); }); }

const CSS=`
#m3o{position:fixed;inset:0;z-index:9500;background:#0e1a12;touch-action:none;user-select:none;-webkit-user-select:none;font-family:inherit;overflow:hidden}
#m3o canvas{display:block;width:100%;height:100%}
#m3o .m3hud{position:absolute;left:0;right:0;top:0;padding:calc(env(safe-area-inset-top,0px) + 8px) 10px 0;pointer-events:none;color:#fff;text-shadow:0 2px 3px rgba(0,0,0,.6)}
#m3o .m3row{display:flex;align-items:center;gap:8px}
#m3o .m3bar{flex:1;height:12px;border-radius:8px;background:rgba(0,0,0,.45);border:2px solid rgba(255,255,255,.75);overflow:hidden}
#m3o .m3bar i{display:block;height:100%;width:100%;transition:width .12s}
#m3o .m3hp i{background:linear-gradient(90deg,#ff4d5e,#ff9a6b)}
#m3o .m3xp i{background:linear-gradient(90deg,#47c8ff,#a77bff)}
#m3o .m3t{font-weight:900;font-size:22px;letter-spacing:1px;min-width:70px;text-align:center}
#m3o .m3s{font-size:13px;font-weight:800;margin-top:6px;display:flex;justify-content:space-between}
#m3o .m3btn{position:absolute;pointer-events:auto;top:calc(env(safe-area-inset-top,0px) + 92px);border:2px solid #fff;background:rgba(0,0,0,.45);color:#fff;border-radius:12px;padding:6px 10px;font-weight:900;font-size:13px}
#m3o .m3pause{right:10px}
#m3o .m3joy{position:absolute;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;border:3px solid rgba(255,255,255,.55);background:rgba(255,255,255,.12);pointer-events:none;display:none}
#m3o .m3joy b{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:rgba(255,255,255,.75)}
#m3o .m3hint{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 18px);text-align:center;color:#fff;font-weight:800;font-size:14px;text-shadow:0 2px 3px rgba(0,0,0,.7);pointer-events:none;transition:opacity .6s}
#m3o .m3modal{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(5,10,8,.62);padding:16px;z-index:3}
#m3o .m3box{background:#fff8ec;color:#2b1a06;border:4px solid #2b1a06;border-radius:22px;padding:18px 16px;max-width:380px;width:100%;text-align:center;box-shadow:0 8px 0 #2b1a06}
#m3o .m3box h3{margin:0 0 6px;font-size:22px}
#m3o .m3cards{display:flex;flex-direction:column;gap:10px;margin-top:10px}
#m3o .m3card{display:flex;align-items:center;gap:12px;text-align:left;border:3px solid #2b1a06;border-radius:16px;background:#fff;padding:10px 12px;font:inherit;color:inherit;cursor:pointer}
#m3o .m3card:active{transform:scale(.98)}
#m3o .m3card i{font-style:normal;font-size:30px;flex:none;width:40px;text-align:center}
#m3o .m3card b{display:block;font-size:16px}
#m3o .m3card small{display:block;font-size:12px;opacity:.75;margin-top:2px}
#m3o .m3card em{font-style:normal;font-size:11px;font-weight:900;color:#d0472d}
#m3o .m3go{display:block;width:100%;margin-top:10px;border:3px solid #2b1a06;border-radius:14px;padding:12px;font:inherit;font-weight:900;font-size:16px;background:#ffd23f;color:#2b1a06;box-shadow:0 4px 0 #2b1a06}
#m3o .m3go.g{background:#fff}
#m3o .m3res{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:12px 0 4px}
#m3o .m3res div{border:2px solid #2b1a06;border-radius:12px;padding:8px 2px;background:#fff}
#m3o .m3res small{display:block;font-size:11px;opacity:.7}
#m3o .m3res b{font-size:20px}
#m3o .m3load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:18px}
#m3o .m3boss{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);color:#ffdf5a;font-weight:900;font-size:30px;text-shadow:0 3px 0 #6b1a00,0 0 18px rgba(255,90,0,.8);pointer-events:none;opacity:0;transition:opacity .4s;white-space:nowrap}
`;

/* ---------- 強化の種類 ---------- */
const UPG=[
  {k:"bolt",  ic:"🔮", n:["魔法弾","Magic Bolt"],        d:["いちばん近い敵に魔法弾をうつ","Shoots the nearest enemy"], max:6, wpn:1},
  {k:"orbit", ic:"⭐", n:["まわる星","Orbit Stars"],       d:["まわりを星がまわって敵に当たる","Stars circle around you"], max:5, wpn:1},
  {k:"wave",  ic:"💫", n:["衝撃波","Shockwave"],           d:["まわりに衝撃波を出す","Releases a shockwave around you"], max:5, wpn:1},
  {k:"thunder",ic:"⚡",n:["かみなり","Thunder"],          d:["ランダムな敵にかみなりを落とす","Lightning strikes random enemies"], max:5, wpn:1},
  {k:"hp",    ic:"❤️", n:["体力アップ","Max HP"],          d:["最大体力+25（全回復）","+25 max HP (full heal)"], max:5},
  {k:"spd",   ic:"👟", n:["スピードアップ","Speed"],       d:["移動が10%はやくなる","Move 10% faster"], max:5},
  {k:"mag",   ic:"🧲", n:["マグネット","Magnet"],          d:["経験値を遠くから集める","Collect XP from farther"], max:5},
  {k:"pow",   ic:"💪", n:["パワーアップ","Power"],          d:["すべての攻撃+15%","+15% damage"], max:5},
  {k:"cd",    ic:"⏱", n:["クールダウン","Cooldown"],       d:["攻撃の間かくが8%短くなる","Attacks 8% faster"], max:5},
  {k:"regen", ic:"🌿", n:["自然回復","Regeneration"],      d:["1秒ごとに体力が少し回復","Heal a little every second"], max:5},
  {k:"armor", ic:"🛡", n:["よろい","Armor"],               d:["受けるダメージ-8%","-8% damage taken"], max:5},
];
const lvTxt=(u,lv)=>{ const L2=L();
  if(u.k==="bolt") return lv===0?tx("新しい武器！","New weapon!"):tx(["","ダメージアップ","弾+1","貫通+1","ダメージアップ","弾+1"][lv]||"強化",["","More damage","+1 bolt","+1 pierce","More damage","+1 bolt"][lv]||"Upgrade");
  if(u.k==="orbit") return lv===0?tx("新しい武器！","New weapon!"):tx("星+1・ダメージアップ","+1 star, more damage");
  if(u.k==="wave") return lv===0?tx("新しい武器！","New weapon!"):tx("範囲・ダメージアップ","Bigger & stronger");
  if(u.k==="thunder") return lv===0?tx("新しい武器！","New weapon!"):tx("かみなり+1・ダメージアップ","+1 strike, more damage");
  return ""; };

/* ---------- テクスチャ（canvasで作る） ---------- */
function grassTex(){ const c=document.createElement("canvas"); c.width=c.height=512; const x=c.getContext("2d");
  x.fillStyle="#5d9640"; x.fillRect(0,0,512,512);
  for(let i=0;i<60;i++){ const r=20+Math.random()*60; const g=x.createRadialGradient(0,0,0,0,0,r); const a=Math.random()<.5;
    g.addColorStop(0,a?"rgba(120,170,70,.35)":"rgba(60,110,40,.35)"); g.addColorStop(1,"rgba(0,0,0,0)"); const px=Math.random()*512, py=Math.random()*512; for(const xx of [0,-512,512]) for(const yy of [0,-512,512]){ x.save(); x.translate(px+xx,py+yy); x.fillStyle=g; x.fillRect(-r,-r,r*2,r*2); x.restore(); } }
  for(let i=0;i<9000;i++){ const px=Math.random()*512, py=Math.random()*512, h=3+Math.random()*7; const s=Math.random();
    x.strokeStyle=s<.33?"#4c8a35":s<.66?"#78b34f":"#8fc760"; x.globalAlpha=.55; x.lineWidth=1; const ox=(Math.random()-.5)*3; for(const yy of [0,512]) for(const xx of [0,-512,512]){ x.beginPath(); x.moveTo(px+xx,py+yy); x.lineTo(px+xx+ox,py+yy-h); x.stroke(); } }
  x.globalAlpha=1; for(let i=0;i<70;i++){ x.fillStyle=["#fff7a8","#ffffff","#ffb7d0","#c9a8ff"][i%4]; const px=Math.random()*512, py=Math.random()*512; x.beginPath(); x.arc(px,py,1.6,0,7); x.fill(); }
  const t=new T.CanvasTexture(c); t.wrapS=t.wrapT=T.RepeatWrapping; t.anisotropy=4; t.encoding=T.sRGBEncoding; return t; }
function blobTex(){ const c=document.createElement("canvas"); c.width=c.height=64; const x=c.getContext("2d"); const g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,"rgba(0,0,0,.55)"); g.addColorStop(1,"rgba(0,0,0,0)"); x.fillStyle=g; x.fillRect(0,0,64,64); return new T.CanvasTexture(c); }
function glowTex(col){ const c=document.createElement("canvas"); c.width=c.height=64; const x=c.getContext("2d"); const g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,"rgba(255,255,255,1)"); g.addColorStop(.25,col); g.addColorStop(1,"rgba(0,0,0,0)"); x.fillStyle=g; x.fillRect(0,0,64,64); return new T.CanvasTexture(c); }

/* ---------- トト（3Dモデル） ---------- */
function makeToto(){
  const g=new T.Group(), body=new T.Group(); g.add(body);
  const wool=new T.MeshStandardMaterial({color:0xfbf7f2, roughness:.95, metalness:0});
  const gray=new T.MeshStandardMaterial({color:0x6c6a6a, roughness:.8});
  const brown=new T.MeshStandardMaterial({color:0xc27a3e, roughness:.65});
  const green=new T.MeshStandardMaterial({color:0x82c84f, roughness:.7, side:T.DoubleSide});
  // ふわふわの体：球の表面を少しでこぼこに
  const sg=new T.SphereGeometry(1,48,36), p=sg.attributes.position, v=new T.Vector3();
  for(let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i); const n=v.clone().normalize();
    const b=.055*Math.sin(n.x*11+n.y*7)*Math.sin(n.y*10+n.z*9)+.035*Math.sin(n.z*17+n.x*13); v.copy(n).multiplyScalar(1+b); p.setXYZ(i,v.x,v.y*.94,v.z); }
  sg.computeVertexNormals(); const bm=new T.Mesh(sg,wool); bm.castShadow=true; body.add(bm);
  for(let i=0;i<46;i++){ const y=1-(i/45)*1.6, r=Math.sqrt(Math.max(0,1-y*y)), th=i*2.39996; if(y<-.55) continue;
    const pf=new T.Mesh(new T.SphereGeometry(.24+((i*37)%10)/100,14,10),wool); pf.position.set(Math.cos(th)*r*.92,y*.88,Math.sin(th)*r*.92); if(pf.position.z>.2&&pf.position.y<.62&&pf.position.y>-.6&&Math.abs(pf.position.x)<.78) continue; pf.castShadow=true; body.add(pf); }
  // 顔（目・口）
  const eyeM=new T.MeshStandardMaterial({color:0x111111, roughness:.25}), hi=new T.MeshBasicMaterial({color:0xffffff});
  [-.28,.28].forEach(x=>{ const e=new T.Mesh(new T.SphereGeometry(.12,16,12),eyeM); e.scale.set(1,1.3,.6); e.position.set(x*1.05,.22,.94); body.add(e);
    const h=new T.Mesh(new T.SphereGeometry(.038,8,6),hi); h.position.set(x*1.05+.035,.29,1.0); body.add(h); });
  const mouth=new T.Mesh(new T.CircleGeometry(.25,28,Math.PI,Math.PI),new T.MeshStandardMaterial({color:0x7a2232, roughness:.6, side:T.DoubleSide})); mouth.position.set(0,.02,.985); body.add(mouth);
  const tongue=new T.Mesh(new T.CircleGeometry(.14,20,Math.PI,Math.PI),new T.MeshStandardMaterial({color:0xf08aa0, roughness:.6, side:T.DoubleSide})); tongue.position.set(0,-.11,.99); body.add(tongue);
  [-.55,.55].forEach(x=>{ const ch=new T.Mesh(new T.CircleGeometry(.12,16),new T.MeshBasicMaterial({color:0xffb3c1, transparent:true, opacity:.45})); ch.position.set(x,-.02,.86); ch.rotation.y=x>0?.55:-.55; body.add(ch); });
  // 角
  const antler=s=>{ const a=new T.Group(); const cap=(r,h,x,y,rz)=>{ const m=new T.Mesh(new T.CapsuleGeometry(r,h,6,10),brown); m.position.set(x,y,0); m.rotation.z=rz; m.castShadow=true; a.add(m); };
    cap(.11,.75,0,.4,-.25*s); cap(.085,.38,.3*s,.62,-1.05*s); cap(.085,.32,-.1*s,.9,.45*s); cap(.08,.28,.18*s,1.0,-.6*s);
    a.position.set(.42*s,.62,0); a.rotation.z=-.25*s; return a; };
  body.add(antler(1)); body.add(antler(-1));
  // 羽
  const wingShape=new T.Shape(); wingShape.moveTo(0,0); wingShape.quadraticCurveTo(.5,.55,1.25,.5); wingShape.quadraticCurveTo(1.05,.28,1.15,.08); wingShape.quadraticCurveTo(.9,.12,.88,-.12); wingShape.quadraticCurveTo(.62,-.02,.55,-.22); wingShape.quadraticCurveTo(.3,-.05,0,0);
  const wg=new T.ExtrudeGeometry(wingShape,{depth:.06,bevelEnabled:true,bevelThickness:.03,bevelSize:.03,bevelSegments:2});
  const wings=[1,-1].map(s=>{ const w=new T.Mesh(wg,green); w.castShadow=true; const piv=new T.Group(); piv.add(w); w.scale.set(s,1,1); w.position.set(0,0,-.03); piv.position.set(.78*s,.28,-.25); piv.rotation.y=s>0?.5:-.5; body.add(piv); return {piv,s}; });
  // 手・足
  const hands=[1,-1].map(s=>{ const h=new T.Mesh(new T.SphereGeometry(.24,18,14),gray); h.position.set(.95*s,-.2,.15); h.castShadow=true; body.add(h); return h; });
  const feet=[1,-1].map(s=>{ const f=new T.Mesh(new T.SphereGeometry(.26,18,14),gray); f.scale.set(1,.7,1.15); f.position.set(.42*s,-.9,.1); f.castShadow=true; g.add(f); return f; });
  // 杖
  const pts=[new T.Vector3(0,-1.1,0),new T.Vector3(0,.6,0)]; for(let i=0;i<=10;i++){ const a=i/10*Math.PI*1.6; pts.push(new T.Vector3(.22-Math.cos(a)*.22,.6+Math.sin(a)*.26+i*.01,0)); }
  const staff=new T.Group(); const st=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),40,.055,8,false),brown); st.castShadow=true; staff.add(st);
  const orb=new T.Mesh(new T.SphereGeometry(.1,16,12),new T.MeshStandardMaterial({color:0xb23cff, emissive:0x8a1fe0, emissiveIntensity:1.2, roughness:.2})); orb.position.set(.24,.66,0); staff.add(orb);
  staff.position.set(1.1,.1,.25); staff.rotation.z=-.12; body.add(staff);
  body.position.y=1.15; feet.forEach(f=>f.position.y+=1.15);
  g.userData={body,wings,hands,feet,staff,orb}; return g; }

/* ---------- 木・岩 ---------- */
function makeDecor(){
  const trunkM=new T.MeshStandardMaterial({color:0x7a5534, roughness:.9}), leafM=[0x3f8a3a,0x4f9b3e,0x5aa845].map(c=>new T.MeshStandardMaterial({color:c, roughness:.85, flatShading:true}));
  const rockM=new T.MeshStandardMaterial({color:0x8e8e8a, roughness:.95, flatShading:true});
  const list=[];
  const tree=()=>{ const g=new T.Group(); const h=1.6+Math.random()*1.4; const tr=new T.Mesh(new T.CylinderGeometry(.18,.26,h,8),trunkM); tr.position.y=h/2; tr.castShadow=true; g.add(tr);
    for(let i=0;i<3;i++){ const r=1.2-i*.25+Math.random()*.3; const lf=new T.Mesh(new T.IcosahedronGeometry(r,1),leafM[(Math.random()*3)|0]); lf.position.set((Math.random()-.5)*.6,h+.3+i*.75,(Math.random()-.5)*.6); lf.castShadow=true; g.add(lf); }
    g.userData.r=1; return g; };
  const rock=()=>{ const g=new T.Group(); const r=.4+Math.random()*.9; const m=new T.Mesh(new T.DodecahedronGeometry(r,0),rockM); m.scale.y=.6+Math.random()*.3; m.position.y=r*.35; m.rotation.set(Math.random(),Math.random(),Math.random()); m.castShadow=true; m.receiveShadow=true; g.add(m); g.userData.r=r*.8; return g; };
  for(let i=0;i<70;i++){ const o=Math.random()<.62?tree():rock(); let x,z; do{ x=(Math.random()-.5)*120; z=(Math.random()-.5)*120; }while(Math.hypot(x,z)<7); o.position.set(x,0,z); o.rotation.y=Math.random()*6; list.push(o); }
  return list; }

/* ---------- 音（小さく） ---------- */
function sfx(n){ try{ if(typeof SFX!=="undefined"&&SFX[n]) SFX[n](); }catch(e){} }

/* ---------- ゲーム ---------- */
function start(){
  T=window.THREE; try{ if(T.ColorManagement) T.ColorManagement.legacyMode=false; }catch(e){} const root=document.getElementById("m3o"); root.querySelector(".m3load")?.remove();
  const W=()=>root.clientWidth, H=()=>root.clientHeight;
  const ren=new T.WebGLRenderer({antialias:(window.devicePixelRatio||1)<=2, powerPreference:"high-performance"});
  ren.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75)); ren.setSize(W(),H()); ren.shadowMap.enabled=true; ren.shadowMap.type=T.PCFSoftShadowMap;
  ren.outputEncoding=T.sRGBEncoding; ren.toneMapping=T.ACESFilmicToneMapping; ren.toneMappingExposure=1.05;
  root.prepend(ren.domElement);
  const scene=new T.Scene(); const sky=0xbfe2ff; scene.background=new T.Color(sky); scene.fog=new T.Fog(sky,40,90);
  const cam=new T.PerspectiveCamera(48,W()/H(),.1,200);
  scene.add(new T.HemisphereLight(0xdff1ff,0x4b6a33,.75));
  const sun=new T.DirectionalLight(0xfff1d6,1.35); sun.castShadow=true; sun.shadow.mapSize.set(1536,1536); const sc=sun.shadow.camera; sc.left=-30; sc.right=30; sc.top=30; sc.bottom=-30; sc.near=1; sc.far=90; sun.shadow.bias=-.0008; scene.add(sun); scene.add(sun.target);
  // 地面
  const gt=grassTex(); gt.repeat.set(24,24); const ground=new T.Mesh(new T.PlaneGeometry(240,240),new T.MeshStandardMaterial({map:gt, roughness:1})); ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
  const decor=makeDecor(); decor.forEach(o=>scene.add(o));
  // トト
  const toto=makeToto(); scene.add(toto);
  const BLOB=blobTex(), GLOW_P=glowTex("rgba(190,90,255,.9)"), GLOW_G=glowTex("rgba(80,220,255,.9)"), GLOW_Y=glowTex("rgba(255,220,80,.9)");
  const blobGeo=new T.PlaneGeometry(1,1), blobMat=new T.MeshBasicMaterial({map:BLOB, transparent:true, depthWrite:false});
  // 敵の絵（魔物の画像）
  const pool=(typeof MONSTERS!=="undefined"?MONSTERS:[]).filter(m=>m&&m.img&&!m.gift&&m.rank!=="L"&&m.rank!=="F");
  const byR=r=>pool.filter(m=>m.rank===r);
  const texCache={}; const loader=new T.TextureLoader();
  const texOf=m=>{ if(texCache[m.id]) return texCache[m.id]; const t=loader.load(m.img); t.encoding=T.sRGBEncoding; t.anisotropy=2; return texCache[m.id]=t; };
  const pick=a=>a[(Math.random()*a.length)|0];

  /* 状態 */
  const st={t:0, hp:100, mhp:100, lv:1, xp:0, need:6, kills:0, spd:6.2, mag:3.2, pow:1, cd:1, regen:0, armor:0, up:{bolt:1}, over:false, paused:false, boss:0};
  const enemies=[], shots=[], gems=[], fx=[];
  const keys={}; let joy=null;
  const hud=document.createElement("div"); hud.className="m3hud";
  hud.innerHTML=`<div class="m3row"><span>❤️</span><div class="m3bar m3hp"><i></i></div><span class="m3t" id="m3T">0:00</span></div>
    <div class="m3row" style="margin-top:6px"><span style="font-weight:900;font-size:13px" id="m3Lv">Lv1</span><div class="m3bar m3xp"><i></i></div></div>
    <div class="m3s"><span id="m3K">💀 0</span><span id="m3W"></span></div>`;
  root.appendChild(hud);
  const pb=document.createElement("button"); pb.className="m3btn m3pause"; pb.type="button"; pb.textContent=tx("⏸ 一時停止","⏸ Pause"); root.appendChild(pb);
  const joyEl=document.createElement("div"); joyEl.className="m3joy"; joyEl.innerHTML="<b></b>"; root.appendChild(joyEl);
  const hint=document.createElement("div"); hint.className="m3hint"; hint.textContent=tx("画面をドラッグして移動！ 攻撃は自動です","Drag to move! Attacks are automatic"); root.appendChild(hint);
  const bossEl=document.createElement("div"); bossEl.className="m3boss"; root.appendChild(bossEl);
  setTimeout(()=>{ hint.style.opacity="0"; },4500);
  const $=s=>root.querySelector(s);

  /* 操作 */
  const kd=e=>{ keys[e.key.toLowerCase()]=1; if(e.key==="Escape") togglePause(); }, ku=e=>{ keys[e.key.toLowerCase()]=0; };
  window.addEventListener("keydown",kd); window.addEventListener("keyup",ku);
  const cv=ren.domElement;
  cv.addEventListener("pointerdown",e=>{ if(st.paused||st.over) return; joy={id:e.pointerId, x:e.clientX, y:e.clientY, dx:0, dy:0}; joyEl.style.display="block"; joyEl.style.left=e.clientX+"px"; joyEl.style.top=e.clientY+"px"; joyEl.firstChild.style.transform=""; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove",e=>{ if(!joy||e.pointerId!==joy.id) return; let dx=e.clientX-joy.x, dy=e.clientY-joy.y; const d=Math.hypot(dx,dy), m=50; if(d>m){ dx*=m/d; dy*=m/d; } joy.dx=dx/m; joy.dy=dy/m; joyEl.firstChild.style.transform=`translate(${dx}px,${dy}px)`; });
  const up=e=>{ if(joy&&e.pointerId===joy.id){ joy=null; joyEl.style.display="none"; } }; cv.addEventListener("pointerup",up); cv.addEventListener("pointercancel",up);
  const onRes=()=>{ ren.setSize(W(),H()); cam.aspect=W()/H(); cam.updateProjectionMatrix(); }; window.addEventListener("resize",onRes);
  const onVis=()=>{ if(document.hidden&&!st.paused&&!st.over) togglePause(true); }; document.addEventListener("visibilitychange",onVis);
  pb.onclick=()=>togglePause();

  /* 敵 */
  function spawn(kind){ if(!pool.length) return; const t=st.t/60;
    let m, size=2.2, hp=5*Math.pow(1+.42*t,1.55), sp=2.1+Math.min(1.6,t*.12)+Math.random()*.5, dmg=9+t*2.2, xp=1;
    if(kind==="boss"){ m=pick(byR("Z").concat(byR("S")).length?byR("Z").concat(byR("S")):pool); size=5.2; hp*=70; sp=1.9+t*.05; dmg*=2.2; xp=40; }
    else if(kind==="elite"){ m=pick(byR("A").length?byR("A"):pool); size=2.8; hp*=6; sp*=.85; dmg*=1.5; xp=6; }
    else { const r=Math.random(); m=pick((r<.55?byR("C"):r<.9?byR("B"):byR("A")).concat([]).length?(r<.55?byR("C"):r<.9?byR("B"):byR("A")):pool); }
    const mat=new T.SpriteMaterial({map:texOf(m), transparent:true, alphaTest:.12}); const sp3=new T.Sprite(mat); sp3.scale.set(size,size,1);
    const a=Math.random()*Math.PI*2, R=24+Math.random()*6; const x=toto.position.x+Math.cos(a)*R, z=toto.position.z+Math.sin(a)*R;
    sp3.position.set(x,size*.5,z); scene.add(sp3);
    const sh=new T.Mesh(blobGeo,blobMat); sh.rotation.x=-Math.PI/2; sh.scale.set(size*.8,size*.8,1); sh.position.set(x,.03,z); scene.add(sh);
    enemies.push({sp:sp3, sh, mat, x, z, hp, mhp:hp, spd:sp, dmg, xp, size, r:size*.36, kind, hit:0, bob:Math.random()*6}); }
  function killEnemy(i){ const e=enemies[i]; scene.remove(e.sp); scene.remove(e.sh); e.mat.dispose(); enemies.splice(i,1); st.kills++;
    const n=e.kind==="boss"?18:e.kind==="elite"?4:1; for(let k=0;k<n;k++) dropGem(e.x+(Math.random()-.5)*(n>1?3:0), e.z+(Math.random()-.5)*(n>1?3:0), e.xp/n*(n>1?1:1));
    if(e.kind==="boss"){ st.hp=Math.min(st.mhp,st.hp+st.mhp*.3); flashText(tx("ボスをたおした！","Boss defeated!")); sfx("reveal"); } }
  function hurtEnemy(e,d){ e.hp-=d*st.pow; e.hit=.12; return e.hp<=0; }

  /* 経験値 */
  const gemGeo=new T.OctahedronGeometry(.22,0), gemMat=new T.MeshStandardMaterial({color:0x5fe0ff, emissive:0x1fa8e0, emissiveIntensity:.9, roughness:.2, metalness:.1});
  const gemMatBig=new T.MeshStandardMaterial({color:0xffd75a, emissive:0xe0a01f, emissiveIntensity:.9, roughness:.2});
  function dropGem(x,z,v){ if(gems.length>260){ const g0=gems.shift(); scene.remove(g0.m); }
    const m=new T.Mesh(gemGeo,v>=5?gemMatBig:gemMat); m.position.set(x,.45,z); if(v>=5) m.scale.setScalar(1.5); scene.add(m); gems.push({m,x,z,v,pull:false}); }

  /* 武器 */
  const shotGeo=new T.SphereGeometry(.16,12,8), shotMat=new T.MeshBasicMaterial({color:0xe6b8ff});
  const glowMatP=new T.SpriteMaterial({map:GLOW_P, color:0xffffff, transparent:true, depthWrite:false, blending:T.AdditiveBlending});
  const glowMatY=new T.SpriteMaterial({map:GLOW_Y, color:0xffffff, transparent:true, depthWrite:false, blending:T.AdditiveBlending});
  const stars=[]; const starGeo=new T.OctahedronGeometry(.32,0), starMat=new T.MeshStandardMaterial({color:0xffe066, emissive:0xffb800, emissiveIntensity:1.1, roughness:.3, metalness:.4});
  const W_={bolt:0, wave:0, thunder:0};
  function nearest(maxD=40){ let b=null, bd=maxD*maxD; for(const e of enemies){ const d=(e.x-toto.position.x)**2+(e.z-toto.position.z)**2; if(d<bd){ bd=d; b=e; } } return b; }
  function fireBolt(){ const lv=st.up.bolt||0; if(!lv) return; const tgt=nearest(); if(!tgt) return;
    const n=1+(lv>=3?1:0)+(lv>=6?1:0), pierce=lv>=4?1:0, dmg=(lv>=2?7:5)*(lv>=5?1.45:1);
    const base=Math.atan2(tgt.z-toto.position.z, tgt.x-toto.position.x);
    for(let i=0;i<n;i++){ const a=base+(i-(n-1)/2)*.22; const m=new T.Mesh(shotGeo,shotMat); const gl=new T.Sprite(glowMatP); gl.scale.set(1.1,1.1,1); m.add(gl);
      m.position.set(toto.position.x+Math.cos(a)*.8, 1.6, toto.position.z+Math.sin(a)*.8); scene.add(m); shots.push({m, vx:Math.cos(a)*24, vz:Math.sin(a)*24, life:1.6, dmg, pierce, hitSet:new Set()}); }
    sfx("tap"); }
  function syncStars(){ const lv=st.up.orbit||0, n=lv?1+lv:0; while(stars.length<n){ const s=new T.Mesh(starGeo,starMat); const gl=new T.Sprite(glowMatY); gl.scale.set(1.3,1.3,1); s.add(gl); s.castShadow=true; scene.add(s); stars.push({m:s, cool:new Map()}); } }
  function waveBlast(){ const lv=st.up.wave||0; if(!lv) return; const R=4.2+lv*.9, dmg=6+lv*4;
    const ring=new T.Mesh(new T.RingGeometry(.8,1,48),new T.MeshBasicMaterial({color:0x9ff3ff, transparent:true, opacity:.8, side:T.DoubleSide, depthWrite:false, blending:T.AdditiveBlending}));
    ring.rotation.x=-Math.PI/2; ring.position.set(toto.position.x,.15,toto.position.z); scene.add(ring); fx.push({m:ring, t:0, life:.45, R, kind:"ring"});
    for(let i=enemies.length-1;i>=0;i--){ const e=enemies[i]; const d=Math.hypot(e.x-toto.position.x,e.z-toto.position.z); if(d<R+e.r){ if(hurtEnemy(e,dmg)) killEnemy(i); else { const k=(R-d)/R*2.2; e.x+=(e.x-toto.position.x)/Math.max(d,.1)*k; e.z+=(e.z-toto.position.z)/Math.max(d,.1)*k; } } } }
  function thunder(){ const lv=st.up.thunder||0; if(!lv||!enemies.length) return; const n=lv, dmg=14+lv*7;
    for(let k=0;k<n&&enemies.length;k++){ const near=enemies.filter(e=>Math.hypot(e.x-toto.position.x,e.z-toto.position.z)<22); if(!near.length) break; const e=pick(near);
      const bolt=new T.Mesh(new T.CylinderGeometry(.09,.22,14,6,1,true),new T.MeshBasicMaterial({color:0xfff7a0, transparent:true, opacity:.95, blending:T.AdditiveBlending, depthWrite:false}));
      bolt.position.set(e.x,7,e.z); scene.add(bolt); fx.push({m:bolt, t:0, life:.22, kind:"bolt"});
      const fl=new T.Sprite(glowMatY.clone()); fl.scale.set(4,4,1); fl.position.set(e.x,.6,e.z); scene.add(fl); fx.push({m:fl, t:0, life:.3, kind:"flash"});
      const idx=enemies.indexOf(e); if(hurtEnemy(e,dmg)) killEnemy(idx); } }

  /* レベルアップ */
  function choices(){ const all=UPG.filter(u=>(st.up[u.k]||0)<u.max); const wpns=Object.keys(st.up).filter(k=>UPG.find(u=>u.k===k&&u.wpn)).length;
    const opts=all.filter(u=>!(u.wpn&&!st.up[u.k]&&wpns>=4)); const out=[]; const bag=opts.slice(); while(out.length<3&&bag.length){ out.push(bag.splice((Math.random()*bag.length)|0,1)[0]); } return out; }
  function levelUp(){ st.paused=true; const ops=choices(); if(!ops.length){ st.paused=false; return; }
    const md=document.createElement("div"); md.className="m3modal";
    md.innerHTML=`<div class="m3box"><h3>⬆️ ${tx("レベルアップ！","Level up!")} Lv${st.lv}</h3><div style="font-size:13px;opacity:.75">${tx("1つえらんで強くなろう","Pick one upgrade")}</div><div class="m3cards">${ops.map((u,i)=>{ const lv=st.up[u.k]||0; return `<button class="m3card" type="button" data-i="${i}"><i>${u.ic}</i><span><b>${tx(u.n[0],u.n[1])} <em>${lv?"Lv"+(lv+1):"NEW"}</em></b><small>${lvTxt(u,lv)?lvTxt(u,lv)+"・":""}${tx(u.d[0],u.d[1])}</small></span></button>`; }).join("")}</div></div>`;
    root.appendChild(md); sfx("reveal");
    md.querySelectorAll("[data-i]").forEach(b=>b.onclick=()=>{ const u=ops[+b.dataset.i]; st.up[u.k]=(st.up[u.k]||0)+1; applyUp(u.k); md.remove(); st.paused=false; joy=null; joyEl.style.display="none"; last=performance.now(); }); }
  function applyUp(k){ if(k==="hp"){ st.mhp+=25; st.hp=st.mhp; } if(k==="spd") st.spd*=1.1; if(k==="mag") st.mag*=1.3; if(k==="pow") st.pow*=1.15; if(k==="cd") st.cd*=.92; if(k==="regen") st.regen+=.6; if(k==="armor") st.armor=Math.min(.6,st.armor+.08); if(k==="orbit") syncStars(); wLabel(); }
  function wLabel(){ $("#m3W").textContent=UPG.filter(u=>st.up[u.k]).map(u=>u.ic+(st.up[u.k])).join(" "); }
  function flashText(t){ bossEl.textContent=t; bossEl.style.opacity="1"; setTimeout(()=>{ bossEl.style.opacity="0"; },1800); }

  function togglePause(force){ if(st.over) return; if(st.paused&&!force){ const m=root.querySelector(".m3pausebox"); if(m){ m.remove(); st.paused=false; last=performance.now(); } return; }
    if(root.querySelector(".m3modal")) return; st.paused=true;
    const md=document.createElement("div"); md.className="m3modal m3pausebox";
    md.innerHTML=`<div class="m3box"><h3>⏸ ${tx("一時停止","Paused")}</h3><button class="m3go" type="button" id="m3Re">${tx("つづける","Resume")}</button><button class="m3go g" type="button" id="m3Qt">${tx("やめる","Quit")}</button></div>`;
    root.appendChild(md); md.querySelector("#m3Re").onclick=()=>{ md.remove(); st.paused=false; last=performance.now(); }; md.querySelector("#m3Qt").onclick=()=>{ md.remove(); gameOver(true); }; }

  function gameOver(quit){ if(st.over) return; st.over=true; st.paused=true; sfx(quit?"tap":"lose");
    const tt=Math.floor(st.t); let best=null; try{ S.m3=S.m3||{}; best=S.m3.best||null; const nb=!best||tt>best.t; if(nb){ S.m3.best={t:tt, lv:st.lv, k:st.kills}; } S.m3.plays=(S.m3.plays||0)+1; save(); }catch(e){}
    const isBest=!best||tt>best.t;
    const md=document.createElement("div"); md.className="m3modal";
    md.innerHTML=`<div class="m3box"><h3>${quit?tx("おしまい","Finished"):tx("やられた…","Defeated…")}</h3>${isBest?`<div style="color:#d0472d;font-weight:900">🏆 ${tx("自己ベスト！","New best!")}</div>`:""}
      <div class="m3res"><div><small>${tx("生きのこった時間","Survived")}</small><b>${fmtT(tt)}</b></div><div><small>${tx("レベル","Level")}</small><b>${st.lv}</b></div><div><small>${tx("たおした数","Kills")}</small><b>${st.kills}</b></div></div>
      ${best&&!isBest?`<div style="font-size:12px;opacity:.7">${tx("自己ベスト","Best")}：${fmtT(best.t)}・Lv${best.lv}・${best.k}</div>`:""}
      <button class="m3go" type="button" id="m3Again">${tx("もう一度","Play again")}</button><button class="m3go g" type="button" id="m3Close">${tx("とじる","Close")}</button></div>`;
    root.appendChild(md);
    md.querySelector("#m3Again").onclick=()=>{ close(); setTimeout(()=>window.open3DSurvival(),50); };
    md.querySelector("#m3Close").onclick=close; }
  const fmtT=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  function close(){ cancelAnimationFrame(raf); window.removeEventListener("keydown",kd); window.removeEventListener("keyup",ku); window.removeEventListener("resize",onRes); document.removeEventListener("visibilitychange",onVis);
    try{ scene.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{ if(m.map) m.map.dispose(); m.dispose(); }); } }); }catch(e){}
    Object.values(texCache).forEach(t=>t.dispose()); ren.dispose(); try{ ren.forceContextLoss(); }catch(e){} root.remove(); G=null; try{ render(); }catch(e){} }

  /* 1コマ */
  let last=performance.now(), spawnAcc=0, raf=0, eliteAt=45, nextBoss=120;
  const camOff=new T.Vector3(0,21,15), camPos=new T.Vector3(); let face=0;
  function frame(now){ raf=requestAnimationFrame(frame); let dt=Math.min(.05,(now-last)/1000); last=now;
    if(!st.paused){ step(dt); }
    // カメラ
    camPos.copy(toto.position).add(camOff); cam.position.lerp(camPos, st.paused?1:Math.min(1,dt*6)); cam.lookAt(toto.position.x, 1, toto.position.z);
    sun.position.set(toto.position.x+14, 26, toto.position.z+10); sun.target.position.set(toto.position.x,0,toto.position.z);
    ren.render(scene,cam); }
  function step(dt){ st.t+=dt;
    // 移動
    let mx=(keys["d"]||keys["arrowright"]?1:0)-(keys["a"]||keys["arrowleft"]?1:0), mz=(keys["s"]||keys["arrowdown"]?1:0)-(keys["w"]||keys["arrowup"]?1:0);
    if(joy){ mx=joy.dx; mz=joy.dy; }
    const ml=Math.hypot(mx,mz); if(ml>1){ mx/=ml; mz/=ml; }
    const moving=ml>.08; toto.position.x+=mx*st.spd*dt; toto.position.z+=mz*st.spd*dt;
    // 木・岩にぶつかる
    for(const o of decor){ const dx=toto.position.x-o.position.x, dz=toto.position.z-o.position.z, d=Math.hypot(dx,dz), R=o.userData.r+.9; if(d<R&&d>0){ toto.position.x=o.position.x+dx/d*R; toto.position.z=o.position.z+dz/d*R; } }
    // 見た目
    const u=toto.userData, tt=st.t;
    if(moving){ const tf=Math.atan2(mx,mz); let df=tf-face; while(df>Math.PI) df-=Math.PI*2; while(df<-Math.PI) df+=Math.PI*2; face+=df*Math.min(1,dt*10); }
    toto.rotation.y=face; u.body.position.y=1.15+(moving?Math.abs(Math.sin(tt*12))*.18:Math.sin(tt*2.5)*.04); u.body.rotation.x=moving?.12:0;
    u.wings.forEach(w=>{ w.piv.rotation.y=(w.s>0?.5:-.5)+Math.sin(tt*(moving?16:5))*(moving?.5:.18)*w.s; });
    u.feet.forEach((f,i)=>{ f.position.z=.1+(moving?Math.sin(tt*12+i*Math.PI)*.22:0); });
    u.orb.material.emissiveIntensity=1+Math.sin(tt*6)*.4;
    // 地面・木（ずっと続くように）
    ground.position.set(toto.position.x,0,toto.position.z); gt.offset.set(toto.position.x/10, -toto.position.z/10);
    for(const o of decor){ if(o.position.x-toto.position.x>60) o.position.x-=120; else if(o.position.x-toto.position.x<-60) o.position.x+=120; if(o.position.z-toto.position.z>60) o.position.z-=120; else if(o.position.z-toto.position.z<-60) o.position.z+=120; }
    // 敵を出す
    const tm=st.t/60; const rate=1.1+tm*1.05; spawnAcc+=dt*rate; const cap=Math.min(150,45+tm*22);
    while(spawnAcc>1){ spawnAcc-=1; if(enemies.length<cap) spawn(); }
    if(st.t>eliteAt){ eliteAt+=Math.max(14,40-tm*4); spawn("elite"); }
    if(st.t>nextBoss){ nextBoss+=120; spawn("boss"); flashText(tx("⚠️ ボス出現！","⚠️ Boss incoming!")); sfx("reveal"); }
    // 敵の動き・当たり
    let dmgIn=0;
    for(let i=enemies.length-1;i>=0;i--){ const e=enemies[i]; const dx=toto.position.x-e.x, dz=toto.position.z-e.z, d=Math.hypot(dx,dz)||.01;
      if(d>48){ scene.remove(e.sp); scene.remove(e.sh); e.mat.dispose(); enemies.splice(i,1); continue; }
      e.x+=dx/d*e.spd*dt; e.z+=dz/d*e.spd*dt;
      if(d<e.r+.85) dmgIn+=e.dmg*dt;
      e.bob+=dt*7; e.sp.position.set(e.x, e.size*.5+Math.abs(Math.sin(e.bob))*.18, e.z); e.sh.position.set(e.x,.03,e.z);
      if(e.hit>0){ e.hit-=dt; e.mat.color.setRGB(1,.35,.35); } else e.mat.color.setRGB(1,1,1); }
    // 敵どうし重ならない（少しだけ）
    for(let i=0;i<enemies.length;i+=2){ const a=enemies[i]; for(let j=i+1;j<Math.min(enemies.length,i+8);j++){ const b=enemies[j]; const dx=a.x-b.x, dz=a.z-b.z, d=Math.hypot(dx,dz), R=(a.r+b.r)*.9; if(d<R&&d>0){ const k=(R-d)/d*.5; a.x+=dx*k; a.z+=dz*k; b.x-=dx*k; b.z-=dz*k; } } }
    if(dmgIn>0){ st.hp-=dmgIn*(1-st.armor); u.body.children[0].material.emissive.setRGB(.35,0,0); } else u.body.children[0].material.emissive.setRGB(0,0,0);
    if(st.regen) st.hp=Math.min(st.mhp,st.hp+st.regen*dt);
    if(st.hp<=0){ st.hp=0; updHud(); gameOver(false); return; }
    // 武器
    W_.bolt-=dt; if(W_.bolt<=0){ W_.bolt=.85*st.cd; fireBolt(); }
    if(st.up.wave){ W_.wave-=dt; if(W_.wave<=0){ W_.wave=Math.max(1.6,4.2-st.up.wave*.35)*st.cd; waveBlast(); } }
    if(st.up.thunder){ W_.thunder-=dt; if(W_.thunder<=0){ W_.thunder=Math.max(1.2,3.2-st.up.thunder*.3)*st.cd; thunder(); } }
    if(stars.length){ const R=2.8+(st.up.orbit||0)*.15, n=stars.length, dmg=(5+(st.up.orbit||0)*3); stars.forEach((s,k)=>{ const a=st.t*2.6+k/n*Math.PI*2; const x=toto.position.x+Math.cos(a)*R, z=toto.position.z+Math.sin(a)*R; s.m.position.set(x,1.3,z); s.m.rotation.y+=dt*6;
        for(let i=enemies.length-1;i>=0;i--){ const e=enemies[i]; if(Math.hypot(e.x-x,e.z-z)<e.r+.5){ const c=s.cool.get(e)||0; if(st.t-c>.45){ s.cool.set(e,st.t); if(hurtEnemy(e,dmg)) killEnemy(i); } } } }); }
    for(let i=shots.length-1;i>=0;i--){ const s=shots[i]; s.life-=dt; s.m.position.x+=s.vx*dt; s.m.position.z+=s.vz*dt; let gone=s.life<=0;
      if(!gone) for(let j=enemies.length-1;j>=0;j--){ const e=enemies[j]; if(s.hitSet.has(e)) continue; if(Math.hypot(e.x-s.m.position.x,e.z-s.m.position.z)<e.r+.25){ s.hitSet.add(e); if(hurtEnemy(e,s.dmg)) killEnemy(j); if(s.pierce-- <=0){ gone=true; break; } } }
      if(gone){ scene.remove(s.m); shots.splice(i,1); } }
    // 経験値
    for(let i=gems.length-1;i>=0;i--){ const g=gems[i]; const dx=toto.position.x-g.x, dz=toto.position.z-g.z, d=Math.hypot(dx,dz);
      if(d<st.mag) g.pull=true; if(g.pull){ const v=Math.max(8,18-d)*dt; g.x+=dx/Math.max(d,.01)*Math.min(v,d); g.z+=dz/Math.max(d,.01)*Math.min(v,d); }
      g.m.position.set(g.x,.45+Math.sin(st.t*4+i)*.08,g.z); g.m.rotation.y+=dt*3;
      if(d<.9){ scene.remove(g.m); gems.splice(i,1); st.xp+=g.v; } }
    if(st.xp>=st.need){ st.xp-=st.need; st.lv++; st.need=Math.floor(6+st.lv*4.2+Math.pow(st.lv,1.35)); updHud(); levelUp(); return; }
    // エフェクト
    for(let i=fx.length-1;i>=0;i--){ const f=fx[i]; f.t+=dt; const k=f.t/f.life; if(k>=1){ scene.remove(f.m); f.m.geometry&&f.m.geometry.dispose(); fx.splice(i,1); continue; }
      if(f.kind==="ring"){ const s=1+k*f.R; f.m.scale.set(s,s,s); f.m.material.opacity=.8*(1-k); }
      else if(f.kind==="bolt"){ f.m.material.opacity=.95*(1-k); } else if(f.kind==="flash"){ f.m.material.opacity=1-k; } }
    updHud(); }
  function updHud(){ $(".m3hp i").style.width=(st.hp/st.mhp*100)+"%"; $(".m3xp i").style.width=(st.xp/st.need*100)+"%"; $("#m3T").textContent=fmtT(Math.floor(st.t)); $("#m3Lv").textContent="Lv"+st.lv; $("#m3K").textContent="💀 "+st.kills; }
  wLabel(); updHud(); raf=requestAnimationFrame(frame);
  G={close,st};
}

window.m3Dev=()=>G;
window.open3DSurvival=async function(){ if(G||document.getElementById("m3o")) return;
  if(!document.getElementById("m3css")){ const s=document.createElement("style"); s.id="m3css"; s.textContent=CSS; document.head.appendChild(s); }
  const root=document.createElement("div"); root.id="m3o"; root.setAttribute("translate","no"); root.innerHTML=`<div class="m3load">${tx("読み込み中…","Loading…")}</div>`; document.body.appendChild(root);
  try{ await loadThree(); }catch(e){ root.querySelector(".m3load").innerHTML=`${tx("読み込めませんでした","Could not load")}<br><button class="m3go g" type="button" style="max-width:200px">${tx("とじる","Close")}</button>`; root.querySelector("button").onclick=()=>root.remove(); return; }
  try{ start(); }catch(e){ console.error(e); root.querySelector(".m3load")?.remove(); root.innerHTML=`<div class="m3load">${tx("この端末では3Dが動きませんでした","3D is not supported on this device")}<br><button class="m3go g" type="button" style="max-width:200px">${tx("とじる","Close")}</button></div>`; root.querySelector("button").onclick=()=>root.remove(); }
};
})();
