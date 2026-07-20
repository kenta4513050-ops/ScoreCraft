// ============================================
// ScoreCraft Ver1.3.11 - analysis.js
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
    const buckets=[]; for(let i=1;i<=10;i++) buckets.push({label:`${i}歩`,min:i,max:i,putts:[]});
    buckets.push({label:"11〜15歩",min:11,max:15,putts:[]},{label:"16歩以上",min:16,max:Infinity,putts:[]});
    analysisRounds.forEach(round=>getHoles(round).forEach(hole=>{
        const distance=Number(hole?.greenDistance?.value), putts=Number(hole?.putts);
        if(!Number.isFinite(distance)||!Number.isFinite(putts)||distance<1) return;
        const bucket=buckets.find(b=>distance>=b.min&&distance<=b.max); if(bucket) bucket.putts.push(putts);
    }));
    const container=document.getElementById("puttDistanceAnalysis");
    const hasData=buckets.some(b=>b.putts.length);
    if(!hasData){container.innerHTML=`<div class="empty-state compact"><p>パット距離とパット数の入力データがありません。</p></div>`;return;}
    container.innerHTML=`<div class="putt-distance-list">${buckets.map(b=>`<div class="putt-distance-row"><span>${b.label}</span><strong>${b.putts.length?`${formatDecimal(average(b.putts))}パット`:'—'}</strong><small>${b.putts.length?`${b.putts.length}ホール`:'データなし'}</small></div>`).join("")}</div>`;
}

function renderScoreChart(){
    const canvas=document.getElementById("scoreChart"); if(!canvas||!canvas.getContext)return;
    const rounds=[...analysisRounds].reverse().slice(-12);
    const series=[
        {label:"スコア",values:rounds.map(getRoundScore)},
        {label:"パット数",values:rounds.map(getRoundPutts)},
        {label:"平均距離",values:rounds.map(getRoundAverageDistance)}
    ];
    const rect=canvas.parentElement.getBoundingClientRect(), width=Math.max(300,Math.floor(rect.width)), height=410, ratio=window.devicePixelRatio||1;
    canvas.width=width*ratio;canvas.height=height*ratio;canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;
    const c=canvas.getContext("2d");c.setTransform(ratio,0,0,ratio,0,0);c.clearRect(0,0,width,height);
    const left=48,right=14,top=15,bottom=38,gap=13,bandH=(height-top-bottom-gap*2)/3,chartW=width-left-right;
    series.forEach((s,band)=>{
        const values=s.values.filter(Number.isFinite); let min=values.length?Math.min(...values):0,max=values.length?Math.max(...values):1;
        if(min===max){min-=1;max+=1;} const pad=(max-min)*0.15;min=Math.max(0,min-pad);max+=pad;
        const y0=top+band*(bandH+gap);
        c.font='bold 11px "Yu Gothic UI",sans-serif';c.fillStyle="#555";c.textAlign="left";c.textBaseline="top";c.fillText(s.label,4,y0+3);
        for(let i=0;i<=2;i++){const y=y0+bandH*i/2;c.strokeStyle="#e3e8e3";c.lineWidth=1;c.beginPath();c.moveTo(left,y);c.lineTo(width-right,y);c.stroke();const val=max-(max-min)*i/2;c.fillStyle="#777";c.textAlign="right";c.textBaseline="middle";c.font='10px "Yu Gothic UI",sans-serif';c.fillText(formatAxisValue(val,s.label),left-6,y);}
        const pts=s.values.map((v,i)=>({x:rounds.length===1?left+chartW/2:left+chartW*i/(rounds.length-1),y:Number.isFinite(v)?y0+(max-v)/(max-min)*bandH:null,v}));
        c.strokeStyle=band===0?"#2E7D32":band===1?"#1976D2":"#EF6C00";c.lineWidth=2.5;c.beginPath();let started=false;pts.forEach(p=>{if(p.y===null){started=false;return;}if(!started){c.moveTo(p.x,p.y);started=true;}else c.lineTo(p.x,p.y);});c.stroke();
        pts.forEach(p=>{if(p.y===null)return;c.fillStyle="#fff";c.strokeStyle=band===0?"#2E7D32":band===1?"#1976D2":"#EF6C00";c.lineWidth=2;c.beginPath();c.arc(p.x,p.y,4,0,Math.PI*2);c.fill();c.stroke();});
    });
    c.fillStyle="#777";c.font='10px "Yu Gothic UI",sans-serif';c.textAlign="center";c.textBaseline="top";rounds.forEach((r,i)=>{const x=rounds.length===1?left+chartW/2:left+chartW*i/(rounds.length-1);c.fillText(formatChartDate(r.date),x,height-bottom+12);});
}
function getRoundPutts(round){return getHoles(round).reduce((s,h)=>s+(Number.isFinite(Number(h?.putts))?Number(h.putts):0),0);}
function getRoundAverageDistance(round){const vals=getHoles(round).map(h=>Number(h?.greenDistance?.value)).filter(v=>Number.isFinite(v)&&v>=0);return vals.length?average(vals):NaN;}
function formatAxisValue(v,label){return label==="平均距離"?v.toFixed(1):String(Math.round(v));}
function handleChartResize(){clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(analysisRounds.length)renderScoreChart();},120);}
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
