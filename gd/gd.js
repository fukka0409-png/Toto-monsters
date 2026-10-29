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
    {r:"S", name:"「勇者アヒル」の原画", img:"gd/s.jpg?v=2", rate:0.01, one:true}   /* 2026-10-29：0.05%→0.01% */,
    {r:"A", name:"複製画キャンバス", img:"gd/a.jpg?v=2", rate:2.95, one:true},
    {r:"B", name:"ランダム複製トレカ3枚セット", img:"gd/b.jpg?v=2", rate:5, max:100},
    {r:"C", name:"パック式豆色紙", img:"gd/c.jpg", rate:7, max:100},
    {r:"D", name:"デジタルステッカー（魔物）", img:"", rate:85.04},
  ],
};
// D賞：ゲームの魔物の絵をステッカー風にして、ステッカー集めの枠に自動で貼る
const stkPool=()=>{ try{ return MONSTERS.filter(m=>m&&m.img&&m.rank!=="L").map(m=>m.id); }catch(e){ return []; } };
const stkImg=id=>{ try{ const m=mon(id); return m&&m.img||""; }catch(e){ return ""; } };
const stkRot=i=>((i*37)%13-6);   // 枠ごとに少しかたむける
const stkTag=(id,i)=>`<img class="gd-st" src="${stkImg(id)}" alt="" style="--r:${stkRot(i)}deg">`;
const COL={S:"#e53935",A:"#fb8c00",B:"#43a047",C:"#1e88e5",D:"#8e24aa"};
const canSee=()=>true;   // 2026-10-29：全冒険者に公開（ログインしている冒険者だけ使える）
const accRef=()=>DB.doc("gdacc/"+MYID), stockRef=()=>DB.doc("gdstock/one");
const pz=r=>GD.PRIZES.find(p=>p.r===r);
// 2026-10-29：数に限りがある景品（B賞・C賞は100個まで）。当たった数は gdstock/one の Bn・Cn
const leftOf=(p,st)=>p.max?Math.max(0,p.max-((st||{})[p.r+"n"]||0)):null;
const soldOut=(p,st)=>p.one?!!(st||{})[p.r]:(p.max?leftOf(p,st)<=0:false);
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
#gdo .gd-pz.out::after{content:attr(data-out);position:absolute;left:-4px;right:-4px;top:42%;background:#222;color:#fff;font-size:10px;padding:3px 0;transform:rotate(-8deg);border-radius:4px}
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

let V=null, ACC=null, WINS=[], STOCK={}, TREQ=[], page="home";
function shell(title,back){ if(!V){ V=document.createElement("div"); V.id="gdo"; document.body.appendChild(V); }
  V.innerHTML=`<div class="gd-top"><button class="gd-b" type="button" id="gdBack">${back?"← もどる":"← タイトルへ"}</button><b>${title}</b><span style="width:70px"></span></div><div class="gd-body"><div class="gd-in" id="gdIn"></div></div>`;
  V.querySelector("#gdBack").onclick=()=>{ tap(); if(back) back(); else close(); };
  return V.querySelector("#gdIn"); }
function close(){ if(V){ V.remove(); V=null; } }

// 2026-10-29：3つをいっしょに読む（前は1つずつ読んでいて遅かった）
async function load(){
  const [a,q,st,tr]=await Promise.all([withTO(accRef().get()).catch(()=>undefined), withTO(DB.collection("gdwin").where("uid","==",MYID).get()).catch(()=>null), withTO(stockRef().get()).catch(()=>null), withTO(DB.collection("gdtreq").where("uid","==",MYID).get()).catch(()=>null)]);
  TREQ=tr?tr.docs.map(d=>({id:d.id,...d.data()})).sort((x,y)=>(y.at||0)-(x.at||0)):[];
  ACC=a===undefined?undefined:(a.exists?a.data():null);
  WINS=q?q.docs.map(d=>({id:d.id,...d.data()})).sort((x,y)=>(y.at||0)-(x.at||0)):[];
  STOCK=st&&st.exists?st.data():{};
  try{ if(ACC!==undefined){ S.gdCache={ACC,WINS,STOCK,uid:MYID}; save(); } }catch(e){}
}
const reshow=()=>{ if(!V) return; if(page==="gacha") gachaPage(); else if(page==="stk") stkPage(); else route(); };
async function open(){ if(!DB||!MYID) return T("グッズ特典はログインしている冒険者だけ使えます");
  if(!canSee()) return;
  GD.PRIZES.forEach(p=>{ if(p.img){ const im=new Image(); im.src=p.img; } }); if(GD.BUY_IMG){ const im=new Image(); im.src=GD.BUY_IMG; }   // 写真を先に読みこんでおく
  const c=S.gdCache; page="home";
  if(c&&c.uid===MYID&&c.ACC){ ACC=c.ACC; WINS=c.WINS||[]; STOCK=c.STOCK||{}; route(); load().then(()=>{ if(V&&!document.querySelector(".gd-res,.pk-stage.gdp")) reshow(); }); return; }   // 前の記録ですぐ出して、うらで新しくする
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
    <p class="gd-cap">デジタルステッカーを${GD.STK}枚集めると<br>Pay IDで使える50%クーポンがゲットできます‼️</p>
    <div class="gd-card" style="line-height:1.7">
      <b style="font-size:16px">🎫 グッズチケットのゲット方法</b>
      <ol style="margin:8px 0 10px;padding-left:1.4em;font-size:14px">
        <li><b>BASEで500円のステッカーを買う</b><br><small>1セット買うと、チケット1枚を申請できます</small></li>
        <li>「グッズガチャ」を開いて、バナーの下の<b>「チケットを申請する」</b>を押す</li>
        <li><b>「条件達成」</b>を押して、買ったセットの数を入れて<b>「申請」</b></li>
        <li>ふっかーが確認すると、<b>チケットが届きます！</b><br><small>（1連はチケット1枚・10連はチケット7枚）</small></li>
      </ol>
      ${GD.BUY_URL?`<a class="gd-go" href="${esc(GD.BUY_URL)}" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none;font-size:16px;margin:0 0 8px">🛒 BASEでステッカーを買う</a>`:""}
      <button class="gd-go" type="button" id="gdTreq2" style="font-size:16px;background:#fff">🎫 チケットを申請する</button>
    </div>`;
  { const t2=el.querySelector("#gdTreq2"); if(t2) t2.onclick=()=>{ tap(); treqFlow(); }; }   // 2026-10-30：ホームからも申請できる
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
  el.innerHTML=`<div class="gd-card"><b>ラインナップ</b><div class="gd-line" style="margin-top:8px">${GD.PRIZES.map(p=>`<div class="gd-pz ${soldOut(p,STOCK)?"out":""}" data-out="${p.one?"当選者が出ました！":"品切れ"}"><span class="rk" style="color:${COL[p.r]}">${p.r}賞</span>${p.img?`<img src="${esc(p.img)}" alt="" data-zoom="${p.r}">`:p.r==="D"&&stkPool().length?`<span class="ph">${stkTag(stkPool()[Math.floor(Math.random()*stkPool().length)],1)}</span>`:`<span class="ph">🎁</span>`}${esc(p.name)}${p.one?"<br><small>1名のみ</small>":p.max?`<br><small style="color:#c62828">残り${leftOf(p,STOCK)}個</small>`:""}</div>`).join("")}</div>
      <p style="font-size:12px;margin:0">S賞とA賞は1人だけ当選します。B賞とC賞は数に限りがあります。当選者が出たり品切れになったりすると、その景品はモノクロになります。</p></div>
    <div style="text-align:center;font-weight:900;margin:0 0 8px">所持チケット 🎫 ${ACC.tk||0}枚</div>
    <div class="gd-pulls"><button type="button" data-n="1" ${(ACC.tk||0)<GD.ONE?"disabled":""}>1連<small>チケット${GD.ONE}枚</small></button><button type="button" data-n="10" ${(ACC.tk||0)<GD.TEN?"disabled":""}>10連<small>チケット${GD.TEN}枚</small></button></div>
    ${GD.BUY_URL?`<a href="${esc(GD.BUY_URL)}" target="_blank" rel="noopener" style="display:block;border-radius:12px;overflow:hidden;border:3px solid #2b1a06;box-shadow:0 4px 0 #2b1a06"><img src="${esc(GD.BUY_IMG)}" alt="グッズチケットを500円で購入！ 1セット購入でグッズチケット1枚申請できます" style="display:block;width:100%;height:auto"></a><p style="text-align:center;font-weight:900;font-size:13px;margin:8px 0 0">🎫 グッズチケットを500円で購入！</p>`:""}
    <button class="gd-go" type="button" id="gdTreq" style="margin-top:14px">🎫 チケットを申請する</button>
    ${(()=>{ const w=TREQ.filter(x=>x.st==="wait"); return w.length?`<p style="text-align:center;font-weight:900;font-size:13px;margin:8px 0 0;color:#c62828">申請中：${w.reduce((t,x)=>t+(x.n||0),0)}枚（ふっかーの確認待ち）</p>`:""; })()}`;
  el.querySelectorAll("[data-n]").forEach(b=>b.onclick=()=>pull(+b.dataset.n));
  { const tb=el.querySelector("#gdTreq"); if(tb) tb.onclick=()=>{ tap(); treqFlow(); }; }
  el.querySelectorAll("[data-zoom]").forEach(im=>im.onclick=()=>{ const p=pz(im.dataset.zoom), z=document.createElement("div"); z.className="gd-zoom"; z.innerHTML=`<div><img src="${esc(p.img)}" alt=""><p>${p.r}賞　${esc(p.name)}</p></div>`; z.onclick=()=>z.remove(); document.body.appendChild(z); }); }
// 2026-10-29：チケットを申請する（①条件の確認 → ②枚数を入れて申請 → ふっかーの「チケット申請」に届く）
function treqFlow(){ const d=document.createElement("div"); d.className="gd-res";
  d.innerHTML=`<div><h3>🎫 チケットを申請する</h3><p style="font-weight:900;line-height:1.7">500円のステッカー購入が条件です！<br>条件を満たしていないと申請は通りません🙏</p><button type="button" id="trOk">条件達成</button><br><br><button type="button" id="trNo" style="background:#fff">やめる</button></div>`;
  document.body.appendChild(d); d.querySelector("#trNo").onclick=()=>d.remove();
  d.querySelector("#trOk").onclick=()=>{ tap();
    d.innerHTML=`<div><h3>🎫 何枚申請しますか？</h3><p style="font-size:13px">買ったセットの数だけ申請してね（1セット＝1枚）</p>
      <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin:10px 0"><button type="button" id="trM" style="background:#fff;padding:8px 14px">−</button><input id="trN" type="number" inputmode="numeric" min="1" max="99" value="1" style="width:80px;padding:10px;font-size:20px;text-align:center;border:3px solid #2b1a06;border-radius:10px"><button type="button" id="trP" style="background:#fff;padding:8px 14px">＋</button></div>
      <div id="trMsg" style="color:#c62828;font-weight:900;margin:0 0 8px"></div><button type="button" id="trGo">申請</button><br><br><button type="button" id="trNo2" style="background:#fff">やめる</button></div>`;
    const inp=d.querySelector("#trN"), msg=d.querySelector("#trMsg"); d.querySelector("#trNo2").onclick=()=>d.remove();
    d.querySelector("#trM").onclick=()=>{ inp.value=Math.max(1,(+inp.value||1)-1); }; d.querySelector("#trP").onclick=()=>{ inp.value=Math.min(99,(+inp.value||0)+1); };
    d.querySelector("#trGo").onclick=async()=>{ const n=Math.trunc(+inp.value||0); if(n<1||n>99){ msg.textContent="1〜99枚で入れてください"; return; }
      const b=d.querySelector("#trGo"); b.disabled=true;
      try{ const ref=DB.collection("gdtreq").doc(); await withTO(ref.set({uid:MYID, adv:String(myName()||"").slice(0,24), real:String((ACC&&ACC.real)||"").slice(0,40), n, at:gnow(), st:"wait"})); TREQ.unshift({id:ref.id, uid:MYID, n, at:gnow(), st:"wait"}); }
      catch(e){ b.disabled=false; msg.textContent="送れませんでした。少し時間をおいてためしてください"; return; }
      d.remove(); T(`チケット${n}枚を申請しました！ ふっかーの確認をお待ちください`); try{ SFX.coin(); }catch(e){} gachaPage(); }; }; }
let pulling=false;
async function pull(n){ if(pulling) return; pulling=true; tap(); const cost=n===10?GD.TEN:GD.ONE; let got=[], newIds=[], gotStk=[], nAcc=null, nSt=null;
  try{ await DB.runTransaction(async tx=>{ const a=await tx.get(accRef()), s=await tx.get(stockRef()); const acc=a.data(), st=s.exists?s.data():{}; got=[]; newIds=[];
      if(!acc||acc.st!=="ok") throw new Error("not ok"); if((acc.tk||0)<cost) throw new Error("tk");
      const taken={S:!!st.S, A:!!st.A}, setSt={}, used={}; let d=0; const sl=(acc.sl||[]).slice(), pool=stkPool(); gotStk=[];
      for(let i=0;i<n;i++){ let x=Math.random()*100, pick=pz("D");
        for(const p of GD.PRIZES){ if((x-=p.rate)<0){ pick=p; break; } }
        if(pick.one&&taken[pick.r]) pick=pz("D");   // 当選者が出たS賞・A賞の分はD賞になる
        if(pick.max&&((st[pick.r+"n"]||0)+(used[pick.r]||0))>=pick.max) pick=pz("D");   // 品切れのB賞・C賞の分もD賞になる
        if(pick.max){ used[pick.r]=(used[pick.r]||0)+1; setSt[pick.r+"n"]=(st[pick.r+"n"]||0)+used[pick.r]; }
        if(pick.one){ taken[pick.r]=true; setSt[pick.r]=MYID; }
        got.push(pick.r); if(pick.r==="D"){ d++; if(pool.length){ const id=pool[Math.floor(Math.random()*pool.length)]; gotStk.push(id); if(sl.length<GD.STK) sl.push(id); } } }
      tx.update(accRef(),{tk:(acc.tk||0)-cost, stk:sl.length, sl}); nAcc={...acc, tk:(acc.tk||0)-cost, stk:sl.length, sl}; nSt={...st,...setSt};
      if(Object.keys(setSt).length) tx.set(stockRef(),{...st,...setSt});
      got.filter(r=>r!=="D").forEach(r=>{ const ref=DB.collection("gdwin").doc(); newIds.push(ref.id); tx.set(ref,{uid:MYID, adv:String(myName()||"").slice(0,24), r, name:pz(r).name, at:gnow(), st:"won"}); }); }); }
  catch(e){ pulling=false; return T(String(e&&e.message)==="tk"?"グッズチケットが足りません":"通信できませんでした。もう一度ためしてください"); }
  if(nAcc) ACC=nAcc; if(nSt) STOCK=nSt; newIds.forEach((id,i)=>{ const r=got.filter(x=>x!=="D")[i]; WINS.unshift({id, uid:MYID, r, name:pz(r).name, at:gnow(), st:"won"}); });   // 待たずに画面を進める
  pulling=false; load().catch(()=>{});
  const cnt={}; got.forEach(r=>cnt[r]=(cnt[r]||0)+1); const real=got.filter(r=>r!=="D").length;
  { const best=["S","A","B","C"].find(r=>cnt[r]); await packFx(best==="S"?"S":best==="A"?"A":best?"B":"D", n, best?pz(best).img:(gotStk[0]!=null?stkImg(gotStk[0]):"")); }   // 2026-10-29：パックを開ける演出（ゲームの魔物パックと同じ）
  const d=document.createElement("div"); d.className="gd-res";
  d.innerHTML=`<div><h3>${real?"🎉 グッズが当たった！":"結果"}</h3><div class="gd-rl">${["S","A","B","C","D"].filter(r=>cnt[r]).map(r=>`<div class="gd-ri" style="border-color:${COL[r]}"><b style="color:${COL[r]}">${r}賞</b>${esc(pz(r).name)}<br>×${cnt[r]}</div>`).join("")}</div>
    ${cnt.D?`<p style="font-weight:900">🏷 デジタルステッカーを${cnt.D}枚ゲット！<br><small>ステッカー集めの枠に自動で貼られました</small></p><div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:0 0 12px">${gotStk.map((id,i)=>`<div style="width:56px;height:56px;display:grid;place-items:center">${stkTag(id,i+3)}</div>`).join("")}</div>`:""}
    ${real?`<p style="font-weight:900">郵送申請すると、グッズが届きます！<br><small>送料無料です！</small></p><button type="button" id="gdMailAll">郵送申請する</button><br><br>`:""}
    <button type="button" id="gdOk" style="background:#fff">${real?"あとで":"OK"}</button></div>`;
  document.body.appendChild(d); try{ SFX.reveal(cnt.S||cnt.A?"Z":real?"S":"A"); }catch(e){}
  d.querySelector("#gdOk").onclick=()=>{ d.remove(); gachaPage(); };
  const ma=d.querySelector("#gdMailAll"); if(ma) ma.onclick=async()=>{ ma.disabled=true; for(const id of newIds){ try{ await withTO(DB.doc("gdwin/"+id).update({st:"req", reqAt:gnow()})); }catch(e){} } await load(); d.remove(); T("郵送申請しました！ 申請済みグッズに追加されました"); gachaPage(); }; }

// パックを開ける演出：ゲームの魔物パックと同じクラフトのパック。上の切り込みを指で横になぞって開ける
// D賞だけ＝ふつうの茶色／B・C賞＝銀色のキラキラ／A賞＝金色のキラキラ／S賞＝虹色の超キラキラ
const PK={D:{c:"",n:0,lab:"GOODS PACK"}, B:{c:"silver",n:16,lab:"SILVER GOODS PACK"}, A:{c:"gold",n:26,lab:"GOLD GOODS PACK"}, S:{c:"rainbow",n:46,lab:"RAINBOW GOODS PACK"}};
function packFx(tier,n,img){ return new Promise(done=>{ const k=PK[tier]||PK.D;
  const el=document.createElement("div"); el.className=`pk-stage gdp ${k.c}`; el.setAttribute("role","dialog"); el.setAttribute("aria-label","パックを開ける");
  const sp=Array.from({length:k.n},()=>`<i class="gdp-sp" style="left:${(Math.random()*110-5).toFixed(1)}%;top:${(Math.random()*110-5).toFixed(1)}%;animation-delay:${(Math.random()*1.6).toFixed(2)}s;--s:${(0.6+Math.random()*1.3).toFixed(2)}"></i>`).join("");
  el.innerHTML=`<div class="pk-title">${tier==="S"?"★ グッズパック ★":tier==="A"?"✨ グッズパック ✨":"グッズパック"}</div>
    <div class="pk-wrap" style="--pk:url('${typeof PACK_IMG!=="undefined"?PACK_IMG:""}')">
      ${n>=10?`<div class="pk-ghost g2"></div><div class="pk-ghost g1"></div>`:""}
      <div class="pk">
        <div class="pk-glow ${tier==="S"?"z":""}"></div>
        ${img?`<img class="pk-card" src="${img}" alt="">`:""}
        <div class="pk-body"><div class="pk-label">${k.lab}<b>${n===1?"1連":n+"連"}</b></div></div>
        <div class="pk-strip"><div class="pk-cut"></div></div>
        <div class="gdp-shine"></div>${sp}
        <div class="pk-finger" aria-hidden="true">👆</div>
      </div>
    </div>
    <p class="pk-hint">上の切り込みを、指で横になぞって開けよう</p>
    <button class="pk-skip" type="button">なぞれないときはタップで開ける</button>`;
  document.body.appendChild(el);
  const pk=el.querySelector(".pk"), strip=el.querySelector(".pk-strip"), cut=el.querySelector(".pk-cut"), big=tier!=="D";
  let opened=false, drag=null, lastX=0, run=0;
  const S_=(f,...a)=>{ try{ SFX[f](...a); }catch(e){} };
  const open=()=>{ if(opened) return; opened=true;
    el.classList.add("opened"); strip.classList.add(drag&&drag.dir<0?"gone-l":"gone-r"); S_("rip");
    if(big) setTimeout(()=>{ el.classList.add("shine"); S_("sparkle"); },420);
    setTimeout(()=>{ el.classList.add("fade"); setTimeout(()=>{ el.remove(); done(); },260); }, tier==="S"?2600:tier==="A"?2200:big?1900:1400); };
  strip.addEventListener("pointerdown",e=>{ if(opened) return; e.preventDefault(); strip.setPointerCapture(e.pointerId);
    const r=pk.getBoundingClientRect(); drag={x0:e.clientX, min:e.clientX, max:e.clientX, w:r.width, left:r.left, dir:0}; lastX=e.clientX; run=0; el.classList.add("touching"); });
  strip.addEventListener("pointermove",e=>{ if(!drag||opened) return;
    const x=Math.max(drag.left,Math.min(drag.left+drag.w,e.clientX));
    drag.min=Math.min(drag.min,x); drag.max=Math.max(drag.max,x); drag.dir=x-drag.x0;
    run+=Math.abs(x-lastX); lastX=x; while(run>9){ run-=9; S_("tear",.7+Math.random()*.4); }
    const prog=(drag.max-drag.min)/drag.w;
    cut.style.left=((drag.min-drag.left)/drag.w*100)+"%"; cut.style.width=(prog*100)+"%";
    strip.style.transform=`translateY(${-prog*3}px) rotate(${(drag.dir<0?1:-1)*prog*2.5}deg)`;
    if(prog>=0.72) open(); });
  const end=()=>{ if(!opened && drag){ strip.style.transform=""; } drag=opened?drag:null; el.classList.remove("touching"); };
  strip.addEventListener("pointerup",end); strip.addEventListener("pointercancel",end);
  el.querySelector(".pk-skip").onclick=open; }); }
const pkCss=document.createElement("style");
pkCss.textContent=`
.pk-stage.gdp{z-index:238}
.pk-stage.gdp.silver{background:radial-gradient(circle at 50% 45%,#4a5560,#0b0d10 72%)}
.pk-stage.gdp.gold{background:radial-gradient(circle at 50% 45%,#5a4210,#140d02 72%)}
.pk-stage.gdp.rainbow{background:radial-gradient(circle at 50% 45%,#3a1d5c,#07020f 72%)}
.pk-stage.gdp.silver .pk-body,.pk-stage.gdp.silver .pk-strip,.pk-stage.gdp.silver .pk-ghost{filter:grayscale(1) brightness(1.45) contrast(1.15)}
.pk-stage.gdp.gold .pk-body,.pk-stage.gdp.gold .pk-strip,.pk-stage.gdp.gold .pk-ghost{filter:sepia(1) saturate(2.6) hue-rotate(-8deg) brightness(1.05) contrast(1.2)}
.pk-stage.gdp.rainbow .pk-body,.pk-stage.gdp.rainbow .pk-strip,.pk-stage.gdp.rainbow .pk-ghost{filter:sepia(1) saturate(4) brightness(1.15) contrast(1.1);animation:gdpHue 2.4s linear infinite}
@keyframes gdpHue{from{filter:sepia(1) saturate(4) brightness(1.15) contrast(1.1) hue-rotate(0deg)}to{filter:sepia(1) saturate(4) brightness(1.15) contrast(1.1) hue-rotate(360deg)}}
.pk-stage.gdp.silver .pk-title{color:#eef4f8;text-shadow:0 0 10px #cfe3ff,0 0 22px #9fc4ff88}
.pk-stage.gdp.gold .pk-title{color:#ffe27a;text-shadow:0 0 10px #ffc83d,0 0 22px #ff9d0088}
.pk-stage.gdp.rainbow .pk-title{background:linear-gradient(90deg,#ff5f6d,#ffc371,#fff96b,#5ef08a,#4fc3f7,#b388ff,#ff5f6d);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:gdpSh 2s linear infinite}
.gdp-shine{position:absolute;inset:0;z-index:4;pointer-events:none;border-radius:inherit;opacity:0}
.pk-stage.gdp.silver .gdp-shine,.pk-stage.gdp.gold .gdp-shine,.pk-stage.gdp.rainbow .gdp-shine{opacity:1;background:linear-gradient(115deg,transparent 30%,#ffffffaa 45%,transparent 60%);background-size:250% 100%;animation:gdpSh 2.2s linear infinite;mix-blend-mode:screen}
.pk-stage.gdp.gold .gdp-shine{animation-duration:1.7s}
.pk-stage.gdp.rainbow .gdp-shine{background:linear-gradient(115deg,#ff5f6d55,#ffc37155,#fff96b55,#5ef08a55,#4fc3f755,#b388ff55,#ff5f6d55);background-size:300% 100%;animation-duration:1.3s;mix-blend-mode:color}
@keyframes gdpSh{from{background-position:200% 0}to{background-position:-100% 0}}
.pk-stage.gdp.silver .pk-wrap{filter:drop-shadow(0 0 16px #dcecffcc)}
.pk-stage.gdp.gold .pk-wrap{filter:drop-shadow(0 0 24px #ffd54fdd)}
.pk-stage.gdp.rainbow .pk-wrap{filter:drop-shadow(0 0 22px #fff) drop-shadow(0 0 46px #f0f) ;animation:gdpGlow 1.6s linear infinite}
@keyframes gdpGlow{0%{filter:drop-shadow(0 0 22px #fff) drop-shadow(0 0 46px #ff4fa3)}33%{filter:drop-shadow(0 0 22px #fff) drop-shadow(0 0 46px #4fc3f7)}66%{filter:drop-shadow(0 0 22px #fff) drop-shadow(0 0 46px #7cff6b)}100%{filter:drop-shadow(0 0 22px #fff) drop-shadow(0 0 46px #ff4fa3)}}
.gdp-sp{position:absolute;width:calc(15px*var(--s));height:calc(15px*var(--s));z-index:5;pointer-events:none;background:radial-gradient(#fff 0 18%,transparent 20%),conic-gradient(from 45deg,transparent 0 10%,#fff 12%,transparent 14% 35%,#fff 37%,transparent 39% 60%,#fff 62%,transparent 64% 85%,#fff 87%,transparent 89%);border-radius:50%;opacity:0;animation:gdpTw 1.6s ease-in-out infinite;transform:translate(-50%,-50%)}
.pk-stage.gdp.gold .gdp-sp{filter:drop-shadow(0 0 3px #ffd54f)}
.pk-stage.gdp.rainbow .gdp-sp{filter:drop-shadow(0 0 4px #f0f) drop-shadow(0 0 4px #0ff);animation-duration:1.1s}
@keyframes gdpTw{0%,100%{opacity:0;transform:translate(-50%,-50%) scale(.3) rotate(0)}50%{opacity:1;transform:translate(-50%,-50%) scale(1) rotate(90deg)}}
.pk-stage.gdp.opened .gdp-shine,.pk-stage.gdp.opened .gdp-sp{opacity:0;transition:opacity .3s}
`;
document.head.appendChild(pkCss);

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
  TREQ.filter(r=>(r.st==="ok"||r.st==="ng")&&!S.gdSeen["tr"+r.id]).forEach(r=>{ S.gdSeen["tr"+r.id]=1; msgs.push(r.st==="ok"?`🎫 申請したチケット${r.n}枚が届きました！`:`🙏 チケット${r.n}枚の申請は通りませんでした（条件を確認してね）`); });
  if(ACC&&ACC.cp&&ACC.cp.st==="sent"&&!S.gdSeen["cp"+ACC.cp.at]){ S.gdSeen["cp"+ACC.cp.at]=1; msgs.push(`🎟 クーポンコードが届きました！<br><b translate="no" style="font-size:20px;color:#1565c0">${esc(ACC.cp.code||"")}</b>`); }
  if(!msgs.length) return; save();
  const d=document.createElement("div"); d.className="gd-res"; d.innerHTML=`<div><h3>🛍 お知らせ</h3><p style="line-height:1.8">${msgs.join("<br>")}</p><button type="button">OK</button></div>`;
  document.body.appendChild(d); d.querySelector("button").onclick=()=>d.remove(); }catch(e){} }

/* ---------- ふっかー：グッズ管理 ---------- */
let AT="treq";
// 2026-10-30：速く開く：前に読んだ内容ですぐ出して、3つを同時に読みなおす（当たった景品は郵送申請と発送ずみだけ読む）
let ADMC=null;
async function admin(){ if(!DB||!dexPeek()) return; const el=shell("🛍 グッズ管理（ふっかー）");
  if(ADMC) adminDraw(el,...ADMC); else el.innerHTML=`<div class="gd-card">読み込み中…</div>`;
  let A, W, R; try{ const [a,w,r]=await Promise.all([withTO(DB.collection("gdacc").get()), withTO(DB.collection("gdwin").where("st","in",["req","sent"]).get()).catch(()=>withTO(DB.collection("gdwin").get())), withTO(DB.collection("gdtreq").get()).catch(()=>({docs:[]}))]);
    A=a.docs.map(d=>({id:d.id,...d.data()})); W=w.docs.map(d=>({id:d.id,...d.data()})); R=r.docs.map(d=>({id:d.id,...d.data()})); }
  catch(e){ if(!ADMC) el.innerHTML=`<div class="gd-card">読み込めませんでした（Firestoreのルールを確認してください）</div>`; return; }
  ADMC=[A,W,R]; if(V&&V.contains(el)) adminDraw(el,A,W,R); }
function adminDraw(el,A,W,R){
  const nk=t=>String(t||"").normalize("NFKC").toLowerCase().replace(/\s+/g,""), same={}; A.forEach(a=>{ same[nk(a.real)]=(same[nk(a.real)]||0)+1; });
  const who=a=>`<b translate="no">${esc(a.adv||"?")}</b><br><small>本名：<span translate="no">${esc(a.real||"")}</span>${same[nk(a.real)]>1?` <b style="color:#c62828">（同じ本名${same[nk(a.real)]}人）</b>`:""}</small>`;
  const nm=uid=>{ const a=A.find(x=>x.id===uid); return a?who(a):esc(uid); };
  const tabs=[["treq",`チケット申請 ${R.filter(r=>r.st==="wait").length}`],["wait",`承認待ち ${A.filter(a=>a.st!=="ok").length}`],["users",`冒険者・チケット ${A.filter(a=>a.st==="ok").length}`],["mail",`郵送申請 ${W.filter(w=>w.st==="req").length}`],["cp",`クーポン申請 ${A.filter(a=>a.cp&&a.cp.st==="wait").length}`]];
  const body=()=>{ if(AT==="treq"){ const L=[...R.filter(r=>r.st==="wait").sort((a,b)=>(b.at||0)-(a.at||0)), ...R.filter(r=>r.st!=="wait").sort((a,b)=>(b.okAt||b.at||0)-(a.okAt||a.at||0)).slice(0,30)];   /* 2026-10-30：送った・却下の履歴は30件まで */ return L.length?L.map(r=>`<div class="gd-it"><b>${nm(r.uid)}<br><small>🎫 <b style="font-size:15px">${r.n}枚</b>の申請 ・ ${new Date(r.at||0).toLocaleString("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}</small></b>${r.st==="wait"?`<button class="gd-mini" type="button" data-trok="${r.id}">承認して送る</button><button class="gd-mini" type="button" data-trng="${r.id}" style="background:#fff">却下</button>`:r.st==="ok"?`<span class="gd-tag sent">送った</span>`:`<span class="gd-tag">却下</span>`}</div>`).join(""):"<p>チケット申請はありません</p>"; }
    if(AT==="wait"){ const L=A.filter(a=>a.st!=="ok"); return L.length?L.map(a=>`<div class="gd-it"><b>${who(a)}<br><small style="opacity:.6">${new Date(a.at||0).toLocaleString("ja-JP")}</small></b><button class="gd-mini" type="button" data-ok="${a.id}">承認する</button></div>`).join(""):"<p>承認待ちはいません</p>"; }
    if(AT==="users"){ const L=A.filter(a=>a.st==="ok"); return L.length?L.map(a=>`<div class="gd-it"><b>${who(a)}<br><small>🎫 のこり${a.tk||0}枚 ・ 🏷 ${a.stk||0}/${GD.STK}<br>📤 ふっかーが送った合計 <b>${(a.given||0).toLocaleString()}枚</b>${(a.gl||[]).length?`<br><span style="opacity:.7">${(a.gl||[]).filter(x=>x&&!Array.isArray(x)).slice(-3).reverse().map(({t,n})=>`${new Date(t).toLocaleString("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})} ${n>0?"+":""}${n}枚`).join("／")}</span>`:""}</small></b><input type="number" inputmode="numeric" min="-999" max="999" value="1" data-tkn="${a.id}" style="width:64px;padding:8px 6px;font-size:16px;border:2px solid #2b1a06;border-radius:8px;text-align:center">枚<button class="gd-mini" type="button" data-tk="${a.id}">送る</button></div>`).join(""):"<p>まだいません</p>"; }
    if(AT==="mail"){ const L=W.filter(w=>w.st==="req"||w.st==="sent").sort((a,b)=>(a.st==="sent")-(b.st==="sent")||(b.reqAt||0)-(a.reqAt||0)); return L.length?L.map(w=>`<div class="gd-it"><span style="font-size:20px;font-weight:900;color:${COL[w.r]}">${w.r}</span><b>${esc(w.name||"")}<br><small>${nm(w.uid)}</small></b>${w.st==="sent"?`<span class="gd-tag sent">発送済み</span>`:`<button class="gd-mini" type="button" data-ship="${w.id}">発送</button>`}</div>`).join(""):"<p>郵送申請はありません</p>"; }
    const L=A.filter(a=>a.cp); return L.length?L.map(a=>`<div class="gd-it"><b>${who(a)}</b>${a.cp.st==="sent"?`<span class="gd-tag code">送った：${esc(a.cp.code||"")}</span>`:`<button class="gd-mini" type="button" data-cp="${a.id}">コードを送る</button>`}</div>`).join(""):"<p>クーポン申請はありません</p>"; };
  const draw=()=>{ el.innerHTML=`<div class="gd-tabs">${tabs.map(([k,t])=>`<button type="button" class="${AT===k?"on":""}" data-at="${k}">${t}</button>`).join("")}</div><div class="gd-card">${body()}</div>`;
    el.querySelectorAll("[data-at]").forEach(b=>b.onclick=()=>{ AT=b.dataset.at; draw(); });
    el.querySelectorAll("[data-ok]").forEach(b=>b.onclick=async()=>{ b.disabled=true; try{ await withTO(DB.doc("gdacc/"+b.dataset.ok).update({st:"ok", okAt:gnow()})); T("承認しました"); }catch(e){ T("できませんでした"); } admin(); });
    el.querySelectorAll("[data-trok]").forEach(b=>b.onclick=async()=>{ const r=R.find(x=>x.id===b.dataset.trok); if(!r) return; b.disabled=true;
      try{ await DB.runTransaction(async tx=>{ const rq=DB.doc("gdtreq/"+r.id), ac=DB.doc("gdacc/"+r.uid); const [x,a]=[await tx.get(rq), await tx.get(ac)]; if(!x.exists||x.data().st!=="wait") throw new Error("done"); const cur=a.data()||{};
          tx.update(ac,{tk:(cur.tk||0)+r.n, given:(cur.given||0)+r.n, gl:[...(cur.gl||[]).filter(z=>z&&!Array.isArray(z)),{t:gnow(),n:r.n}].slice(-20)}); tx.update(rq,{st:"ok", okAt:gnow()}); });
        T(`チケット${r.n}枚を送りました`); }catch(e){ T(String(e&&e.message)==="done"?"もう対応ずみです":"できませんでした"); } admin(); });
    el.querySelectorAll("[data-trng]").forEach(b=>b.onclick=async()=>{ b.disabled=true; try{ await withTO(DB.doc("gdtreq/"+b.dataset.trng).update({st:"ng", okAt:gnow()})); T("却下しました"); }catch(e){ T("できませんでした"); } admin(); });
    el.querySelectorAll("[data-tk]").forEach(b=>b.onclick=async()=>{ const id=b.dataset.tk, n=Math.trunc(+((el.querySelector(`[data-tkn="${id}"]`)||{}).value||0));
      if(!n) return T("枚数を入れてください"); b.disabled=true;
      try{ let after=0; await DB.runTransaction(async tx=>{ const r=DB.doc("gdacc/"+id), sn=await tx.get(r); const cur=sn.data()||{}; after=Math.max(0,(cur.tk||0)+n); const real=after-(cur.tk||0); tx.update(r,{tk:after, given:(cur.given||0)+Math.max(0,real), gl:[...(cur.gl||[]).filter(x=>x&&!Array.isArray(x)),{t:gnow(),n:real}].slice(-20)}); });   // 送った合計と記録
        T(n>0?`チケットを${n}枚わたしました（のこり${after}枚）`:`チケットを${-n}枚へらしました（のこり${after}枚）`); }catch(e){ T("できませんでした"); } admin(); });   // 2026-10-29：送る枚数を自由に（マイナスでへらせる）
    el.querySelectorAll("[data-ship]").forEach(b=>b.onclick=async()=>{ if(!confirmBox("発送済みにしますか？")) return; b.disabled=true; try{ await withTO(DB.doc("gdwin/"+b.dataset.ship).update({st:"sent", sentAt:gnow()})); T("発送済みにしました"); }catch(e){ T("できませんでした"); } admin(); });
    el.querySelectorAll("[data-cp]").forEach(b=>b.onclick=async()=>{ const a=A.find(x=>x.id===b.dataset.cp); askCode(a); }); };
  const askCode=a=>{ const d=document.createElement("div"); d.className="gd-res"; d.innerHTML=`<div><h3>🎟 クーポンコードを送る</h3><p>${who(a)}</p><input type="text" id="gdCode" maxlength="40" style="width:100%;box-sizing:border-box;padding:10px;font-size:16px;border:3px solid #2b1a06;border-radius:10px;margin:8px 0" placeholder="クーポンコード"><button type="button" id="gdCs">送る</button> <button type="button" id="gdCn" style="background:#fff">やめる</button></div>`;
    document.body.appendChild(d); d.querySelector("#gdCn").onclick=()=>d.remove();
    d.querySelector("#gdCs").onclick=async()=>{ const c=d.querySelector("#gdCode").value.trim(); if(!c) return; try{ await withTO(DB.doc("gdacc/"+a.id).update({cp:{st:"sent", at:a.cp.at||gnow(), code:c.slice(0,40), sentAt:gnow()}})); T("クーポンコードを送りました"); }catch(e){ T("できませんでした"); } d.remove(); admin(); }; };
  draw(); }
const confirmBox=t=>true;   // ダイアログは使わない（画面が止まるのを防ぐ）

/* ---------- 2026-10-29：ふっかーの試しのデータをリセット（1回だけ） ----------
   当たった景品は「void」にして一覧から消す・S賞/A賞の当選者とB賞/C賞の数を0に・チケット/ステッカー/クーポン/送った記録を0に（登録と承認はそのまま） */
async function resetFukka(){ try{ if(!DB||!MYID||typeof dexPeek!=="function"||!dexPeek()||S.gdReset1029) return;
  const q=await withTO(DB.collection("gdwin").where("uid","==",MYID).get());
  for(const d of q.docs){ if((d.data()||{}).st!=="void") await withTO(DB.doc("gdwin/"+d.id).update({st:"void"})); }
  await withTO(stockRef().set({S:null, A:null, Bn:0, Cn:0}));
  const a=await withTO(accRef().get()); if(a.exists) await withTO(accRef().update({tk:0, stk:0, sl:[], given:0, gl:[], cp:firebase.firestore.FieldValue.delete()}));
  S.gdReset1029=1; S.gdSeen={}; delete S.gdCache; save(); }catch(e){} }
// 2026-10-30：おじおじさんのグッズ特典の登録を消す（ふっかーが開いたときに1回だけ）
async function delOjiOji(){ try{ if(!DB||!MYID||typeof dexPeek!=="function"||!dexPeek()||S.gdDelOji) return;
  const q=await withTO(DB.collection("gdacc").get()); for(const d of q.docs){ const x=d.data()||{}; if(normName(x.adv)===normName("おじおじ")) await withTO(DB.doc("gdacc/"+d.id).delete()); }
  S.gdDelOji=1; save(); ADMC=null; }catch(e){} }
setTimeout(function tryDel(){ if(typeof DB!=="undefined"&&DB&&MYID) delOjiOji(); else setTimeout(tryDel,3000); }, 5000);
setTimeout(function tryReset(){ if(typeof DB!=="undefined"&&DB&&MYID) resetFukka(); else setTimeout(tryReset,3000); }, 4000);

// ふっかーのタイトルの「グッズ管理」に、対応が必要な数の赤い印
async function admBadge(){ try{ const b=document.getElementById("ttlGdAdmB"); if(!b||!DB||!MYID||typeof dexPeek!=="function"||!dexPeek()) return;
  const [r,a,w]=await Promise.all([DB.collection("gdtreq").where("st","==","wait").get().catch(()=>({size:0,docs:[]})), DB.collection("gdacc").get().catch(()=>({docs:[]})), DB.collection("gdwin").where("st","==","req").get().catch(()=>({size:0}))]);
  const n=r.size+a.docs.filter(d=>{ const x=d.data(); return x.st!=="ok"||(x.cp&&x.cp.st==="wait"); }).length+w.size; b.textContent=n>99?"99+":String(n); b.hidden=!n; }catch(e){} }
setTimeout(admBadge,6000); setInterval(()=>{ if(document.querySelector("#title:not([hidden])")) admBadge(); },60000);

/* ---------- タイトルのボタン ---------- */
setInterval(()=>{ const b=document.getElementById("ttlGd"), m=document.getElementById("ttlGdAdm"); const on=!!(typeof DB!=="undefined"&&DB&&MYID)&&canSee();
  if(b&&b.hidden===on) b.hidden=!on; const am=!!(typeof DB!=="undefined"&&DB&&MYID)&&typeof dexPeek==="function"&&dexPeek(); if(m&&m.hidden===am) m.hidden=!am; }, 1500);
document.addEventListener("click",e=>{ if(e.target.closest("#ttlGd")){ tap(); open(); } else if(e.target.closest("#ttlGdAdm")){ tap(); admin(); } });
window.__gd={GD,open,admin,packFx};
})();
