// ============================================
// ScoreCraft Ver1.3.39 - analysis.js
// ============================================
"use strict";

const ANALYSIS_CLUB_NAMES = {
    driver:"Driver","2w":"2W","3w":"3W","5w":"5W","7w":"7W","9w":"9W",
    "2ut":"2UT","3ut":"3UT","4ut":"4UT","5ut":"5UT","6ut":"6UT",
    "3i":"3I","4i":"4I","5i":"5I","6i":"6I","7i":"7I","8i":"8I","9i":"9I",
    pw:"PW","46":"46°","48":"48°","50":"50°","52":"52°","54":"54°","56":"56°","58":"58°","60":"60°",putter:"Putter"
};
const DIRECTION_ITEMS = [
    ["left","左（←）"],["right","右（→）"],["center","中央"],["short","手前"],["over","オーバー"]
];
const CURVE_ITEMS = [["left","左曲がり"],["straight","まっすぐ"],["right","右曲がり"]];
let analysisRounds = [];
let resizeTimer = null;

document.addEventListener("DOMContentLoaded", initializeAnalysis);
window.addEventListener("resize", handleChartResize);

function initializeAnalysis(){
    if(typeof renderNavigation === "function") renderNavigation("analysis");
    analysisRounds = loadAnalysisRounds();
    renderAnalysis();
}
function loadAnalysisRounds(){
    let rounds=[];
    try{ rounds = typeof load === "function" && typeof STORAGE !== "undefined" ? load(STORAGE.ROUNDS) : JSON.parse(localStorage.getItem("scorecraft_rounds")||"[]"); }
    catch(error){ console.error("分析データを読み込めませんでした。",error); }
    if(!Array.isArray(rounds)) return [];
    return rounds.filter(r=>r&&r.status!=="draft"&&getRoundScore(r)>0).sort((a,b)=>getRoundTime(b)-getRoundTime(a));
}
function renderAnalysis(){
    const count=document.getElementById("analysisRoundCount"); if(count) count.textContent=`${analysisRounds.length}回`;
    if(!analysisRounds.length){ renderEmptyAnalysis(); return; }
    renderSummary(); renderScoreChart(); renderThreeHoleAnalysis(); renderShotAnalysis(); renderPuttDistanceAnalysis();
}
function renderEmptyAnalysis(){
    const empty=`<div class="empty-state compact"><p>分析できるラウンドがまだありません。</p><button class="btn" type="button" onclick="location.href='round.html'">⛳ ラウンドを入力</button></div>`;
    ["analysisSummary","scoreChartArea","threeHoleAnalysis","shotAnalysis","puttDistanceAnalysis"].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=empty;});
}
function renderSummary(){
    const scores=analysisRounds.map(getRoundScore), totalPutts=sumHoleValue("putts"), totalOb=sumHoleValue("ob"), totalBunker=sumHoleValue("bunker");
    const stats=[["平均スコア",formatDecimal(average(scores))],["ベスト",Math.min(...scores)],["ラウンド数",`${analysisRounds.length}回`],["平均パット",formatDecimal(totalPutts/analysisRounds.length)],["OB平均",formatDecimal(totalOb/analysisRounds.length)],["バンカー平均",formatDecimal(totalBunker/analysisRounds.length)]];
    document.getElementById("analysisSummary").innerHTML=stats.map(([l,v])=>`<div class="analysis-stat-card"><span>${escapeHtml(l)}</span><strong>${escapeHtml(String(v))}</strong></div>`).join("");
}

function renderThreeHoleAnalysis(){
    const container=document.getElementById("threeHoleAnalysis");
    if(!container)return;
    const groups=[
        {label:"1–3H",start:1,end:3},{label:"4–6H",start:4,end:6},{label:"7–9H",start:7,end:9},
        {label:"10–12H",start:10,end:12},{label:"13–15H",start:13,end:15},{label:"16–18H",start:16,end:18}
    ];
    const items=groups.map(group=>{
        const diffs=[];
        analysisRounds.forEach(round=>{
            const holes=getHoles(round).filter(h=>Number(h?.hole)>=group.start&&Number(h?.hole)<=group.end);
            if(holes.length!==3)return;
            let valid=true,total=0;
            holes.forEach(h=>{
                const score=Number(h?.score),par=Number(h?.par);
                if(!Number.isFinite(score)||!Number.isFinite(par)){valid=false;return;}
                total+=score-par;
            });
            if(valid)diffs.push(total);
        });
        return {...group,average:diffs.length?average(diffs):NaN,count:diffs.length};
    });
    container.innerHTML=`<div class="three-hole-grid">${items.map(item=>{
        const value=Number.isFinite(item.average)?(item.average===0?"E":`${item.average>0?"+":""}${item.average.toFixed(1)}`):"-";
        const cls=Number.isFinite(item.average)?(item.average<0?"under":item.average>0?"over":"even"):"";
        return `<div class="three-hole-item ${cls}"><span>${item.label}</span><strong>${value}</strong><small>${item.count}R平均</small></div>`;
    }).join("")}</div>`;
}

function getAnalysisShots(){
    const result=[];
    analysisRounds.forEach(round=>getHoles(round).forEach(hole=>{
        if(Array.isArray(hole?.shots) && hole.shots.length){
            hole.shots.forEach((shot,index)=>{
                const clubId=String(shot?.clubId||"").trim();
                const targetRaw=shot?.targetYards;
                const targetYards=(targetRaw===null||targetRaw===""||targetRaw===undefined)?null:Number(targetRaw);
                const landing=normalizeShotLanding(shot?.landing);
                const penalty=String(shot?.penalty||"").trim();
                if(!clubId && !Number.isFinite(targetYards) && !landing && !penalty) return;
                result.push({round,hole:Number(hole?.hole)||null,shotNo:index+1,clubId,targetYards:Number.isFinite(targetYards)&&targetYards>0?targetYards:null,landing,penalty});
            });
            return;
        }
        const tee=hole?.teeShot;
        if(tee && (tee.clubId||tee.direction)) result.push({round,hole:Number(hole?.hole)||null,shotNo:1,clubId:String(tee.clubId||"").trim(),targetYards:null,landing:normalizeShotLanding(tee.direction),penalty:""});
        const a=hole?.approachShot; const legacyDistance=Number(a?.distanceYards);
        if(a && (a.clubId || Number.isFinite(legacyDistance))) result.push({round,hole:Number(hole?.hole)||null,shotNo:null,clubId:String(a.clubId||"").trim(),targetYards:Number.isFinite(legacyDistance)&&legacyDistance>0?legacyDistance:null,landing:a.greenOn===true?"green":(a.greenOn===false?"miss":""),penalty:""});
    }));
    return result;
}
function getMyClubIdsForAnalysis(){
    let ids=[];
    try{
        const saved=JSON.parse(localStorage.getItem("scorecraft_selected_clubs")||"null");
        if(Array.isArray(saved)) ids=saved.map(v=>String(v||"").trim()).filter(Boolean);
    }catch(e){}
    if(!ids.length && Array.isArray(window.CLUBS)) ids=window.CLUBS.map(c=>String(c?.id||"").trim()).filter(Boolean);
    return [...new Set(ids)].sort(compareGolfClubOrder);
}
function golfClubOrderValue(id){
    const s=String(id||"").toUpperCase().replace(/\s+/g,"");
    if(s==="1W"||s==="DR"||s.includes("DRIVER"))return 100;
    let m=s.match(/^(\d+)W$/);if(m)return 200+Number(m[1]);
    m=s.match(/^(\d+)(UT|U|H)$/);if(m)return 300+Number(m[1]);
    m=s.match(/^(\d+)I$/);if(m)return 400+Number(m[1]);
    if(s==="PW")return 510;if(s==="AW"||s==="GW")return 520;if(s==="SW")return 530;
    m=s.match(/^(\d+)(?:°|DEG)?$/);if(m)return 500+Number(m[1]);
    if(s==="PT"||s.includes("PUTTER"))return 900;return 700;
}
function compareGolfClubOrder(a,b){const d=golfClubOrderValue(a)-golfClubOrderValue(b);return d||String(a).localeCompare(String(b),"ja",{numeric:true});}
function renderShotAnalysis(){
    const container=document.getElementById("shotAnalysis"); if(!container)return;
    const holes=[];
    analysisRounds.forEach(round=>getHoles(round).forEach(hole=>{
        const score=Number(hole?.score),par=Number(hole?.par);
        if(Number.isFinite(score)&&score>0&&Number.isFinite(par))holes.push({round,hole,score,par});
    }));
    if(!holes.length){container.innerHTML=`<div class="empty-state compact"><p>ショット分析に使えるデータがまだありません。</p></div>`;return;}
    container.innerHTML=[
        renderTeeKpi(holes),
        renderSecondKpi(holes),
        renderApproachKpi(holes)
    ].join("");
}
function kpiSection(title,desc,body){return `<section class="kpi-section"><div class="kpi-section-title"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(desc)}</p></div>${body}</section>`;}
function kpiTable(headers,rows){
    if(!rows.length)return `<p class="analysis-note">対象データがありません。</p>`;
    return `<div class="kpi-table-scroll"><table class="kpi-table"><thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((v,i)=>`<${i===0?"th":"td"}>${v}</${i===0?"th":"td"}>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function pct(n,d){return d?`${(n/d*100).toFixed(1)}%`:`—`;}
function avgText(vals,suffix=""){return vals.length?`${average(vals).toFixed(2)}${suffix}`:`—`;}
function teeShotForHole(hole){
    if(Array.isArray(hole?.shots)&&hole.shots.length){
        const s=hole.shots[0]||{}; return {clubId:String(s.clubId||hole?.teeShot?.clubId||"").trim(),landing:normalizeShotLanding(s.landing||hole?.teeShot?.direction),penalty:String(s.penalty||"").trim()};
    }
    return {clubId:String(hole?.teeShot?.clubId||"").trim(),landing:normalizeShotLanding(hole?.teeShot?.direction),penalty:""};
}
function teeOutcome(item){
    const {hole}=item,tee=teeShotForHole(hole),p=tee.penalty;
    if(p==="ob"||(!p&&Number(hole?.ob)>0))return "OB";
    if(p==="onePenalty"||(!p&&Number(hole?.onePenalty)>0))return "1ペナ";
    if(p==="woods")return "林";
    if(p==="bunker"||(!p&&Number(hole?.bunker)>0))return "砂";
    if(tee.landing==="fairway"||tee.landing==="center")return "FW";
    if(tee.landing==="left")return "左";
    if(tee.landing==="right")return "右";
    return "その他";
}
function isPlayableTee(item){return ["FW","左","右"].includes(teeOutcome(item));}
function groupedKpiTable(headers,groups){
    const totalRows=groups.reduce((sum,g)=>sum+g.rows.length,0);
    if(!totalRows)return `<p class="analysis-note">対象データがありません。</p>`;
    const body=groups.map(g=>g.rows.map((r,ri)=>`<tr>${ri===0?`<th class="kpi-par-cell" rowspan="${g.rows.length}">${escapeHtml(g.label)}</th>`:""}${r.map((v,i)=>`<${i===0?"th":"td"}>${v}</${i===0?"th":"td"}>`).join("")}</tr>`).join("")).join("");
    return `<div class="kpi-table-scroll"><table class="kpi-table kpi-grouped-table"><thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
}
function renderTeeKpi(holes){
    const teeHoles=holes.filter(x=>[4,5].includes(x.par)&&teeShotForHole(x.hole).clubId);
    const clubGroups={}; teeHoles.forEach(x=>{const id=teeShotForHole(x.hole).clubId;(clubGroups[id]??=[]).push(x);});
    const clubs=Object.keys(clubGroups).sort(compareGolfClubOrder);
    const clubParGroups=[4,5].map(par=>({label:`PAR${par}`,rows:clubs.map(id=>{const a=clubGroups[id].filter(x=>x.par===par);if(!a.length)return null;return [escapeHtml(getClubName(id)),avgText(a.map(x=>x.score)),pct(a.filter(x=>x.score<=par+1).length,a.length),pct(a.filter(x=>x.score>=par+2).length,a.length),`${a.length}H`];}).filter(Boolean)})).filter(g=>g.rows.length);

    const outcomeDefs=[["FW","FW"],["左","左ラフ"],["右","右ラフ"],["砂","バンカー"],["OB","OB"],["1ペナ","1ペナ"]];
    const outcomeParGroups=[4,5].map(par=>({label:`PAR${par}`,rows:outcomeDefs.map(([key,label])=>{const a=teeHoles.filter(x=>x.par===par&&teeOutcome(x)===key);if(!a.length)return null;return [label,avgText(a.map(x=>x.score)),pct(a.filter(x=>x.score<=par+1).length,a.length),pct(a.filter(x=>x.score>=par+2).length,a.length),`${a.length}H`];}).filter(Boolean)})).filter(g=>g.rows.length);

    const playableRows=clubs.map(id=>{const a=clubGroups[id];return [escapeHtml(getClubName(id)),pct(a.filter(isPlayableTee).length,a.length),`${a.filter(isPlayableTee).length}/${a.length}`];});
    const obRows=clubs.map(id=>{const a=clubGroups[id],obs=a.filter(x=>teeOutcome(x)==="OB"),left=obs.filter(x=>teeShotForHole(x.hole).landing==="left").length,right=obs.filter(x=>teeShotForHole(x.hole).landing==="right").length;let tendency="—";if(obs.length)tendency=left>right?`左 ${left}/${obs.length}`:right>left?`右 ${right}/${obs.length}`:`左右同数 ${left}/${obs.length}`;return [escapeHtml(getClubName(id)),pct(obs.length,a.length),tendency,`${a.length}H`];});
    const body=`<h4>使用クラブごとの平均スコア</h4>${groupedKpiTable(["PAR","クラブ","平均","ボギー以下","ダボ以上","サンプル数"],clubParGroups)}<h4>着弾・ペナルティごとの平均スコア</h4>${groupedKpiTable(["PAR","結果","平均","ボギー以下","ダボ以上","サンプル数"],outcomeParGroups)}<h4>使用クラブごとのOKエリア率</h4>${kpiTable(["クラブ","OK率","OK/全体"],playableRows)}<p class="analysis-note kpi-rule">OK＝FW・左ラフ・右ラフ。NG＝林・バンカー・1ペナ・OB・その他。</p><h4>クラブごとのOB率・ミス方向</h4>${kpiTable(["クラブ","OB率","OB方向","サンプル数"],obRows)}`;
    return kpiSection("ティーショット","Par4・Par5の1打目をクラブ・結果別に集計",body);
}
function greenAimShots(holes){
    const out=[];
    holes.forEach(item=>{
        const shots=Array.isArray(item.hole?.shots)?item.hole.shots:[];
        shots.forEach((s,i)=>{const yards=Number(s?.targetYards);if(!Number.isFinite(yards)||yards<=0)return;const landing=normalizeShotLanding(s?.landing);out.push({...item,shot:s,shotNo:i+1,yards,landing,on:landing==="green",afterMath:Math.max(0,item.score-(i+1)),firstPutt:Number(item.hole?.greenDistance?.value)});});
    });return out;
}
function yardBucket(y){if(y<=50)return"〜50yd";if(y<=75)return"51〜75yd";if(y<=100)return"76〜100yd";if(y<=125)return"101〜125yd";if(y<=150)return"126〜150yd";if(y<=175)return"151〜175yd";if(y<=200)return"176〜200yd";return"201yd〜";}
function renderSecondKpi(holes){
    const shots=greenAimShots(holes),miss=shots.filter(s=>!s.on),dirs=[["left","左"],["right","右"],["short","手前"],["over","オーバー"]];
    const dirTotal=miss.filter(s=>dirs.some(([k])=>k===s.landing)).length;
    const missRows=dirs.map(([k,l])=>{const a=miss.filter(s=>s.landing===k);return [l,pct(a.length,dirTotal),`${a.length}打`];});
    const afterRows=dirs.map(([k,l])=>{const a=miss.filter(s=>s.landing===k);return [l,avgText(a.map(s=>s.afterMath),"打"),`${a.length}打`];});
    const order=["〜50yd","51〜75yd","76〜100yd","101〜125yd","126〜150yd","151〜175yd","176〜200yd","201yd〜"];
    const yardRows=order.map(label=>{const a=shots.filter(s=>yardBucket(s.yards)===label);if(!a.length)return null;const on=a.filter(s=>s.on),putts=on.map(s=>s.firstPutt).filter(v=>Number.isFinite(v)&&v>=0);return [label,pct(on.length,a.length),putts.length?`${average(putts).toFixed(1)}歩`:`—`,`${a.length}打`];}).filter(Boolean);
    return kpiSection("セカンド","残りヤードを入力したグリーン狙いショットを集計",`<h4>グリーンを狙ったショットのミス傾向</h4>${kpiTable(["方向","割合","数"],missRows)}<h4>グリーンを外した方向別、その後のホールアウトまでの打数</h4>${kpiTable(["方向","平均残り打数","数"],afterRows)}<h4>残り距離別 GIR率・ON時の平均パット距離</h4>${kpiTable(["残り距離","GIR","ON時パット距離","数"],yardRows)}<p class="analysis-note kpi-rule">※「その後の打数」はグリーンを狙ったショット自体を含まず、次打からホールアウトまで。</p>`);
}
function renderApproachKpi(holes){
    const shots=greenAimShots(holes),on=shots.filter(s=>s.on),off=shots.filter(s=>!s.on);
    const offPutts=off.map(s=>s.firstPutt).filter(v=>Number.isFinite(v)&&v>=0),onPutts=on.map(s=>s.firstPutt).filter(v=>Number.isFinite(v)&&v>=0);
    const rows=[["グリーンON",onPutts.length?`${average(onPutts).toFixed(1)}歩`:`—`,avgText(on.map(s=>s.afterMath),"打"),`${on.length}打`],["グリーンOFF",offPutts.length?`${average(offPutts).toFixed(1)}歩`:`—`,avgText(off.map(s=>s.afterMath),"打"),`${off.length}打`]];
    return kpiSection("アプローチ","グリーンON/OFF後の寄せ・パット結果を比較",`${kpiTable(["結果","平均初回パット距離","その後の平均打数","数"],rows)}<p class="analysis-note kpi-rule">※ 初回パット距離が入力されているホールのみ距離平均に使用。</p>`);
}
function renderPuttDistanceAnalysis(){
    const buckets=[];
    for(let i=1;i<=10;i++) buckets.push({label:`${i}歩`,min:i,max:i,putts:[]});
    buckets.push({label:"11〜15歩",min:11,max:15,putts:[]},{label:"16歩以上",min:16,max:Infinity,putts:[]});

    analysisRounds.forEach(round=>getHoles(round).forEach(hole=>{
        const distance=Number(hole?.greenDistance?.value), putts=Number(hole?.putts);
        if(!Number.isFinite(distance)||!Number.isFinite(putts)||distance<1) return;
        const bucket=buckets.find(b=>distance>=b.min&&distance<=b.max);
        if(bucket) bucket.putts.push(putts);
    }));

    const container=document.getElementById("puttDistanceAnalysis");
    if(!buckets.some(b=>b.putts.length)){
        container.innerHTML=`<div class="empty-state compact"><p>パット距離とパット数の入力データがありません。</p></div>`;
        return;
    }

    container.innerHTML=`<div class="putt-chart-scroll"><canvas id="puttDistanceChart" aria-label="パット距離別の平均パット数を示す棒グラフ"></canvas></div><p class="putt-chart-note">棒の上：平均パット数 ／ 距離の下：対象ホール数</p>`;
    drawPuttDistanceChart(buckets);
}

function drawPuttDistanceChart(buckets){
    const canvas=document.getElementById("puttDistanceChart");
    if(!canvas||!canvas.getContext) return;
    const holder=canvas.parentElement;
    const cssWidth=Math.max(280,Math.floor(holder.getBoundingClientRect().width));
    const height=Math.round(cssWidth*0.75); // 縦3：横4
    const ratio=window.devicePixelRatio||1;
    canvas.width=Math.round(cssWidth*ratio); canvas.height=Math.round(height*ratio);
    canvas.style.width=`${cssWidth}px`; canvas.style.height=`${height}px`;
    const c=canvas.getContext("2d"); c.setTransform(ratio,0,0,ratio,0,0); c.clearRect(0,0,cssWidth,height);

    const compact=cssWidth<390;
    const left=compact?34:44,right=compact?6:12,top=compact?25:30,bottom=compact?58:68;
    const plotW=cssWidth-left-right,plotH=height-top-bottom;
    const values=buckets.map(b=>b.putts.length?average(b.putts):NaN).filter(Number.isFinite);
    const maxData=values.length?Math.max(...values):3;
    const yMax=Math.max(3,Math.ceil((maxData+0.2)*2)/2);
    const tickStep=0.5;
    const axisFont=compact?8.5:10.5,labelFont=compact?7.5:10,valueFont=compact?8:10.5;

    c.font=`${axisFont}px "Yu Gothic UI",sans-serif`; c.textBaseline="middle";
    for(let v=0;v<=yMax+0.001;v+=tickStep){
        const y=top+plotH-(v/yMax)*plotH;
        c.strokeStyle="#e4e9e5"; c.lineWidth=1; c.beginPath(); c.moveTo(left,y); c.lineTo(cssWidth-right,y); c.stroke();
        c.fillStyle="#69756d"; c.textAlign="right"; c.fillText(v.toFixed(1),left-5,y);
    }
    c.strokeStyle="#738078"; c.lineWidth=1.1; c.beginPath(); c.moveTo(left,top); c.lineTo(left,top+plotH); c.lineTo(cssWidth-right,top+plotH); c.stroke();

    const slot=plotW/buckets.length,barW=Math.max(10,Math.min(36,slot*0.58));
    buckets.forEach((b,i)=>{
        const avg=b.putts.length?average(b.putts):NaN;
        const x=left+slot*i+slot/2;
        if(Number.isFinite(avg)){
            const h=(avg/yMax)*plotH,y=top+plotH-h;
            const grad=c.createLinearGradient(0,y,0,top+plotH); grad.addColorStop(0,"#4b7ee8"); grad.addColorStop(1,"#2d63cf");
            c.fillStyle=grad; roundedRect(c,x-barW/2,y,barW,h,Math.min(4,barW/3)); c.fill();
            c.fillStyle="#1f5dcc"; c.font=`bold ${valueFont}px "Yu Gothic UI",sans-serif`; c.textAlign="center"; c.textBaseline="bottom"; c.fillText(avg.toFixed(2),x,y-4);
        }
        c.fillStyle="#25302a"; c.font=`${labelFont}px "Yu Gothic UI",sans-serif`; c.textAlign="center"; c.textBaseline="top";
        const label=b.label.replace("歩以上","+").replace("〜","-");
        c.fillText(label,x,top+plotH+8);
        c.fillStyle="#7b8580"; c.font=`${compact?7:9}px "Yu Gothic UI",sans-serif`; c.fillText(b.putts.length?`${b.putts.length}回`:"—",x,top+plotH+23);
    });

    c.save(); c.translate(compact?9:12,top+plotH/2); c.rotate(-Math.PI/2); c.fillStyle="#526058"; c.font=`${compact?8:10}px "Yu Gothic UI",sans-serif`; c.textAlign="center"; c.textBaseline="top"; c.fillText("平均パット数（回）",0,0); c.restore();
    c.fillStyle="#526058"; c.font=`${compact?8:10}px "Yu Gothic UI",sans-serif`; c.textAlign="center"; c.textBaseline="bottom"; c.fillText("パット距離（歩数）",left+plotW/2,height-3);
}

function renderScoreChart(){
    const canvas=document.getElementById("scoreChart"); if(!canvas||!canvas.getContext)return;
    const rounds=analysisRounds.slice(0,10).reverse();
    const scores=rounds.map(getRoundScore),putts=rounds.map(getRoundPutts),distances=rounds.map(getRoundAverageDistance);
    const rect=canvas.parentElement.getBoundingClientRect();
    const width=Math.max(280,Math.floor(rect.width)),height=Math.round(width*0.75),ratio=window.devicePixelRatio||1; // 縦3：横4
    canvas.width=Math.round(width*ratio); canvas.height=Math.round(height*ratio); canvas.style.width=`${width}px`; canvas.style.height=`${height}px`;
    const c=canvas.getContext("2d"); c.setTransform(ratio,0,0,ratio,0,0); c.clearRect(0,0,width,height);

    const compact=width<390;
    const left=compact?34:44,right=compact?67:82,top=compact?25:30,bottom=compact?39:50;
    const plotW=width-left-right,plotH=height-top-bottom,plotRight=left+plotW;
    // 系列ごとに余白を変え、棒と折れ線の重なりを抑える。
    // スコアは上側の余白を広めに取り、棒の上端を少し下げる。
    // パット数と平均距離は下限側の余白を広めに取り、折れ線を上側へ配置する。
    const scoreScale=makeSeriesScale(scores,{unit:5,steps:5,lowerPadding:5,upperPadding:15,minFloor:0});
    const puttScale=makeSeriesScale(putts,{unit:2,steps:4,lowerPadding:6,upperPadding:2,minFloor:0});
    const distanceScale=makeSeriesScale(distances,{unit:0.5,steps:4,lowerPadding:1.5,upperPadding:0.5,minFloor:0});
    const axisFont=compact?8:10,labelFont=compact?7.5:10,valueFont=compact?7.5:10;

    c.font=`${axisFont}px "Yu Gothic UI",sans-serif`; c.textBaseline="middle";
    for(let i=0;i<=5;i++){
        const y=top+plotH*i/5,value=scoreScale.max-(scoreScale.max-scoreScale.min)*i/5;
        c.strokeStyle="#e3e8e4"; c.lineWidth=1; c.beginPath(); c.moveTo(left,y); c.lineTo(plotRight,y); c.stroke();
        c.fillStyle="#2E7D32"; c.textAlign="right"; c.fillText(String(Math.round(value)),left-5,y);
    }
    for(let i=0;i<=4;i++){
        const y=top+plotH*i/4,value=puttScale.max-(puttScale.max-puttScale.min)*i/4;
        c.fillStyle="#2367d7"; c.textAlign="left"; c.fillText(String(Math.round(value)),plotRight+5,y);
    }
    for(let i=0;i<=4;i++){
        const y=top+plotH*i/4,value=distanceScale.max-(distanceScale.max-distanceScale.min)*i/4;
        c.fillStyle="#f26a13"; c.textAlign="right"; c.fillText(value.toFixed(1),width-1,y);
    }

    c.strokeStyle="#2E7D32"; c.lineWidth=1.1; c.beginPath(); c.moveTo(left,top); c.lineTo(left,top+plotH); c.stroke();
    c.strokeStyle="#2367d7"; c.beginPath(); c.moveTo(plotRight,top); c.lineTo(plotRight,top+plotH); c.stroke();
    c.strokeStyle="#f26a13"; c.beginPath(); c.moveTo(width-(compact?25:31),top); c.lineTo(width-(compact?25:31),top+plotH); c.stroke();

    c.font=`bold ${axisFont}px "Yu Gothic UI",sans-serif`; c.textBaseline="bottom";
    c.fillStyle="#2E7D32"; c.textAlign="left"; c.fillText("スコア",left,top-6);
    c.fillStyle="#2367d7"; c.textAlign="left"; c.fillText("パット",plotRight+3,top-6);
    c.fillStyle="#f26a13"; c.textAlign="right"; c.fillText("距離",width-1,top-6);

    // データ点を左右の縦軸から内側へ寄せ、軸・目盛りとの重なりを防ぐ。
    const fixedSlots=10;
    const slot=plotW/fixedSlots,barW=Math.max(8,Math.min(28,slot*0.58));
    const edgeInset=Math.max(barW/2+4,compact?11:14);
    const dataLeft=left+edgeInset;
    const dataPlotW=Math.max(1,plotW-edgeInset*2);
    const fixedStep=dataPlotW/(fixedSlots-1);
    const getDataX=i=>dataLeft+fixedStep*i;

    // スコアは棒グラフ
    scores.forEach((v,i)=>{
        if(!Number.isFinite(v))return;
        const x=getDataX(i);
        const y=top+(scoreScale.max-v)/(scoreScale.max-scoreScale.min)*plotH;
        const base=top+plotH,h=Math.max(1,base-y);
        const grad=c.createLinearGradient(0,y,0,base); grad.addColorStop(0,"#58b54d"); grad.addColorStop(1,"#2f8c32");
        c.fillStyle=grad; roundedRect(c,x-barW/2,y,barW,h,3); c.fill();
        c.fillStyle="#247a2a"; c.font=`bold ${valueFont}px "Yu Gothic UI",sans-serif`; c.textAlign="center"; c.textBaseline="bottom"; c.fillText(String(Math.round(v)),x,y-3);
    });

    // パット数と平均パット距離は折れ線
    drawLineSeriesFixedSlots(c,putts,puttScale,"#2367d7",dataLeft,top,fixedStep,plotH,0,true,valueFont);
    drawLineSeriesFixedSlots(c,distances,distanceScale,"#f26a13",dataLeft,top,fixedStep,plotH,1,true,valueFont);

    c.fillStyle="#5f6c64"; c.font=`${labelFont}px "Yu Gothic UI",sans-serif`; c.textAlign="center"; c.textBaseline="top";
    rounds.forEach((r,i)=>{const x=getDataX(i);c.fillText(formatChartDate(r.date),x,top+plotH+8);});
    c.fillStyle="#526058"; c.font=`${compact?8:10}px "Yu Gothic UI",sans-serif`; c.fillText("ラウンド",left+plotW/2,height-13);
}

function makeSeriesScale(values,options={}){
    const unit=Number(options.unit)||1;
    const steps=Number(options.steps)||4;
    const lowerPadding=Number.isFinite(Number(options.lowerPadding))?Number(options.lowerPadding):unit;
    const upperPadding=Number.isFinite(Number(options.upperPadding))?Number(options.upperPadding):unit;
    const minFloor=Number.isFinite(Number(options.minFloor))?Number(options.minFloor):0;
    const finite=values.filter(Number.isFinite);
    let dataMin=finite.length?Math.min(...finite):minFloor;
    let dataMax=finite.length?Math.max(...finite):minFloor+unit*steps;
    if(dataMin===dataMax){dataMin-=unit;dataMax+=unit;}
    let min=Math.max(minFloor,Math.floor((dataMin-lowerPadding)/unit)*unit);
    let max=Math.ceil((dataMax+upperPadding)/unit)*unit;
    if(max-min<unit*steps) max=min+unit*steps;
    return {min,max};
}
function drawLineSeries(c,values,scale,color,left,top,plotW,plotH,count,decimals,showValues=false,fontSize=9){
    const pts=values.map((v,i)=>({x:count===1?left+plotW/2:left+plotW*i/(count-1),y:Number.isFinite(v)?top+(scale.max-v)/(scale.max-scale.min)*plotH:null,v}));
    c.strokeStyle=color; c.lineWidth=2.2; c.lineJoin="round"; c.lineCap="round"; c.beginPath(); let started=false;
    pts.forEach(p=>{if(p.y===null){started=false;return;}if(!started){c.moveTo(p.x,p.y);started=true;}else c.lineTo(p.x,p.y);}); c.stroke();
    pts.forEach((p,i)=>{
        if(p.y===null)return;
        c.fillStyle=color; c.strokeStyle="#fff"; c.lineWidth=1.2; c.beginPath(); c.arc(p.x,p.y,3.5,0,Math.PI*2); c.fill(); c.stroke();
        if(showValues){
            const offset=i%2===0?-7:12;
            c.fillStyle=color; c.font=`bold ${fontSize}px "Yu Gothic UI",sans-serif`; c.textAlign="center"; c.textBaseline=offset<0?"bottom":"top";
            c.fillText(Number(p.v).toFixed(decimals),p.x,p.y+offset);
        }
    });
}

function drawLineSeriesFixedSlots(c,values,scale,color,left,top,step,plotH,decimals,showValues=false,fontSize=9){const pts=values.map((v,i)=>({x:left+step*i,y:Number.isFinite(v)?top+(scale.max-v)/(scale.max-scale.min)*plotH:null,v})); c.strokeStyle=color;c.lineWidth=2.2;c.lineJoin="round";c.lineCap="round";c.beginPath();let started=false;pts.forEach(p=>{if(p.y===null){started=false;return;}if(!started){c.moveTo(p.x,p.y);started=true;}else c.lineTo(p.x,p.y);});c.stroke();pts.forEach((p,i)=>{if(p.y===null)return;c.fillStyle=color;c.strokeStyle="#fff";c.lineWidth=1.2;c.beginPath();c.arc(p.x,p.y,3.5,0,Math.PI*2);c.fill();c.stroke();if(showValues){const offset=i%2===0?-7:12;c.fillStyle=color;c.font=`bold ${fontSize}px "Yu Gothic UI",sans-serif`;c.textAlign="center";c.textBaseline=offset<0?"bottom":"top";c.fillText(Number(p.v).toFixed(decimals),p.x,p.y+offset);}});}

function roundedRect(c,x,y,w,h,r){
    const rr=Math.min(r,w/2,h/2); c.beginPath(); c.moveTo(x+rr,y); c.arcTo(x+w,y,x+w,y+h,rr); c.arcTo(x+w,y+h,x,y+h,rr); c.arcTo(x,y+h,x,y,rr); c.arcTo(x,y,x+w,y,rr); c.closePath();
}
function getRoundPutts(round){return getHoles(round).reduce((s,h)=>s+(Number.isFinite(Number(h?.putts))?Number(h.putts):0),0);}
function getRoundAverageDistance(round){const vals=getHoles(round).map(h=>Number(h?.greenDistance?.value)).filter(v=>Number.isFinite(v)&&v>=0);return vals.length?average(vals):NaN;}
function formatAxisValue(v,label){return label==="平均距離"?v.toFixed(1):String(Math.round(v));}
function handleChartResize(){clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(analysisRounds.length){renderScoreChart();renderPuttDistanceAnalysis();}},120);}
function sumHoleValue(key){return analysisRounds.reduce((rt,r)=>rt+getHoles(r).reduce((ht,h)=>{const v=Number(h?.[key]);return ht+(Number.isFinite(v)?v:0);},0),0);}
function getHoles(round){return Array.isArray(round?.holes)?round.holes:[];}
function getRoundScore(round){const total=Number(round?.total);if(Number.isFinite(total)&&total>0)return total;return getHoles(round).reduce((s,h)=>s+(Number.isFinite(Number(h?.score))?Number(h.score):0),0);}
function getRoundTime(round){const t=new Date(round?.completedAt||round?.date||round?.updatedAt||round?.createdAt).getTime();return Number.isFinite(t)?t:0;}
function normalizeShotLanding(value){
    const d=String(value||"").toLowerCase().trim();
    if(["fairway","fw","fwキープ","center","centre","middle","中央","真ん中","straight","ストレート"].includes(d))return "fairway";
    if(["green","greenon","green-on","on","1on","グリーン","グリーンオン"].includes(d))return "green";
    if(["left","l","左","←"].includes(d))return "left";
    if(["right","r","右","→"].includes(d))return "right";
    if(["short","手前","↓"].includes(d))return "short";
    if(["over","long","オーバー","奥","↑"].includes(d))return "over";
    if(["miss","ミス"].includes(d))return "miss";
    return "";
}
function normalizeCurve(value){const d=String(value||"").toLowerCase().trim();if(["left","左","左曲がり","draw","hook"].includes(d))return"left";if(["right","右","右曲がり","fade","slice"].includes(d))return"right";if(["straight","center","まっすぐ","ストレート"].includes(d))return"straight";return"";}
function normalizeDirection(value){const d=String(value||"").toLowerCase().trim();if(["left","l","左","←"].includes(d))return"left";if(["right","r","右","→"].includes(d))return"right";if(["center","centre","straight","middle","c","中央","真ん中","ストレート","fairway","green","fwキープ","1on","グリーンオン"].includes(d))return"center";if(["short","手前","↓"].includes(d))return"short";if(["over","オーバー","↑"].includes(d))return"over";return"";}
function getClubName(id){return ANALYSIS_CLUB_NAMES[id]||String(id).toUpperCase();}
function safeId(v){return String(v).replace(/[^a-zA-Z0-9_-]/g,"-");}
function average(v){return v.length?v.reduce((s,n)=>s+n,0)/v.length:0;}
function formatDecimal(v){return Number.isFinite(v)?v.toFixed(1):"0.0";}
function formatChartDate(value){if(!value)return"-";const d=new Date(`${value}T00:00:00`);return Number.isNaN(d.getTime())?"-":`${d.getMonth()+1}/${d.getDate()}`;}
function escapeHtml(value){return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}


// ===== Ver1.3.24 trend/stat overrides =====
function analysisHoleShots(hole){
    if(Array.isArray(hole?.shots)&&hole.shots.length)return hole.shots;
    const result=[];
    if(hole?.teeShot&&(hole.teeShot.clubId||hole.teeShot.direction))result.push({landing:hole.teeShot.direction||"",targetYards:null});
    if(hole?.approachShot&&(hole.approachShot.clubId||hole.approachShot.distanceYards!==null))result.push({landing:hole.approachShot.greenOn===true?"green":"",targetYards:hole.approachShot.distanceYards});
    return result;
}
function analysisFirstGreenShotNo(hole){
    // Ver1.3.25: グリーンON打数はスコア - パット数で統一する。
    const score=Number(hole?.score);
    const putts=Number(hole?.putts);
    if(!Number.isFinite(score)||!Number.isFinite(putts)||score<=0||putts<0)return null;
    const greenOnStroke=score-putts;
    return greenOnStroke>=1?greenOnStroke:null;
}
function getRoundOnRates(round){
    let den=0,parOn=0,bogeyOn=0;getHoles(round).forEach(h=>{const par=Number(h?.par);if(!Number.isFinite(par))return;den++;const n=analysisFirstGreenShotNo(h);if(Number.isFinite(n)){if(n<=par-2)parOn++;if(n<=par-1)bogeyOn++;}});
    return {parOn:den?parOn/den*100:NaN,bogeyOn:den?bogeyOn/den*100:NaN};
}


