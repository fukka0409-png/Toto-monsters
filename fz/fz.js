/* 融合依頼（2026-10-26・運営＝ふっかーだけ）
   「魔物オリジナル融合」で送信された依頼の一覧。融合した魔物の絵を当てはめて（白い背景は自動で透明に）、
   依頼した冒険者に送ると、その冒険者のBOXに限定ランクとして届き「融合に成功しました！」と出る
   データ：fusereq（依頼）・fusemon/{番号}（できた魔物の絵と名前）・items（item:"fmon" で届ける） */
(()=>{
let V=null, REQ=[], DONE={}, PIC={};   // PIC[依頼ID] = 当てはめた絵（透明にしたPNG）
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
.fz-zoom{position:fixed;inset:0;z-index:240;background:#000c;display:grid;place-items:center;padding:20px}
.fz-zoom img{width:min(86vw,420px);height:auto;image-rendering:pixelated;background:#fff3;border-radius:12px}
.ttl-mini.ttl-fz[hidden]{display:none}
`;
document.head.appendChild(css);

const isOp=()=>{ try{ return dexPeek(); }catch(e){ return false; } };
function zoom(src){ const z=document.createElement("div"); z.className="fz-zoom"; z.innerHTML=`<img src="${src}" alt="">`; z.onclick=()=>z.remove(); document.body.appendChild(z); }

// 写真の白い背景を自動で透明にして、魔物だけを切り抜き、256×256にする
function cutout(file){ return new Promise((ok,ng)=>{ const fr=new FileReader(); fr.onerror=ng; fr.onload=()=>{ const im=new Image(); im.onerror=ng; im.onload=()=>{
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
  ok(o.toDataURL("image/png")); }; im.src=fr.result; }; fr.readAsDataURL(file); }); }

async function load(){ if(!DB) return;
  try{ const q=await withTO(DB.collection("fusereq").orderBy("at","desc").limit(100).get()); REQ=q.docs.map(d=>({id:d.id,...d.data()})); }catch(e){ REQ=[]; }
  try{ const q=await withTO(DB.collection("fusemon").get()); DONE={}; q.docs.forEach(d=>{ const x=d.data(); if(x&&x.req) DONE[x.req]=x; if(x&&x.id&&x.img) FMON_CACHE[x.id]={name:x.name,img:x.img}; }); }catch(e){}
  draw(); }
function draw(){ if(!V) return; const left=REQ.filter(r=>!DONE[r.id]).length;
  V.querySelector(".fz-n").textContent=`依頼数 ${REQ.length}（未対応 ${left}）`;
  const B=V.querySelector(".fz-body");
  if(!REQ.length){ B.innerHTML=`<div class="fz-row" style="justify-content:center">まだ依頼はありません</div>`; return; }
  B.innerHTML=REQ.map(r=>{ const d=DONE[r.id], A=mon(r.a), Bm=mon(r.b), pic=d?d.img:PIC[r.id];
    return `<div class="fz-row ${d?"done":""}" data-r="${r.id}">
      <div class="fz-who"><b>${esc(r.nm||"冒険者")}</b><span>魔物融合</span><small>${new Date(r.at).toLocaleString("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}</small></div>
      <button class="fz-c" type="button" data-z="${A?cardURL(A.id,0,320):""}"><img src="${A?cardURL(A.id,0,120):""}" alt=""></button><span class="fz-plus">＋</span>
      <button class="fz-c" type="button" data-z="${Bm?cardURL(Bm.id,0,320):""}"><img src="${Bm?cardURL(Bm.id,0,120):""}" alt=""></button>
      <button class="fz-pic" type="button" data-pic="${r.id}" ${d?"disabled":""}>${pic?`<img src="${pic}" alt="">`:"絵を<br>えらぶ"}</button>
      <button class="fz-send" type="button" data-send="${r.id}" ${d||!PIC[r.id]?"disabled":""}>${d?"送信<br>ずみ":"📨<br>送る"}</button></div>`; }).join("");
  B.querySelectorAll("[data-z]").forEach(b=>b.onclick=()=>{ if(b.dataset.z) zoom(b.dataset.z); });
  B.querySelectorAll("[data-pic]").forEach(b=>b.onclick=()=>{ const id=b.dataset.pic; const inp=document.createElement("input"); inp.type="file"; inp.accept="image/*";
    inp.onchange=async()=>{ const f=inp.files&&inp.files[0]; if(!f) return; try{ PIC[id]=await cutout(f); draw(); }catch(e){ toast("絵を読みこめませんでした"); } }; inp.click(); });
  B.querySelectorAll("[data-send]").forEach(b=>b.onclick=()=>send(REQ.find(r=>r.id===b.dataset.send)));
}
function send(r){ if(!r||!PIC[r.id]) return; const def=`${r.an||"？"}×${r.bn||"？"}`.slice(0,24);
  const bg=document.createElement("div"); bg.className="sheet-bg center"; bg.style.zIndex=235;
  bg.innerHTML=`<div class="swear" role="dialog" aria-modal="true"><img src="${PIC[r.id]}" alt="" style="width:140px;height:140px;margin:0 auto;image-rendering:pixelated;background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0 0/14px 14px;border-radius:10px">
    <p>${esc(r.nm)}さんに送る</p><div class="note" style="margin:0">融合した魔物の名前（あとから変えられません）</div>
    <input id="fzNm" type="text" maxlength="24" value="${esc(def)}" style="width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:2px solid #3a2306;font:900 15px var(--f-body)">
    <button class="btn gold" type="button" id="fzGo">📨 限定ランクで送る</button><button class="btn ghost" type="button" id="fzNo">やめる</button></div>`;
  document.body.appendChild(bg); bg.querySelector("#fzNo").onclick=()=>bg.remove();
  bg.querySelector("#fzGo").onclick=async e=>{ const nm=bg.querySelector("#fzNm").value.trim().slice(0,24); if(!nm) return toast("名前を入れてね");
    const btn=e.currentTarget; btn.disabled=true; btn.textContent="送信中…";
    const id=Math.floor(gnow()/1000);   // 融合魔物の番号（作った時刻から）
    try{ await withTO(DB.collection("fusemon").doc(String(id)).set({id, name:nm, img:PIC[r.id], uid:r.uid, req:r.id, reqAt:r.at, an:r.an||"", bn:r.bn||"", at:gnow()}));
      await withTO(DB.collection("items").add({att:MYID, def:r.uid, attP:S.plv, item:"fmon", fid:id, qty:1, coins:0, at:gnow()}));
      DONE[r.id]={img:PIC[r.id],id,name:nm}; FMON_CACHE[id]={name:nm,img:PIC[r.id]}; delete PIC[r.id]; bg.remove(); draw(); try{ SFX.coin(); }catch(e){} toast(`${r.nm}さんに「${nm}」を送りました！`); }
    catch(err){ btn.disabled=false; btn.textContent="📨 限定ランクで送る"; toast("送れませんでした。もう一度ためしてね"); } }; }
function close(){ if(V){ V.remove(); V=null; } }
function open(){ if(!isOp()) return; if(!DB||!MYID) return toast("ログインしてね"); close();
  V=document.createElement("div"); V.id="fzo"; V.setAttribute("role","dialog"); V.setAttribute("aria-label","融合依頼");
  V.innerHTML=`<div class="fz-top"><button class="fz-b" type="button">← タイトル画面に戻る</button><span class="fz-n">依頼数 …</span></div><div class="fz-body"><div class="fz-row" style="justify-content:center">読み込み中…</div></div>`;
  document.body.appendChild(V); V.querySelector(".fz-b").onclick=close; load(); }

// タイトルのボタン（ふっかーだけ）と、未対応の数
async function count(){ const n=document.getElementById("ttlFzN"); if(!n||!DB) return;
  try{ const [a,b]=await Promise.all([DB.collection("fusereq").get(),DB.collection("fusemon").get()]); const done=new Set(b.docs.map(d=>d.data().req)); const left=a.docs.filter(d=>!done.has(d.id)).length; n.textContent=left?`未対応 ${left}件`:""; }catch(e){} }
// みんな：融合でできた魔物の絵を読みこんでおく（ほかの冒険者のプロフィールに出ても表示できるように）
async function cache(){ if(!DB) return; try{ const q=await DB.collection("fusemon").get(); q.docs.forEach(d=>{ const x=d.data(); if(x&&x.id&&x.img) FMON_CACHE[x.id]={name:x.name,img:x.img}; }); }catch(e){} }
let was=null;
setInterval(()=>{ const b=document.getElementById("ttlFz"); if(!b) return; const on=!!(DB&&MYID); const op=on&&isOp(); b.hidden=!op;
  if(on!==was){ was=on; if(on){ cache(); if(op) count(); } } }, 1000);
document.addEventListener("click",e=>{ if(e.target.closest("#ttlFz")){ try{ SFX.tap(); }catch(x){} open(); } });
window.openFuseReq=open;
})();
