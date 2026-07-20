// ============================================
// ScoreCraft Ver1.3.12 - analysis.js
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
    renderSummary(); renderScoreChart(); renderClubAnalysis(); renderPuttDistanceAnalysis();
}
function renderEmptyAnalysis(){
    const empty=`<div class="empty-state compact"><p>分析できるラウンドがまだありません。</p><button class="btn" type="button" onclick="location.href='round.html'">⛳ ラウンドを入力</button></div>`;
    ["analysisSummary","scoreChartArea","clubAnalysis","puttDistanceAnalysis"].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=empty;});
}
function renderSummary(){
    const scores=analysisRounds.map(getRoundScore), totalPutts=sumHoleValue("putts"), totalOb=sumHoleValue("ob"), totalBunker=sumHoleValue("bunker");
    const stats=[["平均スコア",formatDecimal(average(scores))],["ベスト",Math.min(...scores)],["ラウンド数",`${analysisRounds.length}回`],["平均パット",formatDecimal(totalPutts/analysisRounds.length)],["OB平均",formatDecimal(totalOb/analysisRounds.length)],["バンカー平均",formatDecimal(totalBunker/analysisRounds.length)]];
    document.getElementById("analysisSummary").innerHTML=stats.map(([l,v])=>`<div class="analysis-stat-card"><span>${escapeHtml(l)}</span><strong>${escapeHtml(String(v))}</strong></div>`).join("");
}

function renderClubAnalysis(){
    const groups=[{key:"long",title:"Par4・5",match:par=>par===4||par===5},{key:"par3",title:"Par3",match:par=>par===3}];
    const container=document.getElementById("clubAnalysis");
    const html=groups.map(group=>{
        const clubMap={}; let total=0;
        analysisRounds.forEach(round=>getHoles(round).forEach(hole=>{
            const par=Number(hole?.par), clubId=String(hole?.teeShot?.clubId||"").trim();
            if(!group.match(par)||!clubId) return;
            total++; if(!clubMap[clubId]) clubMap[clubId]={count:0,directions:{left:0,right:0,center:0,short:0,over:0}};
            clubMap[clubId].count++;
            const d=normalizeDirection(hole?.teeShot?.direction); if(d) clubMap[clubId].directions[d]++;
        }));
        const sorted=Object.entries(clubMap).sort((a,b)=>b[1].count-a[1].count);
        return `<div class="club-par-group"><h3>${group.title}</h3>${!total?`<div class="empty-state compact"><p>使用クラブの入力データがありません。</p></div>`:`<div class="club-analysis-list">${sorted.map(([id,data])=>{
            const pct=Math.round(data.count/total*100); const detailId=`club-detail-${group.key}-${safeId(id)}`;
            return `<div class="club-analysis-item"><button class="club-analysis-button" type="button" aria-expanded="false" aria-controls="${detailId}"><div class="club-analysis-heading"><strong>${escapeHtml(getClubName(id))}</strong><span>${pct}% <small>(${data.count}回)</small></span></div><div class="analysis-progress"><span style="width:${pct}%"></span></div><small class="club-tap-hint">タップして方向割合を表示</small></button><div id="${detailId}" class="club-direction-detail" hidden>${renderDirectionDetail(data.directions)}</div></div>`;
        }).join("")}</div>`}</div>`;
    }).join("");
    container.innerHTML=html;
    container.querySelectorAll(".club-analysis-button").forEach(button=>button.addEventListener("click",()=>{
        const detail=document.getElementById(button.getAttribute("aria-controls")); const open=button.getAttribute("aria-expanded")==="true";
        button.setAttribute("aria-expanded",String(!open)); detail.hidden=open;
    }));
}
function renderDirectionDetail(counts){
    const total=Object.values(counts).reduce((s,v)=>s+v,0);
    if(!total) return `<p class="analysis-note">方向データがありません。</p>`;
    return `<div class="club-direction-grid">${DIRECTION_ITEMS.map(([key,label])=>{const count=counts[key]||0,pct=Math.round(count/total*100);return `<div><span>${label}</span><strong>${pct}%</strong><small>${count}回</small></div>`;}).join("")}</div>`;
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
    const cssWidth=Math.max(720,Math.floor(holder.getBoundingClientRect().width));
    const height=340, ratio=window.devicePixelRatio||1;
    canvas.width=cssWidth*ratio; canvas.height=height*ratio;
    canvas.style.width=`${cssWidth}px`; canvas.style.height=`${height}px`;
    const c=canvas.getContext("2d"); c.setTransform(ratio,0,0,ratio,0,0); c.clearRect(0,0,cssWidth,height);

    const left=45,right=14,top=30,bottom=72,plotW=cssWidth-left-right,plotH=height-top-bottom;
    const values=buckets.map(b=>b.putts.length?average(b.putts):NaN).filter(Number.isFinite);
    const maxData=values.length?Math.max(...values):3;
    const yMax=Math.max(3,Math.ceil((maxData+0.25)*2)/2);
    const tickStep=0.5;

    c.font='11px "Yu Gothic UI",sans-serif'; c.textBaseline="middle";
    for(let v=0;v<=yMax+0.001;v+=tickStep){
        const y=top+plotH-(v/yMax)*plotH;
        c.strokeStyle="#e4e9e5"; c.lineWidth=1; c.beginPath(); c.moveTo(left,y); c.lineTo(cssWidth-right,y); c.stroke();
        c.fillStyle="#69756d"; c.textAlign="right"; c.fillText(v.toFixed(1),left-7,y);
    }
    c.strokeStyle="#738078"; c.lineWidth=1.2; c.beginPath(); c.moveTo(left,top); c.lineTo(left,top+plotH); c.lineTo(cssWidth-right,top+plotH); c.stroke();

    const slot=plotW/buckets.length, barW=Math.min(42,slot*0.58);
    buckets.forEach((b,i)=>{
        const avg=b.putts.length?average(b.putts):NaN;
        const x=left+slot*i+slot/2;
        if(Number.isFinite(avg)){
            const h=(avg/yMax)*plotH, y=top+plotH-h;
            const grad=c.createLinearGradient(0,y,0,top+plotH); grad.addColorStop(0,"#4b7ee8"); grad.addColorStop(1,"#2d63cf");
            c.fillStyle=grad; roundedRect(c,x-barW/2,y,barW,h,5); c.fill();
            c.fillStyle="#1f5dcc"; c.font='bold 11px "Yu Gothic UI",sans-serif'; c.textAlign="center"; c.textBaseline="bottom"; c.fillText(avg.toFixed(2),x,y-6);
        }
        c.fillStyle="#25302a"; c.font='11px "Yu Gothic UI",sans-serif'; c.textAlign="center"; c.textBaseline="top"; c.fillText(b.label,x,top+plotH+11);
        c.fillStyle="#7b8580"; c.font='10px "Yu Gothic UI",sans-serif'; c.fillText(b.putts.length?`${b.putts.length}ホール`:"—",x,top+plotH+31);
    });

    c.save(); c.translate(13,top+plotH/2); c.rotate(-Math.PI/2); c.fillStyle="#526058"; c.font='11px "Yu Gothic UI",sans-serif'; c.textAlign="center"; c.textBaseline="top"; c.fillText("平均パット数（回）",0,0); c.restore();
}

function renderScoreChart(){
    const canvas=document.getElementById("scoreChart"); if(!canvas||!canvas.getContext)return;
    const rounds=[...analysisRounds].reverse().slice(-12);
    const scores=rounds.map(getRoundScore), putts=rounds.map(getRoundPutts), distances=rounds.map(getRoundAverageDistance);
    const rect=canvas.parentElement.getBoundingClientRect(), width=Math.max(330,Math.floor(rect.width)), height=390, ratio=window.devicePixelRatio||1;
    canvas.width=width*ratio; canvas.height=height*ratio; canvas.style.width=`${width}px`; canvas.style.height=`${height}px`;
    const c=canvas.getContext("2d"); c.setTransform(ratio,0,0,ratio,0,0); c.clearRect(0,0,width,height);

    const left=44,right=82,top=28,bottom=52,plotW=width-left-right,plotH=height-top-bottom,plotRight=left+plotW;
    const scoreScale=makeScale(scores,5,5), puttScale=makeScale(putts,4,2), distanceScale=makeScale(distances,4,0.5);

    // grid and left score axis
    c.font='10px "Yu Gothic UI",sans-serif'; c.textBaseline="middle";
    for(let i=0;i<=5;i++){
        const y=top+plotH*i/5, value=scoreScale.max-(scoreScale.max-scoreScale.min)*i/5;
        c.strokeStyle="#e3e8e4"; c.lineWidth=1; c.beginPath(); c.moveTo(left,y); c.lineTo(plotRight,y); c.stroke();
        c.fillStyle="#2E7D32"; c.textAlign="right"; c.fillText(String(Math.round(value)),left-7,y);
    }
    // blue right axis (putts)
    for(let i=0;i<=4;i++){
        const y=top+plotH*i/4, value=puttScale.max-(puttScale.max-puttScale.min)*i/4;
        c.fillStyle="#2367d7"; c.textAlign="left"; c.fillText(String(Math.round(value)),plotRight+7,y);
    }
    // orange far-right axis (average distance)
    for(let i=0;i<=4;i++){
        const y=top+plotH*i/4, value=distanceScale.max-(distanceScale.max-distanceScale.min)*i/4;
        c.fillStyle="#f26a13"; c.textAlign="right"; c.fillText(value.toFixed(1),width-2,y);
    }

    c.strokeStyle="#2E7D32"; c.lineWidth=1.2; c.beginPath(); c.moveTo(left,top); c.lineTo(left,top+plotH); c.stroke();
    c.strokeStyle="#2367d7"; c.beginPath(); c.moveTo(plotRight,top); c.lineTo(plotRight,top+plotH); c.stroke();
    c.strokeStyle="#f26a13"; c.beginPath(); c.moveTo(width-31,top); c.lineTo(width-31,top+plotH); c.stroke();

    c.font='bold 10px "Yu Gothic UI",sans-serif'; c.textBaseline="bottom";
    c.fillStyle="#2E7D32"; c.textAlign="left"; c.fillText("スコア",left,top-8);
    c.fillStyle="#2367d7"; c.textAlign="left"; c.fillText("パット",plotRight+5,top-8);
    c.fillStyle="#f26a13"; c.textAlign="right"; c.fillText("距離",width-2,top-8);

    drawLineSeries(c,scores,scoreScale,"#2E7D32",left,top,plotW,plotH,rounds.length,0);
    drawLineSeries(c,putts,puttScale,"#2367d7",left,top,plotW,plotH,rounds.length,0);
    drawLineSeries(c,distances,distanceScale,"#f26a13",left,top,plotW,plotH,rounds.length,1);

    c.fillStyle="#6c7770"; c.font='10px "Yu Gothic UI",sans-serif'; c.textAlign="center"; c.textBaseline="top";
    rounds.forEach((r,i)=>{const x=rounds.length===1?left+plotW/2:left+plotW*i/(rounds.length-1); c.fillText(formatChartDate(r.date),x,top+plotH+12);});
    c.fillStyle="#526058"; c.font='11px "Yu Gothic UI",sans-serif'; c.fillText("ラウンド",left+plotW/2,height-17);
}

function makeScale(values,steps,unit){
    const finite=values.filter(Number.isFinite); let min=finite.length?Math.min(...finite):0,max=finite.length?Math.max(...finite):unit*steps;
    if(min===max){min-=unit;max+=unit;}
    min=Math.max(0,Math.floor((min-unit)/unit)*unit); max=Math.ceil((max+unit)/unit)*unit;
    if(max-min<unit*steps) max=min+unit*steps;
    return {min,max};
}
function drawLineSeries(c,values,scale,color,left,top,plotW,plotH,count,decimals){
    const pts=values.map((v,i)=>({x:count===1?left+plotW/2:left+plotW*i/(count-1),y:Number.isFinite(v)?top+(scale.max-v)/(scale.max-scale.min)*plotH:null,v}));
    c.strokeStyle=color; c.lineWidth=2.6; c.lineJoin="round"; c.lineCap="round"; c.beginPath(); let started=false;
    pts.forEach(p=>{if(p.y===null){started=false;return;} if(!started){c.moveTo(p.x,p.y);started=true;}else c.lineTo(p.x,p.y);}); c.stroke();
    pts.forEach(p=>{if(p.y===null)return; c.fillStyle="#fff"; c.strokeStyle=color; c.lineWidth=2.2; c.beginPath(); c.arc(p.x,p.y,4.3,0,Math.PI*2); c.fill(); c.stroke();});
}
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
function normalizeDirection(value){const d=String(value||"").toLowerCase().trim();if(["left","l","左","←"].includes(d))return"left";if(["right","r","右","→"].includes(d))return"right";if(["center","centre","straight","middle","c","中央","真ん中","ストレート","fairway","green","fwキープ","1on","グリーンオン"].includes(d))return"center";if(["short","手前","↓"].includes(d))return"short";if(["over","オーバー","↑"].includes(d))return"over";return"";}
function getClubName(id){return ANALYSIS_CLUB_NAMES[id]||String(id).toUpperCase();}
function safeId(v){return String(v).replace(/[^a-zA-Z0-9_-]/g,"-");}
function average(v){return v.length?v.reduce((s,n)=>s+n,0)/v.length:0;}
function formatDecimal(v){return Number.isFinite(v)?v.toFixed(1):"0.0";}
function formatChartDate(value){if(!value)return"-";const d=new Date(`${value}T00:00:00`);return Number.isNaN(d.getTime())?"-":`${d.getMonth()+1}/${d.getDate()}`;}
function escapeHtml(value){return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
