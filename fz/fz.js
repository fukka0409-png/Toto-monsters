/* 融合依頼（2026-10-26・運営＝ふっかーだけ）
   「魔物オリジナル融合」で送信された依頼の一覧。融合した魔物の絵を当てはめて（白い背景は自動で透明に）、
   依頼した冒険者に送ると、その冒険者のBOXに限定ランクとして届き「融合に成功しました！」と出る
   データ：fusereq（依頼）・fusemon/{番号}（できた魔物の絵と名前）・items（item:"fmon" で届ける） */
(()=>{
let V=null, REQ=[], DONE={}, PIC={};
// チーターの疑いで初期化した冒険者の依頼は一覧に出さない（2026-10-27）
const crSkip=nm=>{ try{ return typeof CHEAT_RESET!=="undefined" && CHEAT_RESET.some(c=>normName(c.name)===normName(nm)); }catch(e){ return false; } };   // PIC[依頼ID] = 当てはめた絵（透明にしたPNG）
const css=document.createElement("style");
css.textContent=`
#fzo{position:fixed;inset:0;z-index:210;background:#f4ead2;display:flex;flex-direction:column;font-family:var(--f-body,sans-serif);color:#3a2306}
#fzo .fz-top{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:calc(env(safe-area-inset-top,0px) + 10px) 12px 10px;background:linear-gradient(#5aa7e6,#9fd6ff);border-bottom:4px solid #3a2306}
#fzo .fz-b{padding:8px 12px;border-radius:10px;background:#fff8e6;border:3px solid #3a2306;box-shadow:0 3px 0 #3a2306;font:900 13px var(--f-body);color:#3a2306}
#fzo .fz-n{padding:8px 12px;border-radius:10px;background:#fffaf0;border:3px solid #3a2306;font:900 13px var(--f-body)}
#fzo .fz-body{flex:1;overflow-y:auto;padding:12px 10px calc(16px + env(safe-area-inset-bottom,0px))}
#fzo .fz-row{display:flex;align-items:center;gap:6px;margin:0 auto 10px;max-width:640px;padding:8px;background:#fffaf0;border:3px solid #3a2306;box-shadow:0 3px 0 #3a2306;border-radius:6px}
#fzo .fz-row.done{opacity:.55}
#fzo .fz-who{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
#fzo .fz-who b{font-size:12px;line-height:1.25;padding:3px 6px;background:#efe2c4;border:2px solid #3a2306;border-radius:4px;word-break:break-all}
#fzo .fz-who span{font-size:11px;font-weight:900;padding:3px 6px;border:2px solid #3a2306;border-radius:999px;text-align:center;background:#ffe58a}
#fzo .fz-who small{font-size:10px;opacity:.7}
#fzo .fz-c{flex:none;width:52px;height:52px;border:3px solid #3a2306;border-radius:6px;overflow:hidden;background:#efe2c4;padding:0;cursor:zoom-in}
#fzo .fz-c img{width:100%;height:100%;object-fit:cover;image-rendering:pixelated;display:block}
#fzo .fz-plus{font:900 18px var(--f-body)}
#fzo .fz-pic{flex:none;width:56px;height:56px;border:3px dashed #b5651d;border-radius:6px;background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0 0/12px 12px;display:grid;place-items:center;font:900 10px/1.2 var(--f-body);color:#b5651d;text-align:center;padding:0;overflow:hidden}
#fzo .fz-pic img{width:100%;height:100%;object-fit:contain;image-rendering:pixelated}
#fzo .fz-send{flex:none;width:52px;height:52px;border-radius:8px;border:3px solid #5a3a06;background:#e3a321;font:900 11px/1.15 var(--f-body);color:#3a2306;box-shadow:0 3px 0 #5a3a06;padding:0}
#fzo .fz-send:disabled{opacity:.35}
#fzo .fz-prev{display:flex;align-items:center;gap:8px;max-width:640px;margin:-6px auto 12px;padding:6px 8px;background:#fff2c4;border:2px dashed #b5651d;border-radius:6px;font-size:11.5px}
#fzo .fz-prev img{width:40px;height:40px;object-fit:contain;image-rendering:pixelated;flex:none}
#fzo .fz-prev span{flex:1;min-width:0}
#fzo .fz-prev button{flex:none;padding:8px 10px;border-radius:8px;border:3px solid #5a3a06;background:#e3a321;font:900 12px var(--f-body);color:#3a2306;box-shadow:0 2px 0 #5a3a06}
.fz-zoom{position:fixed;inset:0;z-index:240;background:#000c;display:grid;place-items:center;padding:20px}
.fz-zoom img{width:min(86vw,420px);height:auto;image-rendering:pixelated;background:#fff3;border-radius:12px}
.ttl-mini.ttl-fz[hidden]{display:none}
`;
document.head.appendChild(css);

const isOp=()=>{ try{ return dexPeek(); }catch(e){ return false; } };
function zoom(src){ const z=document.createElement("div"); z.className="fz-zoom"; z.innerHTML=`<img src="${src}" alt="">`; z.onclick=()=>z.remove(); document.body.appendChild(z); }

// 写真の白い背景を自動で透明にして、魔物だけを切り抜き、256×256にする
function cutout(file){ return new Promise((ok,ng)=>{ const url=URL.createObjectURL(file); const fr={}; fr.onload=()=>{ const im=new Image(); im.onerror=()=>{ URL.revokeObjectURL(url); ng(); }; im.onload=()=>{ URL.revokeObjectURL(url);
  const mx=900, k=Math.min(1,mx/Math.max(im.width,im.height)), W=Math.max(1,Math.round(im.width*k)), H=Math.max(1,Math.round(im.height*k));
  const cv=document.createElement("canvas"); cv.width=W; cv.height=H; const g=cv.getContext("2d"); g.drawImage(im,0,0,W,H);
  const d=g.getImageData(0,0,W,H), p=d.data, bg=new Uint8Array(W*H), st=[];
  const light=i=>{ const r=p[i*4],gg=p[i*4+1],b=p[i*4+2],a=p[i*4+3]; return a<20 || (Math.min(r,gg,b)>228 && Math.max(r,gg,b)-Math.min(r,gg,b)<28); };
  for(let x=0;x<W;x++){ st.push(x, (H-1)*W+x); } for(let y=0;y<H;y++){ st.push(y*W, y*W+W-1); }
  while(st.length){ const i=st.pop(); if(bg[i]||!light(i)) continue; bg[i]=1; const x=i%W, y=(i/W)|0;
    if(x>0) st.push(i-1); if(x<W-1) st.push(i+1); if(y>0) st.push(i-W); if(y<H-1) st.push(i+W); }
  let x0=W,y0=H,x1=-1,y1=-1;
  for(let i=0;i<W*H;i++){ if(bg[i]){ p[i*4+3]=0; continue; } const x=i%W,y=(i/W)|0; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
  g.putImageData(d,0,0); if(x1<0){ x0=0;y0=0;x1=W-1;y1=H-1; }
  const w=x1-x0+1, h=y1-y0+1, s=Math.round(Math.max(w,h)*1.06), o=document.createElement("canvas"); o.width=o.height=256; const og=o.getContext("2d");
  og.imageSmoothingEnabled=true; const sc=256/s; og.drawImage(cv,x0,y0,w,h,(256-w*sc)/2,(256-h*sc)/2,w*sc,h*sc);
  ok(o.toDataURL("image/png")); }; im.src=url; }; fr.onload(); }); }

async function load(){ if(!DB) return;
  try{ const q=await withTO(DB.collection("fusereq").orderBy("at","desc").limit(100).get()); REQ=q.docs.map(d=>({id:d.id,...d.data()})).filter(r=>!crSkip(r.nm)); }catch(e){ REQ=[]; }
  try{ const q=await withTO(DB.collection("fusemon").get()); DONE={}; q.docs.forEach(d=>{ const x=d.data(); if(x&&x.req) DONE[x.req]=x; if(x&&x.id&&x.img) FMON_CACHE[x.id]=Object.assign(FMON_CACHE[x.id]||{},{name:x.name,img:x.img,rk:x.rk||"F"},x.a!=null?{a:x.a,b:x.b}:{},x.an?{an:x.an,bn:x.bn}:{},!x.same?{req:x.req,fn:x.fn,fat:x.at}:{}); }); }catch(e){}
  draw(); }
// 同じ組み合わせ（2匹の順番は問わない）で前に作った魔物をさがす
const pairKey=r=>[r.a,r.b].sort((x,y)=>x-y).join("+");
function prevOf(r){ for(const q of REQ){ if(q.id===r.id) continue; const d=DONE[q.id]; if(d&&d.id&&pairKey(q)===pairKey(r)) return d; } return null; }
function draw(){ if(!V) return; const left=REQ.filter(r=>!DONE[r.id]).length;
  V.querySelector(".fz-n").textContent=`依頼数 ${left}（完了 ${REQ.length-left}）`;
  const B=V.querySelector(".fz-body");
  const OPEN=REQ.filter(r=>!DONE[r.id]);   // 融合が完了した依頼は一覧から消す
  if(!OPEN.length){ B.innerHTML=`<div class="fz-row" style="justify-content:center">${REQ.length?"未対応の依頼はありません ✨":"まだ依頼はありません"}</div>`; return; }
  B.innerHTML=OPEN.map(r=>{ const d=DONE[r.id], A=mon(r.a), Bm=mon(r.b), pic=d?(d.img||(FMON_CACHE[d.id]||{}).img):PIC[r.id], pv=!d&&prevOf(r);
    return `<div class="fz-row ${d?"done":""}" data-r="${r.id}">
      <div class="fz-who"><b>${esc(r.nm||"冒険者")}</b><span>魔物融合</span><small>${new Date(r.at).toLocaleString("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}</small></div>
      <button class="fz-c" type="button" data-z="${A?cardURL(A.id,0,320):""}"><img src="${A?cardURL(A.id,0,120):""}" alt=""></button><span class="fz-plus">＋</span>
      <button class="fz-c" type="button" data-z="${Bm?cardURL(Bm.id,0,320):""}"><img src="${Bm?cardURL(Bm.id,0,120):""}" alt=""></button>
      <button class="fz-pic" type="button" data-pic="${r.id}" ${d?"disabled":""}>${pic?`<img src="${pic}" alt="">`:"絵を<br>えらぶ"}</button>
      <button class="fz-send" type="button" data-send="${r.id}" ${d||!PIC[r.id]?"disabled":""}>${d?"送信<br>ずみ":"📨<br>送る"}</button></div>
      ${pv?`<div class="fz-prev"><img src="${pv.img||(FMON_CACHE[pv.id]||{}).img||""}" alt=""><span>この組み合わせは前に作った魔物があります：<b>${esc(pv.name||"")}</b></span><button type="button" data-same="${r.id}">同じ魔物を送る</button></div>`:""}`; }).join("");
  B.querySelectorAll("[data-z]").forEach(b=>b.onclick=()=>{ if(b.dataset.z) zoom(b.dataset.z); });
  // iPhoneでは、画面につないでいない<input>は写真をえらんだあとに消えてしまうことがあるので、画面の中に置いておく
  B.querySelectorAll("[data-pic]").forEach(b=>b.onclick=()=>{ const id=b.dataset.pic; let inp=document.getElementById("fzFile");
    if(!inp){ inp=document.createElement("input"); inp.type="file"; inp.id="fzFile"; inp.accept="image/*"; inp.style.cssText="position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0"; document.body.appendChild(inp); }
    inp.value=""; inp.onchange=async()=>{ const f=inp.files&&inp.files[0]; if(!f) return; toast("絵を読みこんでいます…");
      try{ PIC[id]=await cutout(f); draw(); toast("白い背景を透明にしました"); }catch(e){ toast("絵を読みこめませんでした（PNGかJPEGの写真をえらんでね）"); } };
    inp.click(); });
  B.querySelectorAll("[data-send]").forEach(b=>b.onclick=()=>send(REQ.find(r=>r.id===b.dataset.send)));
  B.querySelectorAll("[data-same]").forEach(b=>b.onclick=()=>sendSame(REQ.find(r=>r.id===b.dataset.same), b));
}
function send(r){ if(!r||!PIC[r.id]) return; const def=`${r.an||"？"}×${r.bn||"？"}`.slice(0,24);
  const bg=document.createElement("div"); bg.className="sheet-bg center"; bg.style.zIndex=235;
  bg.innerHTML=`<div class="swear" role="dialog" aria-modal="true"><img src="${PIC[r.id]}" alt="" style="width:140px;height:140px;margin:0 auto;image-rendering:pixelated;background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0 0/14px 14px;border-radius:10px">
    <p>${esc(r.nm)}さんに送る</p><div class="note" style="margin:0">融合した魔物の名前（あとから変えられません）</div>
    <input id="fzNm" type="text" maxlength="24" value="${esc(def)}" style="width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:2px solid #3a2306;font:900 15px var(--f-body)">
    <div class="note" id="fzDup" style="margin:0;color:#ff7a6a;min-height:1.2em"></div>
    <button class="btn gold" type="button" id="fzGo">📨 ${rkName(fuseRank(r.a,r.b))}ランクで送る</button><button class="btn ghost" type="button" id="fzNo">やめる</button></div>`;
  document.body.appendChild(bg); bg.querySelector("#fzNo").onclick=()=>bg.remove();
  // 名前がほかの魔物（図鑑の魔物・ほかの融合魔物）とかぶっていたら、送れないようにする
  const nk=v=>String(v||"").normalize("NFKC").replace(/\s+/g,"").toLowerCase();
  const taken=()=>{ const v=nk(bg.querySelector("#fzNm").value); if(!v) return "名前を入れてね";
    const hit=MONSTERS.find(m=>nk(m.name)===v)||Object.values(FMON_CACHE).find(x=>nk(x.name)===v); return hit?`「${hit.name}」はもういる魔物の名前です。別の名前にしてね`:""; };
  const chk=()=>{ const w=taken(); bg.querySelector("#fzDup").textContent=w; bg.querySelector("#fzGo").disabled=!!w; return !w; };
  bg.querySelector("#fzNm").addEventListener("input",chk); chk();
  bg.querySelector("#fzGo").onclick=async e=>{ const nm=bg.querySelector("#fzNm").value.trim().slice(0,24); if(!nm) return toast("名前を入れてね"); if(!chk()) return;
    const btn=e.currentTarget; btn.disabled=true; btn.textContent="送信中…";
    const id=Math.floor(gnow()/1000);   // 融合魔物の番号（作った時刻から）
    try{ await withTO(DB.collection("fusemon").doc(String(id)).set({id, name:nm, img:PIC[r.id], rk:fuseRank(r.a,r.b), fn:String(r.nm||"").slice(0,24), uid:r.uid, req:r.id, reqAt:r.at, a:r.a, b:r.b, an:r.an||"", bn:r.bn||"", at:gnow()}));
      await withTO(DB.collection("items").add({att:MYID, def:r.uid, attP:S.plv, item:"fmon", fid:id, qty:1, coins:0, at:gnow()}));
      DONE[r.id]={img:PIC[r.id],id,name:nm,rk:fuseRank(r.a,r.b)}; FMON_CACHE[id]={name:nm,img:PIC[r.id],rk:fuseRank(r.a,r.b)}; delete PIC[r.id]; bg.remove(); draw(); try{ SFX.coin(); }catch(e){} toast(`${r.nm}さんに「${nm}」を送りました！`); }
    catch(err){ btn.disabled=false; btn.textContent=`📨 ${rkName(fuseRank(r.a,r.b))}ランクで送る`; toast("送れませんでした。もう一度ためしてね"); } }; }
// 同じ組み合わせ：前に作った魔物（同じ番号）をそのまま送る
async function sendSame(r,btn){ const pv=r&&prevOf(r); if(!pv) return; const img=pv.img||(FMON_CACHE[pv.id]||{}).img; if(!img) return toast("前の魔物の絵が読みこめませんでした");
  btn.disabled=true; btn.textContent="送信中…";
  try{ await withTO(DB.collection("fusemon").doc(pv.id+"_"+r.id).set({id:pv.id, name:pv.name, img, rk:pv.rk||fuseRank(r.a,r.b), uid:r.uid, req:r.id, reqAt:r.at, a:r.a, b:r.b, an:r.an||"", bn:r.bn||"", same:1, at:gnow()}));
    await withTO(DB.collection("items").add({att:MYID, def:r.uid, attP:S.plv, item:"fmon", fid:pv.id, qty:1, coins:0, at:gnow()}));
    DONE[r.id]={id:pv.id,name:pv.name,img}; draw(); try{ SFX.coin(); }catch(e){} toast(`${r.nm}さんに「${pv.name}」を送りました！`); }
  catch(e){ btn.disabled=false; btn.textContent="同じ魔物を送る"; toast("送れませんでした。もう一度ためしてね"); } }
function close(){ if(V){ V.remove(); V=null; } count(); }
function open(){ if(!isOp()) return; if(!DB||!MYID) return toast("ログインしてね"); close();
  V=document.createElement("div"); V.id="fzo"; V.setAttribute("role","dialog"); V.setAttribute("aria-label","融合依頼");
  V.innerHTML=`<div class="fz-top"><button class="fz-b" type="button">← タイトル画面に戻る</button><span class="fz-n">依頼数 …</span></div><div class="fz-body"><div class="fz-row" style="justify-content:center">読み込み中…</div></div>`;
  document.body.appendChild(V); V.querySelector(".fz-b").onclick=close; load(); }

// タイトルのボタン（ふっかーだけ）と、未対応の数
async function count(){ const n=document.getElementById("ttlFzN"); if(!n||!DB) return;
  try{ const [a,b]=await Promise.all([DB.collection("fusereq").get(),DB.collection("fusemon").get()]); const done=new Set(b.docs.map(d=>d.data().req)); const left=a.docs.filter(d=>!done.has(d.id)&&!crSkip(d.data().nm)).length; n.textContent=left?`依頼 ${left}件`:"";
    const bd=document.getElementById("ttlFzB"); if(bd){ bd.textContent=left>99?"99+":String(left); bd.hidden=!left; } }catch(e){} }
// みんな：融合でできた魔物の絵を読みこんでおく（ほかの冒険者のプロフィールに出ても表示できるように）
async function cache(){ if(!DB) return; try{ const q=await DB.collection("fusemon").get(); q.docs.forEach(d=>{ const x=d.data(); if(x&&x.id&&x.img) FMON_CACHE[x.id]=Object.assign(FMON_CACHE[x.id]||{},{name:x.name,img:x.img,rk:x.rk||"F"},x.a!=null?{a:x.a,b:x.b}:{},x.an?{an:x.an,bn:x.bn}:{},!x.same?{req:x.req,fn:x.fn,fat:x.at}:{}); }); }catch(e){} }
let was=null;
setInterval(()=>{ const b=document.getElementById("ttlFz"); if(!b) return; const on=!!(DB&&MYID); const op=on&&isOp(); b.hidden=!op;
  if(on!==was){ was=on; if(on){ cache(); if(op) count(); } } }, 1000);
setInterval(()=>{ const b=document.getElementById("ttlFz"); if(b&&!b.hidden&&document.querySelector("#title:not([hidden])")) count(); }, 30000);   // タイトル画面を開いているあいだ、依頼の件数を30秒ごとに更新
document.addEventListener("click",e=>{ if(e.target.closest("#ttlFz")){ try{ SFX.tap(); }catch(x){} open(); } });
window.openFuseReq=open;
})();
