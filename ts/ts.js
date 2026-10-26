/* ===================== トトの戦略（試作・まだ公開しない） =====================
   ① 準備（3分）：赤いマスの中に、図鑑で解放した魔物を置く（魔物ごとに大きさがある・合わせて20体まで）
      マスははじめ横10×縦5。横は最大30・縦は最大40。1列ふやすごとに10万コイン
      魔物を置くのにかかるコイン＝その魔物の売却価格の5倍（取り除いてもコインはもどらない）
   ② 準備完了 → ほかの冒険者の配置（いなければCPU）とバトル（1分）。魔物は自動で動く
      勝ち：相手の魔物をぜんぶ倒す。1分で決まらなければ、のこった体力ゲージの合計が多いほうの勝ち
   ・二本指で拡大・縮小（1本指でドラッグすると画面を動かせる）
   ・攻撃力と体力は、図鑑の全冒険者の獲得数で決まる（売却価格と同じ。めずらしい魔物ほど強い）
   ・移動の速さ・攻撃のとどく距離・大きさ・空を飛ぶかは TS_MON で魔物ごとに決められる（なければランクのきまり）
   データ：S.ts = { cols, rows, units:[{u,id,c,r}] }。Firestore tsp/{uid} に準備完了した配置を保存（相手として使う） */
(function(){
const T = (ja,en) => (typeof LANG!=="undefined" && LANG==="en") ? en : ja;
const esc3 = t => String(t??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = n => Math.round(n).toLocaleString();
const now = () => (typeof gnow==="function" ? gnow() : Date.now());

const TS = { COLS0:10, ROWS0:5, COLS_MAX:30, ROWS_MAX:40, EXPAND_COST:100000, MAX_UNITS:10, MAX_KINDS:5, MAX_MON:5, MAX_ITEM:5, MAX_PER:2, MAX_LTD:1, GEN:2, MAX_FLY:1, COST_MUL:5, MIN_READY:5,
  UNDER:-1, PREP_MS:3*60000,   // UNDER：赤いマスは土の中にも1マス（r=-1）
  BATTLE_MS:60000, CS:64, GAP:8 };
// ランクごとのきまり：w×h＝置くときのマスの大きさ、spd＝1秒に進むマス、range＝攻撃がとどく距離（マス）、cd＝攻撃の間かく（秒）
const TS_RANK = {
  C:{w:1,h:1,spd:1.1,range:0.6,cd:1.0}, B:{w:1,h:1,spd:1.0,range:0.8,cd:1.0}, A:{w:2,h:2,spd:0.9,range:1.0,cd:1.1},
  S:{w:2,h:2,spd:0.85,range:1.5,cd:1.1}, Z:{w:3,h:3,spd:0.7,range:2.0,cd:1.2}, L:{w:3,h:3,spd:0.7,range:2.2,cd:1.2} };
// 魔物ごとのきまり（ここに書いた魔物は、ランクのきまりより優先）。例：{ 42:{ fly:true, spd:1.4, range:3 } }
// 置ける場所：ふつうは地面の上のマスだけ。fly:true＝空中のマスにも置ける・under:true＝土の中のマスにも置ける
// 向き：自分の魔物はいつも右向き、相手の魔物はいつも左向き（u.face=u.side?-1:1）
const TS_MON = {
  10:{ w:1, h:1, spd:1.0, anim:"ts10", melee:true, atkMap:[0,1,2,3,3,2,1,0,9,9] },
  42:{ w:2, h:2, spd:0.35, anim:"ts42", fly:true, still:true, drawH:2.3, atkMul:0.93, rock:true,
       zone:{abs:true, cells:[[2,0,1],[2,1,1],[3,0,1],[4,0,1],[5,0,0]]} },   // 42：2×2・空を飛ぶ・めっちゃ遅い・攻撃力少しだけ低め。地面から岩をつき出す。abs＝高さは地面から数える（0＝地面のすぐ上の段）。3つ目が1＝矢印（貫通：そのマスの相手ぜんぶ）、0＝点（いちばん近い1体）
  47:{ w:2, h:2, spd:0.65, anim:"ts47", fly:true, still:true, atkMul:1.15, fire:true, atkMap:[0,1,2,3,4,5,5,5,4,9],
       zone:{cells:[[1,1],[2,1],[1,0],[2,0],[3,0],[4,0],[2,-1],[3,-1],[4,-1]]} },   // 夕焼けドラゴン：2×2・空を飛ぶ・ゆっくり・攻撃力やや高め。炎をはく。cells＝[前に何マス目, 体の下の段から何段上]（-1は1つ下）。範囲にいる相手のうち、いちばん近い1体に当たる
  4:{ w:2, h:1, spd:1.5, anim:"ts4", drawH:1.8, zone:{x:1,up:1}, atkMap:[1,2,2,3,4,5,5,6,7,7] },   // 魔術師ウルフールーパー：横2×縦1マス・移動が早い・かむ攻撃（2〜8コマ目だけ使う）。前1マスの同じ高さと1つ上の2マスにいる相手のうち、いちばん近い1体に当たる
  93:{ w:1, h:1, spd:1.0, anim:"ts93", drawH:1.6, zone:{x:2,up:1} },   // うさぎメイド：移動ふつう・けりの攻撃。前2マス×（同じ高さ＋1つ上）の4マスにいる相手のうち、いちばん近い1体に当たる
  88:{ w:1, h:1, spd:0.5, anim:"ts88", shot:true, rays:[[0.15,1.5],[1.5,1.5],[2.5,1.5],[2.5,0.5]], atkMul:0.85 },   // 始まりキノコ：とても遅い・攻撃力やや低め。前のマスのすみから4本の線（前1・2・3マスの1つ上、前3マスの同じ高さ）の方向に魔法の玉を1発ずつ同時に撃つ。どの線も先の丸まで届き、線の上のいちばん近い1体に当たる
  63:{ w:1, h:1, spd:0.8, anim:"ts63", fly:true, diag:true, flyLoop:[1,2,3,4,5,6,7,8] },   // 羽スライム：やや遅め・1×1。空中にも置ける。置いた高さのまま飛び、前の1マスと斜め前下の1マスにいる相手を攻撃   // ドットスライム：近距離攻撃・移動速度ふつう・1×1マス・歩きと攻撃のアニメ（右向きの絵）
};
// 歩き・攻撃のコマ（[中心x, 足もとy]・大きさ）。攻撃の8・9コマ目はエフェクトだけの絵なので、体（攻撃1コマ目）の前に重ねる
const TS_ANIM = { ts47:{"size":{"a0":[171,200],"a1":[184,206],"a2":[166,187],"a3":[171,187],"a4":[179,191],"a5":[210,183],"a6":[216,188],"a7":[212,183],"a8":[178,180],"a9":[173,183],"w0":[223,153],"w1":[222,173],"w2":[210,214],"w3":[213,227],"w4":[232,163],"w5":[208,161],"w6":[254,141],"w7":[240,130],"w8":[215,168],"w9":[187,214]},"a":[[88.5,200.0],[81.0,206.0],[85.0,187.0],[83.0,187.0],[94.0,191.0],[102.0,183.0],[108.0,188.0],[108.0,183.0],[88.5,180.0],[79.5,183.0]],"w":[[88.5,170.0],[70.5,186.0],[88.5,224.0],[99.5,240.0],[120.5,174.0],[99.5,174.0],[96.5,141.0],[83.5,131.0],[100.0,175.0],[97.5,221.0]]}, ts42:{"size":{"w0":[183,219],"w1":[178,208],"w2":[180,209],"w3":[193,225],"w4":[200,222],"w5":[206,215],"w6":[189,204],"w7":[208,201],"w8":[193,208],"w9":[168,223]},"w":[[97.5,228.0],[89.0,216.0],[88.5,214.0],[61.5,228.0],[95.5,228.0],[94.5,224.0],[79.0,211.0],[94.0,201.0],[61.5,224.0],[77.5,228.0]]}, ts10:{"a":[[41.0,67.5],[38.0,57.0],[39.0,50.0],[39.0,75.5],[41.5,52.0],[52.0,62.0],[56.5,67.0],[28.5,62.0],[27.8,65.5],[44.5,69.0]],"w":[[41.0,76.0],[44.5,77.0],[45.5,76.0],[46.5,60.0],[48.0,70.5],[45.5,49.0],[46.0,56.5],[41.0,76.5],[40.0,67.5],[42.5,55.0]],"size":{"a0":[82,68],"a1":[80,58],"a2":[80,51],"a3":[84,76],"a4":[90,53],"a5":[93,62],"a6":[92,68],"a7":[89,63],"a8":[88,66],"a9":[90,70],"w0":[83,76],"w1":[82,78],"w2":[82,77],"w3":[85,60],"w4":[90,71],"w5":[88,50],"w6":[90,57],"w7":[88,77],"w8":[88,68],"w9":[91,56]}}, ts4:{"size":{"a0":[180,202],"a1":[174,191],"a2":[175,191],"a3":[191,202],"a4":[194,198],"a5":[188,197],"a6":[154,186],"a7":[161,181],"a8":[171,192],"a9":[180,202],"w0":[175,201],"w1":[171,201],"w2":[175,201],"w3":[179,208],"w4":[179,217],"w5":[179,215],"w6":[168,200],"w7":[187,201],"w8":[177,199],"w9":[172,201]},"a":[[88.0,202.0],[85.5,191.0],[84.0,191.0],[91.5,202.0],[87.0,198.0],[66.0,197.0],[62.5,186.0],[80.0,181.0],[85.0,192.0],[95.0,202.0]],"w":[[84.5,201.0],[83.5,201.0],[87.5,201.0],[88.5,208.0],[91.0,217.0],[82.0,215.0],[74.5,200.0],[89.0,201.0],[80.0,199.0],[79.0,201.0]]}, ts93:{"size":{"a0":[131,275],"a1":[117,280],"a2":[129,287],"a3":[181,288],"a4":[181,299],"a5":[169,299],"a6":[143,290],"a7":[150,289],"a8":[173,272],"a9":[135,280],"w0":[134,285],"w1":[134,285],"w2":[134,284],"w3":[135,283],"w4":[136,285],"w5":[134,286],"w6":[134,283],"w7":[143,279],"w8":[134,283],"w9":[137,284]},"a":[[69.0,275.0],[58.5,280.0],[72.5,287.0],[88.0,288.0],[84.5,299.0],[80.5,299.0],[81.0,290.0],[95.5,289.0],[82.5,272.0],[62.5,280.0]],"w":[[69.0,285.0],[62.0,285.0],[63.5,284.0],[62.5,283.0],[67.5,285.0],[64.5,286.0],[65.5,283.0],[67.5,279.0],[63.5,283.0],[68.5,284.0]]}, ts88:{"a":[[68.0,151.0],[63.0,146.0],[63.0,180.0],[65.0,216.0],[72.0,239.0],[67.0,141.0],[45.0,141.0],[45.0,138.0],[47.0,136.0],[59.0,145.0]],"size":{"a0":[132,151],"a1":[129,146],"a2":[128,180],"a3":[137,216],"a4":[141,239],"a5":[142,141],"a6":[131,141],"a7":[126,138],"a8":[123,136],"a9":[128,145],"w0":[135,149],"w1":[133,154],"w2":[132,153],"w3":[130,148],"w4":[130,150],"w5":[129,154],"w6":[136,149],"w7":[136,153],"w8":[135,154],"w9":[135,155]},"w":[[63.0,149.0],[63.0,154.0],[59.0,153.0],[56.0,148.0],[56.0,150.0],[54.0,154.0],[55.0,149.0],[67.5,153.0],[64.0,154.0],[64.0,155.0]]}, ts63:{"a":[[41.8,68.5],[42.2,65.0],[38.5,65.0],[42.8,66.5],[44.2,83.5],[43.2,72.5],[43.8,67.0],[42.8,72.0],[43.2,69.0],[39.1,68.0]],"w":[[42.0,65.5],[39.0,65.0],[38.5,60.5],[39.5,61.5],[44.0,49.5],[42.0,59.5],[40.0,61.0],[42.5,66.5],[43.5,67.5],[36.0,65.5]],"size":{"a0":[80,69],"a1":[84,67],"a2":[78,66],"a3":[86,67],"a4":[88,82],"a5":[86,74],"a6":[86,69],"a7":[82,74],"a8":[80,71],"a9":[82,68],"w0":[80,66],"w1":[76,78],"w2":[76,80],"w3":[78,82],"w4":[82,57],"w5":[82,69],"w6":[76,71],"w7":[86,81],"w8":[86,80],"w9":[78,66]}} };
const ROCK_META=[[81.5, 42], [81.0, 75], [87.0, 108], [90.0, 173], [91.5, 246], [103.0, 327], [94.0, 307], [93.5, 246], [90.0, 215], [83.0, 135]];   // 岩の絵の [横のまん中, 高さ]（下が地面）
for(let i=0;i<10;i++) setTimeout(()=>animImg("rock"+i),0);
const FIRE_META=[[89, 62, 28.0], [145, 105, 60.0], [184, 118, 60.0], [275, 151, 77.0], [326, 177, 75.0], [239, 155, 88.0], [228, 139, 69.0], [206, 134, 82.0], [206, 153, 89.0], [179, 152, 107.0]];   // 炎の絵の [横, 縦, 炎のまん中の高さ]（左はしが口）
const FIRE_IMG=[]; const fireImg=i=>{ if(!FIRE_IMG[i]){ const im=new Image(); im.src="ts/fire"+i+".png"; FIRE_IMG[i]=im; } return FIRE_IMG[i]; };
for(let i=0;i<10;i++) setTimeout(()=>fireImg(i),0);
const ANIM_IMG={}; const animImg=n=>{ if(!ANIM_IMG[n]){ const im=new Image(); im.src="ts/"+n+".png"; ANIM_IMG[n]=im; } return ANIM_IMG[n]; };
Object.keys(TS_ANIM).forEach(k=>{ for(let i=0;i<10;i++){ if(TS_ANIM[k].a) animImg(k+"a"+i); animImg(k+"w"+i); } });
// melee:true＝近距離攻撃。絵のまわりの草の分だけ少し重なるくらい（-0.3マス）まで近づいてから攻撃する
/* アイテム（2026-10-25）。図鑑の解放はいらない。cost＝置くのにかかるコイン（仮の値）
   地雷：1×1。土の中にも置ける。相手の地上の魔物が上を通ると爆発して、地雷の上の横3×縦2マスにいる相手の魔物の体力を半分（最大体力の半分）へらす。
         空中の魔物は通っても反応しないが、爆発したときに範囲にいればダメージ。地雷の位置は相手には見えない（自分には見える）
   壁：縦3×横1。相手の地上の魔物は通りぬけられず、こわすまで先に進めない（空中の魔物は飛びこえる）。トゲは相手のほうを向く */
const TS_ITEMS = {
  "i:mine":{ name:"地雷", en:"Mine", img:"ts/mine.png", w:1, h:1, under:true, cost:10000, mine:true },
  "i:wall":{ name:"壁", en:"Wall", img:"ts/wall.png", w:1, h:3, cost:20000, hpPerLv:100, wall:true },   // 耐久力＝置いた冒険者の冒険者レベル×100
};
const isItem = id => typeof id==="string" && !!TS_ITEMS[id];
const nameOf = id => isItem(id) ? T(TS_ITEMS[id].name, TS_ITEMS[id].en) : ((mon(id)||{}).name||"");
const okId = id => isItem(id) || (!!mon(id) && !!TS_MON[id]);
const cfgOf = id => { if(isItem(id)) return Object.assign({fly:false, spd:0, range:0, cd:9}, TS_ITEMS[id]); const m=mon(id), c=Object.assign({fly:false}, TS_RANK[m&&m.rank]||TS_RANK.C, TS_MON[id]||{}); if(c.melee) c.range=-0.3; return c; };
// 強さ：売却価格（＝図鑑の全冒険者の獲得数で決まる）から。めずらしいほど強い
const priceOf = id => { try{ const p=dexPrice(id); if(p!=null) return p; }catch(e){} try{ return sellPrice({m:id}); }catch(e){ return 10; } };
const myLv = () => Math.max(1, Math.floor(S.plv||1));
const statsOf = (id, lv) => { if(isItem(id)){ const it=TS_ITEMS[id]; return { hp:it.hpPerLv?it.hpPerLv*Math.max(1,lv||myLv()):(it.hp||1), atk:0 }; } const k=Math.pow(Math.max(1,priceOf(id)),0.35), c=cfgOf(id), sz=Math.sqrt(c.w*c.h); return { hp:Math.round(60*k*sz), atk:Math.max(1,Math.round(8*k*(c.atkMul||1))) }; };
const costOf = id => { if(isItem(id)) return TS_ITEMS[id].cost; let p=0; try{ p=sellPrice({m:id}); }catch(e){ p=priceOf(id); } return Math.max(1,Math.round(p*TS.COST_MUL)); };

const st = () => { S.ts=S.ts||{}; const t=S.ts; t.cols=t.cols||TS.COLS0; t.rows=t.rows||TS.ROWS0; t.units=(t.units||[]).filter(u=>isItem(u.id)||mon(u.id)); t.nu=t.nu||1;
  // まだトトの戦略に追加していない魔物が置かれていたら外して、払ったコインを返す（2026-10-25）
  const bad=t.units.filter(u=>!okId(u.id)); if(bad.length){ let back=0; bad.forEach(u=>{ back+=costOf(u.id); }); t.units=t.units.filter(u=>okId(u.id)); S.coins=(S.coins||0)+back; try{ save(); }catch(e){} setTimeout(()=>{ try{ coinView(); msg(T(`まだ使えない魔物${bad.length}体を外して、${fmt(back)}コインを返しました`,`Removed ${bad.length} monsters not yet available and refunded ${fmt(back)} coins`)); }catch(e){} },600); }
  return t; };
const IMGS={}; const imgOf = id => { if(!IMGS[id]){ const im=new Image(); const m=isItem(id)?null:mon(id); im.src=isItem(id)?TS_ITEMS[id].img:(m?m.img:""); IMGS[id]=im; } return IMGS[id]; };
Object.keys(TS_ITEMS).forEach(imgOf);
// 地雷が爆発する動き・壁がくずれる動き（各10コマ。[中心x, 下y, 幅, 高さ]）。基準：地雷1コマ目の幅＝1マス、壁1コマ目の高さ＝3マス
const FX = {"mine":[[52.5,42.0,106,40],[50.2,56.7,100,55],[47.8,64.8,97,63],[56.0,77.3,109,75],[55.8,89.6,112,88],[52.3,86.8,114,83],[57.2,86.8,118,85],[54.4,82.6,113,80],[54.8,78.8,115,77],[46.6,70.0,104,68]],"wall":[[19.9,142.1,42,140],[18.2,141.0,43,139],[18.9,137.9,49,136],[21.5,135.1,57,133],[22.9,128.4,58,127],[26.4,113.7,63,112],[31.7,93.1,68,91],[39.4,68.9,75,67],[37.3,57.7,74,55],[36.1,37.1,74,35]]};
const fxImg = (k,i) => imgOf("fx:"+k+i);
(function(){ for(const k in FX) for(let i=0;i<10;i++){ const im=new Image(); im.src=`ts/${k}_x${i}.png`; IMGS["fx:"+k+i]=im; } })();
function drawFx(g,k,i,wx,wy,face,alpha){ const m=FX[k][i], im=fxImg(k,i); if(!im||!im.complete||!im.naturalWidth) return; const z=V.cam.z;
  const big = k==="mine" ? 1+1.6*Math.min(1,Math.max(0,(i-1)/4)) : 1;   // 爆発は、ダメージの範囲（横3マス）くらいまで大きくなる
  const sc=(k==="mine" ? TS.CS/FX.mine[0][2] : TS.CS*3/FX.wall[0][3])*z*big, p=w2s(wx,wy);
  g.save(); g.globalAlpha=alpha??1; g.translate(p.x,p.y); if(face<0) g.scale(-1,1); g.drawImage(im,-m[0]*sc,-m[1]*sc,m[2]*sc,m[3]*sc); g.restore(); }
const deco = (()=>{ const im=new Image(); im.src="adv/toto_s.png"; return im; })();
const grave = (()=>{ const im=new Image(); im.src="mb/grave.png"; return im; })();
function sfx(k){ try{ if(k==="tap") SFX.tap(); else if(k==="coin") SFX.coin(); else if(k==="ng") SFX.ng(); else if(k==="win") SFX.reveal("S"); else if(k==="level") SFX.level(); }catch(e){} }

/* ---------- 画面 ---------- */
const css=document.createElement("style");
css.textContent=`
#tso{position:fixed;inset:0;z-index:150;background:#7cc4f5;touch-action:none;user-select:none;-webkit-user-select:none;font-family:var(--f-body,sans-serif);overflow:hidden}
#tso.embed{position:absolute;inset:0;z-index:1;background:transparent}
#tso.embed #tsX,#tso.embed #tsTm{visibility:hidden}
#tso.embed .ts-top{padding-top:6px}
#tso.embed .ts-panel{padding-bottom:0}
#tso canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
#tso .ts-top{position:absolute;left:0;right:0;top:0;display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:calc(env(safe-area-inset-top,0px) + 8px) max(10px,env(safe-area-inset-right,0px)) 0 max(10px,env(safe-area-inset-left,0px));pointer-events:none}
#tso .ts-top>*{pointer-events:auto}
#tso .ts-b{border:3px solid #3a2306;border-radius:10px;background:#fff8e8;color:#3a2306;font:900 13px/1.2 var(--f-body,sans-serif);padding:6px 10px;cursor:pointer;box-shadow:0 3px 0 #3a2306}
#tso .ts-b:active{transform:translateY(2px);box-shadow:0 1px 0 #3a2306}
#tso .ts-b:disabled{opacity:.5;cursor:default}
#tso .ts-timer{background:#3a3a3aee;color:#fff;border:3px solid #111;border-radius:6px;padding:4px 14px 6px;text-align:center;min-width:120px}
#tso .ts-timer small{display:block;font:700 11px/1.2 var(--f-body,sans-serif);text-align:left;opacity:.9}
#tso .ts-timer b{font:900 24px/1.1 var(--f-body,sans-serif);font-variant-numeric:tabular-nums}
#tso .ts-timer.low b{color:#ff8a6a}
#tso .ts-side{display:flex;flex-direction:column;gap:6px;align-items:flex-end}
#tso .ts-info{background:#0008;color:#fff;border-radius:8px;padding:4px 8px;font:700 11px/1.4 var(--f-body,sans-serif)}
#tso .ts-panel{position:absolute;left:0;right:0;bottom:0;box-sizing:content-box;height:min(34vh,calc((100vw - 12px)*270/1280));background:#b98a5f;display:flex;justify-content:center;padding-bottom:env(safe-area-inset-bottom,0px)}
#tso .ts-pin{position:relative;height:100%;aspect-ratio:1280/270;max-width:100%}
#tso .ts-pin img{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
#tso .ts-hit{position:absolute;background:transparent;border:0;padding:0;cursor:pointer;border-radius:8px}
#tso .ts-hit:active{background:#0002}
#tso .ts-coin{position:absolute;left:2%;top:33%;width:26.6%;height:42.6%;display:flex;align-items:center;justify-content:center;color:#ffd75e;font:900 clamp(13px,5.5vw,28px)/1 var(--f-body,sans-serif);font-variant-numeric:tabular-nums;pointer-events:none}
#tso .ts-msg{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 70px);transform:translateX(-50%);background:#000c;color:#fff;border-radius:10px;padding:8px 14px;font:900 13px/1.4 var(--f-body,sans-serif);pointer-events:none;opacity:0;transition:opacity .2s;text-align:center;max-width:86vw}
#tso .ts-msg.on{opacity:1}
#tso .ts-sel{position:absolute;display:flex;gap:6px;transform:translate(-50%,-100%);pointer-events:auto}
.ts-dlg{position:fixed;inset:0;z-index:170;display:grid;place-items:center;background:#0008;padding:16px}
.ts-dlg>div{background:#fff8e8;color:#3a2306;border:4px solid #3a2306;border-radius:16px;padding:14px;max-width:560px;width:100%;max-height:86vh;overflow:auto;text-align:center;font:14px/1.5 var(--f-body,sans-serif)}
.ts-dlg h3{margin:0 0 8px;font-size:17px}
.ts-dlg .row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:10px}
.ts-dlg .row button{border:3px solid #3a2306;border-radius:10px;background:#ffd75e;font:900 14px/1 var(--f-body,sans-serif);padding:10px 16px;cursor:pointer;color:#3a2306}
.ts-dlg .row button.g{background:#fff}
.ts-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px;text-align:left}
.ts-card{border:2px solid #d9bf8a;border-radius:10px;background:#fdf7e6;padding:6px;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;font:700 11px/1.35 var(--f-body,sans-serif);color:#3a2306}
.ts-card img{width:72px;height:72px;object-fit:contain;image-rendering:pixelated}
.ts-card b{font-size:12px;text-align:center}
.ts-card .c{color:#b5420e;font-weight:900}
.ts-card.no{opacity:.5}
`;
document.head.appendChild(css);

let V=null;   // 今の画面
function el(html){ const d=document.createElement("div"); d.innerHTML=html; return d.firstElementChild; }
function dlg(html, btns, opt){ const bg=el(`<div class="ts-dlg"><div>${html}${btns&&btns.length?`<div class="row">${btns.map((b,i)=>`<button type="button" data-i="${i}" class="${b[2]||""}">${b[0]}</button>`).join("")}</div>`:""}</div></div>`);
  document.body.appendChild(bg); bg.querySelectorAll("[data-i]").forEach(b=>b.onclick=()=>{ const f=btns[+b.dataset.i][1]; bg.remove(); if(f) f(); });
  if(!(opt&&opt.modal)) bg.onclick=e=>{ if(e.target===bg) bg.remove(); }; return bg; }
function msg(t){ const m=V&&V.root.querySelector(".ts-msg"); if(!m) return; m.textContent=t; m.classList.add("on"); clearTimeout(m._t); m._t=setTimeout(()=>m.classList.remove("on"),2400); }
function coinView(){ const c=V&&V.root.querySelector(".ts-coin"); if(c) c.textContent=fmt(S.coins||0); try{ renderCoins(); }catch(e){} }
const mmss = ms => { ms=Math.max(0,ms); const s=Math.ceil(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`; };

// opts.embed＝ホームの中に配置画面を出す（時間制限なし・準備完了で魔物合戦の相手になれる）
// opts.fight＝ランキングの魔物合戦：相手の配置（tsp）と、自分の配置で戦う
let EV=null;   // 魔物合戦のあいだ、ホームの配置画面をしまっておく
function openTS(opts){ opts=opts||{};
  if(opts.embed){ const host=opts.embed;
    // 2026-10-25：全冒険者の配置から魔物をいったん全部取り除く（置いたときのコインは全部返す）。GEN を上げると、もう一度取り除ける
    try{ const t=st(); if((S.tsGen||0)<TS.GEN){ const M=t.units.filter(u=>!isItem(u.id)); let back=0; M.forEach(u=>{ try{ back+=costOf(u.id); }catch(e){} });
      t.units=t.units.filter(u=>isItem(u.id)); S.tsGen=TS.GEN; S.tsRd=0; S.tsSig=""; S.coins=(S.coins||0)+back; save();
      if(typeof DB!=="undefined"&&DB&&MYID) DB.collection("tsp").doc(MYID).set({rd:0},{merge:true}).catch(()=>{});
      if(M.length) setTimeout(()=>dlg(`<div style="font-size:44px">⚔️</div><h3>${T("魔物合戦のお知らせ","Monster Battle notice")}</h3><p>${T(`魔物合戦のきまりが変わったので、置いていた魔物（${M.length}体）をいったん全部取り除きました。<br>置いたときのコイン <b>${fmt(back)}</b> は全部返しました。<br>新しいきまり（魔物5体まで・同じ魔物2体まで・限定1体まで・アイテム5個まで）で置き直して「準備完了」を押してね`,`Monsters were removed due to rule changes. ${fmt(back)} coins refunded.`)}</p>`,[["OK",null]]),500); } }catch(e){}
    // きまり（魔物5種類まで・20個まで）ができる前に準備完了していた配置は、準備完了を外す
    try{ const t=st(); if(S.tsRd && layoutErr(t)){ S.tsRd=0; S.tsSig=""; save(); if(typeof DB!=="undefined"&&DB&&MYID) DB.collection("tsp").doc(MYID).set({rd:0},{merge:true}).catch(()=>{}); const er=layoutErr(t); setTimeout(()=>msg(T(`魔物合戦のきまりが変わりました：${er}。へらしてから、もう一度「準備完了」を押してね`,`Rules changed: ${er}. Adjust and press Ready again.`)),600); } }catch(e){}
    if(V&&V.embed){ host.appendChild(V.root); resize(); sideView(); coinView(); return; }   // ホームが描きなおされたら、同じ画面をつけかえる
    if(EV){ host.appendChild(EV.root); return; }
  }
  if(opts.fight&&V&&V.embed){ cancelAnimationFrame(V.raf); EV=V; V=null; }
  if(V) closeTS();
  try{ if(typeof loadDexStats==="function") loadDexStats(); }catch(e){}
  const root=el(`<div id="tso" role="dialog" aria-label="トトの戦略" translate="no"><canvas></canvas>
    <div class="ts-top"><button type="button" class="ts-b" id="tsX">← ${T("もどる","Back")}</button><div class="ts-timer" id="tsTm"><small id="tsTmL"></small><b id="tsTmV"></b></div><div class="ts-side" id="tsSide"></div></div>
    <div class="ts-msg"></div><div id="tsSel"></div>
    <div class="ts-panel" id="tsPanel"><div class="ts-pin"><img src="ts/panel.jpg" alt="">
      <div class="ts-coin"></div>
      <button type="button" class="ts-hit" id="tsAddM" style="left:34%;top:4%;width:31.4%;height:42%" aria-label="${T("魔物を追加","Add monster")}"></button>
      <button type="button" class="ts-hit" id="tsAddI" style="left:34%;top:50%;width:31.4%;height:46%" aria-label="${T("アイテムを追加","Add item")}"></button>
      <button type="button" class="ts-hit" id="tsGo" style="left:75.6%;top:5%;width:22.8%;height:90%" aria-label="${T("準備完了","Ready")}"></button>
    </div></div></div>`);
  if(opts.embed){ root.classList.add("embed"); opts.embed.appendChild(root); } else document.body.appendChild(root);
  V={root, embed:!!opts.embed, fight:opts.fight||null, cv:root.querySelector("canvas"), mode:"prep", cam:{x:0,y:0,z:1}, ptr:new Map(), placing:null, sel:null, drag:null, prepEnd:now()+TS.PREP_MS, raf:0, last:0};
  V.ctx=V.cv.getContext("2d");
  root.querySelector("#tsX").onclick=()=>{ if(V&&V.mode==="battle"&&!(V.B&&V.B.over)) return dlg(`<p>${T("バトル中です。やめると負けになります。","You're in a battle. Leaving counts as a loss.")}</p>`,[[T("つづける","Keep playing"),null,"g"],[T("やめる","Leave"),()=>{ if(V&&V.fight&&!V.done){ V.done=1; try{ window.tsFightDone&&window.tsFightDone(V.fight,"lose"); }catch(e){} } closeTS(); }]]); closeTS(); };
  root.querySelector("#tsAddM").onclick=()=>{ sfx("tap"); pickMonster(); };
  root.querySelector("#tsAddI").onclick=()=>{ sfx("tap"); pickItem(); };
  root.querySelector("#tsGo").onclick=()=>{ sfx("tap"); readyGo(); };
  sideView(); coinView();
  resize(); fitPrep(); addEventListener("resize",resize);
  bindPointers();
  V.last=performance.now(); V.raf=requestAnimationFrame(loop);
  if(opts.fight){ const t=st(); startBattle({cols:t.cols, rows:t.rows, units:t.units.map(u=>({id:u.id,c:u.c,r:u.r}))}, opts.fight); return; }
  setTimeout(()=>msg(V&&V.embed?T("魔物を置いて「準備完了」を押すと、ランキングで魔物合戦ができます。二本指で拡大・縮小","Place monsters and press Ready to join Monster Battles in the ranking. Pinch to zoom."):T("「魔物を追加」で魔物をえらんで、赤いマスに置こう。二本指で拡大・縮小できます","Pick a monster with “Add monster” and place it on the red grid. Pinch to zoom.")),400);
}
function closeTS(){ if(!V) return; cancelAnimationFrame(V.raf); removeEventListener("resize",resize); V.root.remove(); document.querySelectorAll(".ts-dlg").forEach(x=>x.remove()); V=null;
  if(EV){ V=EV; EV=null; addEventListener("resize",resize); resize(); sideView(); coinView(); V.last=performance.now(); V.raf=requestAnimationFrame(loop); } }
window.openTS=openTS;
window.__tsB=()=>V&&V.B;   // テスト用
window.__tsW2S=(x,y)=>{ if(!V) return null; const p=w2s(x,y), r=V.cv.getBoundingClientRect(); return {x:r.left+p.x/V.dpr, y:r.top+p.y/V.dpr}; };   // テスト用

function sideView(){ const s=V&&V.root.querySelector("#tsSide"); if(!s) return; const t=st();
  if(V.mode!=="prep"){ s.innerHTML=V.B?`<div class="ts-info">${T("相手","Opponent")}：${esc3(V.B.enemyName)}</div>`:""; return; }
  const rdTxt=V.embed?`<div class="ts-info">${!S.tsRd?T(`⚠️ まだ準備完了していません（魔物${TS.MIN_READY}体で出られます）`,`⚠️ Not ready (needs ${TS.MIN_READY} monsters)`):S.tsSig===sigOf(t)?T("✅ 準備完了ずみ","✅ Ready"):T("✏️ 変えた配置は、もう一度「準備完了」で反映","✏️ Press Ready again to save changes")}</div>`:"";
  s.innerHTML=`${rdTxt}<div class="ts-info">${T("魔物","Monsters")} ${t.units.filter(u=>!isItem(u.id)).length}/${TS.MAX_MON}　${T("アイテム","Items")} ${t.units.filter(u=>isItem(u.id)).length}/${TS.MAX_ITEM}　${T("マス","Grid")} ${t.cols}×${t.rows}</div>
    <div style="display:flex;gap:6px"><button type="button" class="ts-b" id="tsEx" ${t.cols>=TS.COLS_MAX?"disabled":""}>${T("横+1","Width +1")}</button><button type="button" class="ts-b" id="tsEy" ${t.rows>=TS.ROWS_MAX?"disabled":""}>${T("縦+1","Height +1")}</button></div>`;
  s.querySelector("#tsEx").onclick=()=>expand("c"); s.querySelector("#tsEy").onclick=()=>expand("r"); }
// 魔物合戦で負けたとき：配置をすべて取り消して、置くのに使ったコインの3分の1を返す（index.html の checkTsBattles からよばれる）
window.tsLoseLayout=()=>{ const t=st(); let paid=0; t.units.forEach(u=>{ try{ paid+=costOf(u.id); }catch(e){} }); const back=Math.floor(paid/3), n=t.units.length;
  t.units=[]; S.tsRd=0; S.tsSig=""; S.coins=(S.coins||0)+back; try{ save(); }catch(e){}
  if(V&&V.embed){ V.sel=null; V.placing=null; try{ selView(); sideView(); coinView(); }catch(e){} }
  else if(EV){ EV.sel=null; EV.placing=null; }
  return {back, n}; };
// 配置の強さ＝置いた魔物・アイテムの値段の合計（魔物合戦のごほうびの段階に使う）
window.tsPower=L=>(L&&L.units||[]).reduce((a,u)=>{ try{ return a+(okId(u.id)?costOf(u.id):0); }catch(e){ return a; } },0);
// マスの中に置ける魔物は5種類まで（アイテムは数えない）。置ける数は魔物とアイテムを合わせて20個まで
const kindsOf=t=>new Set(t.units.filter(u=>!isItem(u.id)).map(u=>u.id));
// 攻撃範囲のマス（準備画面で、タップした魔物の範囲をうすい赤で点滅させる）。[前に何マス目, 体の下の段から何段上, 地面から数えるか]
function rangeCells(id){ const k=cfgOf(id), out=[]; if(isItem(id)) return out;
  if(k.zone&&k.zone.cells) return k.zone.cells.map(c=>[c[0],c[1],!!k.zone.abs]);
  if(k.zone){ for(let x=1;x<=k.zone.x;x++) for(let y=0;y<=k.zone.up;y++) out.push([x,y,false]); return out; }
  if(k.diag) return [[1,0,false],[1,-1,false]];
  if(k.rays){ const seen=new Set();   // 線がとおるマス（rayTargets と同じ数え方）
    for(const [tx,ty] of k.rays) for(let i=1;i<=60;i++){ const x=tx*i/60, y=ty*i/60, fx=x-Math.floor(x), fy=y-Math.floor(y);
      if(fx<0.12||fx>0.88&&x<tx-0.1||fy<0.12&&y>0.12||fy>0.88&&y<ty-0.1) continue; const key=(Math.floor(x)+1)+","+Math.floor(y); if(!seen.has(key)){ seen.add(key); out.push([Math.floor(x)+1,Math.floor(y),false]); } }
    return out; }
  const n=Math.max(1,Math.ceil((k.range||0)+0.01)); for(let x=1;x<=n;x++) out.push([x,0,false]);   // ふつうの魔物：前のマス（地上の魔物は1つ上の段にもとどく）
  if(!k.fly) out.push([1,1,false]);
  return out; }
// 置けるきまり（2026-10-25）：魔物は5体まで・同じ魔物は2体まで・限定（Lランク）は1体まで・アイテムは5個まで
const isLtd=id=>!isItem(id)&&((mon(id)||{}).rank==="L");
function addErr(t,id){ const U=t.units, M=U.filter(u=>!isItem(u.id));
  if(isItem(id)) return U.length-M.length>=TS.MAX_ITEM?T(`アイテムは${TS.MAX_ITEM}個まで置けます`,`Up to ${TS.MAX_ITEM} items`):"";
  if(M.length>=TS.MAX_MON) return T(`魔物は${TS.MAX_MON}体まで置けます`,`Up to ${TS.MAX_MON} monsters`);
  if(M.filter(u=>u.id===id).length>=TS.MAX_PER) return T(`同じ魔物は${TS.MAX_PER}体まで置けます`,`Up to ${TS.MAX_PER} of the same monster`);
  if(isLtd(id)&&M.some(u=>isLtd(u.id))) return T(`限定の魔物は${TS.MAX_LTD}体まで置けます`,`Up to ${TS.MAX_LTD} limited monster`);
  return ""; }
function layoutErr(t){ const U=t.units, M=U.filter(u=>!isItem(u.id)), cnt={}; M.forEach(u=>cnt[u.id]=(cnt[u.id]||0)+1);
  if(M.some(u=>u.r>TS.MAX_FLY)) return T(`空中の魔物は地面から${TS.MAX_FLY}マスまでしか浮かせられません（高いところの魔物を下ろしてね）`,`Flying monsters can float at most ${TS.MAX_FLY} cell`);
  if(M.length>TS.MAX_MON) return T(`魔物は${TS.MAX_MON}体までです（今 ${M.length}体）`,`Up to ${TS.MAX_MON} monsters`);
  if(U.length-M.length>TS.MAX_ITEM) return T(`アイテムは${TS.MAX_ITEM}個までです（今 ${U.length-M.length}個）`,`Up to ${TS.MAX_ITEM} items`);
  if(Object.values(cnt).some(n=>n>TS.MAX_PER)) return T(`同じ魔物は${TS.MAX_PER}体までです`,`Up to ${TS.MAX_PER} of the same monster`);
  if(M.filter(u=>isLtd(u.id)).length>TS.MAX_LTD) return T(`限定の魔物は${TS.MAX_LTD}体までです`,`Up to ${TS.MAX_LTD} limited monster`);
  return ""; }
const sigOf=t=>JSON.stringify([t.cols,t.rows,t.units.map(u=>[u.id,u.c,u.r])]);
function expand(k){ const t=st(), max=k==="c"?TS.COLS_MAX:TS.ROWS_MAX, cur=k==="c"?t.cols:t.rows; if(cur>=max) return;
  dlg(`<h3>➕ ${k==="c"?T("マスを横に1列ふやす","Add 1 column"):T("マスを縦に1列ふやす","Add 1 row")}</h3><p>${k==="c"?`${T("横","Width")} ${cur} → <b>${cur+1}</b>`:`${T("縦","Height")} ${cur} → <b>${cur+1}</b>`}（${T("最大","max")} ${max}）<br>💰 <b>${fmt(TS.EXPAND_COST)}</b> ${T("コイン","coins")}（${T("所持","you have")} ${fmt(S.coins||0)}）</p>`,
    [[T("やめる","Cancel"),null,"g"],[T("ふやす","Add"),()=>{ if((S.coins||0)<TS.EXPAND_COST){ sfx("ng"); return msg(T("コインが足りません","Not enough coins")); } S.coins-=TS.EXPAND_COST; if(k==="c") t.cols++; else t.rows++; save(); sfx("coin"); coinView(); sideView(); }]]); }

/* ---------- 魔物をえらぶ ---------- */
function pickMonster(){ const t=st();
  { const M=t.units.filter(u=>!isItem(u.id)); if(M.length>=TS.MAX_MON) return dlg(`<p>${T(`魔物は${TS.MAX_MON}体まで置けます`,`Up to ${TS.MAX_MON} monsters`)}</p>`,[["OK",null]]); }
  const K=kindsOf(t);
  const own=MONSTERS.filter(m=>(S.got||{})[m.id] && TS_MON[m.id]);   // トトの戦略に追加した魔物（TS_MON にある魔物）だけ。図鑑で解放していることも必要
  if(!own.length) return dlg(`<p>${T(`使える魔物がいません。<br>トトの戦略で使える魔物：${Object.keys(TS_MON).map(id=>mon(+id)?`「${esc3(mon(+id).name)}」`:"").join("")}（図鑑で解放すると使えます）`,"No usable monsters yet. Unlock them in your Monster Book.")}</p>`,[["OK",null]]);
  // 今追加できる魔物だけ（コインが足りる・今のマスに入る大きさ）
  const L=own.filter(m=>{ const c=cfgOf(m.id); return (K.size<TS.MAX_KINDS||K.has(m.id)) && !addErr(t,m.id) && costOf(m.id)<=(S.coins||0) && c.w<=t.cols && c.h<=t.rows; }).sort((a,b)=>RANKS.indexOf(b.rank)-RANKS.indexOf(a.rank)||a.id-b.id);
  if(!L.length) return dlg(`<h3>👾 ${T("魔物を追加","Add a monster")}</h3><p>${T(`同じ魔物は${TS.MAX_PER}体まで・限定の魔物は${TS.MAX_LTD}体までです。<br>`,`Up to ${TS.MAX_PER} of the same monster, ${TS.MAX_LTD} limited.<br>`)}${T(`今追加できる魔物がいません。<br>（いちばん安い魔物：💰 ${fmt(Math.min(...own.map(m=>costOf(m.id))))}・所持 ${fmt(S.coins||0)}コイン）`,`No monster you can add right now.`)}</p>`,[["OK",null]]);
  const bg=dlg(`<h3>👾 ${T("魔物を追加","Add a monster")}</h3><p style="font-size:12px;margin:0 0 8px">${T(`今の所持コイン（${fmt(S.coins||0)}）で追加できる魔物だけ出ています。コインは置いたときに払います（取り除いてももどりません）`,`Only monsters you can afford now (${fmt(S.coins||0)} coins). You pay when you place it (no refund on removal).`)}</p>
    <div class="ts-grid">${L.map(m=>{ const c=cfgOf(m.id), s=statsOf(m.id), cost=costOf(m.id); return `<button type="button" class="ts-card" data-id="${m.id}"><img src="${m.img}" alt=""><b>${esc3(m.name)}</b><span><span class="rk rk-${m.rank}">${m.rank==="L"?T("限定","LTD"):m.rank}</span> ${c.w}×${c.h}${T("マス","")}${c.fly?" 🪽":""}</span><span>❤ ${fmt(s.hp)}　⚔ ${fmt(s.atk)}</span><span class="c">💰 ${fmt(cost)}</span></button>`; }).join("")}</div>`,[[T("とじる","Close"),null,"g"]]);
  bg.querySelectorAll("[data-id]").forEach(b=>b.onclick=()=>{ const id=+b.dataset.id, cost=costOf(id);
    if((S.coins||0)<cost){ sfx("ng"); return msg(T("コインが足りません","Not enough coins")); }
    bg.remove(); V.placing={id}; V.sel=null; selView(); const c=cfgOf(id); msg(T(`置きたいマスをタップ（${c.w}×${c.h}マス・左下のマスをタップ）`,`Tap a cell to place it (${c.w}×${c.h}, bottom-left cell)`)); });
}

/* ---------- アイテムをえらぶ ---------- */
function pickItem(){ const t=st();
  if(t.units.filter(u=>isItem(u.id)).length>=TS.MAX_ITEM) return dlg(`<p>${T(`アイテムは${TS.MAX_ITEM}個まで置けます`,`Up to ${TS.MAX_ITEM} items`)}</p>`,[["OK",null]]);
  const desc={ "i:mine":T("土の中にも置ける。相手の地上の魔物が上を通ると爆発し、上の横3×縦2マスの相手の体力を半分へらす（空中の魔物は通っても反応しない）。相手には見えない","Can go underground. Explodes when an enemy ground monster walks over it: halves HP in a 3×2 area above. Hidden from the opponent."),
    "i:wall":T(`相手の地上の魔物は、こわすまで通りぬけられない。空中の魔物は飛びこえる。耐久力は冒険者レベル×${TS_ITEMS["i:wall"].hpPerLv}（今は${fmt(statsOf("i:wall").hp)}）`,`Blocks enemy ground monsters until destroyed. HP = Adventurer Lv × ${TS_ITEMS["i:wall"].hpPerLv}.`) };
  const L=Object.keys(TS_ITEMS).filter(id=>{ const c=cfgOf(id); return c.w<=t.cols && c.h<=t.rows; });
  const bg=dlg(`<h3>🧰 ${T("アイテムを追加","Add an item")}</h3><p style="font-size:12px;margin:0 0 8px">${T(`所持コイン ${fmt(S.coins||0)}。コインは置いたときに払います（取り除いてももどりません）`,`You have ${fmt(S.coins||0)} coins. You pay when you place it.`)}</p>
    <div class="ts-grid">${L.map(id=>{ const c=cfgOf(id), cost=costOf(id), ok=(S.coins||0)>=cost; return `<button type="button" class="ts-card ${ok?"":"no"}" data-it="${id}"><img src="${TS_ITEMS[id].img}" alt="" style="object-fit:contain"><b>${esc3(nameOf(id))}</b><span>${c.w}×${c.h}${T("マス","")}${c.under?T("・土の中OK"," · underground OK"):""}${c.wall?`・❤ ${fmt(statsOf(id).hp)}`:""}</span><span style="font-size:10px;font-weight:700">${desc[id]||""}</span><span class="c">💰 ${fmt(cost)}</span></button>`; }).join("")}</div>`,[[T("とじる","Close"),null,"g"]]);
  bg.querySelectorAll("[data-it]").forEach(b=>b.onclick=()=>{ const id=b.dataset.it, cost=costOf(id);
    if((S.coins||0)<cost){ sfx("ng"); return msg(T("コインが足りません","Not enough coins")); }
    bg.remove(); V.placing={id}; V.sel=null; selView(); const c=cfgOf(id); msg(T(`置きたいマスをタップ（${c.w}×${c.h}マス・左下のマスをタップ）`,`Tap a cell to place it (${c.w}×${c.h}, bottom-left cell)`)); });
}
/* ---------- 置く・動かす ---------- */
const fits = (id,c,r,skip) => { const t=st(), k=cfgOf(id); if(c<0||r<TS.UNDER||c+k.w>t.cols||r+k.h>t.rows) return false;
  if(r<0 && !k.under) return false;   // 土の中に置けるのは under:true の魔物・アイテムだけ
  if(r>0 && !k.fly) return false;     // 地面から浮かせて置けるのは fly:true の魔物・アイテムだけ
  if(r>TS.MAX_FLY && !isItem(id)) return false;   // 空中に置ける魔物も、地面から1マスまでしか浮かせられない（2026-10-26）
  return !t.units.some(u=>{ if(u===skip) return false; const q=cfgOf(u.id); return c<u.c+q.w && u.c<c+k.w && r<u.r+q.h && u.r<r+k.h; }); };
const cellAt = (wx,wy) => ({ c:Math.floor(wx/TS.CS), r:Math.floor(-wy/TS.CS) });
const unitAt = (wx,wy) => { const t=st(); for(let i=t.units.length-1;i>=0;i--){ const u=t.units[i], k=cfgOf(u.id); const x0=u.c*TS.CS, y1=-u.r*TS.CS, x1=x0+k.w*TS.CS, y0=y1-k.h*TS.CS; if(wx>=x0&&wx<x1&&wy>=y0&&wy<y1) return u; } return null; };
function place(c,r){ const id=V.placing.id, t=st(), cost=costOf(id);
  { const er=addErr(t,id); if(er){ V.placing=null; sfx("ng"); return msg(er); } }
  if(!isItem(id)){ const K=kindsOf(t); if(!K.has(id)&&K.size>=TS.MAX_KINDS){ V.placing=null; sfx("ng"); return msg(T(`置ける魔物は${TS.MAX_KINDS}種類までです`,`Up to ${TS.MAX_KINDS} kinds`)); } }
  if(!fits(id,c,r)){ sfx("ng"); const k=cfgOf(id); return msg(r<0&&!k.under?T(isItem(id)?"このアイテムは土の中には置けません（地面の上のマスに置いてね）":"この魔物は土の中には置けません（地面の上のマスに置いてね）","This one can't go underground"):r>TS.MAX_FLY&&!isItem(id)&&k.fly?T(`空中に置くときは、地面から${TS.MAX_FLY}マスまでしか浮かせられません`,`Can float at most ${TS.MAX_FLY} cell above the ground`):r>0&&!k.fly?T("この魔物は浮かせて置けません（地面の上のマスに置いてね）","This one can't float — place it on the ground"):T("そこには置けません（マスからはみ出す・ほかと重なる）","Can't place there (off the grid or overlapping)")); }
  if((S.coins||0)<cost){ sfx("ng"); V.placing=null; return msg(T("コインが足りません","Not enough coins")); }
  S.coins-=cost; t.units.push({u:t.nu++, id, c, r}); save(); sfx("coin"); coinView(); sideView(); V.placing=null;
  msg(T(`「${nameOf(id)}」を置きました（-${fmt(cost)}コイン）`,`Placed ${nameOf(id)} (-${fmt(cost)})`)); }
function selView(){ const box=V&&V.root.querySelector("#tsSel"); if(!box) return; box.innerHTML=""; const u=V.sel; if(!u||V.mode!=="prep") return;
  const k=cfgOf(u.id), s=statsOf(u.id), m={name:nameOf(u.id)}, p=w2s((u.c+k.w/2)*TS.CS, -(u.r+k.h)*TS.CS);
  const d=el(`<div class="ts-sel" style="left:${p.x/V.dpr}px;top:${p.y/V.dpr-6}px"><span class="ts-info">${esc3(m.name)}${isItem(u.id)?(k.wall?`　❤${fmt(s.hp)}`:""):`　❤${fmt(s.hp)} ⚔${fmt(s.atk)}`}<br>${T("ドラッグで移動","Drag to move")}</span><button type="button" class="ts-b">${T("取り除く","Remove")}</button></div>`);
  d.querySelector("button").onclick=()=>dlg(`<p>${T(`「${esc3(m.name)}」を取り除きますか？<br>置いたときのコインはもどりません。`,`Remove ${esc3(m.name)}? Coins are not refunded.`)}</p>`,[[T("やめる","Cancel"),null,"g"],[T("取り除く","Remove"),()=>{ const t=st(); t.units=t.units.filter(x=>x!==u); save(); V.sel=null; selView(); sideView(); }]]);
  box.appendChild(d); }

/* ---------- カメラ・指の操作 ---------- */
function resize(){ if(!V) return; const dpr=Math.min(2,window.devicePixelRatio||1), r=V.root.getBoundingClientRect(); V.dpr=dpr; V.cv.width=Math.round(r.width*dpr); V.cv.height=Math.round(r.height*dpr); V.W=V.cv.width; V.H=V.cv.height;
  const p=V.root.querySelector("#tsPanel"); V.panelH=p&&!p.hidden?p.getBoundingClientRect().height*dpr:0; selView(); }
const viewH = () => V.H - V.panelH;
const w2s = (x,y) => ({ x:(x-V.cam.x)*V.cam.z + V.W/2, y:(y-V.cam.y)*V.cam.z + viewH()/2 });
const s2w = (x,y) => ({ x:(x-V.W/2)/V.cam.z + V.cam.x, y:(y-viewH()/2)/V.cam.z + V.cam.y });
function fitRect(x0,y0,x1,y1){ const pad=1.15, z=Math.min(V.W/((x1-x0)*pad), viewH()/((y1-y0)*pad)); V.cam.z=Math.max(0.15,Math.min(3,z)); V.cam.x=(x0+x1)/2; V.cam.y=(y0+y1)/2; }
function fitPrep(){ const t=st(); fitRect(-TS.CS*1.5, -t.rows*TS.CS-TS.CS*1.2, t.cols*TS.CS+TS.CS*1.5, -TS.UNDER*TS.CS+TS.CS*0.6); }
function bindPointers(){ const cv=V.cv;
  const pos=e=>{ const r=cv.getBoundingClientRect(); return {x:(e.clientX-r.left)*V.dpr, y:(e.clientY-r.top)*V.dpr}; };
  cv.addEventListener("pointerdown",e=>{ if(!V) return; e.preventDefault(); try{ cv.setPointerCapture(e.pointerId); }catch(_){} const p=pos(e); V.ptr.set(e.pointerId,{...p, x0:p.x, y0:p.y, t0:performance.now()});
    if(V.ptr.size===2){ const [a,b]=[...V.ptr.values()]; V.pinch={d:Math.hypot(a.x-b.x,a.y-b.y), z:V.cam.z, w:s2w((a.x+b.x)/2,(a.y+b.y)/2)}; V.drag=null; return; }
    if(V.mode==="prep" && !V.placing){ const w=s2w(p.x,p.y), u=unitAt(w.x,w.y); if(u){ const k=cfgOf(u.id); V.drag={u, ox:w.x-u.c*TS.CS, oy:w.y+u.r*TS.CS, moved:false, c:u.c, r:u.r}; } } });
  cv.addEventListener("pointermove",e=>{ if(!V||!V.ptr.has(e.pointerId)) return; const p=pos(e), o=V.ptr.get(e.pointerId); const dx=p.x-o.x, dy=p.y-o.y; o.x=p.x; o.y=p.y;
    if(V.ptr.size>=2 && V.pinch){ const [a,b]=[...V.ptr.values()], d=Math.hypot(a.x-b.x,a.y-b.y), mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
      V.cam.z=Math.max(0.15,Math.min(3,V.pinch.z*d/Math.max(1,V.pinch.d))); V.cam.x=V.pinch.w.x-(mx-V.W/2)/V.cam.z; V.cam.y=V.pinch.w.y-(my-viewH()/2)/V.cam.z; selView(); return; }
    if(V.drag){ const w=s2w(p.x,p.y); if(Math.hypot(p.x-o.x0,p.y-o.y0)>8*V.dpr) V.drag.moved=true; if(V.drag.moved){ const c=Math.round((w.x-V.drag.ox)/TS.CS), r=Math.round(-(w.y-V.drag.oy)/TS.CS); V.drag.c=c; V.drag.r=r; } return; }
    V.cam.x-=dx/V.cam.z; V.cam.y-=dy/V.cam.z; if(Math.abs(dx)+Math.abs(dy)>0) selView(); });
  const up=e=>{ if(!V||!V.ptr.has(e.pointerId)) return; const o=V.ptr.get(e.pointerId); V.ptr.delete(e.pointerId); if(V.ptr.size<2) V.pinch=null;
    const tap=Math.hypot(o.x-o.x0,o.y-o.y0)<10*V.dpr && performance.now()-o.t0<400 && V.ptr.size===0;
    if(V.drag){ const d=V.drag; V.drag=null;
      if(d.moved){ if(fits(d.u.id,d.c,d.r,d.u)){ d.u.c=d.c; d.u.r=d.r; save(); sfx("tap"); } else { sfx("ng"); msg(T("そこには動かせません","Can't move there")); } V.sel=d.u; selView(); return; }
      if(tap){ V.sel=V.sel===d.u?null:d.u; selView(); return; } }
    if(tap && V.mode==="prep"){ const w=s2w(o.x,o.y);
      if(V.placing){ const {c,r}=cellAt(w.x,w.y); place(c,r); return; }
      V.sel=null; selView(); } };
  cv.addEventListener("pointerup",up); cv.addEventListener("pointercancel",up);
  cv.addEventListener("wheel",e=>{ e.preventDefault(); const p=pos(e), w=s2w(p.x,p.y); V.cam.z=Math.max(0.15,Math.min(3,V.cam.z*Math.exp(-e.deltaY*0.0015))); V.cam.x=w.x-(p.x-V.W/2)/V.cam.z; V.cam.y=w.y-(p.y-viewH()/2)/V.cam.z; selView(); },{passive:false});
}

/* ---------- 準備完了 → 相手さがし → バトル ---------- */
let busy=false;
async function readyGo(auto){ if(!V||V.mode!=="prep"||busy) return; const t=st();
  if(!t.units.length){ if(auto){ msg(T("魔物を置かなかったので、準備時間をもう一度はじめます","Nothing placed — prep time restarted")); V.prepEnd=now()+TS.PREP_MS; return; } sfx("ng"); return msg(T("魔物を1体以上置いてね","Place at least one monster")); }
  const mine={cols:t.cols, rows:t.rows, units:t.units.map(u=>({id:u.id,c:u.c,r:u.r}))};
  if(V.embed){   // ホーム：時間制限なし。準備完了で、ランキングの魔物合戦の相手になれる
    if(!(typeof DB!=="undefined" && DB && MYID)){ sfx("ng"); return msg(T("ログインすると準備完了できます","Log in to get ready")); }
    { const er=layoutErr(t); if(er){ sfx("ng"); return msg(er+T("。へらしてから準備完了してね","")); } }
    const nMon=t.units.filter(u=>!isItem(u.id)).length; if(nMon<TS.MIN_READY){ sfx("ng"); return msg(T(`魔物合戦に出るには、魔物を${TS.MIN_READY}体置いてください（今 ${nMon}体）`,`Place at least ${TS.MIN_READY} monsters to join (now ${nMon})`)); }
    busy=true; V.placing=null; V.sel=null; selView(); let nm=""; try{ nm=myName(); }catch(e){}
    try{ await DB.collection("tsp").doc(MYID).set({uid:MYID, nm:String(nm).slice(0,24), ...mine, plv:myLv(), rd:1, g:TS.GEN, at:now()}); S.tsPow=window.tsPower(mine); S.tsRd=1; S.tsRdAt=(typeof gnow==="function"?gnow():Date.now()); S.tsSig=sigOf(t); save(); try{ queueProfile(true); }catch(e){}
      sfx("level"); dlg(`<div style="font-size:48px">⚔️</div><h3>${T("準備完了！","Ready!")}</h3><p>${T("ランキングで冒険者のプロフィールを開くと「魔物合戦」で戦えます。<br>勝つと冒険者Lv+1・1000コイン！<br>ほかの冒険者からも、この配置に合戦をしかけられます。","Open an adventurer's profile in the ranking to start a Monster Battle. Win for Adventurer Lv+1 and 1000 coins!")}</p>`,[["OK",null]]); }
    catch(e){ sfx("ng"); msg(T("保存できませんでした。もう一度ためしてね","Couldn't save. Try again.")); }
    busy=false; sideView(); return; }
  busy=true; V.placing=null; V.sel=null; selView(); msg(T("相手をさがしています…","Finding an opponent…"));
  try{ if(typeof DB!=="undefined" && DB && MYID){ let nm=""; try{ nm=myName(); }catch(e){} DB.collection("tsp").doc(MYID).set({uid:MYID, nm:String(nm).slice(0,24), ...mine, plv:myLv(), at:now()}).catch(()=>{}); } }catch(e){}
  let opp=null;
  try{ if(typeof DB!=="undefined" && DB && MYID){ const q=await Promise.race([DB.collection("tsp").orderBy("at","desc").limit(40).get(), new Promise((_,ng)=>setTimeout(()=>ng(new Error("to")),6000))]);
      const L=q.docs.map(d=>d.data()).filter(x=>x&&x.uid!==MYID&&Array.isArray(x.units)&&x.units.some(u=>okId(u.id)&&!isItem(u.id))); if(L.length) opp=L[Math.floor(Math.random()*L.length)]; } }catch(e){}
  if(!opp) opp=cpuLayout(mine);
  busy=false; startBattle(mine, opp);
}
function cpuLayout(mine){ const n=Math.max(3,Math.min(TS.MAX_UNITS,mine.units.length)), cols=mine.cols, rows=mine.rows, L=[], pool=MONSTERS.filter(m=>TS_MON[m.id]);
  const occ=new Set(), ok=(id,c,r)=>{ const k=cfgOf(id); if(c<0||r<0||c+k.w>cols||r+k.h>rows) return false; for(let i=0;i<k.w;i++) for(let j=0;j<k.h;j++) if(occ.has((c+i)+","+(r+j))) return false; return true; };
  for(let tries=0; L.length<n && tries<400; tries++){ const m=pool[Math.floor(Math.random()*pool.length)], k=cfgOf(m.id), c=Math.floor(Math.random()*cols), r=k.fly?Math.floor(Math.random()*rows):0;
    if(!ok(m.id,c,r)) continue; for(let i=0;i<k.w;i++) for(let j=0;j<k.h;j++) occ.add((c+i)+","+(r+j)); L.push({id:m.id,c,r}); }
  return {nm:T("さすらいの戦略家（CPU）","Wandering Tactician (CPU)"), cols, rows, units:L, cpu:1}; }

function mkUnit(u, side, X0, cols, lv){ const k=cfgOf(u.id), s=statsOf(u.id, lv), w=k.w*TS.CS, h=k.h*TS.CS;
  const c = side ? (cols-u.c-k.w) : u.c;   // 相手は左右反対（前が自分のほうを向く）
  if(k.mine) return { id:u.id, mine:true, side, x:X0+c*TS.CS+w/2, y:-u.r*TS.CS, w, h, done:false };
  return { id:u.id, wall:!!k.wall, side, diag:!!k.diag, shot:!!k.shot, line:!!k.line, zone:k.zone||null, fire:!!k.fire, rock:!!k.rock, rays:k.rays||null, drawH:k.drawH||0, x:X0+c*TS.CS+w/2, y:-Math.max(0,u.r)*TS.CS,   /* 土の中に置いた魔物は、バトルが始まると地面に出てくる */ w, h, fly:k.fly, hp:s.hp, max:s.hp, atk:s.atk, spd:k.spd*TS.CS, range:k.range*TS.CS, cd:k.cd, t:Math.random()*0.4, x0r:Math.floor(Math.random()*10), vy:0, dead:false, deadT:0, flash:0, atkT:9, moving:false, face:side?-1:1, hop:Math.random()*6 }; }
function startBattle(mine, opp){
  const X1=0, X2=mine.cols*TS.CS+TS.GAP*TS.CS;
  const all=[...mine.units.filter(u=>okId(u.id)).map(u=>mkUnit(u,0,X1,mine.cols,myLv())), ...opp.units.filter(u=>okId(u.id)).map(u=>mkUnit(u,1,X2,opp.cols,opp.plv||myLv()))];
  const units=all.filter(u=>!u.mine), mines=all.filter(u=>u.mine);
  V.B={units, mines, booms:[], pops:[], shots:[], end:now()+TS.BATTLE_MS, X1, X2, W:X2+opp.cols*TS.CS, rows:Math.max(mine.rows,opp.rows||mine.rows), mine, opp, enemyName:opp.nm||T("冒険者","Adventurer"), over:false};
  V.mode="battle"; V.root.querySelector("#tsPanel").hidden=true; resize(); sideView();
  fitRect(-TS.CS*2, -V.B.rows*TS.CS-TS.CS*2, V.B.W+TS.CS*2, TS.CS*1);
  sfx("win"); msg(T(`バトル開始！ 相手：${opp.nm||"冒険者"}`,`Battle start! vs ${opp.nm||"Adventurer"}`));
}
// 斜め前下を攻撃する飛ぶ魔物：置いた高さのまま。前（相手のほう）1マス・下1マスのマスにいる相手を攻撃する
// 攻撃できる相手がいない魔物は、進む向き（自分は右・相手は左）にそのまま進みつづける。フィールドの外に出たら、たおれた扱い
function advance(u,B,dt,walls){ const dir=u.side?-1:1; let nx=u.x+dir*u.spd*dt;
  if(!u.fly && walls) for(const wl of walls(1-u.side)){ const edge=wl.x-dir*(wl.w+u.w)/2; if(dir>0 ? (u.x<=edge+1 && nx>edge) : (u.x>=edge-1 && nx<edge)) nx=edge; }
  u.moving=nx!==u.x; u.face=u.side?-1:1; u.x=nx; u.hop+=dt*8;
  // フィールドの外（両はしのかざりより外）に出たら、たおれた扱い
  if(u.x<B.X1-TS.CS*2 || u.x>B.W+TS.CS*2){ u.hp=0; u.dead=true; u.deadT=9; B.pops.push({x:Math.max(B.X1,Math.min(B.W,u.x)),y:u.y-u.h,v:"OUT",t:0,side:u.side}); } }
function stepDiag(u,B,dt,alive,walls){ u.atkT+=dt; u.moving=false; u.hop+=dt*8;
  // 斜め前下の高さにいる相手だけが、攻撃できる相手
  // 攻撃範囲：前の1列の「同じ高さ」と「1つ下」の2マス（No.63の図）
  const top=u.y-TS.CS+4, bot=u.y+TS.CS-4;
  const all=[...alive(1-u.side),...walls(1-u.side)], foes=all.filter(f=>f.y>top && f.y-f.h<bot);
  if(!foes.length){ advance(u,B,dt,null); return; }
  let tg=null, bd=Infinity; for(const f of foes){ const d=Math.abs(f.x-u.x)+Math.abs(f.y-u.y)*0.3; if(d<bd){ bd=d; tg=f; } }
  u.face=u.side?-1:1;
  const zx0=u.face>0?u.x+u.w/2-10:u.x-u.w/2-14, zx1=zx0+24, zy0=top, zy1=bot;   // 前の1列・2マス（くっつくところまで近づいて攻撃）
  const inZ=f=>{ const fx0=f.x-f.w/2, fx1=f.x+f.w/2, fy0=f.y-f.h, fy1=f.y; return fx1>zx0&&fx0<zx1&&fy1>zy0&&fy0<zy1; };
  const hitT=foes.find(inZ);
  if(hitT){ if(u.t<=0){ u.t=u.cd; u.atkT=0; hitT.hp=Math.max(0,hitT.hp-u.atk); hitT.flash=0.15; B.pops.push({x:hitT.x,y:hitT.y-hitT.h,v:u.atk,t:0,side:hitT.side}); if(hitT.hp<=0) hitT.dead=true; } return; }
  const want=tg.x-u.face*(u.w/2+tg.w/2-8), dx=want-u.x;   // 相手が前の列（同じ高さか1つ下）に来る位置まで動く
  if(Math.abs(dx)>2){ u.x+=Math.sign(dx)*Math.min(Math.abs(dx),u.spd*dt); u.moving=true; } }
// 決まったマスの範囲を攻撃する魔物（zone：x＝前に何マス、up＝上に何段）。範囲にいる相手のうち、いちばん近い1体に当たる
function stepZone(u,B,dt,alive,walls){ u.atkT+=dt; u.moving=false;
  if(!u.fly){ if(u.y<0){ u.vy+=1800*dt; u.y=Math.min(0,u.y+u.vy*dt); if(u.y>=0) u.vy=0; } }
  const Z=u.zone;
  if(Z.cells) return stepCells(u,B,dt,alive,walls);
  const top=u.y-(Z.up+1)*TS.CS+4, bot=u.y-4;
  const foes=[...alive(1-u.side),...walls(1-u.side)].filter(f=>f.y>top && f.y-f.h<bot);   // 範囲の高さにいる相手
  if(!alive(1-u.side).length) return;
  if(!foes.length){ advance(u,B,dt,walls); return; }
  let tg=null, bd=Infinity; for(const f of foes){ const d=Math.abs(f.x-u.x); if(d<bd){ bd=d; tg=f; } }
  u.face=u.side?-1:1;
  const zx0=u.face>0?u.x+u.w/2-6:u.x-u.w/2-Z.x*TS.CS, zx1=u.face>0?u.x+u.w/2+Z.x*TS.CS:u.x-u.w/2+6;
  const inZ=f=>f.x+f.w/2>zx0+4 && f.x-f.w/2<zx1-4;
  const hits=foes.filter(inZ);
  if(hits.length){ if(u.t<=0){ let h=hits[0]; for(const f of hits) if(Math.abs(f.x-u.x)<Math.abs(h.x-u.x)) h=f;
      u.t=u.cd; u.atkT=0; h.hp=Math.max(0,h.hp-u.atk); h.flash=0.15; B.pops.push({x:h.x,y:h.y-h.h,v:u.atk,t:0,side:h.side}); if(h.hp<=0) h.dead=true; } return; }
  let nx=u.x+u.face*u.spd*dt;
  if(!u.fly) for(const wl of walls(1-u.side)){ const edge=wl.x-u.face*(wl.w+u.w)/2; if(u.face>0 ? (u.x<=edge+1 && nx>edge) : (u.x>=edge-1 && nx<edge)) nx=edge; }
  u.moving=nx!==u.x; u.x=nx; u.hop+=dt*8; }
// 線の方向に魔法の玉を撃つ魔物（rays：[前に何マス, 上に何段] の先の丸）。前のマスの下のすみから線をのばし、線の上でいちばん近い1体をねらう。1回の攻撃で線の数だけ同時に撃つ（同じ相手には1発だけ）
function rayTargets(u,foes){ const f0=u.face, xf=u.x+f0*u.w/2, out=[];
  // マスの数え方：前のマスの下のすみが(0,0)。線の先（rays の値）までたどって、通ったマス（すみをかすっただけのマスはのぞく）に相手がいたら、いちばん近い1体に当たる
  const inCell=(f,cx,cy)=>{ const x0=xf+f0*cx*TS.CS, x1=x0+f0*TS.CS, l=Math.min(x0,x1), r=Math.max(x0,x1), b=u.y-cy*TS.CS, t=b-TS.CS;
    const ox=Math.min(r,f.x+f.w/2)-Math.max(l,f.x-f.w/2), oy=Math.min(b,f.y)-Math.max(t,f.y-f.h); return ox>TS.CS*0.4 && oy>TS.CS*0.4; };
  for(const [tx,ty] of u.rays){ const seen=new Set();
    for(let i=1;i<=60;i++){ const x=tx*i/60, y=ty*i/60, fx=x-Math.floor(x), fy=y-Math.floor(y);
      if(fx<0.12||fx>0.88&&x<tx-0.1||fy<0.12&&y>0.12||fy>0.88&&y<ty-0.1) continue;   // マスのさかいめはかすっただけ
      const cx=Math.floor(x), cy=Math.floor(y), key=cx+","+cy; if(seen.has(key)) continue; seen.add(key);
      const hs=foes.filter(f=>inCell(f,cx,cy)); if(hs.length){ let h=hs[0]; for(const f of hs) if(Math.abs(f.x-u.x)<Math.abs(h.x-u.x)) h=f; if(!out.includes(h)) out.push(h); break; } } }
  return out; }
// 攻撃範囲のマス（cells）の四角。前のはし（顔の向き）と体のいちばん下の段が基準
function cellRects(u){ const xf=u.x+u.face*u.w/2; return u.zone.cells.map(([k,dy])=>{ const a=xf+u.face*(k-1)*TS.CS, b=a+u.face*TS.CS, bot=u.zone.abs?-dy*TS.CS:u.y-dy*TS.CS; return {x0:Math.min(a,b), x1:Math.max(a,b), y0:bot-TS.CS, y1:bot, k, dy}; }); }
function stepCells(u,B,dt,alive,walls){
  if(!alive(1-u.side).length) return;
  const C=u.zone.cells, lo=Math.min(...C.map(c=>c[1])), hi=Math.max(...C.map(c=>c[1])), y0=u.zone.abs?0:u.y, top=y0-(hi+1)*TS.CS+4, bot=y0-lo*TS.CS-4;
  const foes=[...alive(1-u.side),...walls(1-u.side)].filter(f=>f.y>top && f.y-f.h<bot);   // 範囲の高さにいる相手
  if(!foes.length){ advance(u,B,dt,walls); return; }
  let tg=null, bd=Infinity; for(const f of foes){ const d=Math.abs(f.x-u.x); if(d<bd){ bd=d; tg=f; } }
  if(Math.abs(tg.x-u.x)>u.w*0.3) u.face=u.side?-1:1;
  const R=cellRects(u), ov=(f,r)=>Math.min(r.x1,f.x+f.w/2)-Math.max(r.x0,f.x-f.w/2)>TS.CS*0.3 && Math.min(r.y1,f.y)-Math.max(r.y0,f.y-f.h)>TS.CS*0.3;
  const hits=foes.filter(f=>R.some(r=>ov(f,r)));
  if(hits.length && u.zone.abs){ if(u.t<=0){ u.t=u.cd; u.atkT=0;   // 矢印のマスは貫通（いる相手ぜんぶ）、点のマスはいちばん近い1体
      const hs=new Set(); C.forEach((c,j)=>{ const r=R[j], inR=foes.filter(f=>ov(f,r)); if(!inR.length) return; if(c[2]) inR.forEach(f=>hs.add(f)); else { let h=inR[0]; for(const f of inR) if(Math.abs(f.x-u.x)<Math.abs(h.x-u.x)) h=f; hs.add(h); } });
      hs.forEach(h=>{ h.hp=Math.max(0,h.hp-u.atk); h.flash=0.15; B.pops.push({x:h.x,y:h.y-h.h,v:u.atk,t:0,side:h.side}); if(h.hp<=0) h.dead=true; }); } return; }
  if(hits.length){ if(u.t<=0){ let h=hits[0]; for(const f of hits) if(Math.abs(f.x-u.x)<Math.abs(h.x-u.x)) h=f;
      u.t=u.cd; u.atkT=0; h.hp=Math.max(0,h.hp-u.atk); h.flash=0.15; B.pops.push({x:h.x,y:h.y-h.h,v:u.atk,t:0,side:h.side}); if(h.hp<=0) h.dead=true; } return; }
  advance(u,B,dt,walls); }
function stepRays(u,B,dt,alive,walls){ u.atkT+=dt; u.moving=false;
  if(!u.fly){ if(u.y<0){ u.vy+=1800*dt; u.y=Math.min(0,u.y+u.vy*dt); if(u.y>=0) u.vy=0; } }
  if(!alive(1-u.side).length) return;
  const maxUp=Math.max(...u.rays.map(r=>r[1])), top=u.y-(maxUp+1)*TS.CS+4;
  const foes=[...alive(1-u.side),...walls(1-u.side)].filter(f=>f.y>top && f.y-f.h<u.y-4);
  if(!foes.length){ advance(u,B,dt,walls); return; }
  let tg=null, bd=Infinity; for(const f of foes){ const d=Math.abs(f.x-u.x); if(d<bd){ bd=d; tg=f; } }
  if(Math.abs(tg.x-u.x)>u.w*0.6) u.face=u.side?-1:1;
  const hits=rayTargets(u,foes);
  if(hits.length){ if(u.t<=0){ u.t=u.cd; u.atkT=0; for(const h of hits) B.shots.push({x:u.x+u.face*u.w*0.45, y:u.y-u.h*0.42, tg:h, dmg:u.atk, side:u.side, face:u.face, d:0.3}); } return; }
  advance(u,B,dt,walls); }
function stepBattle(dt){ const B=V.B; if(!B||B.over) return;
  const alive=s=>B.units.filter(u=>u.side===s&&!u.dead&&!u.wall);   // 勝ち負けに数えるのは魔物だけ
  const walls=s=>B.units.filter(u=>u.side===s&&!u.dead&&u.wall);
  for(const u of B.units){ if(u.dead){ u.deadT+=dt; continue; } u.flash=Math.max(0,u.flash-dt); if(u.wall) continue; u.t-=dt;
    if(u.diag){ stepDiag(u,B,dt,alive,walls); continue; }
    if(u.zone){ stepZone(u,B,dt,alive,walls); continue; }
    if(u.rays){ stepRays(u,B,dt,alive,walls); continue; }
    if(!u.fly){ if(u.y<0){ u.vy+=1800*dt; u.y=Math.min(0,u.y+u.vy*dt); if(u.y>=0) u.vy=0; } }   // 地上の魔物は地面に落ちる
    // 地上の魔物がとどくのは、地面のすぐ上（1段目）を飛んでいる魔物まで
    let foes=u.fly?alive(1-u.side):[...alive(1-u.side).filter(f=>!f.fly||f.y>=-TS.CS-2),...walls(1-u.side)]; if(!alive(1-u.side).length) continue;
    if(u.line){ const t0=u.y-TS.CS+4, t1=u.y-4; foes=foes.filter(f=>f.y>t0 && f.y-f.h<t1); }   // 同じ高さ（自分のマスの段）にいる相手だけ
    if(!foes.length){ u.atkT+=dt; advance(u,B,dt,walls); continue; }
    let tg=null, bd=Infinity; for(const f of foes){ const d=Math.hypot(f.x-u.x,(f.y-f.h/2)-(u.y-u.h/2)); if(d<bd){ bd=d; tg=f; } }
    const dx=tg.x-u.x, gap=Math.abs(dx)-(u.w+tg.w)/2, vgap=Math.abs((tg.y-tg.h/2)-(u.y-u.h/2))-(u.h+tg.h)/2;
    u.face=u.side?-1:1;
    u.atkT+=dt; u.moving=false;
    const rg=tg.wall?Math.max(u.range,2):u.range;   // 壁はくっついたところで攻撃する
    const vr=Math.max(rg,2);   // たての方向は、となりのマスならとどく
    if(gap>rg || (vgap>vr && !u.fly)){ let nx=u.x+Math.sign(dx)*u.spd*dt;
      if(!u.fly) for(const wl of walls(1-u.side)){ const edge=wl.x-Math.sign(dx)*(wl.w+u.w)/2; if(Math.sign(dx)>0 ? (u.x<=edge+1 && nx>edge) : (u.x>=edge-1 && nx<edge)) nx=edge; }   // 相手の壁は通りぬけられない
      u.x=nx; u.hop+=dt*8; u.moving=true; }
    else if(u.fly && vgap>rg){ const ty=tg.y-tg.h/2+u.h/2; u.y+=Math.sign(ty-u.y)*u.spd*0.8*dt; }
    else if(u.t<=0 && u.shot){ u.t=u.cd; u.atkT=0; B.shots.push({x:u.x+u.face*u.w*0.45, y:u.y-u.h*0.42, tg, dmg:u.atk, side:u.side, face:u.face, d:0.3}); }   // 魔法の玉：攻撃のアニメの6コマ目で飛び出す
    else if(u.t<=0){ u.t=u.cd; u.atkT=0; tg.hp=Math.max(0,tg.hp-u.atk); tg.flash=0.15; B.pops.push({x:tg.x,y:tg.y-tg.h,v:u.atk,t:0,side:tg.side});
      if(tg.hp<=0){ tg.dead=true; } }
    if(u.fly && gap>u.range){ const ty=tg.y-tg.h/2+u.h/2; u.y+=Math.sign(ty-u.y)*Math.min(Math.abs(ty-u.y),u.spd*0.5*dt); }
  }
  // 地雷：相手の地上の魔物が上を通ったら爆発（上の横3×縦2マス）。空中の魔物には反応しない
  for(const mn of B.mines){ if(mn.done) continue;
    const hit=B.units.find(u=>!u.dead&&!u.wall&&!u.fly&&u.side!==mn.side&&Math.abs(u.x-mn.x)<mn.w/2+u.w*0.25&&u.y>=-4);
    if(!hit) continue; mn.done=true; B.booms.push({x:mn.x,y:mn.y,t:0});
    const x0=mn.x-TS.CS*1.5, x1=mn.x+TS.CS*1.5, y0=-TS.CS*2;
    for(const u of B.units){ if(u.dead||u.wall||u.side===mn.side) continue; const ux0=u.x-u.w/2, ux1=u.x+u.w/2, uy0=u.y-u.h, uy1=u.y;
      if(ux1>x0&&ux0<x1&&uy1>y0&&uy0<4){ const d=Math.ceil(u.max/2); u.hp=Math.max(0,u.hp-d); u.flash=0.25; B.pops.push({x:u.x,y:u.y-u.h,v:d,t:0,side:u.side}); if(u.hp<=0) u.dead=true; } } }
  // 魔法の玉：ねらった相手まで飛んで当たる。とちゅうで相手がたおれたら消える
  for(const sh of B.shots){ if(sh.d>0){ sh.d-=dt; continue; } const tg=sh.tg; if(tg.dead){ sh.gone=true; continue; }
    const tx=tg.x, ty=tg.y-tg.h*0.45, dx=tx-sh.x, dy=ty-sh.y, d=Math.hypot(dx,dy), v=TS.CS*9*dt;
    if(d<=v+tg.w*0.3){ sh.gone=true; tg.hp=Math.max(0,tg.hp-sh.dmg); tg.flash=0.15; B.pops.push({x:tg.x,y:tg.y-tg.h,v:sh.dmg,t:0,side:tg.side}); if(tg.hp<=0) tg.dead=true; continue; }
    sh.x+=dx/d*v; sh.y+=dy/d*v; sh.ang=Math.atan2(dy,dx); }
  B.shots=B.shots.filter(sh=>!sh.gone);
  B.booms.forEach(b=>b.t+=dt); B.booms=B.booms.filter(b=>b.t<0.9);
  B.pops.forEach(p=>p.t+=dt); B.pops=B.pops.filter(p=>p.t<0.9);
  const a=alive(0).length, b=alive(1).length, left=B.end-now();
  if(!a||!b||left<=0){ B.over=true; const g=s=>B.units.filter(u=>u.side===s&&!u.wall).reduce((t,u)=>t+u.hp/u.max,0), ga=g(0), gb=g(1);
    const res = !b&&a?"win" : !a&&b?"lose" : !a&&!b?"draw" : ga>gb?"win" : ga<gb?"lose" : "draw";
    setTimeout(()=>result(res, ga, gb, !a||!b), 900); }
}
function result(res, ga, gb, ko){ if(!V) return; sfx(res==="win"?"win":"ng");
  const B=V.B, n=s=>B.units.filter(u=>u.side===s&&!u.dead&&!u.wall).length;
  dlg(`<div style="font-size:54px">${res==="win"?"🏆":res==="draw"?"🤝":"💀"}</div><h3>${res==="win"?T("勝利！","Victory!"):res==="draw"?T("引き分け","Draw"):T("敗北…","Defeat...")}</h3>
    <p>${ko?T("どちらかの魔物が全滅しました。","One side was wiped out."):T("1分がたったので、のこった体力ゲージの合計で決まりました。","Time's up — decided by the total of remaining HP gauges.")}<br>
    ${T("あなた","You")}：${T("のこり","left")} ${n(0)}${T("体","")}・${T("体力ゲージ合計","HP gauges")} <b>${ga.toFixed(2)}</b><br>${T("相手","Opponent")}：${T("のこり","left")} ${n(1)}${T("体","")}・${T("体力ゲージ合計","HP gauges")} <b>${gb.toFixed(2)}</b></p>${V.fight&&res==="win"&&window.tsTier?(()=>{ const r=window.tsTier(window.tsPower(V.fight)); return `<p style="font-weight:900;color:#c77d00">🎉 ${T(`冒険者Lv+${r.lv}・${fmt(r.c)}コイン！`,`Adventurer Lv+${r.lv} · ${fmt(r.c)} coins!`)}</p>`; })():""}`,
    V.fight?[[T("とじる","Close"),()=>closeTS()]]:[[T("準備にもどる","Back to setup"),()=>backToPrep()]],{modal:true});
  if(V.fight&&!V.done){ V.done=1; try{ window.tsFightDone&&window.tsFightDone(V.fight,res); }catch(e){} } }
function backToPrep(){ if(!V) return; V.mode="prep"; V.B=null; V.prepEnd=now()+TS.PREP_MS; V.root.querySelector("#tsPanel").hidden=false; resize(); sideView(); coinView(); fitPrep(); }

/* ---------- 描く ---------- */
function loop(ts){ if(!V) return; const dt=Math.min(0.05,(ts-V.last)/1000); V.last=ts;
  if(V.embed && !V.root.isConnected){ V.raf=requestAnimationFrame(loop); return; }   // ホームから別の画面に行っているあいだは描かない
  if(V.mode==="prep"&&V.embed){ /* 時間制限なし */ }
  else if(V.mode==="prep"){ const left=V.prepEnd-now(); timerView(T("準備時間","Setup time"),left); if(left<=0) readyGo(true); }
  else if(V.mode==="battle"&&V.B){ stepBattle(dt); timerView(T("制限時間","Time limit"),V.B.end-now()); }
  draw(); V.raf=requestAnimationFrame(loop); }
function timerView(l,ms){ const a=V.root.querySelector("#tsTmL"), b=V.root.querySelector("#tsTmV"), box=V.root.querySelector("#tsTm"); if(a.textContent!==l) a.textContent=l; const t=mmss(ms); if(b.textContent!==t) b.textContent=t; box.classList.toggle("low",ms<10000); }
function drawWorld(g, x0, x1){ const z=V.cam.z, top=s2w(0,0).y, bot=s2w(0,V.H).y;
  // 空
  const sky=g.createLinearGradient(0,0,0,V.H); sky.addColorStop(0,"#6bb8f0"); sky.addColorStop(1,"#a8dcff"); g.fillStyle=sky; g.fillRect(0,0,V.W,V.H);
  // 雲（ドット）
  g.fillStyle="#ffffffd0"; for(let i=-2;i<14;i++){ const wx=i*420+((i*137)%200), wy=-260-((i*73)%5)*70; const p=w2s(wx,wy); const s=8*z; for(const [a,b,c,d] of [[0,1,10,3],[2,0,6,1],[1,-1,4,1]]) g.fillRect(p.x+a*s*4,p.y+b*s*4,c*s*4,d*s*4); }
  // 地面
  const gy=w2s(0,0).y; g.fillStyle="#b98a5f"; g.fillRect(0,gy,V.W,V.H-gy);
  g.fillStyle="#5ec44a"; g.fillRect(0,gy,V.W,Math.max(3,18*z)); g.fillStyle="#3f8f2f"; const step=Math.max(4,16*z);
  for(let x=(-((V.cam.x*z)%step)); x<V.W; x+=step) g.fillRect(x,gy+18*z,step*0.5,Math.max(2,6*z));
  g.fillStyle="#111"; g.fillRect(0,gy-Math.max(1,2*z),V.W,Math.max(1,3*z));
  g.fillStyle="#9b6e47"; for(let i=0;i<60;i++){ const wx=((i*347)%4000)-800, wy=40+((i*97)%220); const p=w2s(wx,wy); g.fillRect(p.x,p.y,8*z,8*z); }
}
function drawGrid(g, X0, cols, rows, col){ const z=V.cam.z; g.strokeStyle=col; g.lineWidth=Math.max(1,2*z);
  for(let c=0;c<=cols;c++){ const a=w2s(X0+c*TS.CS,-rows*TS.CS), b=w2s(X0+c*TS.CS,-TS.UNDER*TS.CS); g.beginPath(); g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); g.stroke(); }
  for(let r=TS.UNDER;r<=rows;r++){ const a=w2s(X0,-r*TS.CS), b=w2s(X0+cols*TS.CS,-r*TS.CS); g.beginPath(); g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); g.stroke(); } }
function drawMon(g, id, cx, by, w, h, face, alpha, flash){ const im=imgOf(id); if(!im.complete||!im.naturalWidth) return; const z=V.cam.z;
  const k=Math.min(w/im.naturalWidth, h/im.naturalHeight), dw=im.naturalWidth*k*z, dh=im.naturalHeight*k*z, p=w2s(cx,by);
  g.save(); g.globalAlpha=alpha??1; g.translate(p.x,p.y); if(face<0) g.scale(-1,1); if(flash>0) g.filter="brightness(2.2)"; g.drawImage(im,-dw/2,-dh,dw,dh); g.restore(); }
// アニメのある魔物を描く（ないときは false）
function drawAnim(g,id,cx,by,w,face,kind,i,flash,alpha){ const an=(TS_MON[id]||{}).anim, A=an&&TS_ANIM[an]; if(!A) return false;
  const z=V.cam.z, base=A.size["w0"], dh=(TS_MON[id]||{}).drawH, sc=(dh?dh*TS.CS/base[1]:w*1.05/base[0])*z,   /* drawH：縦長の絵は高さ（マス）で大きさを決める */ p=w2s(cx,by);
  const one=(k,j,dx)=>{ const im=animImg(an+k+j); if(!im.complete||!im.naturalWidth) return; const m=A[k][j]; g.drawImage(im,dx-m[0]*sc,-m[1]*sc,im.naturalWidth*sc,im.naturalHeight*sc); };
  g.save(); g.globalAlpha=alpha??1; g.translate(p.x,p.y); if(face<0) g.scale(-1,1); if(flash>0) g.filter="brightness(2.2)";
  const cf=TS_MON[id]||{};
  if(kind==="a" && !A.a) one("w",cf.still?0:i,0);   // 攻撃の絵がない魔物は、飛ぶ絵のまま
  else if(kind==="a") one("a",cf.atkMap?cf.atkMap[i]:i,0);   // atkMap：使うコマのならび（ドットスライムはエフェクトのないコマだけ）
  else if(cf.flyLoop) one("w",cf.flyLoop[i%cf.flyLoop.length],0);   // 飛ぶ魔物は空中のコマだけをくり返す
  else one(kind,i,0);
  g.restore(); return true; }
function draw(){ const g=V.ctx; g.imageSmoothingEnabled=false; drawWorld(g);
  const z=V.cam.z;
  if(V.mode==="prep"){ const t=st();
    // 置ける場所
    const a=w2s(0,-t.rows*TS.CS), b=w2s(t.cols*TS.CS,-TS.UNDER*TS.CS); g.fillStyle="#ff5a5a14"; g.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);
    drawGrid(g,0,t.cols,t.rows,"#e0505599");
    if(V.sel&&!(V.drag&&V.drag.moved)){ const u=V.sel, k=cfgOf(u.id), a=0.16+0.16*(0.5+0.5*Math.sin(performance.now()/1000*6)); g.fillStyle=`rgba(255,40,40,${a.toFixed(3)})`;
      for(const [x,y,abs] of rangeCells(u.id)){ const c=u.c+k.w+x-1, r=abs?y:Math.max(0,u.r)+y; if(r<TS.UNDER) continue; const p0=w2s(c*TS.CS,-(r+1)*TS.CS), p1=w2s((c+1)*TS.CS,-r*TS.CS); g.fillRect(p0.x,p0.y,p1.x-p0.x,p1.y-p0.y); } }
    for(const u of t.units){ const k=cfgOf(u.id); let c=u.c, r=u.r; const dr=V.drag&&V.drag.u===u&&V.drag.moved; if(dr){ c=V.drag.c; r=V.drag.r; }
      if(dr||V.sel===u){ const ok=!dr||fits(u.id,c,r,u); const p0=w2s(c*TS.CS,-(r+k.h)*TS.CS), p1=w2s((c+k.w)*TS.CS,-r*TS.CS); g.fillStyle=ok?"#ffd75e55":"#ff303055"; g.fillRect(p0.x,p0.y,p1.x-p0.x,p1.y-p0.y); }
      if(!drawAnim(g,u.id,(c+k.w/2)*TS.CS,-r*TS.CS,k.w*TS.CS,1,"w",0,0,dr?0.75:1)) drawMon(g,u.id,(c+k.w/2)*TS.CS,-r*TS.CS,k.w*TS.CS,k.h*TS.CS,1,dr?0.75:1); }
    if(V.placing){ const k=cfgOf(V.placing.id); g.fillStyle="#fff"; g.font=`900 ${Math.round(13*V.dpr)}px sans-serif`; g.textAlign="center"; const p=w2s(t.cols*TS.CS/2,-t.rows*TS.CS); g.fillText(T(`${nameOf(V.placing.id)}（${k.w}×${k.h}）を置くマスをタップ`,`Tap a cell for ${nameOf(V.placing.id)} (${k.w}×${k.h})`),p.x,p.y-10*V.dpr); }
    const d=w2s(-TS.CS*0.9,0); if(deco.complete){ const h=TS.CS*1.1*z, w=h*deco.width/deco.height; g.drawImage(deco,d.x-w/2,d.y-h,w,h); }
    return; }
  const B=V.B; if(!B) return;
  drawGrid(g,B.X1,B.mine.cols,B.mine.rows,"#e0505530"); drawGrid(g,B.X2,B.opp.cols,B.opp.rows||B.mine.rows,"#5070e030");
  // かざり（両はし）
  if(deco.complete){ const h=TS.CS*1.1*z, w=h*deco.width/deco.height; const L=w2s(B.X1-TS.CS*1.2,0), R=w2s(B.W+TS.CS*1.2,0); g.drawImage(deco,L.x-w/2,L.y-h,w,h); g.save(); g.translate(R.x,R.y); g.scale(-1,1); g.drawImage(deco,-w/2,-h,w,h); g.restore(); }
  // 地雷：自分の地雷だけ見える（相手の地雷は見えない）
  for(const mn of B.mines){ if(mn.done||mn.side!==0) continue; drawMon(g,mn.id,mn.x,mn.y,mn.w,mn.h,1,0.85,0); }
  for(const bo of B.booms) drawFx(g,"mine",Math.min(9,1+Math.floor(bo.t/0.9*9)),bo.x,bo.y,1);   // 爆発（2〜10コマ目）
  const L=[...B.units].sort((a,b)=>b.h-a.h);
  for(const u of L){ if(u.dead&&u.wall){ if(u.deadT<1.0) drawFx(g,"wall",Math.min(9,Math.floor(u.deadT/1.0*10)),u.x,u.y,u.side?-1:1); continue; }   // 壁がくずれる
    if(u.dead){ if(u.deadT<1.2 && grave.complete){ const p=w2s(u.x,u.fly?u.y:0), h=TS.CS*0.7*z, w=h*grave.width/grave.height; g.globalAlpha=1-u.deadT/1.2; g.drawImage(grave,p.x-w/2,p.y-h,w,h); g.globalAlpha=1; } continue; }
    const still=(TS_MON[u.id]||{}).still, bob=still?Math.sin(V.last/1000*3.2+u.x0r)*5:u.fly?Math.sin(u.hop*0.6)*4:0;   // still：No.42・No.47 は羽を動かさず、1枚の絵のままゆらゆら進む
    if(u.wall) drawMon(g,u.id,u.x,u.y,u.w,u.h,u.side?-1:1,1,u.flash);
    else if(!drawAnim(g,u.id,u.x,u.y+bob,u.w,u.face,u.atkT<0.6?"a":"w",u.atkT<0.6?Math.min(9,Math.floor(u.atkT/0.6*10)):(still?0:u.fly?Math.floor(V.last/1000*12+u.x0r)%10:u.moving?Math.floor(u.hop*1.4)%10:0),u.flash)) drawMon(g,u.id,u.x,u.y+bob,u.w,u.h,u.face,1,u.flash);
    // 体力ゲージ
    const p=w2s(u.x-u.w*0.4,u.y-Math.max(u.h,u.drawH*TS.CS*0.97)-10), bw=u.w*0.8*z, bh=Math.max(3,7*z); g.fillStyle="#111"; g.fillRect(p.x-1,p.y-1,bw+2,bh+2); g.fillStyle="#3a1f2a"; g.fillRect(p.x,p.y,bw,bh);
    const r=u.hp/u.max; g.fillStyle=u.side?(r<.3?"#ff7a5a":"#ff9a3d"):(r<.3?"#ff5a5a":"#5ec44a"); g.fillRect(p.x,p.y,bw*r,bh); }
  // 炎をはく魔物（No.47）：攻撃のとちゅうで、口から斜め前下に炎の絵（10コマ ts/fire0〜9.png）を出す
  for(const u of B.units){ if(u.dead||!u.fire) continue; const fr=Math.floor((u.atkT-0.18)/0.06); if(fr<0||fr>9) continue;
    const im=fireImg(fr); if(!im.complete||!im.naturalWidth) continue; const m=FIRE_META[fr], sc=TS.CS*4.3/326*z, p=w2s(u.x+u.face*(u.w/2-TS.CS*0.2), u.y-TS.CS*1.3);
    g.save(); g.translate(p.x,p.y); g.scale(u.face,1); g.rotate(0.4); g.drawImage(im,0,-m[2]*sc,m[0]*sc,m[1]*sc); g.restore(); }
  g.globalAlpha=1;
  // 岩をつき出す魔物（No.42）：攻撃のとちゅうで、地面から岩が生える。近いマスから遠いマスへ順番に（10コマの絵 ts/rock0〜9）
  for(const u of B.units){ if(u.dead||!u.rock||u.atkT>2) continue; const R=cellRects(u), col={};
    R.forEach(r=>{ const c=u.zone.cells.find(c=>c[0]===r.k&&c[1]===r.dy)||[]; const h=c[2]?r.dy+1:0.6; col[r.k]=Math.max(col[r.k]||0,h); col[r.k+"x"]=(r.x0+r.x1)/2; });
    Object.keys(col).filter(k=>!k.endsWith("x")).map(Number).sort((a,b)=>a-b).forEach((k,idx)=>{
      const fr=Math.floor((u.atkT-0.08-idx*0.12)/0.065); if(fr<0||fr>9) return; const im=animImg("rock"+fr); if(!im.complete||!im.naturalWidth) return;
      const m=ROCK_META[fr], sc=col[k]*TS.CS*1.15/327*z, p=w2s(col[k+"x"],0);
      g.save(); g.translate(p.x,p.y); if(u.face<0) g.scale(-1,1); g.drawImage(im,-m[0]*sc,-m[1]*sc,im.naturalWidth*sc,im.naturalHeight*sc); g.restore(); }); }
  const shI=animImg("ts88shot");
  if(shI.complete&&shI.naturalWidth) for(const sh of B.shots){ if(sh.d>0) continue; const p=w2s(sh.x,sh.y), w=TS.CS*0.5*z, h=w*shI.naturalHeight/shI.naturalWidth; g.save(); g.translate(p.x,p.y); if(sh.ang!=null) g.rotate(sh.ang); else if(sh.face<0) g.scale(-1,1); g.drawImage(shI,-w/2,-h/2,w,h); g.restore(); }
  g.textAlign="center"; g.font=`900 ${Math.round(Math.max(11,16*z))}px sans-serif`;
  for(const q of B.pops){ const p=w2s(q.x,q.y-q.t*40); g.globalAlpha=1-q.t/0.9; g.fillStyle="#000"; g.fillText((typeof q.v==="number"?"-"+fmt(q.v):q.v),p.x+1,p.y+1); g.fillStyle=q.side?"#ffd75e":"#ff6a5a"; g.fillText((typeof q.v==="number"?"-"+fmt(q.v):q.v),p.x,p.y); } g.globalAlpha=1;
}
})();
