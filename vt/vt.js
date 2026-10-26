/* 魔物投票（2026-10-26・試作：冒険者「ふっかー」だけに表示）
   ・5人までが自分のBOXの魔物をエントリー。5人そろった瞬間に24時間の投票が始まる
   ・投票は1人1回（自分のエントリーには投票できない）。投票すると1000コイン
   ・自分でエントリーすると1モコ（エントリー予約チケットを使ったときはモコなし）
   ・エントリーしたら次の回は休み（48時間に1回のイメージ）
   ・投票中にエントリー予約チケットを使うと、次の回のエントリー枠に先に入れる
   ・24時間後、投票数がいちばん多い冒険者（同数なら全員）にごほうび
   データ：vstate/cur（今の回）・vvotes/{回}_{uid}（投票・1人1つ）・vres/{回}（結果） */
(()=>{
const VT = { N:5, MS:24*3600e3, VOTE_COIN:1000, ENTRY_MOKO:1, WIN:{coins:10000, moko:3} };
const now = () => (typeof gnow==="function" ? gnow() : Date.now());
const ref = () => DB.collection("vstate").doc("cur");
const blank = r => ({ r:r||1, e:[], st:0, c:[0,0,0,0,0], q:[], pe:[] });
const VT_USERS = ["ふっかー","🐴"];   // 試作を見せる冒険者（2026-10-26：🐴さんにも公開）
const vtNm = t => normName(t).replace(/[\uFE0E\uFE0F\u200D]/g,"");   // 絵文字の見えない文字（異体字セレクタなど）は無視して比べる
const vtOn = () => true;   // 2026-10-26：全員に公開。ボタンはすぐ出す（押したときにログインを確かめる）
const vtk = () => (S.items||{}).vtk||0;   // エントリー予約チケット
const isVoting = d => d && d.st>0 && d.e.length>=VT.N && now()<d.st+VT.MS;
const isOver = d => d && d.st>0 && now()>=d.st+VT.MS;
const mmss = ms => { const t=Math.max(0,Math.ceil(ms/1000)), h=Math.floor(t/3600), m=Math.floor(t%3600/60), s=t%60; return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; };
let V=null, CUR=null, unsub=null, tick=0;

/* ---------- 回の終わり：結果を残して、次の回へ（だれが開いてもOK・トランザクション） ---------- */
async function settle(){ if(!DB) return;
  try{ await DB.runTransaction(async tx=>{ const sn=await tx.get(ref()); const d=sn.exists?sn.data():null; if(!d||!isOver(d)) return;
    const max=Math.max(0,...d.c), win=max>0?d.c.map((v,i)=>v===max?i:-1).filter(i=>i>=0):[];
    tx.set(DB.collection("vres").doc(String(d.r)), { r:d.r, e:d.e, c:d.c, win, end:d.st+VT.MS });
    const nx=blank(d.r+1); nx.pe=d.e.map(x=>x.uid); nx.e=(d.q||[]).slice(0,VT.N).map(x=>({...x, res:1})); nx.q=(d.q||[]).slice(VT.N);
    if(nx.e.length>=VT.N) nx.st=d.st+VT.MS;   // 予約で5人そろっていたら、すぐ次の投票
    tx.set(ref(), nx); }); }catch(e){} }

/* ---------- 自分が1位になった回のごほうび（ログイン時・画面を開いたとき） ---------- */
async function checkWins(){ if(!DB||!MYID) return;
  try{ const q=await DB.collection("vres").where("r",">",S.vtSeen||0).get(); const L=q.docs.map(x=>x.data()).sort((a,b)=>a.r-b.r); if(!L.length) return;
    for(const x of L){ S.vtSeen=Math.max(S.vtSeen||0,x.r); const i=(x.e||[]).findIndex(z=>z.uid===MYID); if(i<0||!(x.win||[]).includes(i)) continue;
      const m=mon(x.e[i].m); presentAdd({ic:"🗳", title:`魔物投票で1位！（${m?m.name:"魔物"}・${x.c[i]}票）`, en:"1st place in the Monster Vote!", coins:VT.WIN.coins, moko:VT.WIN.moko}); }
    save(); }catch(e){} }

/* ---------- 画面 ---------- */
const css=document.createElement("style");
css.textContent=`
#vto{position:fixed;inset:0;z-index:210;background:#f4ead2 url() ;display:flex;flex-direction:column;font-family:var(--f-body,sans-serif);color:#3a2306;overflow:hidden}
#vto .vt-sky{position:relative;flex:none;height:calc(140px + env(safe-area-inset-top,0px));background:linear-gradient(#5aa7e6,#9fd6ff);overflow:hidden}
#vto .vt-sky::before{content:"";position:absolute;left:0;right:0;bottom:0;height:22px;background:linear-gradient(#5ec44a 0 9px,#3f8f2f 9px 12px,#b98a5f 12px)}
#vto .vt-cloud{position:absolute;background:#fff;box-shadow:12px 0 #fff,24px 0 #fff,6px -10px #fff,18px -10px #fff;width:12px;height:10px;opacity:.95}
#vto .vt-title{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);padding:8px 26px;background:#fbefd2;border:4px solid #3a2306;box-shadow:0 4px 0 #3a2306,inset 0 0 0 3px #e7c98f;font:900 30px/1.1 var(--f-pix,var(--f-body));letter-spacing:.12em;white-space:nowrap}
#vto .vt-x{position:absolute;left:10px;top:calc(env(safe-area-inset-top,0px) + 10px);z-index:2;padding:8px 14px;border-radius:12px;background:#fff8e6;border:3px solid #3a2306;box-shadow:0 3px 0 #3a2306;font:900 14px var(--f-body);color:#3a2306}
#vto .vt-body{flex:1;overflow-y:auto;padding:14px 14px calc(18px + env(safe-area-inset-bottom,0px));background:repeating-linear-gradient(0deg,#f4ead2 0 22px,#efe2c4 22px 23px)}
#vto .vt-panel{max-width:520px;margin:0 auto 12px;padding:12px 14px;background:#fffaf0;border:4px solid #3a2306;box-shadow:0 4px 0 #3a2306;border-radius:6px;text-align:center}
#vto .vt-time{display:flex;justify-content:space-between;align-items:center;gap:8px;font-weight:900;font-size:15px}
#vto .vt-time b{font:900 24px/1 var(--f-pix,monospace);letter-spacing:.06em}
#vto .vt-lead{margin:6px 0 0;font-weight:900;font-size:16px}
#vto .vt-note{margin:6px 0 0;font-size:12px;opacity:.85}
#vto .vt-rows{max-width:520px;margin:0 auto;display:flex;flex-direction:column;gap:10px}
#vto .vt-row{display:flex;align-items:center;gap:12px;padding:8px 10px;background:#fffaf0;border:3px solid #3a2306;box-shadow:0 3px 0 #3a2306;border-radius:6px}
#vto .vt-slot{flex:none;width:84px;height:84px;border:4px solid #3a2306;border-radius:6px;background:#efe2c4;display:grid;place-items:center;overflow:hidden;image-rendering:pixelated}
#vto .vt-slot img{width:100%;height:100%;object-fit:cover}
#vto .vt-slot.empty{display:flex;align-items:center;justify-content:center;color:#a08a63;font:900 34px/1 var(--f-body)}
#vto .vt-slot.empty span{display:block;line-height:1;transform:translateY(-.08em)}
#vto .vt-info{flex:1;min-width:0;text-align:left}
#vto .vt-info b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#vto .vt-info small{display:block;font-size:11.5px;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#vto .vt-cnt{font:900 18px var(--f-pix,monospace);color:#b5651d}
#vto .vt-b{flex:none;min-width:110px;padding:11px 12px;border-radius:8px;border:3px solid #1d2733;background:#4a5b74;color:#fff;font:900 15px var(--f-body);box-shadow:0 3px 0 #1d2733,inset 0 2px 0 #7f93b3}
#vto .vt-b.gold{background:#e3a321;border-color:#5a3a06;box-shadow:0 3px 0 #5a3a06,inset 0 2px 0 #ffd77a;color:#3a2306}
#vto .vt-b:disabled{opacity:.45}
#vto .vt-b:active:not(:disabled){transform:translateY(2px);box-shadow:none}
#vto .vt-rank{display:inline-block;margin-right:4px;padding:1px 7px;border-radius:999px;background:#e3a321;color:#3a2306;font-size:11px;font-weight:900}
#vto .vt-tk{max-width:520px;margin:12px auto 0}
.vt-pick{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px;max-height:60vh;overflow-y:auto}
.vt-pick button{border:3px solid #3a2306;border-radius:8px;background:#fffaf0;padding:4px;font:900 11px var(--f-body);color:#3a2306}
.vt-pick button:disabled{opacity:.4}
.vt-pick img{width:100%;aspect-ratio:1;object-fit:cover;image-rendering:pixelated;display:block}
.ttl-mini.ttl-vote{top:1045px}
.ttl-vote-tip{position:absolute;left:343px;top:1192px;width:360px;box-sizing:border-box;padding:10px 12px;background:#fff;border:4px solid #3a1a08;border-radius:18px;font:900 26px/1.2 var(--f-body);color:#c0392b;text-align:center;box-shadow:0 4px 0 #3a1a08;animation:vtTip 1.6s ease-in-out infinite;pointer-events:none}
.ttl-vote-tip::before{content:"";position:absolute;left:50%;top:-26px;margin-left:-12px;border:12px solid transparent;border-bottom:14px solid #3a1a08}
.ttl-vote-tip[hidden]{display:none}
@keyframes vtTip{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
`;
document.head.appendChild(css);

function close(){ if(!V) return; clearInterval(tick); if(unsub) try{ unsub(); }catch(e){} unsub=null; V.remove(); V=null; }
function open(){
  if(!DB||!MYID) return toast("ログインすると魔物投票に参加できます");
  close();
  V=document.createElement("div"); V.id="vto"; V.setAttribute("role","dialog"); V.setAttribute("aria-label","魔物投票");
  V.innerHTML=`<div class="vt-sky"><i class="vt-cloud" style="left:8%;top:38%"></i><i class="vt-cloud" style="left:78%;top:28%"></i><i class="vt-cloud" style="left:58%;top:58%"></i>
    <button class="vt-x" type="button">← もどる</button><div class="vt-title">🗳 魔物投票</div></div><div class="vt-body" id="vtBody"><div class="vt-panel">読み込み中…</div></div>`;
  document.body.appendChild(V);
  V.querySelector(".vt-x").onclick=close;
  unsub=ref().onSnapshot(sn=>{ CUR=sn.exists?sn.data():null; if(CUR&&isOver(CUR)) settle(); draw(); }, ()=>{ draw(); });
  tick=setInterval(()=>{ const t=V&&V.querySelector("#vtTm"); if(t&&CUR&&CUR.st) t.textContent=mmss(CUR.st+VT.MS-now()); if(CUR&&isOver(CUR)){ settle(); } },1000);
  checkWins();
}
function draw(){ if(!V) return; const B=V.querySelector("#vtBody"); const d=CUR||blank(1);
  const voting=isVoting(d), mineIdx=d.e.findIndex(x=>x.uid===MYID), entrant=mineIdx>=0, voted=(S.vtVoted||{})[d.r];
  const rest=(d.pe||[]).includes(MYID), reserved=(d.q||[]).some(x=>x.uid===MYID);
  const showAll=voting&&voted!=null, top=[...d.c.map((v,i)=>[v,i])].sort((a,b)=>b[0]-a[0]).slice(0,3).map(x=>x[1]);
  const head=voting
    ? `<div class="vt-time"><span>投票結果まで残り</span><b id="vtTm">${mmss(d.st+VT.MS-now())}</b></div><p class="vt-lead">この中で1番好きな魔物に投票せよ！</p>
       <p class="vt-note">${voted!=null?"✅ 投票ずみ。みんなの投票数が見られます":entrant?"エントリーした冒険者は、1〜3位の投票数が見られます":"投票すると1000コイン！ 投票数は投票したあとに見られます"}</p>`
    : `<div class="vt-time"><span>エントリー募集中</span><b>${d.e.length}/${VT.N}</b></div><p class="vt-lead">BOXの魔物をエントリーしよう！</p>
       <p class="vt-note">5人そろった瞬間に24時間の投票がスタート。自分でエントリーすると1モコ！<br>1位の冒険者には ${VT.WIN.coins.toLocaleString()}コイン＋${VT.WIN.moko}モコ</p>`;
  const rows=[...Array(VT.N)].map((_,i)=>{ const x=d.e[i];
    if(!x) return `<div class="vt-row"><div class="vt-slot empty"><span>?</span></div><div class="vt-info"><b>あき枠</b><small>${rest?"前の回にエントリーしたので今回は休み":entrant?"あなたはエントリーずみ":"だれでもエントリーできます"}</small></div>
      <button class="vt-b gold" type="button" data-ent="${i}" ${entrant||rest||voting?"disabled":""}>エントリー</button></div>`;
    const m=mon(x.m), see=voting&&(showAll||(entrant&&top.includes(i))), me=x.uid===MYID;   // 票数は投票が始まってから
    return `<div class="vt-row"><div class="vt-slot"><img src="${m?cardURL(m.id,0,160):""}" alt=""></div>
      <div class="vt-info"><b>${showAll&&top[0]===i&&d.c[i]>0?'<span class="vt-rank">1位</span>':""}${esc(m?m.name:"？？？")}</b><small>${me?"あなたのエントリー":"エントリー"+(i+1)}${x.res?"（予約）":""}</small>
        ${see?`<span class="vt-cnt">${d.c[i]}票</span>`:voting?`<small>投票数：？？？</small>`:""}</div>
      ${voting?`<button class="vt-b" type="button" data-vote="${i}" ${voted!=null||me?"disabled":""}>${voted===i?"投票した！":"投票する"}</button>`:`<span></span>`}</div>`; }).join("");
  const tk=voting?`<div class="vt-panel vt-tk"><b>🎫 エントリー予約チケット（${vtk()}枚）</b><p class="vt-note">投票中に使うと、この投票が終わったあとの次の回のエントリーに先に入れます（モコはもらえません）。予約 ${(d.q||[]).length}人</p>
      <button class="vt-b gold" type="button" id="vtRes" ${vtk()&&!reserved&&!entrant?"":"disabled"} style="margin-top:6px">${reserved?"予約ずみ":entrant?"今回エントリー中なので予約できません":"チケットで次の回を予約"}</button></div>`:"";
  B.innerHTML=`<div class="vt-panel">${head}</div><div class="vt-rows">${rows}</div>${tk}`;
  B.querySelectorAll("[data-ent]").forEach(b=>b.onclick=()=>pick(m=>enter(m), d.e.map(x=>x.m)));
  B.querySelectorAll("[data-vote]").forEach(b=>b.onclick=()=>vote(+b.dataset.vote));
  const rb=B.querySelector("#vtRes"); if(rb) rb.onclick=()=>pick(m=>reserve(m), (d.q||[]).map(x=>x.m));
}
function pick(cb,taken){ taken=taken||[]; const ids=[...new Set((S.units||[]).map(z=>z.m))].map(mon).filter(Boolean).sort((a,b)=>(RANKS.indexOf(b.rank)-RANKS.indexOf(a.rank))||(a.id-b.id));
  if(!ids.length) return toast("BOXに魔物がいません");
  const bg=document.createElement("div"); bg.className="sheet-bg"; bg.style.zIndex=230;
  bg.innerHTML=`<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-h"><h3>エントリーする魔物をえらぶ</h3><button class="x" type="button" aria-label="閉じる">✕</button></div>
    <p class="note" style="margin:0 0 8px">同じ魔物はエントリーできません（ほかの冒険者がエントリーずみの魔物は選べません）</p>
    <div class="vt-pick">${ids.map(m=>`<button type="button" data-m="${m.id}" ${taken.includes(m.id)?"disabled":""}><img src="${cardURL(m.id,0,120)}" alt="">${esc(m.name)}${taken.includes(m.id)?"<br><small>エントリーずみ</small>":""}</button>`).join("")}</div></div>`;
  document.body.appendChild(bg); const x=()=>bg.remove(); bg.querySelector(".x").onclick=x; bg.onclick=e=>{ if(e.target===bg) x(); };
  bg.querySelectorAll("[data-m]").forEach(b=>b.onclick=()=>{ x(); cb(+b.dataset.m); }); }
async function enter(mid){
  let ok=false, why="";
  try{ await DB.runTransaction(async tx=>{ const sn=await tx.get(ref()); const d=sn.exists?sn.data():blank(1); ok=false;
    if(isOver(d)){ why="投票が終わったところです。少し待ってからもう一度"; return; }
    if(isVoting(d)){ why="投票中はエントリーできません（予約チケットを使ってね）"; return; }
    if(d.e.some(x=>x.uid===MYID)){ why="もうエントリーしています"; return; }
    if((d.pe||[]).includes(MYID)){ why="前の回にエントリーしたので、今回は休みです"; return; }
    if(d.e.length>=VT.N){ why="エントリー枠がうまりました"; return; }
    if(d.e.some(x=>x.m===mid)){ why="その魔物はもうほかの冒険者がエントリーしています（同じ魔物はエントリーできません）"; return; }
    d.e.push({uid:MYID, m:mid}); if(d.e.length>=VT.N) d.st=now(); tx.set(ref(), d); ok=true; }); }
  catch(e){ why="通信できませんでした"; }
  if(!ok) return toast(why||"エントリーできませんでした");
  S.moko=(S.moko||0)+VT.ENTRY_MOKO; save(); try{ SFX.coin(); }catch(e){} toast(`エントリーしました！ +${VT.ENTRY_MOKO}モコ`); }
async function reserve(mid){
  if(!vtk()) return toast("エントリー予約チケットがありません");
  let ok=false, why="";
  try{ await DB.runTransaction(async tx=>{ const sn=await tx.get(ref()); const d=sn.exists?sn.data():null; ok=false;
    if(!d||!isVoting(d)){ why="予約チケットは投票中に使えます"; return; }
    if(d.e.some(x=>x.uid===MYID)){ why="今回エントリー中なので、次の回は休みです"; return; }
    d.q=d.q||[]; if(d.q.some(x=>x.uid===MYID)){ why="もう予約しています"; return; }
    if(d.q.some(x=>x.m===mid)){ why="その魔物はもうほかの冒険者が予約しています（同じ魔物はエントリーできません）"; return; }
    d.q.push({uid:MYID, m:mid}); tx.set(ref(), d); ok=true; }); }
  catch(e){ why="通信できませんでした"; }
  if(!ok) return toast(why||"予約できませんでした");
  addItem("vtk",-1); save(); toast("次の回のエントリーを予約しました！"); }
async function vote(i){
  const d=CUR; if(!d||!isVoting(d)) return; if((S.vtVoted||{})[d.r]!=null) return toast("この回はもう投票しました");
  if(d.e[i]&&d.e[i].uid===MYID) return toast("自分のエントリーには投票できません");
  let ok=false, why="";
  try{ await DB.runTransaction(async tx=>{ const vr=DB.collection("vvotes").doc(`${d.r}_${MYID}`); const [sn,vs]=[await tx.get(ref()), await tx.get(vr)]; const x=sn.data(); ok=false;
    if(!x||x.r!==d.r||!isVoting(x)){ why="投票は終わりました"; return; }
    if(vs.exists){ why="この回はもう投票しました"; return; }
    x.c[i]=(x.c[i]||0)+1; tx.set(ref(), x); tx.set(vr,{r:d.r, uid:MYID, i, at:now()}); ok=true; }); }
  catch(e){ why="通信できませんでした"; }
  if(!ok) return toast(why||"投票できませんでした");
  S.vtVoted=S.vtVoted||{}; S.vtVoted[d.r]=i; S.coins=(S.coins||0)+VT.VOTE_COIN; save(); try{ renderCoins(); SFX.coin(); }catch(e){} toast(`投票しました！ +${VT.VOTE_COIN.toLocaleString()}コイン`); draw(); }

/* ---------- タイトルのボタンと吹き出し ---------- */
async function titleTip(){ const b=document.getElementById("ttlVote"), tip=document.getElementById("ttlVoteTip"); if(!b) return;
  b.hidden=false; if(!DB||!MYID){ tip.hidden=true; return; }
  try{ const sn=await ref().get(); const d=sn.exists?sn.data():blank(1); if(isOver(d)) settle();
    if(isVoting(d)){ tip.textContent="投票して1000コインゲット！"; tip.hidden=(S.vtVoted||{})[d.r]!=null; }
    else { tip.textContent="エントリーして1モコゲット"; tip.hidden=d.e.some(x=>x.uid===MYID)||(d.pe||[]).includes(MYID); } }catch(e){ tip.hidden=true; } }
let setupDone=false;
function setup(){ const b=document.getElementById("ttlVote"); if(!b||setupDone) return; setupDone=true;   // ボタンは index.html にあるので、タイトルが出たときからすぐ見える
  b.onclick=()=>{ try{ SFX.tap(); }catch(e){} open(); };
  titleTip(); setInterval(()=>{ if(document.querySelector("#title:not([hidden])")) titleTip(); }, 20000);
  let was=null; setInterval(()=>{ const on=!!(DB&&MYID); if(on!==was){ was=on; titleTip(); if(on){ checkWins(); clearTest(); } } }, 1000); }   // ログインしたらすぐ吹き出しを出す   // ログインしたらすぐボタンを出す
// ふっかーの試しエントリーを消す（1回だけ・2026-10-26）
async function clearTest(){ try{ if(S.vtClr1||!DB||!MYID||!dexPeek()) return;
  await DB.runTransaction(async tx=>{ const sn=await tx.get(ref()); if(!sn.exists) return; const d=sn.data();
    const had=d.e.some(x=>x.uid===MYID); d.e=d.e.filter(x=>x.uid!==MYID); d.q=(d.q||[]).filter(x=>x.uid!==MYID); d.pe=(d.pe||[]).filter(u=>u!==MYID);
    if(had&&d.st){ d.st=0; d.c=[0,0,0,0,0]; d.r=(d.r||1)+1; } tx.set(ref(), d); });   // 投票が始まっていたら、票を0にして回の番号を変える（同じ人がもう一度投票できるように）
  S.vtClr1=1; save(); }catch(e){} }
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",setup); else setup();
setTimeout(()=>{ setup(); titleTip(); }, 4000);
window.openVote=open; window.__vt={settle,checkWins,draw:()=>draw(),VT};
})();
