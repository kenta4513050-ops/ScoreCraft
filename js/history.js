// ============================================
// ScoreCraft
// history.js
// ラウンド履歴・詳細・削除
// ============================================

"use strict";

const historyState = {
    rounds: [],
    filteredRounds: [],
    selectedRoundId: ""
};

document.addEventListener("DOMContentLoaded", initializeHistory);

function initializeHistory() {
    if (typeof renderNavigation === "function") {
        renderNavigation("history");
    }

    historyState.rounds = loadCompletedRounds();
    historyState.filteredRounds = [...historyState.rounds];

    bindHistoryEvents();
    renderHistoryList();

    const requestedRoundId = new URLSearchParams(location.search).get("id");

    if (requestedRoundId) {
        showRoundDetail(requestedRoundId);
    }
}

function bindHistoryEvents() {
    const searchInput = document.getElementById("historySearch");
    const closeButton = document.getElementById("closeDetailButton");
    const editButton = document.getElementById("editRoundButton");
    const deleteButton = document.getElementById("deleteRoundButton");

    if (searchInput) {
        searchInput.addEventListener("input", handleHistorySearch);
    }

    if (closeButton) {
        closeButton.addEventListener("click", closeRoundDetail);
    }

    if (editButton) {
        editButton.addEventListener("click", editSelectedRound);
    }

    if (deleteButton) {
        deleteButton.addEventListener("click", deleteSelectedRound);
    }
}

function loadCompletedRounds() {
    let rounds = [];

    try {
        if (
            typeof load === "function" &&
            typeof STORAGE !== "undefined" &&
            STORAGE.ROUNDS
        ) {
            rounds = load(STORAGE.ROUNDS);
        } else {
            rounds = JSON.parse(
                localStorage.getItem("scorecraft_rounds") || "[]"
            );
        }
    } catch (error) {
        console.error("ラウンド履歴を読み込めませんでした。", error);
        rounds = [];
    }

    if (!Array.isArray(rounds)) {
        return [];
    }

    return rounds
        .filter(round => round && round.status !== "draft")
        .sort((a, b) => getRoundTimestamp(b) - getRoundTimestamp(a));
}

function handleHistorySearch(event) {
    const keyword = normalizeText(event.target.value);

    if (!keyword) {
        historyState.filteredRounds = [...historyState.rounds];
    } else {
        historyState.filteredRounds = historyState.rounds.filter(round => {
            const searchableText = [
                round.courseName,
                round.coursePrefecture,
                round.courseLayoutName,
                round.date
            ]
                .filter(Boolean)
                .join(" ");

            return normalizeText(searchableText).includes(keyword);
        });
    }

    renderHistoryList();
}

function renderHistoryList() {
    const container = document.getElementById("historyList");
    const count = document.getElementById("historyCount");

    if (!container) {
        return;
    }

    if (count) {
        count.textContent = `${historyState.filteredRounds.length}回`;
    }

    if (historyState.rounds.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>保存されたラウンドはまだありません。</p>
                <button class="btn" type="button" onclick="location.href='round.html'">
                    ⛳ 最初のラウンドを入力
                </button>
            </div>
        `;
        return;
    }

    if (historyState.filteredRounds.length === 0) {
        container.innerHTML = `
            <div class="empty-state compact">
                <p>検索条件に一致するラウンドがありません。</p>
            </div>
        `;
        return;
    }

    const list = document.createElement("div");
    list.className = "history-list";

    historyState.filteredRounds.forEach(round => {
        list.appendChild(createHistoryItem(round));
    });

    container.innerHTML = "";
    container.appendChild(list);
}

function createHistoryItem(round) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item";
    button.addEventListener("click", () => showRoundDetail(round.id));

    const main = document.createElement("div");
    main.className = "history-item-main";

    const date = document.createElement("span");
    date.className = "history-item-date";
    date.textContent = formatDate(round.date);

    const course = document.createElement("strong");
    course.className = "history-item-course";
    course.textContent = round.courseName || "ゴルフ場名未設定";

    const detail = document.createElement("span");
    detail.className = "history-item-detail";
    detail.textContent = createCourseDetailText(round);

    main.appendChild(date);
    main.appendChild(course);
    main.appendChild(detail);

    const scoreArea = document.createElement("div");
    scoreArea.className = "history-item-score-area";

    const score = document.createElement("strong");
    score.className = "history-item-score";
    score.textContent = String(getScore(round));

    const relative = document.createElement("span");
    relative.className = "history-item-relative";
    relative.textContent = getRelativeScore(round);

    scoreArea.appendChild(score);

    if (relative.textContent) {
        scoreArea.appendChild(relative);
    }

    const arrow = document.createElement("span");
    arrow.className = "history-item-arrow";
    arrow.textContent = "›";

    button.appendChild(main);
    button.appendChild(scoreArea);
    button.appendChild(arrow);

    return button;
}

function showRoundDetail(roundId) {
    const round = historyState.rounds.find(item => item.id === roundId);
    const section = document.getElementById("roundDetailSection");
    const container = document.getElementById("roundDetail");

    if (!round || !section || !container) {
        return;
    }

    historyState.selectedRoundId = round.id;

    container.innerHTML = "";
    container.appendChild(createDetailSummary(round));
    container.appendChild(createHoleScoreTable(round));
    container.appendChild(createRoundAnalysis(round));

    section.hidden = false;
    section.scrollIntoView({ behavior: "smooth", block: "start" });

    const url = new URL(location.href);
    url.searchParams.set("id", round.id);
    history.replaceState(null, "", url);
}

function createDetailSummary(round) {
    const wrapper = document.createElement("div");
    wrapper.className = "round-detail-summary";

    const heading = document.createElement("div");
    heading.className = "round-detail-heading";

    const course = document.createElement("strong");
    course.className = "round-detail-course";
    course.textContent = round.courseName || "ゴルフ場名未設定";

    const meta = document.createElement("p");
    meta.className = "round-detail-meta";
    meta.textContent = [
        formatDate(round.date),
        round.coursePrefecture,
        round.courseLayoutName
    ].filter(Boolean).join(" / ");

    heading.appendChild(course);
    heading.appendChild(meta);

    const stats = document.createElement("div");
    stats.className = "round-detail-stats";

    stats.appendChild(createDetailStat("OUT", getNumberOrDash(round.out)));
    stats.appendChild(createDetailStat("IN", getNumberOrDash(round.in)));
    stats.appendChild(createDetailStat("TOTAL", getScore(round)));
    stats.appendChild(createDetailStat("PUTT", getRoundPuttTotal(round)));

    wrapper.appendChild(heading);
    wrapper.appendChild(stats);

    return wrapper;
}

function createDetailStat(label, value) {
    const item = document.createElement("div");
    item.className = "round-detail-stat";

    const labelElement = document.createElement("span");
    labelElement.textContent = label;

    const valueElement = document.createElement("strong");
    valueElement.textContent = String(value);

    item.appendChild(labelElement);
    item.appendChild(valueElement);

    return item;
}

function createHoleScoreTable(round) {
    const wrapper = document.createElement("div");
    wrapper.className = "hole-table-wrapper";

    const table = document.createElement("table");
    table.className = "hole-score-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>HOLE</th>
            <th>PAR</th>
            <th>SCORE</th>
            <th>PUTT</th>
            <th>OB</th>
        </tr>
    `;

    const tbody = document.createElement("tbody");
    const holes = Array.isArray(round.holes) ? round.holes : [];

    holes.forEach(hole => {
        const row = document.createElement("tr");
        const scoreClass = getHoleScoreClass(hole);

        row.innerHTML = `
            <td>${escapeHtml(String(hole.hole ?? "-"))}</td>
            <td>${escapeHtml(String(hole.par ?? "-"))}</td>
            <td class="${scoreClass}">${escapeHtml(String(hole.score ?? "-"))}</td>
            <td>${escapeHtml(String(hole.putts ?? "-"))}</td>
            <td>${escapeHtml(String(hole.ob ?? 0))}</td>
        `;

        tbody.appendChild(row);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    wrapper.appendChild(table);

    return wrapper;
}

function getRoundPuttTotal(round) {
    const holes = Array.isArray(round?.holes) ? round.holes : [];
    const values = holes.map(h => h?.putts).filter(v => v !== null && v !== "" && Number.isFinite(Number(v)));
    return values.length ? values.reduce((sum, v) => sum + Number(v), 0) : "-";
}

function createRoundAnalysis(round) {
    const wrapper = document.createElement("section");
    wrapper.className = "round-single-analysis";
    const holes = Array.isArray(round?.holes) ? round.holes : [];

    const heading = document.createElement("div");
    heading.className = "round-analysis-heading";
    heading.innerHTML = `<h3>このラウンドの分析</h3><p>分析ページと同じ観点で、この1ラウンドだけを集計します。</p>`;
    wrapper.appendChild(heading);

    const threeHole = [[1,3],[4,6],[7,9],[10,12],[13,15],[16,18]].map(([start,end]) => {
        const hs = holes.filter(h => Number(h?.hole) >= start && Number(h?.hole) <= end);
        if (hs.length !== 3) return { label:`${start}–${end}H`, value:"-" };
        let diff = 0;
        for (const h of hs) {
            const score=Number(h?.score), par=Number(h?.par);
            if(!Number.isFinite(score)||!Number.isFinite(par)) return {label:`${start}–${end}H`,value:"-"};
            diff += score-par;
        }
        return { label:`${start}–${end}H`, value:diff===0?"E":`${diff>0?"+":""}${diff}` };
    });
    wrapper.insertAdjacentHTML("beforeend", `<div class="round-analysis-block"><h4>3ホールごとのPar差</h4><div class="three-hole-grid round-three-hole-grid">${threeHole.map(x=>`<div class="three-hole-item"><span>${x.label}</span><strong>${x.value}</strong></div>`).join("")}</div></div>`);

    const teeHoles = holes.filter(h => h?.teeShot && h.teeShot.clubId);
    const clubMap = {};
    teeHoles.forEach(h => {
        const id=String(h.teeShot.clubId||"");
        if(!clubMap[id]) clubMap[id]={count:0,directions:{},curves:{}};
        const d=clubMap[id]; d.count++;
        const dir=normalizeHistoryDirection(h.teeShot.direction);
        const curve=normalizeHistoryCurve(h.teeShot.curve);
        if(dir)d.directions[dir]=(d.directions[dir]||0)+1;
        if(curve)d.curves[curve]=(d.curves[curve]||0)+1;
    });
    const totalTee=teeHoles.length;
    const clubRows=Object.entries(clubMap).sort((a,b)=>b[1].count-a[1].count).map(([id,data])=>{
        const pct=totalTee?Math.round(data.count/totalTee*100):0;
        const dirs=historyDirectionSummary(data.directions);
        const curves=historyCurveSummary(data.curves);
        return `<div class="round-analysis-row"><div><strong>${escapeHtml(historyClubName(id))}</strong><small>${dirs}${curves?" / "+curves:""}</small></div><span>${pct}% <small>(${data.count}回)</small></span></div>`;
    }).join("");
    wrapper.insertAdjacentHTML("beforeend", `<div class="round-analysis-block"><h4>ティーショット</h4>${clubRows||'<p class="analysis-note">ティーショットデータがありません。</p>'}</div>`);

    const approachShots=holes.map(h=>h?.approachShot).filter(s=>s&&s.clubId&&typeof s.greenOn==="boolean");
    const girClub={};
    approachShots.forEach(s=>{const id=String(s.clubId);if(!girClub[id])girClub[id]={attempts:0,on:0};girClub[id].attempts++;if(s.greenOn)girClub[id].on++;});
    const girRows=Object.entries(girClub).sort((a,b)=>b[1].attempts-a[1].attempts).map(([id,d])=>`<div class="round-analysis-row"><strong>${escapeHtml(historyClubName(id))}</strong><span>${Math.round(d.on/d.attempts*100)}% <small>(${d.on}/${d.attempts})</small></span></div>`).join("");
    const distanceBuckets=[
        {label:"〜50yd",min:0,max:50},{label:"51–75yd",min:51,max:75},{label:"76–100yd",min:76,max:100},
        {label:"101–125yd",min:101,max:125},{label:"126–150yd",min:126,max:150},{label:"151–175yd",min:151,max:175},
        {label:"176–200yd",min:176,max:200},{label:"201yd〜",min:201,max:9999}
    ];
    approachShots.forEach(s=>{const d=Number(s.distanceYards);if(!Number.isFinite(d))return;const b=distanceBuckets.find(x=>d>=x.min&&d<=x.max);if(b){b.attempts=(b.attempts||0)+1;b.on=(b.on||0)+(s.greenOn?1:0);}});
    const distRows=distanceBuckets.filter(b=>b.attempts).map(b=>`<div class="round-analysis-row"><strong>${b.label}</strong><span>${Math.round(b.on/b.attempts*100)}% <small>(${b.on}/${b.attempts})</small></span></div>`).join("");
    wrapper.insertAdjacentHTML("beforeend", `<div class="round-analysis-block"><h4>グリーンオン率</h4><div class="round-analysis-columns"><div><h5>番手別</h5>${girRows||'<p class="analysis-note">データなし</p>'}</div><div><h5>距離別</h5>${distRows||'<p class="analysis-note">データなし</p>'}</div></div></div>`);

    const puttBuckets=[];
    for(let i=1;i<=10;i++)puttBuckets.push({label:`${i}歩`,min:i,max:i,values:[]});
    puttBuckets.push({label:"11–15歩",min:11,max:15,values:[]},{label:"16歩〜",min:16,max:9999,values:[]});
    holes.forEach(h=>{const dist=Number(h?.greenDistance?.value),putts=Number(h?.putts);if(!Number.isFinite(dist)||!Number.isFinite(putts))return;const b=puttBuckets.find(x=>dist>=x.min&&dist<=x.max);if(b)b.values.push(putts);});
    const puttRows=puttBuckets.filter(b=>b.values.length).map(b=>`<div class="round-analysis-row"><strong>${b.label}</strong><span>${(b.values.reduce((a,v)=>a+v,0)/b.values.length).toFixed(1)} <small>(${b.values.length}H)</small></span></div>`).join("");
    wrapper.insertAdjacentHTML("beforeend", `<div class="round-analysis-block"><h4>パット距離別 平均パット数</h4>${puttRows||'<p class="analysis-note">パット距離データがありません。</p>'}</div>`);
    return wrapper;
}

function normalizeHistoryDirection(value){
    const d=String(value||"").toLowerCase().trim();
    if(["left","l","左","←"].includes(d))return"left";
    if(["right","r","右","→"].includes(d))return"right";
    if(["center","fairway","green","keep","fw","fwキープ","キープ","1on","中央","・"].includes(d))return"center";
    if(["short","手前"].includes(d))return"short";
    if(["over","オーバー"].includes(d))return"over";
    return"";
}
function normalizeHistoryCurve(value){
    const d=String(value||"").toLowerCase().trim();
    if(["left","左","左曲がり","draw","hook"].includes(d))return"left";
    if(["right","右","右曲がり","fade","slice"].includes(d))return"right";
    if(["straight","まっすぐ","ストレート"].includes(d))return"straight";
    return"";
}
function historyDirectionSummary(counts){
    const labels={left:"←",right:"→",center:"中央",short:"手前",over:"奥"};
    const total=Object.values(counts||{}).reduce((a,v)=>a+v,0);
    if(!total)return"着弾未入力";
    return Object.entries(counts).map(([k,v])=>`${labels[k]||k}${Math.round(v/total*100)}%`).join(" ");
}
function historyCurveSummary(counts){
    const labels={left:"←曲",right:"→曲",straight:"直"};
    const total=Object.values(counts||{}).reduce((a,v)=>a+v,0);
    if(!total)return"";
    return Object.entries(counts).map(([k,v])=>`${labels[k]||k}${Math.round(v/total*100)}%`).join(" ");
}
function historyClubName(id){
    const names={driver:"Driver","2w":"2W","3w":"3W","5w":"5W","7w":"7W","9w":"9W","2ut":"2UT","3ut":"3UT","4ut":"4UT","5ut":"5UT","6ut":"6UT","3i":"3I","4i":"4I","5i":"5I","6i":"6I","7i":"7I","8i":"8I","9i":"9I",pw:"PW","46":"46°","48":"48°","50":"50°","52":"52°","54":"54°","56":"56°","58":"58°","60":"60°",putter:"Putter"};
    return names[String(id).toLowerCase()]||String(id).toUpperCase();
}

function getHoleScoreClass(hole) {
    const score = Number(hole && hole.score);
    const par = Number(hole && hole.par);

    if (!Number.isFinite(score) || !Number.isFinite(par)) {
        return "";
    }

    const difference = score - par;

    if (difference <= -2) {
        return "score-eagle";
    }

    if (difference === -1) {
        return "score-birdie";
    }

    if (difference === 0) {
        return "score-par";
    }

    if (difference === 1) {
        return "score-bogey";
    }

    return "score-double-or-more";
}

function closeRoundDetail() {
    const section = document.getElementById("roundDetailSection");

    historyState.selectedRoundId = "";

    if (section) {
        section.hidden = true;
    }

    const url = new URL(location.href);
    url.searchParams.delete("id");
    history.replaceState(null, "", url);
}


function editSelectedRound() {
    const roundId = historyState.selectedRoundId;

    if (!roundId) {
        return;
    }

    location.href = `round.html?edit=${encodeURIComponent(roundId)}`;
}

function deleteSelectedRound() {
    const roundId = historyState.selectedRoundId;
    const round = historyState.rounds.find(item => item.id === roundId);

    if (!round) {
        return;
    }

    const shouldDelete = window.confirm(
        `${round.courseName || "このラウンド"}の記録を削除しますか？\nこの操作は取り消せません。`
    );

    if (!shouldDelete) {
        return;
    }

    try {
        if (
            typeof remove === "function" &&
            typeof STORAGE !== "undefined" &&
            STORAGE.ROUNDS
        ) {
            remove(STORAGE.ROUNDS, roundId);
        } else {
            const filtered = historyState.rounds.filter(item => item.id !== roundId);
            localStorage.setItem("scorecraft_rounds", JSON.stringify(filtered));
        }
    } catch (error) {
        console.error("ラウンドを削除できませんでした。", error);
        window.alert("ラウンドを削除できませんでした。");
        return;
    }

    historyState.rounds = historyState.rounds.filter(item => item.id !== roundId);
    historyState.filteredRounds = historyState.filteredRounds.filter(item => item.id !== roundId);

    closeRoundDetail();
    renderHistoryList();
}

function getScore(round) {
    const score = Number(round && round.total);
    return Number.isFinite(score) && score > 0 ? score : "-";
}

function getRelativeScore(round) {
    const score = Number(round && round.total);
    const par = Number(round && round.totalPar);

    if (
        !Number.isFinite(score) ||
        score <= 0 ||
        !Number.isFinite(par) ||
        par <= 0
    ) {
        return "";
    }

    const difference = score - par;

    if (difference === 0) {
        return "E";
    }

    return difference > 0 ? `+${difference}` : String(difference);
}

function createCourseDetailText(round) {
    return [round.coursePrefecture, round.courseLayoutName]
        .filter(Boolean)
        .join(" / ") || "詳細情報なし";
}

function formatDate(value) {
    if (!value) {
        return "日付未設定";
    }

    const parts = String(value).split("-");

    if (parts.length !== 3) {
        return String(value);
    }

    return `${Number(parts[0])}/${Number(parts[1])}/${Number(parts[2])}`;
}

function getRoundTimestamp(round) {
    const candidates = [
        round && round.date,
        round && round.completedAt,
        round && round.updatedAt,
        round && round.createdAt
    ];

    for (const candidate of candidates) {
        const timestamp = Date.parse(candidate);

        if (Number.isFinite(timestamp)) {
            return timestamp;
        }
    }

    return 0;
}

function getNumberOrDash(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : "-";
}

function normalizeText(value) {
    return String(value || "")
        .normalize("NFKC")
        .toLowerCase()
        .replace(/\s+/g, "");
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ===== Ver1.3.24 round detail overrides =====
function historyShots(hole){
    if(Array.isArray(hole?.shots) && hole.shots.length){
        const shots=hole.shots.map(s=>({...s}));
        if(!shots[0]) shots[0]={clubId:"",landing:"",targetYards:null,penalty:""};
        if(!shots[0].clubId && hole?.teeShot?.clubId) shots[0].clubId=hole.teeShot.clubId;
        if(!shots[0].landing && hole?.teeShot?.direction) shots[0].landing=hole.teeShot.direction;
        return shots;
    }
    const result=[];
    if(hole?.teeShot && (hole.teeShot.clubId||hole.teeShot.direction)) result.push({clubId:hole.teeShot.clubId||"",landing:hole.teeShot.direction||"",targetYards:null,penalty:""});
    if(hole?.approachShot && (hole.approachShot.clubId||hole.approachShot.distanceYards!==null)) result.push({clubId:hole.approachShot.clubId||"",landing:hole.approachShot.greenOn===true?"green":"",targetYards:hole.approachShot.distanceYards,penalty:""});
    return result;
}
function historyLanding(v){
    const d=String(v||"").toLowerCase().trim();
    if(["left","l","左","←"].includes(d))return"left"; if(["right","r","右","→"].includes(d))return"right";
    if(["green","グリーンオン","on","1on"].includes(d))return"green"; if(["fairway","keep","fw","fwキープ","キープ","center","中央","・"].includes(d))return"fairway";
    if(["short","手前","↓"].includes(d))return"short"; if(["over","奥","オーバー","↑"].includes(d))return"over"; return"";
}
function historyLandingLabel(v){return ({left:"←",right:"→",green:"・",fairway:"・",short:"↓",over:"↑"})[historyLanding(v)]||"-";}
function historyPenaltyCount(hole,type,legacyKey){
    const shots=historyShots(hole); const hasPenalty=shots.some(s=>String(s?.penalty||"").trim());
    if(hasPenalty) return shots.filter(s=>String(s?.penalty||"").trim()===type).length;
    const n=Number(hole?.[legacyKey]); return Number.isFinite(n)?n:0;
}
function historyFirstGreenShotNo(hole){
    // Ver1.3.25: グリーンON打数はスコア - パット数で統一する。
    const score=Number(hole?.score);
    const putts=Number(hole?.putts);
    if(!Number.isFinite(score)||!Number.isFinite(putts)||score<=0||putts<0)return null;
    const greenOnStroke=score-putts;
    return greenOnStroke>=1?greenOnStroke:null;
}
function historyRoundAdvancedStats(round){
    const holes=Array.isArray(round?.holes)?round.holes:[];
    let fwDen=0,fwOn=0,p3Den=0,p3On=0,parDen=0,parOn=0,bogeyOn=0; const greenDists=[];
    holes.forEach(hole=>{
        const par=Number(hole?.par); if(!Number.isFinite(par))return;
        const shots=historyShots(hole); const tee=shots[0]; const teeLanding=historyLanding(tee?.landing);
        if(par===3){p3Den++; if(teeLanding==="green")p3On++;}
        if(par===4||par===5){fwDen++; if(teeLanding==="fairway")fwOn++;}
        parDen++;
        const greenNo=historyFirstGreenShotNo(hole);
        if(Number.isFinite(greenNo)){
            if(greenNo<=par-2)parOn++;
            if(greenNo<=par-1)bogeyOn++;
        }
        shots.forEach(s=>{const yd=Number(s?.targetYards);if(Number.isFinite(yd)&&yd>0&&historyLanding(s?.landing)==="green")greenDists.push(yd);});
        if(!shots.some(s=>historyLanding(s?.landing)==="green") && hole?.approachShot?.greenOn===true){const yd=Number(hole.approachShot.distanceYards);if(Number.isFinite(yd)&&yd>0)greenDists.push(yd);}
    });
    return {fwRate:fwDen?fwOn/fwDen*100:NaN,p3Rate:p3Den?p3On/p3Den*100:NaN,avgGreenDistance:greenDists.length?greenDists.reduce((a,b)=>a+b,0)/greenDists.length:NaN,parOnRate:parDen?parOn/parDen*100:NaN,bogeyOnRate:parDen?bogeyOn/parDen*100:NaN};
}
function createHoleScoreTable(round){
    const wrapper=document.createElement("div");wrapper.className="hole-table-wrapper";
    const table=document.createElement("table");table.className="hole-score-table hole-score-table-advanced";
    const thead=document.createElement("thead");thead.innerHTML=`<tr><th>HOLE</th><th>PAR</th><th>SCORE</th><th>PUTT</th><th>OB</th><th>1P</th><th>B</th><th>TEE</th><th>方向</th></tr>`;
    const tbody=document.createElement("tbody"); const holes=Array.isArray(round?.holes)?round.holes:[];
    holes.forEach(hole=>{
        const shots=historyShots(hole),tee=shots[0]||{}; const row=document.createElement("tr"); const scoreClass=getHoleScoreClass(hole);
        row.innerHTML=`<td>${escapeHtml(String(hole.hole??"-"))}</td><td>${escapeHtml(String(hole.par??"-"))}</td><td class="${scoreClass}">${escapeHtml(String(hole.score??"-"))}</td><td>${escapeHtml(String(hole.putts??"-"))}</td><td>${historyPenaltyCount(hole,"ob","ob")}</td><td>${historyPenaltyCount(hole,"onePenalty","onePenalty")}</td><td>${historyPenaltyCount(hole,"bunker","bunker")}</td><td>${escapeHtml(tee.clubId?historyClubName(tee.clubId):"-")}</td><td>${escapeHtml(historyLandingLabel(tee.landing))}</td>`;
        tbody.appendChild(row);
    });
    table.append(thead,tbody);wrapper.appendChild(table);return wrapper;
}
function createRoundAnalysis(round){
    const wrapper=document.createElement("section");wrapper.className="round-single-analysis";
    const stats=historyRoundAdvancedStats(round);
    const fmt=v=>Number.isFinite(v)?`${v.toFixed(1)}%`:"-";
    const dist=Number.isFinite(stats.avgGreenDistance)?`${stats.avgGreenDistance.toFixed(1)}yd`:"-";
    wrapper.innerHTML=`<div class="round-analysis-heading"><h3>このラウンドの集計</h3><p>ティーショットとグリーン到達状況を1ラウンド単位で確認できます。</p></div><div class="round-kpi-grid"><div><span>Par4/5 FWキープ率</span><strong>${fmt(stats.fwRate)}</strong></div><div><span>Par3 1ON率</span><strong>${fmt(stats.p3Rate)}</strong></div><div><span>グリーンON時 平均距離</span><strong>${dist}</strong></div><div><span>パーオン率</span><strong>${fmt(stats.parOnRate)}</strong></div><div><span>ボギーオン率</span><strong>${fmt(stats.bogeyOnRate)}</strong></div></div>`;
    return wrapper;
}
