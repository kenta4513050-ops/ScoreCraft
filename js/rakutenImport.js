"use strict";

const importState = { files: [], worker: null, holes: createBlankHoles(), meta: {} };
const ROW_Y = { header:[0.225,0.302], par:[0.300,0.372], score:[0.405,0.495], putts:[0.495,0.568], direction:[0.568,0.637], club:[0.637,0.706], bunker:[0.706,0.775], ob:[0.775,0.844], penalty:[0.844,0.918] };

document.addEventListener("DOMContentLoaded", () => {
  if (typeof renderNavigation === "function") renderNavigation("settings");
  document.getElementById("rakutenImages").addEventListener("change", handleFiles);
  document.getElementById("analyzeButton").addEventListener("click", analyzeImages);
  document.getElementById("saveImportedRoundButton").addEventListener("click", saveImportedRound);
  document.getElementById("resetImportButton").addEventListener("click", resetImport);
});

function createBlankHoles(){ return Array.from({length:18},(_,i)=>({hole:i+1,par:null,score:null,putts:null,teeClub:"",direction:"",bunker:0,ob:0,onePenalty:0})); }
function safeId(prefix="import"){ return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`; }
function setMessage(text,type=""){ const el=document.getElementById("importMessage"); el.textContent=text; el.className=`data-message ${type}`; }

function handleFiles(e){
  const files=Array.from(e.target.files||[]).slice(0,2);
  importState.files=files;
  const list=document.getElementById("imagePreviewList"); list.innerHTML="";
  files.forEach((file,i)=>{ const card=document.createElement("div"); card.className="import-image-preview"; const img=document.createElement("img"); img.src=URL.createObjectURL(file); img.alt=`選択画像${i+1}`; const span=document.createElement("span"); span.textContent=`画像 ${i+1}`; card.append(img,span); list.appendChild(card); });
  document.getElementById("analyzeButton").disabled=files.length===0;
  setMessage(files.length ? `${files.length}枚選択しました。` : "");
}

async function analyzeImages(){
  if(!importState.files.length) return;
  if(typeof Tesseract==="undefined"){ setMessage("画像解析ライブラリを読み込めません。通信状態を確認してください。","error"); return; }
  toggleBusy(true); importState.holes=createBlankHoles(); importState.meta={};
  try{
    updateProgress(2,"解析エンジンを準備しています...");
    importState.worker=await Tesseract.createWorker("jpn+eng",1,{logger:m=>{ if(m.status==="recognizing text") updateProgress(5+Math.round((m.progress||0)*80),`文字を読み取っています ${Math.round((m.progress||0)*100)}%`); }});
    await importState.worker.setParameters({ preserve_interword_spaces:"1" });
    for(let i=0;i<importState.files.length;i++){
      updateProgress(8+i*42,`画像${i+1}を解析しています...`);
      const image=await loadImage(importState.files[i]);
      const page=await analyzeOneImage(image);
      mergePage(page);
    }
    await importState.worker.terminate(); importState.worker=null;
    normalizeAndInfer(); renderResult();
    updateProgress(100,"解析が完了しました。");
    document.getElementById("resultSection").hidden=false;
    document.getElementById("resultSection").scrollIntoView({behavior:"smooth",block:"start"});
    setMessage("読み取り結果を確認してください。読み取れなかった欄は手入力できます。","success");
  }catch(err){ console.error(err); if(importState.worker){try{await importState.worker.terminate();}catch{} importState.worker=null;} setMessage(`画像を解析できませんでした：${err.message||err}`,"error"); }
  finally{ toggleBusy(false); }
}

async function analyzeOneImage(img){
  const W=img.naturalWidth,H=img.naturalHeight;
  const headerCanvas=cropCanvas(img,0,H*0.08,W,H*0.15,true);
  await importState.worker.setParameters({tessedit_pageseg_mode:Tesseract.PSM.SPARSE_TEXT});
  const headerResult=await importState.worker.recognize(headerCanvas);
  const meta=parseHeader(headerResult.data.text||"");

  const headerRow=await recognizeCrop(img,ROW_Y.header,"0123456789",Tesseract.PSM.SPARSE_TEXT);
  let columns=detectHoleColumns(headerRow.data,W);
  if(!columns.length) columns=fallbackColumns(W);

  const rows={};
  for(const [name,yr] of Object.entries(ROW_Y)){
    if(name==="header") continue;
    let whitelist="0123456789";
    if(name==="club") whitelist="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz°";
    if(name==="direction") whitelist="←→↑↓◎○";
    const result=await recognizeCrop(img,yr,whitelist,Tesseract.PSM.SPARSE_TEXT);
    rows[name]=mapWordsToColumns(result.data,columns,W);
  }
  return {meta,columns,rows};
}

async function recognizeCrop(img,yr,whitelist,psm){
  const W=img.naturalWidth,H=img.naturalHeight;
  const canvas=cropCanvas(img,0,H*yr[0],W,H*(yr[1]-yr[0]),true);
  await importState.worker.setParameters({tessedit_pageseg_mode:psm,tessedit_char_whitelist:whitelist});
  return importState.worker.recognize(canvas);
}

function cropCanvas(img,x,y,w,h,enhance=false){
  const scale=enhance?1.5:1, c=document.createElement("canvas"); c.width=Math.round(w*scale); c.height=Math.round(h*scale);
  const ctx=c.getContext("2d",{willReadFrequently:true}); ctx.drawImage(img,x,y,w,h,0,0,c.width,c.height);
  if(enhance){ const d=ctx.getImageData(0,0,c.width,c.height); for(let i=0;i<d.data.length;i+=4){ const g=.299*d.data[i]+.587*d.data[i+1]+.114*d.data[i+2]; const v=g>175?255:g<80?0:Math.max(0,Math.min(255,(g-128)*1.65+128)); d.data[i]=d.data[i+1]=d.data[i+2]=v; } ctx.putImageData(d,0,0); }
  return c;
}

function parseHeader(text){
  const clean=String(text).replace(/\s+/g," ").trim();
  const date=(clean.match(/(20\d{2})[\/.年-](\d{1,2})[\/.月-](\d{1,2})/)||[]);
  const tee=(clean.match(/ティー\s*[:：]\s*([^\s]+)/)||[])[1]||"";
  const green=(clean.match(/グリーン\s*[:：]\s*([^\s]+)/)||[])[1]||"";
  let course="";
  const courseMatch=clean.match(/(?:20\d{2}[\/.年-]\d{1,2}[\/.月-]\d{1,2}日?)[ ]+(.+?)(?=ティー|グリーン|$)/);
  if(courseMatch) course=courseMatch[1].replace(/スコアカード/g,"").trim();
  return {date:date.length?`${date[1]}-${String(date[2]).padStart(2,"0")}-${String(date[3]).padStart(2,"0")}`:"",courseName:course,teeName:tee,greenName:green,raw:clean};
}

function getWords(data){
  if(Array.isArray(data.words)&&data.words.length) return data.words;
  const words=[]; (data.blocks||[]).forEach(b=>(b.paragraphs||[]).forEach(p=>(p.lines||[]).forEach(l=>(l.words||[]).forEach(w=>words.push(w))))); return words;
}
function detectHoleColumns(data,imageWidth){
  const scale=1.5; const words=getWords(data).map(w=>({text:(w.text||"").trim(),x:((w.bbox.x0+w.bbox.x1)/2)/scale})).filter(w=>/^\d{1,2}$/.test(w.text)&&+w.text>=1&&+w.text<=18&&w.x>imageWidth*.18);
  words.sort((a,b)=>a.x-b.x);
  const cols=[]; let segment=0,prev=null;
  words.forEach(w=>{ if(prev!==null && w.x-prev>imageWidth*.065) segment++; cols.push({x:w.x,label:+w.text,segment}); prev=w.x; });
  const unique=[]; cols.forEach(c=>{if(!unique.some(u=>Math.abs(u.x-c.x)<imageWidth*.012)) unique.push(c);});
  const segs=[...new Set(unique.map(c=>c.segment))];
  segs.forEach((seg,idx)=>{ const group=unique.filter(c=>c.segment===seg); const hasAbsolute=group.some(c=>c.label>=10); group.forEach(c=>{ c.hole=hasAbsolute?c.label:(idx===0?c.label:c.label+9); }); });
  return unique.filter(c=>c.hole>=1&&c.hole<=18);
}
function fallbackColumns(W){ const start=.218*W,step=.0357*W; return Array.from({length:18},(_,i)=>({x:start+i*step,hole:i+1,label:(i%9)+1,segment:i<9?0:1})).filter(c=>c.x<W*.97); }
function mapWordsToColumns(data,columns,W){
  const scale=1.5,out={};
  const words=getWords(data).map(w=>({text:(w.text||"").trim(),x:((w.bbox.x0+w.bbox.x1)/2)/scale,conf:w.confidence||0})).filter(w=>w.text&&w.x>W*.18);
  words.forEach(w=>{ let best=null,dist=Infinity; columns.forEach(c=>{const d=Math.abs(c.x-w.x);if(d<dist){dist=d;best=c;}}); if(best&&dist<W*.027){ if(!out[best.hole]||w.conf>out[best.hole].conf) out[best.hole]=w; } });
  return out;
}
function mergePage(page){
  if(!importState.meta.date&&page.meta.date) importState.meta.date=page.meta.date;
  if(!importState.meta.courseName&&page.meta.courseName) importState.meta.courseName=page.meta.courseName;
  if(!importState.meta.teeName&&page.meta.teeName) importState.meta.teeName=page.meta.teeName;
  if(!importState.meta.greenName&&page.meta.greenName) importState.meta.greenName=page.meta.greenName;
  page.columns.forEach(c=>{ const h=importState.holes[c.hole-1]; if(!h)return; h.par=pickNumber(page.rows.par[c.hole],h.par,2,6); h.score=pickNumber(page.rows.score[c.hole],h.score,1,20); h.putts=pickNumber(page.rows.putts[c.hole],h.putts,0,10); h.bunker=pickNumber(page.rows.bunker[c.hole],h.bunker,0,9); h.ob=pickNumber(page.rows.ob[c.hole],h.ob,0,9); h.onePenalty=pickNumber(page.rows.penalty[c.hole],h.onePenalty,0,9); const club=cleanClub(page.rows.club[c.hole]?.text); if(club)h.teeClub=club; const dir=cleanDirection(page.rows.direction[c.hole]?.text); if(dir)h.direction=dir; });
}
function pickNumber(word,current,min,max){ const m=String(word?.text||"").match(/\d+/); if(!m)return current; const n=+m[0]; return n>=min&&n<=max?n:current; }
function cleanClub(v){ const s=String(v||"").toUpperCase().replace(/\s/g,""); return /^(1W|[3-9]W|U\d|[3-9]I|PW|AW|SW|\d{2}°)$/.test(s)?s:""; }
function cleanDirection(v){ const s=String(v||""); if(/[◎○]/.test(s))return "center"; if(s.includes("←"))return "left"; if(s.includes("→"))return "right"; return ""; }
function normalizeAndInfer(){
  importState.holes.forEach(h=>{ if(h.par===0)h.par=null; if(h.score===0)h.score=null; });
  const raw=(importState.meta.raw||"");
  const labels=[...raw.matchAll(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z]+コース|OUT|IN)/gu)].map(m=>m[1]);
  if(labels.length){ importState.meta.frontCourse=labels[0]||""; importState.meta.backCourse=labels.find(x=>x!==labels[0])||""; }
}
function renderResult(){
  document.getElementById("roundDate").value=importState.meta.date||"";
  document.getElementById("courseName").value=(importState.meta.courseName||"").replace(/\s+/g,"");
  document.getElementById("frontCourse").value=importState.meta.frontCourse||"";
  document.getElementById("backCourse").value=importState.meta.backCourse||"";
  document.getElementById("teeName").value=importState.meta.teeName||"";
  document.getElementById("greenName").value=importState.meta.greenName||"";
  const body=document.getElementById("holeTableBody"); body.innerHTML="";
  importState.holes.forEach(h=>{ const tr=document.createElement("tr"); tr.innerHTML=`<th>${h.hole}</th>${numInput("par",h.par,2,6)}${numInput("score",h.score,1,20)}${numInput("putts",h.putts,0,10)}<td><input data-field="teeClub" data-hole="${h.hole}" value="${escapeHtml(h.teeClub)}" class="compact-text"></td><td><select data-field="direction" data-hole="${h.hole}"><option value=""></option><option value="left" ${h.direction==="left"?"selected":""}>左</option><option value="center" ${h.direction==="center"?"selected":""}>中央</option><option value="right" ${h.direction==="right"?"selected":""}>右</option></select></td>${numInput("bunker",h.bunker,0,9)}${numInput("ob",h.ob,0,9)}${numInput("onePenalty",h.onePenalty,0,9)}`; body.appendChild(tr); });
  body.querySelectorAll("input,select").forEach(el=>el.addEventListener("change",syncTable)); updateSummary(); updateCourseNotice();
}
function numInput(field,value,min,max){ return `<td><input type="number" inputmode="numeric" data-field="${field}" data-hole="__H__" min="${min}" max="${max}" value="${value??""}"></td>`; }
// inject hole attributes omitted by helper
const originalRenderResult=renderResult;
renderResult=function(){ originalRenderResultBodyFix(); };
function originalRenderResultBodyFix(){
  document.getElementById("roundDate").value=importState.meta.date||""; document.getElementById("courseName").value=(importState.meta.courseName||"").replace(/\s+/g,""); document.getElementById("frontCourse").value=importState.meta.frontCourse||""; document.getElementById("backCourse").value=importState.meta.backCourse||""; document.getElementById("teeName").value=importState.meta.teeName||""; document.getElementById("greenName").value=importState.meta.greenName||"";
  const body=document.getElementById("holeTableBody"); body.innerHTML="";
  importState.holes.forEach(h=>{ const tr=document.createElement("tr"); const ni=(f,v,min,max)=>`<td><input type="number" inputmode="numeric" data-field="${f}" data-hole="${h.hole}" min="${min}" max="${max}" value="${v??""}"></td>`; tr.innerHTML=`<th>${h.hole}</th>${ni("par",h.par,2,6)}${ni("score",h.score,1,20)}${ni("putts",h.putts,0,10)}<td><input data-field="teeClub" data-hole="${h.hole}" value="${escapeHtml(h.teeClub)}" class="compact-text"></td><td><select data-field="direction" data-hole="${h.hole}"><option value=""></option><option value="left" ${h.direction==="left"?"selected":""}>左</option><option value="center" ${h.direction==="center"?"selected":""}>中央</option><option value="right" ${h.direction==="right"?"selected":""}>右</option></select></td>${ni("bunker",h.bunker,0,9)}${ni("ob",h.ob,0,9)}${ni("onePenalty",h.onePenalty,0,9)}`; body.appendChild(tr); });
  body.querySelectorAll("input,select").forEach(el=>el.addEventListener("change",syncTable)); updateSummary(); updateCourseNotice();
}
function syncTable(e){ const h=importState.holes[+e.target.dataset.hole-1],f=e.target.dataset.field; if(!h||!f)return; h[f]=e.target.type==="number"?(e.target.value===""?null:+e.target.value):e.target.value; updateSummary(); }
function updateSummary(){ const sum=f=>importState.holes.reduce((a,h)=>a+(Number(h[f])||0),0); document.getElementById("previewPar").textContent=sum("par")||"-"; document.getElementById("previewScore").textContent=sum("score")||"-"; document.getElementById("previewPutts").textContent=sum("putts")||"-"; document.getElementById("previewOb").textContent=sum("ob")||"-"; }
function updateCourseNotice(){ const complete=importState.holes.every(h=>Number.isFinite(h.par)); document.getElementById("courseSaveNotice").textContent=complete?"18ホールのPARが揃っているため、未登録コースとして保存できます。":"PARが揃っていないホールがあります。ラウンドは保存できますが、コース情報の自動登録には18ホールのPARが必要です。"; }

function saveImportedRound(){
  syncMetaFromForm(); const date=importState.meta.date,courseName=importState.meta.courseName;
  if(!date||!courseName){ setMessage("ラウンド日とゴルフ場名を入力してください。","error"); return; }
  if(!importState.holes.every(h=>Number.isFinite(h.score))){ if(!confirm("スコアが未入力のホールがあります。このまま保存しますか？"))return; }
  const rounds=load(STORAGE.ROUNDS); const total=sumField("score");
  const duplicate=rounds.some(r=>r&&r.status!=="draft"&&r.date===date&&normalize(r.courseName)===normalize(courseName)&&Number(r.total)===total);
  if(duplicate&&!confirm("同じ日付・ゴルフ場・合計スコアの履歴があります。重複して保存しますか？"))return;
  let courseId=""; const layout=[importState.meta.frontCourse,importState.meta.backCourse].filter(Boolean).join(" → ");
  if(document.getElementById("saveCourseCheck").checked&&importState.holes.every(h=>Number.isFinite(h.par))){ courseId=findOrCreateCourse(courseName,layout); }
  const now=new Date().toISOString();
  const round={version:1,id:safeId("round"),status:"completed",courseId,courseName,coursePrefecture:"",courseLayoutName:layout,date,inputMode:"standard",distanceUnit:"step",enabledInputs:{score:true,putt:true,greenDistance:false,teeClub:true,direction:true,ob:true,onePenalty:true,bunker:true,memo:true},currentHole:18,holes:importState.holes.map(h=>({hole:h.hole,par:h.par,score:h.score,putts:h.putts,greenDistance:{value:null,unit:"step"},teeShot:{clubId:"",clubName:h.teeClub,direction:h.direction},ob:h.ob||0,onePenalty:h.onePenalty||0,bunker:h.bunker||0,memo:""})),out:importState.holes.slice(0,9).reduce((a,h)=>a+(+h.score||0),0),in:importState.holes.slice(9).reduce((a,h)=>a+(+h.score||0),0),total,outPar:importState.holes.slice(0,9).reduce((a,h)=>a+(+h.par||0),0),inPar:importState.holes.slice(9).reduce((a,h)=>a+(+h.par||0),0),totalPar:sumField("par"),teeName:importState.meta.teeName,greenName:importState.meta.greenName,importSource:"rakuten-screenshot",createdAt:now,updatedAt:now};
  rounds.push(round); save(STORAGE.ROUNDS,rounds); localStorage.removeItem("scorecraft_draft_round"); setMessage("ラウンド履歴を保存しました。","success"); setTimeout(()=>location.href=`history.html?id=${encodeURIComponent(round.id)}`,500);
}
function syncMetaFromForm(){ importState.meta.date=document.getElementById("roundDate").value; importState.meta.courseName=document.getElementById("courseName").value.trim(); importState.meta.frontCourse=document.getElementById("frontCourse").value.trim(); importState.meta.backCourse=document.getElementById("backCourse").value.trim(); importState.meta.teeName=document.getElementById("teeName").value.trim(); importState.meta.greenName=document.getElementById("greenName").value.trim(); }
function findOrCreateCourse(name,layout){ const db=getCourseDatabase(); const existing=db.find(c=>normalize(c.name)===normalize(name)&&normalize(c.courseName||"")===normalize(layout)); if(existing)return existing.id; const course={id:createCourseId(),name,prefecture:"",courseName:layout||"画像取込",holes:importState.holes.map(h=>({hole:h.hole,par:h.par})),isCustom:true,createdFrom:"rakuten-screenshot"}; return upsertCustomCourse(course).id; }
function sumField(f){ return importState.holes.reduce((a,h)=>a+(Number(h[f])||0),0); }
function normalize(v){ return String(v||"").replace(/[\s　]/g,"").toLowerCase(); }
function escapeHtml(v){ return String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function loadImage(file){ return new Promise((res,rej)=>{const img=new Image();img.onload=()=>res(img);img.onerror=()=>rej(new Error("画像を開けません"));img.src=URL.createObjectURL(file);}); }
function toggleBusy(b){ document.getElementById("analyzeButton").disabled=b||!importState.files.length; document.getElementById("rakutenImages").disabled=b; document.getElementById("ocrProgress").hidden=!b; }
function updateProgress(p,text){ document.getElementById("ocrProgressBar").style.width=`${Math.max(0,Math.min(100,p))}%`; document.getElementById("ocrProgressText").textContent=text; }
function resetImport(){ location.reload(); }
