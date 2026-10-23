/* =========================================================
   魔物キャッチャー（UFOキャッチャー式のミニゲーム）
   A 台を選ぶ（1回2000コイン）／B アーム専門店（1本500コイン）／C アーム作家になる（描いて出品・売れるたびに500コイン）
   本体（index.html）のグローバル（S・save・DB・MYID・MONSTERS・gnow・seasonNow など）を使う
   ========================================================= */
(()=>{
const MC = { PLAY:2000, ARM:500, SALE:500, MAXARM:5, USES:20, LIST_MS:24*3600e3, COL:"arms" };
// 台に置くグッズ。null のときはガチャに出る魔物から自動でえらぶ。魔物の id を並べると、その魔物だけが置かれる（例：[5, 29, 48]）
const MC_GOODS = null;
// 台の種類（cost：1回のコイン・ランクの出やすさ）。ランクが上がるほど出にくい。いくつでも増やせる
const MC_MACHINES = [
  { nm:"ノーマル台", en:"Normal", cost:2000, w:{ C:.4, B:.32, A:.2, S:.07, Z:.01 } },
  { nm:"レア台", en:"Rare", cost:3000, w:{ C:.2, B:.3, A:.3, S:.16, Z:.04 } },
  { nm:"スーパーレア台", en:"Super Rare", cost:3000, w:{ B:.2, A:.4, S:.3, Z:.1 } },
];
const RANK_GRIP = { C:1, B:.9, A:.75, S:.55, Z:.35, L:.3 };   // 重さ：レアなほどつかみにくい
const T = (ja,en) => (typeof LANG!=="undefined" && LANG==="en") ? en : ja;
const st = () => { S.mc=S.mc||{}; const m=S.mc; m.arms=m.arms||[]; m.bought=m.bought||[]; m.paid=m.paid||{}; m.taken=m.taken||{}; m.shop=m.shop||{}; return m; };
const day = () => { try{ return seasonNow(); }catch(e){ return 0; } };   // ゲーム内の1日（ランク戦の切りかえと同じ）
const now = () => { try{ return gnow(); }catch(e){ return Date.now(); } };
const sfx = (k,a) => { try{ SFX[k](a); }catch(e){} };
const fmt = n => Math.floor(n||0).toLocaleString();
const stars = s => { const n=Math.max(1,Math.min(5,1+Math.floor((s||0)*4.99))); return "★".repeat(n)+"☆".repeat(5-n); };
function rng(seed){ let a=seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const coinUpd = () => { const el=document.getElementById("mcCoin"); if(el) el.textContent=fmt(S.coins); try{ renderCoins(); }catch(e){} };

/* ---------- 見た目 ---------- */
const css = document.createElement("style");
css.textContent = `
#mco{position:fixed;inset:0;z-index:140;overflow:hidden;background:#111;touch-action:manipulation;-webkit-user-select:none;user-select:none}
#mco .mc-blur{position:absolute;inset:-30px;background-size:cover;background-position:center;filter:blur(18px) brightness(.55)}
#mco .mc-st{position:absolute;left:0;top:0;transform-origin:0 0;background-size:100% 100%;overflow:hidden}
#mco .mc-coin{position:absolute;right:10px;top:max(10px,env(safe-area-inset-top));z-index:5;background:#3a2306e6;border:3px solid #e9b949;border-radius:12px;padding:3px 12px;color:#ffe9a8;text-align:right;font-weight:900;line-height:1.1}
#mco .mc-coin small{display:block;font-size:10px;color:#f3d79a}
#mco .mc-x{position:absolute;left:10px;top:max(10px,env(safe-area-inset-top));z-index:5;width:44px;height:44px;border-radius:50%;border:3px solid #3a2306;background:#fff8e8;font:900 20px/1 sans-serif;color:#3a2306}
#mco .hit{position:absolute;background:transparent;border:0;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
#mco .hit:active{filter:brightness(.85);background:#0002;border-radius:14px}
#mco .mc-label{position:absolute;left:220px;top:1314px;width:272px;height:68px;background:#24262c;border-radius:6px;display:flex;align-items:center;justify-content:center;gap:8px;color:#fff;font:900 34px/1 var(--f-body,sans-serif)}
#mco .mc-label small{font-size:20px;color:#ffd75e}
#mco .mc-name{position:absolute;left:150px;top:358px;background:#000a;color:#fff;border:3px solid #ffd75e;border-radius:999px;padding:6px 18px;font:900 26px/1 var(--f-body,sans-serif)}
#mco .mc-arm{position:absolute;left:52px;top:1292px;width:126px;height:220px;border:4px solid #2b2f38;border-radius:14px;background:linear-gradient(#fff8e8,#e9dcc0);display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:6px 2px;color:#3a2306;font:900 22px/1.1 var(--f-body,sans-serif);text-align:center;box-shadow:0 4px 0 #1c1f26}
#mco .mc-arm canvas,#mco .mc-arm .ph{width:110px;height:114px}
#mco .mc-arm .ph{display:flex;align-items:center;justify-content:center;font-size:44px;opacity:.5}
#mco .mc-arm em{font-style:normal;font-size:20px;color:#7a5520}
#mco .mc-trol{position:absolute;left:0;top:262px;width:0;height:0;z-index:3}
#mco .mc-mount{position:absolute;left:-40px;top:0;width:80px;height:40px;border-radius:6px 6px 10px 10px;background:linear-gradient(#cfd6e2,#7b8597 60%,#4b5262);border:3px solid #1d2028}
#mco .mc-rod{position:absolute;left:-9px;top:38px;width:18px;background:linear-gradient(90deg,#4b5262,#dfe5ee 45%,#6c7587);border-left:3px solid #1d2028;border-right:3px solid #1d2028}
#mco .mc-armc{position:absolute;transform-origin:50% 12%}
#mco .mc-it{position:absolute;width:96px;height:96px;margin:-48px 0 0 -48px;object-fit:contain;filter:drop-shadow(0 3px 2px #0006);pointer-events:none}
#mco .mc-rk{position:absolute;transform:translate(-50%,0);pointer-events:none;font-size:13px!important;padding:1px 6px!important}
#mco .mc-msg{position:absolute;left:50%;top:430px;transform:translateX(-50%);z-index:4;background:#000c;color:#fff;border:4px solid #ffd75e;border-radius:18px;padding:12px 26px;font:900 36px/1.2 var(--f-body,sans-serif);white-space:nowrap;pointer-events:none;transition:opacity .3s}
#mco .mc-msg[hidden]{display:block;opacity:0}
/* アーム作家の作業台 */
#mco .mc-cv{position:absolute;left:175px;top:520px;width:510px;height:528px;touch-action:none;cursor:crosshair}
#mco .mc-tool{position:absolute;border-radius:16px}
#mco .mc-tool.on{outline:5px solid #ffeb3b;box-shadow:0 0 18px #ffeb3b;background:#ffeb3b33}
#mco .mc-clr{position:absolute;left:386px;top:1100px;width:140px;height:84px;border-radius:12px;border:3px solid #3a2306;background:#fff3d6;color:#3a2306;font:900 24px/1.15 var(--f-body,sans-serif)}
#mco .mc-live{position:absolute;left:536px;top:1076px;width:250px;background:#3a2306e6;color:#fff3d6;border-radius:12px;padding:8px 12px;font:900 24px/1.4 var(--f-body,sans-serif)}
#mco .mc-live b{color:#ffd75e}
#mco .mc-live .ng{color:#ff9a9a;font-size:19px;line-height:1.3;display:block}
#mco .mc-shl{position:absolute;left:222px;top:1268px;font:900 34px/1 var(--f-body,sans-serif);color:#3a2306}
#mco .mc-shl small{font-size:18px;color:#7a5520;margin-left:8px}
#mco .mc-shi{position:absolute;left:224px;top:1322px;width:410px;height:70px;border:0;border-radius:6px;background:#fdf7e6;padding:0 14px;font:900 30px/1 var(--f-body,sans-serif);color:#3a2306;outline:none}
#mco .mc-tb{position:absolute;top:max(10px,env(safe-area-inset-top));right:10px}
#mco .mc-stat{position:absolute;right:14px;top:20px;z-index:2;border:3px solid #3a2306;background:#fff3d6;color:#3a2306;border-radius:999px;padding:10px 18px;font:900 24px/1 var(--f-body,sans-serif)}
#mco .mc-back{position:absolute;left:14px;top:20px;z-index:2;border:3px solid #3a2306;background:#fff3d6;color:#3a2306;border-radius:999px;padding:10px 18px;font:900 24px/1 var(--f-body,sans-serif)}
/* お店・一覧 */
#mco.page{background:linear-gradient(#3b2410,#1f1307)}
#mco .mc-page{position:absolute;inset:0;overflow:auto;-webkit-overflow-scrolling:touch;padding:calc(96px + env(safe-area-inset-top)) 12px 30px}
#mco .mc-ph{position:fixed;left:0;right:0;top:0;z-index:4;display:flex;align-items:center;gap:8px;padding:max(10px,env(safe-area-inset-top)) 128px 10px 64px;background:#2b1a08f2;border-bottom:3px solid #e9b949;color:#ffe9a8;font:900 20px/1.2 var(--f-body,sans-serif);justify-content:flex-start;text-align:left;min-height:72px}
#mco .mc-ph small{display:block;font-size:11px;color:#f3d79a}
#mco .mc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;max-width:760px;margin:0 auto}
#mco .mc-card{background:#f6e7c4;border:3px solid #8a5a1e;border-radius:14px;padding:8px;color:#3a2306;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;text-align:center;animation:mcIn .4s ease-out both}
@keyframes mcIn{from{transform:translateY(-14px);opacity:0}to{transform:none;opacity:1}}
#mco .mc-card canvas{width:120px;height:124px;background:#fdf7e6;border-radius:8px;border:2px solid #d9bf8a}
#mco .mc-card b{font-size:14px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#mco .mc-card .s{color:#c77d00;font-size:15px;letter-spacing:1px}
#mco .mc-card .t{font-size:11px;color:#7a5520}
#mco .mc-card button{width:100%;border:0;border-radius:10px;padding:8px 4px;font:900 13px/1.2 var(--f-body,sans-serif);background:#2f6fe0;color:#fff;box-shadow:0 3px 0 #1d4597}
#mco .mc-card button:disabled{background:#bba98a;box-shadow:none;color:#fff8}
#mco .mc-card.bot{background:#e7e2d6}
#mco .mc-card .tag{font-size:10px;background:#3a2306;color:#ffe9a8;border-radius:999px;padding:2px 8px}
#mco .mc-note{max-width:760px;margin:0 auto 10px;color:#f3d79a;font-size:12px;line-height:1.5;text-align:center}
#mco .mc-sum{max-width:760px;margin:0 auto 12px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
#mco .mc-sum div{background:#f6e7c4;border-radius:12px;padding:8px;text-align:center;color:#3a2306;font-size:11px}
#mco .mc-sum b{display:block;font-size:20px}
.mc-dlg{position:fixed;inset:0;z-index:150;background:#0009;display:flex;align-items:center;justify-content:center;padding:16px}
.mc-dlg>div{background:#fff8e8;color:#3a2306;border:4px solid #3a2306;border-radius:18px;padding:16px;max-width:420px;width:100%;max-height:86vh;overflow:auto;text-align:center;font-size:14px;line-height:1.5}
.mc-dlg h3{margin:0 0 8px;font-size:19px}
.mc-dlg .row{display:flex;gap:8px;margin-top:12px}
.mc-dlg .row button{flex:1;border:0;border-radius:12px;padding:12px;font:900 15px/1.2 var(--f-body,sans-serif);background:#efe2c6;color:#3a2306}
.mc-dlg .row button.go{background:#f2c94c;box-shadow:0 3px 0 #b8902a}
.mc-dlg .al{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin-top:8px}
.mc-dlg .al button{border:3px solid #d9bf8a;border-radius:12px;background:#fdf7e6;padding:6px;font:900 12px/1.3 var(--f-body,sans-serif);color:#3a2306;display:flex;flex-direction:column;align-items:center}
.mc-dlg .al button.on{border-color:#2f6fe0;background:#e6efff}
.mc-dlg .al canvas{width:80px;height:83px}
.mc-dlg .al .s{color:#c77d00}
.mc-pick button{display:flex;align-items:center;gap:10px;width:100%;margin-top:8px;border:3px solid #8a5a1e;border-radius:14px;background:#f6e7c4;padding:10px;text-align:left;color:#3a2306;font:900 16px/1.25 var(--f-body,sans-serif)}
.mc-pick button i{font-style:normal;font-size:30px}
.mc-pick button small{display:block;font-size:11px;font-weight:700;color:#7a5520}
.mg-pick .mg-mc{position:relative;padding:0!important;overflow:hidden;min-height:96px;background:#1d4597!important}
.mg-pick .mg-mc img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.9}
.mg-pick .mg-mc span{position:relative;z-index:1;background:linear-gradient(90deg,#000c,#0000);color:#fff;padding:10px 12px;align-self:stretch;display:flex;flex-direction:column;justify-content:center;text-shadow:0 2px 3px #000}
.mg-pick .mg-mc span small{color:#ffe9a8}
`;
document.head.appendChild(css);

/* ---------- 共通：ステージとダイアログ ---------- */
const V = { raf:0, fit:null, pend:null, busy:false };
function closeAll(){ if(V.pend){ givePrize(V.pend, true); V.pend=null; } cancelAnimationFrame(V.raf); V.raf=0; clearInterval(V.hold); clearInterval(V.liveT); if(V.fit) removeEventListener("resize",V.fit); V.fit=null; document.getElementById("mco")?.remove(); document.querySelectorAll(".mc-dlg").forEach(x=>x.remove()); V.busy=false; }
function shell(W,H,bg){ closeAll(); const el=document.createElement("div"); el.id="mco"; el.setAttribute("translate","no");
  el.innerHTML=`<div class="mc-blur" style="background-image:url(${bg})"></div><div class="mc-st" style="width:${W}px;height:${H}px;background-image:url(${bg})"></div><div class="mc-coin"><small>${T("所持コイン","Coins")}</small><b id="mcCoin"></b></div>`;
  document.body.appendChild(el); const s=el.querySelector(".mc-st");
  const fit=()=>{ const k=Math.min(innerWidth/W, innerHeight/H); s.style.transform=`translate(${(innerWidth-W*k)/2}px,${(innerHeight-H*k)/2}px) scale(${k})`; };
  fit(); V.fit=fit; addEventListener("resize",fit); coinUpd(); return s; }
function page(title, sub){ closeAll(); const el=document.createElement("div"); el.id="mco"; el.className="page"; el.setAttribute("translate","no");
  el.innerHTML=`<div class="mc-ph"><div>${title}${sub?`<small>${sub}</small>`:""}</div></div><button class="mc-x" type="button" aria-label="${T("もどる","Back")}">←</button><div class="mc-coin"><small>${T("所持コイン","Coins")}</small><b id="mcCoin"></b></div><div class="mc-page"></div>`;
  document.body.appendChild(el); el.querySelector(".mc-x").onclick=()=>{ sfx("tap"); openMC(); }; coinUpd(); return el.querySelector(".mc-page"); }
function dlg(html, btns=[[T("閉じる","Close"),null]]){ const bg=document.createElement("div"); bg.className="mc-dlg"; bg.setAttribute("translate","no");
  bg.innerHTML=`<div>${html}<div class="row">${btns.map((b,i)=>`<button type="button" data-i="${i}" class="${i===btns.length-1&&btns.length>1?"go":""}">${b[0]}</button>`).join("")}</div></div>`;
  document.body.appendChild(bg); bg.querySelectorAll("[data-i]").forEach(b=>b.onclick=()=>{ const f=btns[+b.dataset.i][1]; if(f&&f(bg)===true) return; bg.remove(); });
  bg.onclick=e=>{ if(e.target===bg) bg.remove(); }; return bg; }
const msgT={};
function say(t,ms=1600){ const el=document.querySelector("#mco .mc-msg"); if(!el) return; el.textContent=t; el.hidden=false; clearTimeout(msgT.t); msgT.t=setTimeout(()=>{ el.hidden=true; },ms); }
const tw=(ms,f)=>new Promise(res=>{ const t0=performance.now(); const step=t=>{ const k=Math.min(1,(t-t0)/ms); f(k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2); if(k<1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
const wait=ms=>new Promise(r=>setTimeout(r,ms));

/* ---------- アームの絵 ---------- */
// 作業台の紙（510×528）の座標。リング（付着部分）の中心と半径
const CV={W:510,H:528, RX:257, RY:137, RR:76};
// アームの絵（線だけの透明画像）＋リングを、指定の幅でキャンバスに描く
const imgCache={};
function armImg(a){ if(!imgCache[a.id]){ const im=new Image(); im.src=a.img; imgCache[a.id]=im; } return imgCache[a.id]; }
function drawArm(cv, a, w){ const h=Math.round(w*CV.H/CV.W), k=w/CV.W; cv.width=w; cv.height=h; const g=cv.getContext("2d");
  const ring=()=>{ g.lineWidth=Math.max(2,6*k); g.strokeStyle="#1d2028"; g.fillStyle="#e9edf3"; g.beginPath(); g.arc(CV.RX*k,CV.RY*k,CV.RR*k,0,Math.PI*2); g.moveTo(CV.RX*k+CV.RR*k*.4,CV.RY*k); g.arc(CV.RX*k,CV.RY*k,CV.RR*k*.4,0,Math.PI*2,true); g.fill("evenodd"); g.beginPath(); g.arc(CV.RX*k,CV.RY*k,CV.RR*k,0,Math.PI*2); g.stroke(); g.beginPath(); g.arc(CV.RX*k,CV.RY*k,CV.RR*k*.4,0,Math.PI*2); g.stroke(); };
  const im=armImg(a); const go=()=>{ g.clearRect(0,0,w,h); ring(); try{ g.drawImage(im,0,0,w,h); }catch(e){} };
  if(im.complete) go(); else { ring(); im.addEventListener("load",go,{once:true}); } return cv; }
const armCv = (a,w) => drawArm(document.createElement("canvas"), a, w);

/* ---------- アームの強さを調べる（作業台の絵から） ---------- */
// 制作時間が長いほど強い。ただし形（つかめる「ツメ」があるか・はば・深さ・線の量・発想）でも大きく変わる
function analyze(cv, activeMs, strokes){ const g=cv.getContext("2d"), D=g.getImageData(0,0,CV.W,CV.H).data, C=3, gw=Math.ceil(CV.W/C), gh=Math.ceil(CV.H/C), ink=new Uint8Array(gw*gh);
  for(let y=0;y<gh;y++) for(let x=0;x<gw;x++){ let on=0; for(let yy=y*C;yy<Math.min(CV.H,y*C+C)&&!on;yy++) for(let xx=x*C;xx<Math.min(CV.W,x*C+C);xx++){ if(D[(yy*CV.W+xx)*4+3]>40){ on=1; break; } } ink[y*gw+x]=on; }
  const dist=(x,y)=>Math.hypot(x*C+C/2-CV.RX, y*C+C/2-CV.RY);
  const comp=new Uint8Array(gw*gh), Q=[]; let total=0;
  for(let i=0;i<ink.length;i++){ if(!ink[i]) continue; total++; const x=i%gw, y=(i/gw)|0; if(dist(x,y)<=CV.RR+8){ comp[i]=1; Q.push(i); } }
  while(Q.length){ const i=Q.pop(), x=i%gw, y=(i/gw)|0; for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=gw||ny>=gh) continue; const j=ny*gw+nx; if(ink[j]&&!comp[j]){ comp[j]=1; Q.push(j); } } }
  let n=0, minX=1e9, maxX=-1, maxY=-1; const ringBot=CV.RY+CV.RR;
  for(let i=0;i<comp.length;i++){ if(!comp[i]) continue; n++; const x=i%gw, y=(i/gw)|0; if(y*C>CV.RY){ minX=Math.min(minX,x); maxX=Math.max(maxX,x); } maxY=Math.max(maxY,y); }
  const attached=n>0, loose=total-n;
  if(!attached||maxX<0) return {attached, loose, n, str:0, shape:0, time:0};
  const W=(maxX-minX+1)*C, Dp=maxY*C+C-ringBot;
  const widthS = W<100 ? W/100*.4 : W<180 ? .4+.6*(W-100)/80 : W<=420 ? 1 : Math.max(.5,1-(W-420)/200);
  const depthS = Dp<=0 ? 0 : Math.min(1, Dp/180);
  // ツメ：下のほうで、左右に線があって真ん中が空いている行がどれだけあるか
  let rows=0, cupRows=0; const y0=Math.max(Math.ceil(ringBot/C), Math.floor(maxY-(maxY-ringBot/C)*.6));
  for(let y=y0;y<=maxY;y++){ let segs=0, prev=0, gapMax=0, gap=0, seen=0; for(let x=minX;x<=maxX;x++){ const v=comp[y*gw+x]; if(v&&!prev) segs++; if(v){ if(seen) gapMax=Math.max(gapMax,gap); gap=0; seen=1; } else if(seen) gap++; prev=v; } rows++; if(segs>=2&&gapMax*C>=30) cupRows++; }
  const cup = rows ? Math.min(1, cupRows/rows*1.4) : 0;
  const area=n*C*C, inkS = area>40000 ? .7 : Math.min(1, area/9000);
  const creative = Math.min(1,(strokes||0)/8)*.6 + (cup>.2&&widthS>.6 ? .4 : .2);
  const shape = .35*cup + .25*widthS + .15*depthS + .15*inkS + .10*creative;
  const time = Math.min(1, Math.sqrt((activeMs||0)/1000/300));
  const str = Math.max(.05, Math.min(1, .05 + .5*time + .45*shape*(.4+.6*time)));   // 時間をかけるほど強い。形がよいほど、さらに強くなる
  return {attached, loose, n, comp, gw, C, str, shape, time, cup, lx:minX*C/CV.W, rx:(maxX+1)*C/CV.W, by:Math.min(1,(maxY+1)*C/CV.H)}; }
// つながっていない線を消して、小さい画像（保存用）にする
function exportArm(cv, A){ const big=document.createElement("canvas"); big.width=CV.W; big.height=CV.H; const g=big.getContext("2d"); g.drawImage(cv,0,0);
  for(let i=0;i<A.comp.length;i++){ if(A.comp[i]) continue; const x=i%A.gw, y=(i/A.gw)|0; g.clearRect(x*A.C,y*A.C,A.C,A.C); }
  const sm=document.createElement("canvas"); sm.width=204; sm.height=211; sm.getContext("2d").drawImage(big,0,0,204,211); return sm.toDataURL("image/png"); }

/* ---------- ボットのアーム（出品者がいないとき・やや弱い・形がへん） ---------- */
const BOT_SHOPS=[["からくりボット堂","Clockwork Bot Co."],["ボット工房1号","Bot Workshop #1"],["ぐにゃぐにゃ製作所","Wobbly Works"],["ロボのてづくり屋","Robo Handmade"]];
function botArms(){ const d=day(), out=[];
  for(let k=0;k<4;k++){ const r=rng(d*977+k*131+7), cv=document.createElement("canvas"); cv.width=CV.W; cv.height=CV.H; const g=cv.getContext("2d");
    g.strokeStyle="#2b1a08"; g.lineCap="round"; g.lineJoin="round"; g.lineWidth=7+r()*4; let strokes=0;
    const wob=(pts)=>{ g.beginPath(); pts.forEach(([x,y],i)=>{ const jx=x+(r()-.5)*14, jy=y+(r()-.5)*14; i?g.lineTo(jx,jy):g.moveTo(jx,jy); }); g.stroke(); strokes++; };
    const by=CV.RY+CV.RR-4;
    for(const s of [-1,1]){ const sx=CV.RX+s*(20+r()*30), pts=[[sx,by]]; let x=sx, y=by; const len=6+Math.floor(r()*5), out2=60+r()*90;
      for(let i=1;i<=len;i++){ const t=i/len; x=sx+s*Math.sin(t*Math.PI*.9)*out2; y=by+t*(150+r()*120); pts.push([x,y]); }
      pts.push([x-s*(25+r()*50), y+(r()-.3)*40]); wob(pts); }
    for(let j=0;j<1+Math.floor(r()*3);j++){ const x=CV.RX+(r()-.5)*160, y=by+20+r()*200; wob([[CV.RX+(r()-.5)*60,by],[x,y],[x+(r()-.5)*80,y+(r()-.5)*80]]); }
    const A=analyze(cv, 0, strokes); if(!A.attached) continue;
    out.push({ id:`bot-${d}-${k}`, uid:"__bot", bot:1, shop:T(BOT_SHOPS[k][0],BOT_SHOPS[k][1]), img:exportArm(cv,A), str:+(.12+r()*.2).toFixed(3), lx:A.lx, rx:A.rx, by:A.by, at:0 }); }
  return out; }

/* ---------- メニュー（A・B・C） ---------- */
async function checkSales(){ if(!DB||!MYID) return; try{ const q=await DB.collection(MC.COL).where("uid","==",MYID).get(); const m=st(); let add=0, cnt=0;
    q.docs.forEach(x=>{ const d=x.data(), sold=Math.max(0,Math.floor(d.sold||0)), paid=m.paid[x.id]||0; if(sold>paid){ add+=(sold-paid)*MC.SALE; cnt+=sold-paid; m.paid[x.id]=sold; } });
    if(add>0){ S.coins+=add; save(); coinUpd(); dlg(`<h3>🦾 ${T("アームが売れた！","Your arms sold!")}</h3><p>${T(`あなたのアームが <b>${cnt}本</b> 売れました！`,`<b>${cnt}</b> of your arms sold!`)}</p><p style="font-size:22px;font-weight:900;color:#2e7d32">+${fmt(add)} ${T("コイン","coins")}</p>`); sfx("coin"); } }catch(e){} }
function openMC(){ closeAll(); const m=st(); sfx("tap");
  const bg=dlg(`<h3>🎯 ${T("魔物キャッチャー","Monster Catcher")}</h3><p style="font-size:12px;margin:0">${T(`持っているアーム：${m.arms.length}/${MC.MAXARM}本`,`Arms: ${m.arms.length}/${MC.MAXARM}`)}</p>
    <div class="mc-pick"><button type="button" data-p="a"><i>🎮</i><span>${T("台を選ぶ","Choose a machine")}<small>${T(`1回${fmt(MC.PLAY)}コイン〜。アームで魔物をつかんで、手に入れよう！`,`From ${fmt(MC.PLAY)} coins a play. Grab monsters with your arm!`)}</small></span></button>
    <button type="button" data-p="b"><i>🏪</i><span>${T("アーム専門店","Arm Shop")}<small>${T(`みんなが作ったアームを買える（1本${fmt(MC.ARM)}コイン・${MC.USES}回使うとこわれる）`,`Buy arms made by others (${fmt(MC.ARM)} coins each, breaks after ${MC.USES} uses)`)}</small></span></button>
    <button type="button" data-p="c"><i>✏️</i><span>${T("アーム作家になる","Become an arm maker")}<small>${T(`指でアームを描いて出品。売れるたびに${fmt(MC.SALE)}コイン！`,`Draw an arm and sell it. ${fmt(MC.SALE)} coins every sale!`)}</small></span></button></div>`,[[T("閉じる","Close"),null]]);
  bg.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>{ bg.remove(); sfx("tap"); ({a:()=>openGame(0), b:openShop, c:openWork})[b.dataset.p](); });
  checkSales(); }
window.openMC = openMC; window.__mc = { openShop:()=>openShop(), openGame:i=>openGame(i), openWork:()=>openWork(), openStats:()=>openStats() };

/* ---------- A：台 ---------- */
const GAME={ W:1026, H:1532, XMIN:150, XMAX:905, CHUTE:157, X0:560, TOP:262, IDLE:46, AW:330, PILE:[262,925], ROW:[1032,1096] };
function goods(mi){ const d=day(), M=MC_MACHINES[mi], r=rng(d*7919+mi*104729+11);
  const pool = MC_GOODS ? MC_GOODS.map(id=>mon(id)).filter(Boolean) : MONSTERS.filter(m=>!m.gift&&!m.evoOnly&&m.rank!=="L");
  const pick=()=>{ if(MC_GOODS) return pool[Math.floor(r()*pool.length)]; let x=r(), rk="A"; for(const [k,w] of Object.entries(M.w)){ if((x-=w)<0){ rk=k; break; } }
    const order=[rk, ...RANKS.filter(k=>k!==rk&&k!=="L")]; for(const k of order){ const p=pool.filter(m=>m.rank===k); if(p.length) return p[Math.floor(r()*p.length)]; } return pool[0]; };
  const items=[], N=9;
  for(let i=0;i<N;i++){ const m=pick(); const back=i%2===0; const x=GAME.PILE[0]+(GAME.PILE[1]-GAME.PILE[0])*((i+.5)/N)+(r()-.5)*40; items.push({i, m, x:Math.round(x), y:back?GAME.ROW[0]+r()*16:GAME.ROW[1]+r()*14, rot:(r()-.5)*24}); }
  const taken=st().taken[`${d}_${mi}`]||[]; return items.filter(o=>!taken.includes(o.i)); }
function curArm(){ const m=st(); return m.arms.find(a=>a.u===m.cur) || m.arms[0] || null; }
function openGame(mi){ const s=shell(GAME.W,GAME.H,"mc/machine.jpg"), m=st(); mi=((mi%MC_MACHINES.length)+MC_MACHINES.length)%MC_MACHINES.length; V.mi=mi;
  const M=MC_MACHINES[mi], hit=(id,x,y,w,h,lab)=>`<button type="button" class="hit" id="${id}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px" aria-label="${lab}"></button>`;
  s.innerHTML=`<div class="mc-name">${T(`台${mi+1}　${M.nm}`,`Machine ${mi+1} · ${M.en}`)}</div><div id="mcItems"></div>
    <div class="mc-trol" id="mcTrol"><div class="mc-mount"></div><div class="mc-rod" id="mcRod"></div><canvas class="mc-armc" id="mcArmC"></canvas></div>
    <div class="mc-label">${T("1回","1 play")} ${fmt(M.cost||MC.PLAY)}<small>${T("コイン","coins")}</small></div>
    <button type="button" class="mc-arm" id="mcArmB"></button>
    ${hit("mcNext",607,1308,218,72,T("次の台","Next"))}${hit("mcL",178,1404,132,92,"←")}${hit("mcR",312,1404,132,92,"→")}${hit("mcGo",490,1384,168,128,T("決定","Go"))}${hit("mcBack",703,1406,162,86,T("もどる","Back"))}
    <div class="mc-msg" hidden></div>`;
  V.x=GAME.X0; V.rod=GAME.IDLE; V.items=goods(mi); V.busy=false;
  drawItems(); drawArmBtn(); placeTrol();
  const g=id=>document.getElementById(id);
  g("mcBack").onclick=()=>{ if(V.busy) return; sfx("tap"); openMC(); };
  g("mcNext").onclick=()=>{ if(V.busy) return; sfx("tap"); openGame(mi+1); };
  g("mcArmB").onclick=()=>{ if(V.busy) return; sfx("tap"); pickArm(); };
  const hold=d=>e=>{ e.preventDefault(); if(V.busy) return; clearInterval(V.hold); const step=()=>{ V.x=Math.max(GAME.XMIN,Math.min(GAME.XMAX,V.x+d*9)); placeTrol(); }; step(); V.hold=setInterval(step,16); };
  const stop=()=>clearInterval(V.hold);
  for(const [id,d] of [["mcL",-1],["mcR",1]]){ const b=g(id); b.onpointerdown=hold(d); b.onpointerup=stop; b.onpointerleave=stop; b.onpointercancel=stop; b.oncontextmenu=e=>e.preventDefault(); }
  g("mcGo").onclick=()=>play();
  if(!m.arms.length) setTimeout(noArm,300); else say(T("← → で動かして「決定」！","Move with ← →, then press Go!"),2200); }
function noArm(){ dlg(`<h3>🦾 ${T("アームがありません","You have no arm")}</h3><p>${T("アーム専門店でアームを購入してください。","Please buy an arm at the Arm Shop.")}</p>`,[[T("閉じる","Close"),null],[T("アーム専門店へ","Go to the Arm Shop"),()=>{ openShop(); }]]); }
function drawItems(){ const box=document.getElementById("mcItems"); if(!box) return;
  box.innerHTML=V.items.slice().sort((a,b)=>a.y-b.y).map(o=>`<img class="mc-it" data-i="${o.i}" src="${o.m.img}" alt="" style="left:${o.x}px;top:${o.y}px;transform:rotate(${o.rot}deg);z-index:${Math.round(o.y)}">${["S","Z"].includes(o.m.rank)?`<span class="rk rk-${o.m.rank} mc-rk" data-r="${o.i}" style="left:${o.x}px;top:${o.y+40}px;z-index:${Math.round(o.y)+1}">${o.m.rank}</span>`:""}`).join(""); }
function drawArmBtn(){ const b=document.getElementById("mcArmB"); if(!b) return; const a=curArm();
  b.innerHTML = a ? `<span>${T("アームを<br>選ぶ","Choose<br>arm")}</span><canvas></canvas><em>${T(`のこり${a.left}回`,`${a.left} uses left`)}</em>` : `<span>${T("アームを<br>選ぶ","Choose<br>arm")}</span><div class="ph">🦾</div><em>${T("なし","none")}</em>`;
  if(a) drawArm(b.querySelector("canvas"), a, 192);
  const c=document.getElementById("mcArmC"); if(a){ drawArm(c, a, GAME.AW); c.hidden=false; } else c.hidden=true; placeTrol(); }
function armGeo(){ const a=curArm(), k=GAME.AW/CV.W, h=GAME.AW*CV.H/CV.W, ringTop=(CV.RY-CV.RR)*k;
  return { a, k, h, ringTop, bot:a?(a.by||.8)*h:h*.8, lx:a?(a.lx||.3)*GAME.AW:GAME.AW*.3, rx:a?(a.rx||.7)*GAME.AW:GAME.AW*.7 }; }
function placeTrol(held){ const t=document.getElementById("mcTrol"); if(!t) return; const G=armGeo(); t.style.left=V.x+"px";
  document.getElementById("mcRod").style.height=V.rod+"px"; const c=document.getElementById("mcArmC"); c.style.left=(-GAME.AW/2)+"px"; c.style.top=(38+V.rod-G.ringTop)+"px"; c.style.width=GAME.AW+"px";
  if(V.held){ const el=document.querySelector(`#mcItems img[data-i="${V.held.i}"]`), y=GAME.TOP+38+V.rod-G.ringTop+G.bot-30; if(el){ el.style.left=V.x+"px"; el.style.top=y+"px"; el.style.zIndex=2000; } const rk=document.querySelector(`#mcItems .mc-rk[data-r="${V.held.i}"]`); if(rk) rk.remove(); } }
async function play(){ if(V.busy) return; const a=curArm(); if(!a) return noArm();
  const cost=MC_MACHINES[V.mi].cost||MC.PLAY;   // 台ごとの1回の値段
  if((S.coins||0)<cost) return say(T("コインが足りません","Not enough coins"));
  V.busy=true; sfx("tap"); S.coins-=cost; a.left=Math.max(0,(a.left??MC.USES)-1); save(); coinUpd(); drawArmBtn();
  const G=armGeo();
  // ねらい：アームのはばの中で、いちばん真ん中に近い魔物
  const cx=V.x, half=Math.max(30,(G.rx-G.lx)/2*.9), mid=V.x-GAME.AW/2+(G.lx+G.rx)/2;
  const cand=V.items.map(o=>({o, dx:Math.abs(o.x-mid)})).filter(z=>z.dx<=half).sort((p,q)=>p.dx-q.dx||q.o.y-p.o.y);
  const tgt=cand[0]&&cand[0].o, align=tgt?1-cand[0].dx/half:0;
  const p = tgt ? Math.max(.02, Math.min(.85, (.12+.6*(a.str||.2)) * (.5+.5*align) * (RANK_GRIP[tgt.m.rank]||.5))) : 0;
  const win = tgt && Math.random()<p, slip = tgt && !win && align>.25 && Math.random()<.55;
  if(win) V.pend={m:tgt.m, mi:V.mi, i:tgt.i};
  // 下りる
  const floorY = tgt ? tgt.y-26 : GAME.ROW[0]-10, maxRod = floorY - (GAME.TOP+38) + G.ringTop - G.bot;
  const r0=V.rod; await tw(900,k=>{ V.rod=r0+(Math.max(r0,maxRod)-r0)*k; placeTrol(); });
  const c=document.getElementById("mcArmC"); await tw(260,k=>{ if(c) c.style.transform=`scaleX(${1-.12*k})`; }); await wait(150);
  if(win||slip){ V.held=tgt; }
  const r1=V.rod; let dropAt = slip ? .25+Math.random()*.6 : 2;
  const fall=async()=>{ const o=V.held; V.held=null; const el=document.querySelector(`#mcItems img[data-i="${o.i}"]`); const sy=parseFloat(el?el.style.top:o.y), nx=Math.max(GAME.PILE[0],Math.min(GAME.PILE[1],V.x+(Math.random()-.5)*60));
    sfx("ng"); await tw(380,k=>{ if(el){ el.style.top=(sy+(o.y-sy)*k)+"px"; el.style.left=(V.x+(nx-V.x)*k)+"px"; } }); o.x=Math.round(nx); drawItems(); say(T("おしい！","So close!")); };
  // 上がる
  await tw(900,k=>{ V.rod=r1+(GAME.IDLE-r1)*k; placeTrol(); if(V.held&&slip&&k>=dropAt&&dropAt<1){ dropAt=9; fall(); } }); if(V.held&&slip){ await fall(); }
  // 出口へ
  const x0=V.x; await tw(Math.max(400,Math.abs(x0-GAME.CHUTE)*1.6),k=>{ V.x=x0+(GAME.CHUTE-x0)*k; placeTrol(); });
  await tw(240,k=>{ if(c) c.style.transform=`scaleX(${.88+.12*k})`; }); if(c) c.style.transform="";
  if(V.held){ const o=V.held; V.held=null; const el=document.querySelector(`#mcItems img[data-i="${o.i}"]`); const sy=parseFloat(el?el.style.top:0);
    await tw(500,k=>{ if(el){ el.style.top=(sy+(1320-sy)*k)+"px"; el.style.opacity=String(1-k*.6); } });
    V.items=V.items.filter(z=>z!==o); drawItems(); const pd=V.pend; V.pend=null; if(pd) givePrize(pd,false); }
  else if(!tgt) say(T("つかめなかった…","Missed..."));
  else if(!slip) say(T("つかめなかった…","Couldn't grab it..."));
  await wait(200); const x1=V.x; await tw(500,k=>{ V.x=x1+(GAME.X0-x1)*k; placeTrol(); });
  if(a.left<=0){ const m=st(); m.arms=m.arms.filter(z=>z!==a); if(m.cur===a.u) m.cur=m.arms[0]?m.arms[0].u:null; save(); drawArmBtn(); dlg(`<h3>💥 ${T("アームがこわれた！","Your arm broke!")}</h3><p>${T(`「${esc(a.shop||"")}」のアームを${MC.USES}回使ったので、こわれてなくなりました。`,`The arm from "${esc(a.shop||"")}" was used ${MC.USES} times and broke.`)}</p>`, m.arms.length?[[T("OK","OK"),null]]:[[T("閉じる","Close"),null],[T("アーム専門店へ","Arm Shop"),()=>openShop()]]); }
  if(!V.items.length) say(T("この台は空っぽ！ 次の台へ","This machine is empty! Try the next one"),2500);
  V.busy=false; }
function givePrize(pd, quiet){ const m=pd.m, M=st(), key=`${day()}_${pd.mi}`; (M.taken[key]=M.taken[key]||[]).push(pd.i);
  S.got[m.id]=(S.got[m.id]||0)+1; S.units.push({u:S.nextUid++,m:m.id,l:1,e:0,s:0,g:0,k:false,t:now()}); save();
  try{ render(); }catch(e){}
  if(quiet){ try{ toast(T(`🎯 魔物キャッチャー：「${m.name}」をゲット！（BOXに入りました）`,`🎯 Monster Catcher: got "${m.name}"! (sent to your BOX)`)); }catch(e){} return; }
  sfx("reveal", m.rank); const g=document.createElement("div"); g.className="reveal"; g.style.zIndex=160; g.setAttribute("translate","no");
  g.innerHTML=`<div class="burst"></div><h3>🎯 ${T("ゲット！","Got it!")}</h3><img src="${cardURL(m.id,0)}" alt="" style="width:min(60vw,260px);height:auto"><p class="note" style="text-align:center"><span class="rk rk-${m.rank}">${m.rank}</span> <b>${esc(m.name)}</b><br>${T("BOXに入りました","Sent to your BOX")}</p><button class="btn gold" type="button">OK</button>`;
  document.body.appendChild(g); g.querySelector(".btn").onclick=()=>g.remove(); }
function pickArm(){ const m=st(); if(!m.arms.length) return noArm();
  const bg=dlg(`<h3>🦾 ${T("アームを選ぶ","Choose an arm")}</h3><div class="al">${m.arms.map(a=>`<button type="button" data-u="${a.u}" class="${curArm()===a?"on":""}"><canvas></canvas><span class="s">${stars(a.str)}</span><span>${esc(a.shop||"")}</span><small>${T(`のこり${a.left}回`,`${a.left} uses`)}</small></button>`).join("")}</div>`,[[T("閉じる","Close"),null],[T("アーム専門店へ","Arm Shop"),()=>openShop()]]);
  bg.querySelectorAll("[data-u]").forEach((b,i)=>{ drawArm(b.querySelector("canvas"), m.arms[i], 160); b.onclick=()=>{ m.cur=b.dataset.u; save(); bg.remove(); drawArmBtn(); sfx("tap"); }; }); }

/* ---------- B：アーム専門店 ---------- */
async function openShop(){ const box=page(`🏪 ${T("アーム専門店","Arm Shop")}`, T(`1本${fmt(MC.ARM)}コイン・${MC.USES}回使うとこわれる・同じお店からは1日1本まで`,`${fmt(MC.ARM)} coins each · breaks after ${MC.USES} uses · 1 per shop per day`));
  box.innerHTML=`<p class="mc-note">${T("読みこみ中…","Loading...")}</p>`;
  const m=st(); let list=[];
  if(DB){ try{ const q=await DB.collection(MC.COL).where("at",">",now()-MC.LIST_MS).orderBy("at","desc").limit(120).get(); list=q.docs.map(x=>({id:x.id,...x.data()})); }catch(e){ box.innerHTML=`<p class="mc-note">${T("読みこめませんでした。","Couldn't load.")} ${esc(e&&e.code||"")}</p>`; } }
  if(!document.getElementById("mco")) return;
  const players=list.filter(a=>a.img&&a.uid);
  const show=players.filter(a=>!m.bought.includes(a.id));
  const bots = players.length ? [] : botArms().filter(a=>!m.bought.includes(a.id));
  const all=[...show, ...bots];
  const sd=m.shop.d===day()?m.shop.u||[]:[];
  box.innerHTML=`${!DB||!MYID?`<p class="mc-note">${T("ログインすると買えます","Sign in to buy")}</p>`:""}${bots.length?`<p class="mc-note">${T("いまは出品している作家がいないので、ボットが作ったアームを売っています（やや弱め）。","No makers are selling right now, so bot-made arms are on sale (a bit weak).")}</p>`:""}
    <div class="mc-grid">${all.map((a,i)=>{ const mine=a.uid===MYID, lim=sd.includes(a.uid); const left=a.at?Math.max(0,a.at+MC.LIST_MS-now()):0;
      return `<div class="mc-card ${a.bot?"bot":""}" style="animation-delay:${Math.min(i,12)*40}ms"><canvas></canvas><b>${esc(a.shop||"?")}</b><span class="s">${stars(a.str)}</span>${a.bot?`<span class="tag">🤖 ${T("ボット","Bot")}</span>`:`<span class="t">${T(`のこり${Math.ceil(left/3600e3)}時間`,`${Math.ceil(left/3600e3)}h left`)}</span>`}
        <button type="button" data-i="${i}" ${mine||lim?"disabled":""}>${mine?T("あなたの作品","Your work"):lim?T("このお店は今日はもう買えません","Already bought here today"):T(`${fmt(MC.ARM)}コインで買う`,`Buy for ${fmt(MC.ARM)}`)}</button></div>`; }).join("")||`<p class="mc-note">${T("いま買えるアームはありません。","No arms for sale right now.")}</p>`}</div>`;
  box.querySelectorAll(".mc-card canvas").forEach((c,i)=>drawArm(c, all[i], 240));
  box.querySelectorAll("[data-i]").forEach(b=>b.onclick=()=>buy(all[+b.dataset.i])); }
async function buy(a){ const m=st(); if(!DB||!MYID) return dlg(`<p>${T("ログインすると買えます","Sign in to buy")}</p>`);
  if(a.uid===MYID) return; if((S.coins||0)<MC.ARM) return dlg(`<p>${T("コインが足りません","Not enough coins")}</p>`);
  const sd=m.shop.d===day()?m.shop.u||[]:[]; if(sd.includes(a.uid)) return dlg(`<p>${T("このお店からは、今日はもう買えません（1日1本まで）","You've already bought from this shop today (1 per day)")}</p>`);
  const go=async(drop)=>{ if(!a.bot){ try{ const ref=DB.collection(MC.COL).doc(a.id); await DB.runTransaction(async tx=>{ const s=await tx.get(ref); if(!s.exists) throw {code:"gone"}; tx.update(ref,{sold:(s.data().sold||0)+1}); }); }catch(e){ return dlg(`<p>${T("買えませんでした","Couldn't buy")} ${esc(e&&e.code||"")}</p>`); } }
    if(drop) m.arms=m.arms.filter(z=>z!==drop);
    S.coins-=MC.ARM; const arm={u:`${a.id}`, id:a.id, img:a.img, str:a.str, lx:a.lx, rx:a.rx, by:a.by, bot:a.bot?1:0, shop:a.shop, left:MC.USES, at:now()}; m.arms.push(arm); if(!curArm()||!m.cur) m.cur=arm.u;
    m.bought.push(a.id); if(m.bought.length>400) m.bought=m.bought.slice(-400); if(m.shop.d!==day()) m.shop={d:day(),u:[]}; m.shop.u.push(a.uid); save(); coinUpd(); sfx("coin");
    dlg(`<h3>🦾 ${T("アームを買った！","Arm purchased!")}</h3><p>${T(`「${esc(a.shop)}」のアーム（${stars(a.str)}）`,`Arm from "${esc(a.shop)}" (${stars(a.str)})`)}</p>`,[[T("お店にもどる","Back to shop"),()=>openShop()],[T("台で遊ぶ","Play"),()=>openGame(V.mi||0)]]); };
  if(m.arms.length>=MC.MAXARM){ const bg=dlg(`<h3>🔄 ${T("アームを交換","Swap an arm")}</h3><p>${T(`持てるアームは${MC.MAXARM}本までです。手放すアームを選んでください。`,`You can hold up to ${MC.MAXARM} arms. Choose one to give up.`)}</p><div class="al">${m.arms.map(z=>`<button type="button"><canvas></canvas><span class="s">${stars(z.str)}</span><small>${T(`のこり${z.left}回`,`${z.left} uses`)}</small></button>`).join("")}</div>`,[[T("やめる","Cancel"),null]]);
    bg.querySelectorAll(".al button").forEach((b,i)=>{ const z=m.arms[i]; drawArm(b.querySelector("canvas"), z, 160); b.onclick=()=>{ bg.remove(); go(z); }; }); return; }
  dlg(`<h3>🦾 ${T("このアームを買う？","Buy this arm?")}</h3><canvas id="mcBuyC" style="width:160px;height:166px"></canvas><p>${esc(a.shop)}　<span style="color:#c77d00">${stars(a.str)}</span><br>${T(`${fmt(MC.ARM)}コイン・${MC.USES}回使える`,`${fmt(MC.ARM)} coins · ${MC.USES} uses`)}</p>`,[[T("やめる","Cancel"),null],[T("買う","Buy"),()=>{ go(null); }]]);
  drawArm(document.getElementById("mcBuyC"), a, 320); }

/* ---------- C：アーム作家 ---------- */
const WK={W:852,H:1846};
function openWork(){ if(!DB||!MYID){ return dlg(`<p>${T("ログインするとアームを出品できます","Sign in to sell arms")}</p>`,[[T("もどる","Back"),()=>openMC()]]); }
  const s=shell(WK.W,WK.H,"mc/work.jpg"), m=st();
  s.innerHTML=`<button type="button" class="mc-back" id="mcWBack">← ${T("もどる","Back")}</button><button type="button" class="mc-stat" id="mcWStat">📊 ${T("過去の作品","My arms")}</button>
    <canvas class="mc-cv" id="mcCv" width="${CV.W}" height="${CV.H}"></canvas>
    <button type="button" class="hit mc-tool on" id="mcPen" style="left:166px;top:1080px;width:104px;height:126px" aria-label="${T("えんぴつ","Pencil")}"></button>
    <button type="button" class="hit mc-tool" id="mcEra" style="left:284px;top:1080px;width:90px;height:130px" aria-label="${T("消しゴム","Eraser")}"></button>
    <button type="button" class="mc-clr" id="mcClr">🗑<br>${T("ぜんぶ消す","Clear")}</button>
    <div class="mc-live" id="mcLive"></div>
    <div class="mc-shl">${T("ショップ名","Shop name")}<small>${T("（16文字まで）","(up to 16)")}</small></div>
    <input class="mc-shi" id="mcShop" maxlength="16" placeholder="${T("例：トトのアーム屋","e.g. Toto's Arms")}" value="${esc(m.shopName||"")}">
    <button type="button" class="hit" id="mcPub" style="left:210px;top:1462px;width:432px;height:130px;border-radius:20px" aria-label="${T("出品する","Sell")}"></button>`;
  const cv=document.getElementById("mcCv"), g=cv.getContext("2d"); let tool="pen", drawing=false, last=null, strokes=0, active=0, lastAct=0, A=null;
  const act=()=>{ const t=performance.now(); if(lastAct && t-lastAct<8000) active+=t-lastAct; lastAct=t; };
  const pos=e=>{ const r=cv.getBoundingClientRect(); return [(e.clientX-r.left)/r.width*CV.W, (e.clientY-r.top)/r.height*CV.H]; };
  const line=(a,b)=>{ g.globalCompositeOperation=tool==="pen"?"source-over":"destination-out"; g.strokeStyle="#2b1a08"; g.lineWidth=tool==="pen"?12:30; g.lineCap="round"; g.lineJoin="round"; g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(b[0],b[1]); g.stroke(); };
  cv.onpointerdown=e=>{ e.preventDefault(); cv.setPointerCapture(e.pointerId); drawing=true; last=pos(e); line(last,[last[0]+.1,last[1]+.1]); if(tool==="pen") strokes++; act(); };
  cv.onpointermove=e=>{ if(!drawing) return; const p=pos(e); line(last,p); last=p; act(); };
  cv.onpointerup=cv.onpointercancel=()=>{ drawing=false; act(); live(); };
  const setTool=t=>{ tool=t; document.getElementById("mcPen").classList.toggle("on",t==="pen"); document.getElementById("mcEra").classList.toggle("on",t==="era"); sfx("tap"); };
  document.getElementById("mcPen").onclick=()=>setTool("pen"); document.getElementById("mcEra").onclick=()=>setTool("era");
  document.getElementById("mcClr").onclick=()=>{ dlg(`<p>${T("ぜんぶ消しますか？","Clear everything?")}</p>`,[[T("やめる","Cancel"),null],[T("消す","Clear"),()=>{ g.clearRect(0,0,CV.W,CV.H); strokes=0; live(); }]]); };
  document.getElementById("mcWBack").onclick=()=>{ sfx("tap"); openMC(); };
  document.getElementById("mcWStat").onclick=()=>{ sfx("tap"); openStats(); };
  const mmss=ms=>{ const s2=Math.floor(ms/1000); return `${Math.floor(s2/60)}:${String(s2%60).padStart(2,"0")}`; };
  function live(){ A=analyze(cv, active, strokes); const el=document.getElementById("mcLive"); if(!el) return;
    el.innerHTML=`⏱ ${T("制作時間","Time")} <b>${mmss(active)}</b><br>💪 ${T("強さ","Power")} <b>${A.attached?stars(A.str):"―"}</b>${!A.n&&!A.loose?`<span class="ng">${T("鉛筆で紙をなぞってね","Draw on the paper")}</span>`:!A.attached?`<span class="ng">${T("リング（付着部分）に線をつなげてね","Connect your lines to the ring")}</span>`:A.loose?`<span class="ng">${T("リングにつながっていない線は使われません","Lines not connected to the ring won't be used")}</span>`:""}`; }
  live(); V.liveT=setInterval(()=>{ if(document.getElementById("mcLive")) document.getElementById("mcLive").querySelector("b").textContent=mmss(active); },1000);
  document.getElementById("mcPub").onclick=async()=>{ live(); const shop=(document.getElementById("mcShop").value||"").trim().slice(0,16);
    if(!A.attached||A.n<160) return dlg(`<h3>✏️ ${T("まだ出品できません","Not ready yet")}</h3><p>${T("アームが動く付着部分（リング）に、しっかり描いた線をつなげてください。","Connect solid lines to the ring (the attachment point).")}</p>`);
    if(!shop) return dlg(`<p>${T("ショップ名を入れてください","Enter a shop name")}</p>`);
    dlg(`<h3>🏪 ${T("出品する？","Sell this arm?")}</h3><canvas id="mcPubC" style="width:160px;height:166px"></canvas><p>${esc(shop)}　<span style="color:#c77d00">${stars(A.str)}</span><br>${T(`専門店に24時間ならびます。1本売れるたびに${fmt(MC.SALE)}コイン！`,`Listed for 24 hours. ${fmt(MC.SALE)} coins per sale!`)}</p>`,[[T("やめる","Cancel"),null],[T("出品する","Sell"),()=>{ (async()=>{ try{
        const img=exportArm(cv,A); const doc={uid:MYID, shop, img, str:+A.str.toFixed(3), lx:+A.lx.toFixed(3), rx:+A.rx.toFixed(3), by:+A.by.toFixed(3), ms:Math.round(active), at:now(), sold:0};
        await DB.collection(MC.COL).add(doc); m.shopName=shop; save(); sfx("coin");
        g.clearRect(0,0,CV.W,CV.H); strokes=0; active=0; lastAct=0; live();
        dlg(`<h3>🎉 ${T("出品しました！","Listed!")}</h3><p>${T("アーム専門店にならびました。売れたら、次に魔物キャッチャーを開いたときにコインが入ります。","It's now in the Arm Shop. Coins arrive the next time you open Monster Catcher after a sale.")}</p>`,[[T("続けて描く","Draw another"),null],[T("お店を見る","See the shop"),()=>openShop()]]);
      }catch(e){ dlg(`<p>${T("出品できませんでした","Couldn't list")} ${esc(e&&e.code||"")}</p>`); } })(); }]]);
    const pc=document.getElementById("mcPubC"); if(pc){ const tmp={id:"__pv"+Date.now(), img:exportArm(cv,A)}; drawArm(pc,tmp,320); } }; }
async function openStats(){ const box=page(`📊 ${T("過去の作品と売れた数","My arms & sales")}`); box.innerHTML=`<p class="mc-note">${T("読みこみ中…","Loading...")}</p>`;
  let L=[]; try{ const q=await DB.collection(MC.COL).where("uid","==",MYID).get(); L=q.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>(b.at||0)-(a.at||0)); }catch(e){ box.innerHTML=`<p class="mc-note">${T("読みこめませんでした","Couldn't load")}</p>`; return; }
  if(!document.getElementById("mco")) return; await checkSales();
  const tot=L.reduce((a,x)=>a+(x.sold||0),0), live=L.filter(x=>(x.at||0)+MC.LIST_MS>now()).length;
  box.innerHTML=`<div class="mc-sum"><div>${T("作品","Arms")}<b>${L.length}</b></div><div>${T("売れた数","Sold")}<b>${tot}</b></div><div>${T("収入","Earned")}<b>${fmt(tot*MC.SALE)}</b></div></div><p class="mc-note">${T(`出品中 ${live}本`,`${live} on sale now`)}</p>
    <div class="mc-grid">${L.map((a,i)=>{ const on=(a.at||0)+MC.LIST_MS>now(); return `<div class="mc-card"><canvas></canvas><b>${esc(a.shop||"")}</b><span class="s">${stars(a.str)}</span><span class="t">${on?T(`出品中・のこり${Math.ceil((a.at+MC.LIST_MS-now())/3600e3)}時間`,`On sale · ${Math.ceil((a.at+MC.LIST_MS-now())/3600e3)}h left`):T("出品おわり","Ended")}</span><span>${T(`売れた数 <b>${a.sold||0}本</b>`,`Sold <b>${a.sold||0}</b>`)}<br>${T(`収入 ${fmt((a.sold||0)*MC.SALE)}コイン`,`Earned ${fmt((a.sold||0)*MC.SALE)}`)}</span></div>`; }).join("")||`<p class="mc-note">${T("まだ出品した作品はありません","You haven't listed any arms yet")}</p>`}</div>`;
  box.querySelectorAll(".mc-card canvas").forEach((c,i)=>drawArm(c, L[i], 240)); }

})();
