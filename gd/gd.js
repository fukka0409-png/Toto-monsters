/* 🛍 グッズ特典（2026-10-29・試作：おじおじさんとふっかーだけ）
   ①登録：BASEのPay IDの名前を入れて「ふっかーへ申請」→ ふっかーが承認するまで先へ進めない
   ②グッズガチャ：グッズチケットで引く（1連=1枚・10連=7枚）。S〜C賞は「郵送申請」、D賞はデジタルステッカー
   ③ステッカー集め：30枚で「50%クーポン券を申請する」→ ふっかーがクーポンコードを送る
   ふっかー：タイトルの「🛍 グッズ管理」から、承認・チケットを渡す・発送・クーポンコードを送る
   データ：gdacc/{uid}（登録・チケット・ステッカー・クーポン）／gdwin/{id}（当たった景品）／gdstock/one（S賞・A賞の当選者） */
(()=>{
const GD={
  WHO:["おじおじ"],            // 見られる冒険者（ふっかーはいつでも）
  ONE:1, TEN:7,                 // 1連・10連に使うチケット
  STK:30,                       // ステッカーの枠
  BUY_URL:"https://fukka0409.base.shop/items/151065414", BUY_IMG:"gd/buy.jpg",   // 「グッズチケットを500円で購入！」のリンク（BASEのショップ）
  // 景品（S賞・A賞は1人だけ当選）。img にラインナップの画像を入れる
  PRIZES:[
    {r:"S", name:"「勇者アヒル」の原画", img:"gd/s.jpg?v=2", rate:0.05, one:true},
    {r:"A", name:"複製画キャンバス", img:"gd/a.jpg?v=2", rate:2.95, one:true},
    {r:"B", name:"ランダム複製トレカ3枚セット", img:"gd/b.jpg?v=2", rate:5},
    {r:"C", name:"パック式豆色紙", img:"gd/c.jpg", rate:7},
    {r:"D", name:"デジタルステッカー（魔物）", img:"", rate:85},
  ],
};
// D賞：ゲームの魔物の絵をステッカー風にして、ステッカー集めの枠に自動で貼る
const stkPool=()=>{ try{ return MONSTERS.filter(m=>m&&m.img&&m.rank!=="L").map(m=>m.id); }catch(e){ return []; } };
const stkImg=id=>{ try{ const m=mon(id); return m&&m.img||""; }catch(e){ return ""; } };
const stkRot=i=>((i*37)%13-6);   // 枠ごとに少しかたむける
const stkTag=(id,i)=>`<img class="gd-st" src="${stkImg(id)}" alt="" style="--r:${stkRot(i)}deg">`;
const COL={S:"#e53935",A:"#fb8c00",B:"#43a047",C:"#1e88e5",D:"#8e24aa"};
const canSee=()=>{ try{ if(typeof dexPeek==="function"&&dexPeek()) return true; const me=normName(myName()); return GD.WHO.some(n=>normName(n)===me); }catch(e){ return false; } };
const accRef=()=>DB.doc("gdacc/"+MYID), stockRef=()=>DB.doc("gdstock/one");
const pz=r=>GD.PRIZES.find(p=>p.r===r);
const T=t=>{ try{ toast(t); }catch(e){} };
const tap=()=>{ try{ SFX.tap(); }catch(e){} };

const css=document.createElement("style");
css.textContent=`
#gdo{position:fixed;inset:0;z-index:215;background:#fff8ec;display:flex;flex-direction:column;font-family:var(--f-body,sans-serif);color:#2b1a06}
#gdo .gd-top{flex:none;display:flex;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top,0px) + 10px) 12px 10px;background:linear-gradient(#ffcf6b,#ffe9b0);border-bottom:4px solid #2b1a06}
#gdo .gd-top b{flex:1;text-align:center;font:900 17px var(--f-body)}
#gdo .gd-b{padding:8px 12px;border-radius:10px;background:#fff;border:3px solid #2b1a06;box-shadow:0 3px 0 #2b1a06;font:900 13px var(--f-body);color:#2b1a06}
#gdo .gd-body{flex:1;overflow-y:auto;padding:14px 14px calc(20px + env(safe-area-inset-bottom,0px))}
#gdo .gd-in{max-width:520px;margin:0 auto}
#gdo .gd-card{background:#fff;border:3px solid #2b1a06;border-radius:12px;box-shadow:0 4px 0 #2b1a06;padding:14px;margin:0 0 14px}
#gdo .gd-safe{background:#e8f6ea;border:3px solid #2e7d32;border-radius:12px;padding:10px 12px;font-weight:900;color:#1b5e20;line-height:1.6;margin:0 0 12px}
#gdo input[type=text]{width:100%;box-sizing:border-box;padding:12px;font-size:17px;border:3px solid #2b1a06;border-radius:10px;margin:6px 0 10px}
#gdo .gd-go{display:block;width:100%;padding:14px;border-radius:12px;border:3px solid #2b1a06;background:#ffcf3b;box-shadow:0 4px 0 #2b1a06;font:900 18px var(--f-body);color:#2b1a06}
#gdo .gd-go:disabled{opacity:.4}
#gdo .gd-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 18px}
#gdo .gd-box{background:#fff;border:3px solid #2b1a06;border-radius:10px;padding:10px;text-align:center;font-weight:900}
#gdo .gd-box small{display:block;font-size:12px;opacity:.75}
#gdo .gd-box b{font-size:24px}
#gdo .gd-big{display:block;width:100%;padding:26px 10px;margin:8px 0 4px;border-radius:14px;border:4px solid #2b1a06;box-shadow:0 5px 0 #2b1a06;font:900 30px var(--f-body);color:#2b1a06;background:linear-gradient(#fff3c4,#ffd76a)}
#gdo .gd-big.stk{background:linear-gradient(#e7f3ff,#a9d4ff)}
#gdo .gd-cap{text-align:center;font-weight:900;font-size:14px;margin:0 0 22px;line-height:1.5}
#gdo .gd-line{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:0 0 12px}
#gdo .gd-pz{position:relative;background:#fff;border:3px solid #2b1a06;border-radius:10px;padding:6px 4px;text-align:center;font-size:10.5px;font-weight:900;line-height:1.25}
#gdo .gd-pz .rk{display:block;font-size:18px}
#gdo .gd-pz img,#gdo .gd-pz .ph{width:100%;aspect-ratio:1;object-fit:contain;display:block;margin:3px 0;border-radius:6px;background:#f6efe0;font-size:28px;line-height:1;display:grid;place-items:center}
#gdo .gd-pz.out{filter:grayscale(1);opacity:.55}
#gdo .gd-pz.out::after{content:"当選者が出ました！";position:absolute;left:-4px;right:-4px;top:42%;background:#222;color:#fff;font-size:10px;padding:3px 0;transform:rotate(-8deg);border-radius:4px}
#gdo .gd-pulls{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 16px}
#gdo .gd-pulls button{padding:14px 6px;border-radius:12px;border:3px solid #2b1a06;box-shadow:0 4px 0 #2b1a06;background:#ffcf3b;font:900 18px var(--f-body);color:#2b1a06}
#gdo .gd-pulls button small{display:block;font-size:12px;margin-top:3px}
#gdo .gd-pulls button:disabled{opacity:.4}
#gdo .gd-buy{display:block;text-align:center;padding:16px;border-radius:12px;border:3px dashed #e53935;background:#fff0f0;color:#c62828;font:900 17px var(--f-body);text-decoration:none}
#gdo .gd-slots{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin:0 0 14px}
#gdo .gd-slot{aspect-ratio:1;border:3px dashed #b9a98a;border-radius:10px;display:grid;place-items:center;font-size:22px;background:#fffdf6}
#gdo .gd-slot.on{border:3px solid #8e24aa;background:#f3e5f5}
.gd-st{width:86%;height:86%;object-fit:contain;image-rendering:pixelated;transform:rotate(var(--r,0deg));filter:drop-shadow(2px 0 0 #fff) drop-shadow(-2px 0 0 #fff) drop-shadow(0 2px 0 #fff) drop-shadow(0 -2px 0 #fff) drop-shadow(1px 2px 2px #0007)}
#gdo .gd-pz img{object-fit:cover;cursor:zoom-in}
.gd-zoom{position:fixed;inset:0;z-index:240;background:#000d;display:grid;place-items:center;padding:16px}
.gd-zoom img{max-width:94vw;max-height:80vh;border-radius:10px}
.gd-zoom p{color:#fff;font-weight:900;text-align:center;margin:8px 0 0}
#gdo .gd-it{display:flex;align-items:center;gap:10px;padding:10px;border:2px solid #2b1a06;border-radius:10px;background:#fff;margin:0 0 8px}
#gdo .gd-it b{flex:1}
#gdo .gd-tag{font-size:12px;font-weight:900;padding:4px 8px;border-radius:999px;background:#ffe082;white-space:nowrap}
#gdo .gd-tag.sent{background:#a5d6a7}
#gdo .gd-tag.code{background:#90caf9}
#gdo .gd-mini{padding:6px 10px;border-radius:8px;border:2px solid #2b1a06;background:#ffcf3b;font:900 12px var(--f-body);color:#2b1a06;white-space:nowrap}
#gdo .gd-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}
#gdo .gd-tabs button{padding:8px 10px;border-radius:999px;border:2px solid #2b1a06;background:#fff;font:900 12px var(--f-body)}
#gdo .gd-tabs button.on{background:#2b1a06;color:#fff}
.gd-res{position:fixed;inset:0;z-index:236;background:#000c;display:grid;place-items:center;padding:16px}
.gd-res>div{background:#fff8ec;border:4px solid #2b1a06;border-radius:16px;padding:16px;max-width:420px;width:100%;max-height:86vh;overflow:auto;text-align:center;color:#2b1a06}
.gd-res h3{margin:0 0 10px;font:900 20px var(--f-body)}
.gd-res .gd-rl{display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:8px;margin:0 0 12px}
.gd-res .gd-ri{border:3px solid #2b1a06;border-radius:10px;padding:6px 2px;font-weight:900;font-size:11px;background:#fff}
.gd-res .gd-ri b{display:block;font-size:22px}
.gd-res button{padding:12px 18px;border-radius:12px;border:3px solid #2b1a06;background:#ffcf3b;font:900 16px var(--f-body);color:#2b1a06;box-shadow:0 3px 0 #2b1a06}
`;
document.head.appendChild(css);

let V=null, ACC=null, WINS=[], STOCK={}, page="home";
function shell(title,back){ if(!V){ V=document.createElement("div"); V.id="gdo"; document.body.appendChild(V); }
  V.innerHTML=`<div class="gd-top"><button class="gd-b" type="button" id="gdBack">${back?"← もどる":"← タイトルへ"}</button><b>${title}</b><span style="width:70px"></span></div><div class="gd-body"><div class="gd-in" id="gdIn"></div></div>`;
  V.querySelector("#gdBack").onclick=()=>{ tap(); if(back) back(); else close(); };
  return V.querySelector("#gdIn"); }
function close(){ if(V){ V.remove(); V=null; } }

async function load(){
  try{ const a=await withTO(accRef().get()); ACC=a.exists?a.data():null; }catch(e){ ACC=undefined; }
  try{ const q=await withTO(DB.collection("gdwin").where("uid","==",MYID).get()); WINS=q.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.at||0)-(a.at||0)); }catch(e){ WINS=[]; }
  try{ const s=await withTO(stockRef().get()); STOCK=s.exists?s.data():{}; }catch(e){ STOCK={}; }
}
async function open(){ if(!DB||!MYID) return T("グッズ特典はログインしている冒険者だけ使えます");
  if(!canSee()) return;
  const el=shell("🛍 グッズ特典"); el.innerHTML=`<div class="gd-card" style="text-align:center">読み込み中…</div>`;
  await load(); route(); }
function route(){
  if(ACC===undefined){ shell("🛍 グッズ特典").innerHTML=`<div class="gd-card">読み込めませんでした。少し時間をおいて開き直してください。</div>`; return; }
  if(!ACC) return regPage();
  if(ACC.st!=="ok") return waitPage();
  if(!S.gdOkSeen){ S.gdOkSeen=1; try{ save(); }catch(e){}
    const el=shell("🛍 グッズ特典"); el.innerHTML=`<div class="gd-card" style="text-align:center"><div style="font-size:56px">🎉</div><h2 style="margin:6px 0 10px">承認されました！</h2><p>グッズガチャとステッカー集めが使えるようになりました。</p><button class="gd-go" type="button" id="gdNext">次へ進む</button></div>`;
    el.querySelector("#gdNext").onclick=()=>{ tap(); homePage(); }; return; }
  homePage(); }

// ① 登録
function regPage(){ const el=shell("📝 登録画面");
  el.innerHTML=`<div class="gd-safe">🔒 名前を含む個人情報は、ほかの冒険者からは見えません！<br>見られるのは運営（ふっかー）だけです。安心して入力してね。</div>
    <div class="gd-card"><b>BASEのPay IDに登録している名前を記入</b>
      <input type="text" id="gdName" maxlength="30" autocomplete="name" placeholder="例：山田 太郎">
      <small style="display:block;margin:-4px 0 12px;opacity:.75">グッズを送るときの確認だけに使います。冒険者名と本名はふっかーだけが確認できます。</small>
      <div id="gdMsg" style="color:#c62828;font-weight:900;margin:0 0 8px"></div>
      <button class="gd-go" type="button" id="gdSend">ふっかーへ申請</button></div>`;
  el.querySelector("#gdSend").onclick=async()=>{ const v=el.querySelector("#gdName").value.replace(/\s+/g," ").trim().slice(0,30), msg=el.querySelector("#gdMsg");
    if(v.length<2){ msg.textContent="名前を入力してください"; return; }
    const b=el.querySelector("#gdSend"); b.disabled=true; b.textContent="送信中…";
    try{ await withTO(accRef().set({uid:MYID, adv:String(myName()||"").slice(0,24), real:v, st:"wait", at:gnow(), tk:0, stk:0})); }
    catch(e){ b.disabled=false; b.textContent="ふっかーへ申請"; msg.textContent="送れませんでした。少し時間をおいてためしてください"; return; }
    ACC={uid:MYID, real:v, st:"wait", at:gnow(), tk:0, stk:0}; tap(); waitPage(); }; }
// 承認待ち（ここから先へは進めない）
function waitPage(){ const el=shell("⏳ 承認待ち");
  el.innerHTML=`<div class="gd-card" style="text-align:center"><div style="font-size:52px">⏳</div>
    <p style="font-weight:900;font-size:17px;line-height:1.6">ふっかーからの承認をお待ちください！</p>
    <p style="line-height:1.7">2日以上経っても承認されない場合は、ふっかーのインスタもしくはTikTokのDMにてメッセージを送ってください。</p>
    <p style="font-size:12px;opacity:.7">申請した名前：<b translate="no">${esc(ACC.real||"")}</b></p>
    <button class="gd-b" type="button" id="gdRe">🔄 承認されたか確かめる</button></div>`;
  el.querySelector("#gdRe").onclick=async()=>{ tap(); await load(); if(ACC&&ACC.st==="ok") route(); else T("まだ承認されていません"); }; }

// ② ホーム（申請済みグッズ・所持チケット数・ガチャ・ステッカー集め）
function pendingCount(){ return WINS.filter(w=>w.st==="req").length + (ACC.cp&&ACC.cp.st==="wait"?1:0); }
function homePage(){ page="home"; const el=shell("🛍 グッズ特典");
  el.innerHTML=`<div class="gd-row">
      <button class="gd-box" type="button" id="gdReq"><small>申請済みグッズ</small><b>${pendingCount()}</b><small>タップで確認</small></button>
      <div class="gd-box"><small>所持チケット数</small><b>🎫 ${ACC.tk||0}</b><small>グッズチケット</small></div></div>
    <button class="gd-big" type="button" id="gdGacha">グッズガチャ</button>
    <p class="gd-cap">本物のグッズが当たります‼️</p>
    <button class="gd-big stk" type="button" id="gdStk">ステッカー集め</button>
    <p class="gd-cap">デジタルステッカーを${GD.STK}枚集めると<br>Pay IDで使える50%クーポンがゲットできます‼️</p>`;
  el.querySelector("#gdReq").onclick=()=>{ tap(); reqPage(); };
  el.querySelector("#gdGacha").onclick=()=>{ tap(); gachaPage(); };
  el.querySelector("#gdStk").onclick=()=>{ tap(); stkPage(); };
  noticeCheck(); }

// 申請済みグッズ（郵送申請したもの・クーポン）
function reqPage(){ const el=shell("📦 申請済みグッズ",homePage);
  const unreq=WINS.filter(w=>w.st==="won"), req=WINS.filter(w=>w.st==="req"||w.st==="sent");
  const it=w=>`<div class="gd-it"><span style="font-size:22px;color:${COL[w.r]};font-weight:900">${w.r}</span><b>${esc(w.name||"")}<br><small style="opacity:.6">${new Date(w.at||0).toLocaleDateString("ja-JP")}</small></b>${w.st==="sent"?`<span class="gd-tag sent">発送されました</span>`:w.st==="req"?`<span class="gd-tag">承認待ち</span>`:`<button class="gd-mini" type="button" data-req="${w.id}">郵送申請</button>`}</div>`;
  const cp=ACC.cp;
  el.innerHTML=`${unreq.length?`<div class="gd-card"><b>まだ郵送申請していない景品</b><p style="font-size:12px;margin:4px 0 8px">送料無料です！</p>${unreq.map(it).join("")}</div>`:""}
    <div class="gd-card"><b>申請済み</b><div style="margin-top:8px">${req.length||cp?"":"<p style='opacity:.6'>まだありません</p>"}${req.map(it).join("")}
    ${cp?`<div class="gd-it"><span style="font-size:22px">🎟</span><b>50%クーポン券${cp.st==="sent"?`<br><small>クーポンコード：<span translate="no" style="font-size:16px;color:#1565c0">${esc(cp.code||"")}</span></small>`:""}</b>${cp.st==="sent"?`<span class="gd-tag code">届きました！</span>`:`<span class="gd-tag">承認待ち</span>`}</div>`:""}</div></div>`;
  el.querySelectorAll("[data-req]").forEach(b=>b.onclick=()=>mailReq(b.dataset.req,reqPage)); }
async function mailReq(id,after){ tap(); try{ await withTO(DB.doc("gdwin/"+id).update({st:"req", reqAt:gnow()})); }catch(e){ return T("送れませんでした"); }
  const w=WINS.find(x=>x.id===id); if(w){ w.st="req"; w.reqAt=gnow(); } T("郵送申請しました！ 申請済みグッズに追加されました"); after&&after(); }

// ③ グッズガチャ
function gachaPage(){ page="gacha"; const el=shell("🎰 グッズガチャ",homePage);
  el.innerHTML=`<div class="gd-card"><b>ラインナップ</b><div class="gd-line" style="margin-top:8px">${GD.PRIZES.map(p=>`<div class="gd-pz ${p.one&&STOCK[p.r]?"out":""}"><span class="rk" style="color:${COL[p.r]}">${p.r}賞</span>${p.img?`<img src="${esc(p.img)}" alt="" data-zoom="${p.r}">`:p.r==="D"&&stkPool().length?`<span class="ph">${stkTag(stkPool()[Math.floor(Math.random()*stkPool().length)],1)}</span>`:`<span class="ph">🎁</span>`}${esc(p.name)}${p.one?"<br><small>1名のみ</small>":""}</div>`).join("")}</div>
      <p style="font-size:12px;margin:0">S賞とA賞は1人だけ当選します。当選者が出ると、その景品はモノクロになります。</p></div>
    <div style="text-align:center;font-weight:900;margin:0 0 8px">所持チケット 🎫 ${ACC.tk||0}枚</div>
    <div class="gd-pulls"><button type="button" data-n="1" ${(ACC.tk||0)<GD.ONE?"disabled":""}>1連<small>チケット${GD.ONE}枚</small></button><button type="button" data-n="10" ${(ACC.tk||0)<GD.TEN?"disabled":""}>10連<small>チケット${GD.TEN}枚</small></button></div>
    ${GD.BUY_URL?`<a href="${esc(GD.BUY_URL)}" target="_blank" rel="noopener" style="display:block;border-radius:12px;overflow:hidden;border:3px solid #2b1a06;box-shadow:0 4px 0 #2b1a06"><img src="${esc(GD.BUY_IMG)}" alt="グッズチケットを500円で購入！ 1セット購入でグッズチケット1枚申請できます" style="display:block;width:100%;height:auto"></a><p style="text-align:center;font-weight:900;font-size:13px;margin:8px 0 0">🎫 グッズチケットを500円で購入！</p>`:""}`;
  el.querySelectorAll("[data-n]").forEach(b=>b.onclick=()=>pull(+b.dataset.n));
  el.querySelectorAll("[data-zoom]").forEach(im=>im.onclick=()=>{ const p=pz(im.dataset.zoom), z=document.createElement("div"); z.className="gd-zoom"; z.innerHTML=`<div><img src="${esc(p.img)}" alt=""><p>${p.r}賞　${esc(p.name)}</p></div>`; z.onclick=()=>z.remove(); document.body.appendChild(z); }); }
let pulling=false;
async function pull(n){ if(pulling) return; pulling=true; tap(); const cost=n===10?GD.TEN:GD.ONE; let got=[], newIds=[], gotStk=[];
  try{ await DB.runTransaction(async tx=>{ const a=await tx.get(accRef()), s=await tx.get(stockRef()); const acc=a.data(), st=s.exists?s.data():{}; got=[]; newIds=[];
      if(!acc||acc.st!=="ok") throw new Error("not ok"); if((acc.tk||0)<cost) throw new Error("tk");
      const taken={S:!!st.S, A:!!st.A}, setSt={}; let d=0; const sl=(acc.sl||[]).slice(), pool=stkPool(); gotStk=[];
      for(let i=0;i<n;i++){ let x=Math.random()*100, pick=pz("D");
        for(const p of GD.PRIZES){ if((x-=p.rate)<0){ pick=p; break; } }
        if(pick.one&&taken[pick.r]) pick=pz("D");   // 当選者が出たS賞・A賞の分はD賞になる
        if(pick.one){ taken[pick.r]=true; setSt[pick.r]=MYID; }
        got.push(pick.r); if(pick.r==="D"){ d++; if(pool.length){ const id=pool[Math.floor(Math.random()*pool.length)]; gotStk.push(id); if(sl.length<GD.STK) sl.push(id); } } }
      tx.update(accRef(),{tk:(acc.tk||0)-cost, stk:sl.length, sl});
      if(Object.keys(setSt).length) tx.set(stockRef(),{...st,...setSt});
      got.filter(r=>r!=="D").forEach(r=>{ const ref=DB.collection("gdwin").doc(); newIds.push(ref.id); tx.set(ref,{uid:MYID, adv:String(myName()||"").slice(0,24), r, name:pz(r).name, at:gnow(), st:"won"}); }); }); }
  catch(e){ pulling=false; return T(String(e&&e.message)==="tk"?"グッズチケットが足りません":"通信できませんでした。もう一度ためしてください"); }
  await load(); pulling=false;
  const cnt={}; got.forEach(r=>cnt[r]=(cnt[r]||0)+1); const real=got.filter(r=>r!=="D").length;
  const d=document.createElement("div"); d.className="gd-res";
  d.innerHTML=`<div><h3>${real?"🎉 グッズが当たった！":"結果"}</h3><div class="gd-rl">${["S","A","B","C","D"].filter(r=>cnt[r]).map(r=>`<div class="gd-ri" style="border-color:${COL[r]}"><b style="color:${COL[r]}">${r}賞</b>${esc(pz(r).name)}<br>×${cnt[r]}</div>`).join("")}</div>
    ${cnt.D?`<p style="font-weight:900">🏷 デジタルステッカーを${cnt.D}枚ゲット！<br><small>ステッカー集めの枠に自動で貼られました</small></p><div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:0 0 12px">${gotStk.map((id,i)=>`<div style="width:56px;height:56px;display:grid;place-items:center">${stkTag(id,i+3)}</div>`).join("")}</div>`:""}
    ${real?`<p style="font-weight:900">郵送申請すると、グッズが届きます！<br><small>送料無料です！</small></p><button type="button" id="gdMailAll">郵送申請する</button><br><br>`:""}
    <button type="button" id="gdOk" style="background:#fff">${real?"あとで":"OK"}</button></div>`;
  document.body.appendChild(d); try{ SFX.reveal(cnt.S||cnt.A?"Z":real?"S":"A"); }catch(e){}
  d.querySelector("#gdOk").onclick=()=>{ d.remove(); gachaPage(); };
  const ma=d.querySelector("#gdMailAll"); if(ma) ma.onclick=async()=>{ ma.disabled=true; for(const id of newIds){ try{ await withTO(DB.doc("gdwin/"+id).update({st:"req", reqAt:gnow()})); }catch(e){} } await load(); d.remove(); T("郵送申請しました！ 申請済みグッズに追加されました"); gachaPage(); }; }

// ④ ステッカー集め
function stkPage(){ page="stk"; const el=shell("🏷 ステッカー集め",homePage); const n=Math.min(GD.STK,ACC.stk||0), cp=ACC.cp;
  el.innerHTML=`<div class="gd-card"><b>デジタルステッカー ${n} / ${GD.STK}</b><p style="font-size:12px;margin:4px 0 10px">グッズガチャでD賞が当たると、魔物のステッカーが自動で1枚ずつ貼られます。</p>
    <div class="gd-slots">${Array.from({length:GD.STK},(_,i)=>{ const id=(ACC.sl||[])[i]; return `<div class="gd-slot ${i<n?"on":""}">${i<n?(id!=null&&stkImg(id)?stkTag(id,i):"🏷"):""}</div>`; }).join("")}</div>
    ${cp&&cp.st==="wait"?`<p style="font-weight:900;text-align:center">🎟 50%クーポン券を申請中です（承認待ち）</p>`:cp&&cp.st==="sent"?`<p style="font-weight:900;text-align:center">🎟 クーポンコードが届いています！「申請済みグッズ」で確認できます</p>`:""}
    ${n>=GD.STK&&!(cp&&cp.st==="wait")?`<button class="gd-go" type="button" id="gdCp">50%クーポン券を申請する</button>`:""}</div>`;
  const b=el.querySelector("#gdCp"); if(b) b.onclick=async()=>{ b.disabled=true; tap();
    try{ await withTO(accRef().update({stk:0, sl:[], cp:{st:"wait", at:gnow()}})); }catch(e){ b.disabled=false; return T("送れませんでした"); }
    ACC.stk=0; ACC.sl=[]; ACC.cp={st:"wait", at:gnow()}; T("50%クーポン券を申請しました！ 申請済みグッズに追加されました"); stkPage(); }; }

// お知らせ：発送された・クーポンコードが届いた
function noticeCheck(){ try{ S.gdSeen=S.gdSeen||{}; const msgs=[];
  WINS.filter(w=>w.st==="sent"&&!S.gdSeen[w.id]).forEach(w=>{ S.gdSeen[w.id]=1; msgs.push(`📦 ${w.r}賞「${esc(w.name)}」が発送されました！`); });
  if(ACC&&ACC.cp&&ACC.cp.st==="sent"&&!S.gdSeen["cp"+ACC.cp.at]){ S.gdSeen["cp"+ACC.cp.at]=1; msgs.push(`🎟 クーポンコードが届きました！<br><b translate="no" style="font-size:20px;color:#1565c0">${esc(ACC.cp.code||"")}</b>`); }
  if(!msgs.length) return; save();
  const d=document.createElement("div"); d.className="gd-res"; d.innerHTML=`<div><h3>🛍 お知らせ</h3><p style="line-height:1.8">${msgs.join("<br>")}</p><button type="button">OK</button></div>`;
  document.body.appendChild(d); d.querySelector("button").onclick=()=>d.remove(); }catch(e){} }

/* ---------- ふっかー：グッズ管理 ---------- */
let AT="wait";
async function admin(){ if(!DB||!dexPeek()) return; const el=shell("🛍 グッズ管理（ふっかー）"); el.innerHTML=`<div class="gd-card">読み込み中…</div>`;
  let A=[], W=[]; try{ A=(await withTO(DB.collection("gdacc").get())).docs.map(d=>({id:d.id,...d.data()})); W=(await withTO(DB.collection("gdwin").get())).docs.map(d=>({id:d.id,...d.data()})); }
  catch(e){ el.innerHTML=`<div class="gd-card">読み込めませんでした（Firestoreのルールを確認してください）</div>`; return; }
  const nk=t=>String(t||"").normalize("NFKC").toLowerCase().replace(/\s+/g,""), same={}; A.forEach(a=>{ same[nk(a.real)]=(same[nk(a.real)]||0)+1; });
  const who=a=>`<b translate="no">${esc(a.adv||"?")}</b><br><small>本名：<span translate="no">${esc(a.real||"")}</span>${same[nk(a.real)]>1?` <b style="color:#c62828">（同じ本名${same[nk(a.real)]}人）</b>`:""}</small>`;
  const nm=uid=>{ const a=A.find(x=>x.id===uid); return a?who(a):esc(uid); };
  const tabs=[["wait",`承認待ち ${A.filter(a=>a.st!=="ok").length}`],["users",`冒険者・チケット ${A.filter(a=>a.st==="ok").length}`],["mail",`郵送申請 ${W.filter(w=>w.st==="req").length}`],["cp",`クーポン申請 ${A.filter(a=>a.cp&&a.cp.st==="wait").length}`]];
  const body=()=>{ if(AT==="wait"){ const L=A.filter(a=>a.st!=="ok"); return L.length?L.map(a=>`<div class="gd-it"><b>${who(a)}<br><small style="opacity:.6">${new Date(a.at||0).toLocaleString("ja-JP")}</small></b><button class="gd-mini" type="button" data-ok="${a.id}">承認する</button></div>`).join(""):"<p>承認待ちはいません</p>"; }
    if(AT==="users"){ const L=A.filter(a=>a.st==="ok"); return L.length?L.map(a=>`<div class="gd-it"><b>${who(a)}<br><small>🎫 ${a.tk||0}枚 ・ 🏷 ${a.stk||0}/${GD.STK}</small></b><button class="gd-mini" type="button" data-tk="${a.id}" data-v="1">+1枚</button><button class="gd-mini" type="button" data-tk="${a.id}" data-v="7">+7枚</button></div>`).join(""):"<p>まだいません</p>"; }
    if(AT==="mail"){ const L=W.filter(w=>w.st==="req"||w.st==="sent").sort((a,b)=>(a.st==="sent")-(b.st==="sent")||(b.reqAt||0)-(a.reqAt||0)); return L.length?L.map(w=>`<div class="gd-it"><span style="font-size:20px;font-weight:900;color:${COL[w.r]}">${w.r}</span><b>${esc(w.name||"")}<br><small>${nm(w.uid)}</small></b>${w.st==="sent"?`<span class="gd-tag sent">発送済み</span>`:`<button class="gd-mini" type="button" data-ship="${w.id}">発送</button>`}</div>`).join(""):"<p>郵送申請はありません</p>"; }
    const L=A.filter(a=>a.cp); return L.length?L.map(a=>`<div class="gd-it"><b>${who(a)}</b>${a.cp.st==="sent"?`<span class="gd-tag code">送った：${esc(a.cp.code||"")}</span>`:`<button class="gd-mini" type="button" data-cp="${a.id}">コードを送る</button>`}</div>`).join(""):"<p>クーポン申請はありません</p>"; };
  const draw=()=>{ el.innerHTML=`<div class="gd-tabs">${tabs.map(([k,t])=>`<button type="button" class="${AT===k?"on":""}" data-at="${k}">${t}</button>`).join("")}</div><div class="gd-card">${body()}</div>`;
    el.querySelectorAll("[data-at]").forEach(b=>b.onclick=()=>{ AT=b.dataset.at; draw(); });
    el.querySelectorAll("[data-ok]").forEach(b=>b.onclick=async()=>{ b.disabled=true; try{ await withTO(DB.doc("gdacc/"+b.dataset.ok).update({st:"ok", okAt:gnow()})); T("承認しました"); }catch(e){ T("できませんでした"); } admin(); });
    el.querySelectorAll("[data-tk]").forEach(b=>b.onclick=async()=>{ b.disabled=true; try{ await withTO(DB.doc("gdacc/"+b.dataset.tk).update({tk:firebase.firestore.FieldValue.increment(+b.dataset.v)})); T(`チケットを${b.dataset.v}枚わたしました`); }catch(e){ T("できませんでした"); } admin(); });
    el.querySelectorAll("[data-ship]").forEach(b=>b.onclick=async()=>{ if(!confirmBox("発送済みにしますか？")) return; b.disabled=true; try{ await withTO(DB.doc("gdwin/"+b.dataset.ship).update({st:"sent", sentAt:gnow()})); T("発送済みにしました"); }catch(e){ T("できませんでした"); } admin(); });
    el.querySelectorAll("[data-cp]").forEach(b=>b.onclick=async()=>{ const a=A.find(x=>x.id===b.dataset.cp); askCode(a); }); };
  const askCode=a=>{ const d=document.createElement("div"); d.className="gd-res"; d.innerHTML=`<div><h3>🎟 クーポンコードを送る</h3><p>${who(a)}</p><input type="text" id="gdCode" maxlength="40" style="width:100%;box-sizing:border-box;padding:10px;font-size:16px;border:3px solid #2b1a06;border-radius:10px;margin:8px 0" placeholder="クーポンコード"><button type="button" id="gdCs">送る</button> <button type="button" id="gdCn" style="background:#fff">やめる</button></div>`;
    document.body.appendChild(d); d.querySelector("#gdCn").onclick=()=>d.remove();
    d.querySelector("#gdCs").onclick=async()=>{ const c=d.querySelector("#gdCode").value.trim(); if(!c) return; try{ await withTO(DB.doc("gdacc/"+a.id).update({cp:{st:"sent", at:a.cp.at||gnow(), code:c.slice(0,40), sentAt:gnow()}})); T("クーポンコードを送りました"); }catch(e){ T("できませんでした"); } d.remove(); admin(); }; };
  draw(); }
const confirmBox=t=>true;   // ダイアログは使わない（画面が止まるのを防ぐ）

/* ---------- タイトルのボタン ---------- */
setInterval(()=>{ const b=document.getElementById("ttlGd"), m=document.getElementById("ttlGdAdm"); const on=!!(typeof DB!=="undefined"&&DB&&MYID)&&canSee();
  if(b&&b.hidden===on) b.hidden=!on; const am=!!(typeof DB!=="undefined"&&DB&&MYID)&&typeof dexPeek==="function"&&dexPeek(); if(m&&m.hidden===am) m.hidden=!am; }, 1500);
document.addEventListener("click",e=>{ if(e.target.closest("#ttlGd")){ tap(); open(); } else if(e.target.closest("#ttlGdAdm")){ tap(); admin(); } });
window.__gd={GD,open,admin};
})();
