"use strict";
document.addEventListener("DOMContentLoaded", initCourseManager);
const standardPars=[4,4,3,5,4,3,4,4,5,4,3,4,5,4,4,3,4,5];
function initCourseManager(){
    renderNavigation("settings");
    createParInputs();
    renderCourseList();document.getElementById("saveCourseButton").addEventListener("click",saveCourseFromForm);document.getElementById("cancelEditButton").addEventListener("click",resetForm);document.getElementById("setPar72Button").addEventListener("click",()=>setPars(standardPars));document.getElementById("clearParButton").addEventListener("click",()=>setPars(Array(18).fill("")));}
function createParInputs(){const grid=document.getElementById("parGrid");grid.innerHTML=Array.from({length:18},(_,i)=>`<label class="par-input-item"><span>${i+1}H</span><select id="par${i+1}" aria-label="${i+1}ホールのPAR"><option value="">-</option><option>3</option><option>4</option><option>5</option><option>6</option></select></label>`).join("");grid.querySelectorAll("select").forEach(el=>el.addEventListener("change",updateTotals));}
function setPars(values){values.forEach((v,i)=>document.getElementById(`par${i+1}`).value=v);updateTotals();}
function getPars(){return Array.from({length:18},(_,i)=>Number(document.getElementById(`par${i+1}`).value));}
function updateTotals(){const p=getPars().map(v=>Number.isFinite(v)?v:0);document.getElementById("outPar").textContent=p.slice(0,9).reduce((a,b)=>a+b,0);document.getElementById("inPar").textContent=p.slice(9).reduce((a,b)=>a+b,0);document.getElementById("totalPar").textContent=p.reduce((a,b)=>a+b,0);}
function renderCourseList(){
    const box=document.getElementById("courseList");
    const courses=getCourseDatabase();
    if(!courses.length){
        box.innerHTML=`<div class="course-empty-state">
            <div class="course-empty-icon">⛳</div>
            <h3>ゴルフ場が登録されていません</h3>
            <p>まずは「ゴルフ場を追加」から、よく利用するコースを登録してください。</p>
            <button class="btn course-empty-button" type="button" onclick="openCourseForm()">＋ ゴルフ場を追加</button>
        </div>`;
        return;
    }
    box.innerHTML=courses.map(c=>`<article class="course-manager-item"><div><strong>${escapeHtml(c.name)}</strong><small>${escapeHtml(c.courseName||"")} ${c.prefecture?`（${escapeHtml(c.prefecture)}）`:""}</small><span>PAR ${c.holes.reduce((sum,h)=>sum+Number(h.par||0),0)}</span></div><div class="course-manager-actions"><button type="button" class="mini-button" onclick="editCourse('${c.id}')">編集</button><button type="button" class="mini-button danger-mini" onclick="removeCourse('${c.id}')">削除</button></div></article>`).join("");
}
function openCourseForm(){
    resetForm(false);
    document.getElementById("courseFormCard").scrollIntoView({behavior:"smooth",block:"start"});
    window.setTimeout(()=>document.getElementById("courseName").focus(),350);
}
function saveCourseFromForm(){const name=document.getElementById("courseName").value.trim();const pars=getPars();if(!name){message("ゴルフ場名を入力してください。",true);return;}if(pars.some(v=>![3,4,5,6].includes(v))){message("18ホールすべてのPARを選択してください。",true);return;}const id=document.getElementById("editingCourseId").value||createCourseId();upsertCustomCourse({id,name,prefecture:document.getElementById("prefecture").value.trim(),courseName:document.getElementById("courseNameDetail").value.trim(),isCustom:true,holes:pars.map((par,i)=>({hole:i+1,par}))});renderCourseList();message("ゴルフ場を保存しました。");resetForm(false);}
function editCourse(id){const c=getCourseById(id);if(!c||!isCustomCourse(id))return;document.getElementById("editingCourseId").value=c.id;document.getElementById("courseName").value=c.name;document.getElementById("prefecture").value=c.prefecture||"";document.getElementById("courseNameDetail").value=c.courseName||"";setPars(c.holes.map(h=>h.par));document.getElementById("formTitle").textContent="ゴルフ場を編集";document.getElementById("cancelEditButton").hidden=false;document.getElementById("courseFormCard").scrollIntoView({behavior:"smooth"});}
function removeCourse(id){const c=getCourseById(id);if(!c||!confirm(`「${c.name}」を削除しますか？\n保存済みラウンドの記録は削除されません。`))return;deleteCustomCourse(id);renderCourseList();if(document.getElementById("editingCourseId").value===id)resetForm();message("ゴルフ場を削除しました。");}
function resetForm(clearMessage=true){document.getElementById("editingCourseId").value="";document.getElementById("courseName").value="";document.getElementById("prefecture").value="";document.getElementById("courseNameDetail").value="";setPars(Array(18).fill(""));document.getElementById("formTitle").textContent="新しいゴルフ場を追加";document.getElementById("cancelEditButton").hidden=true;if(clearMessage)message("");}
function message(text,error=false){const el=document.getElementById("courseMessage");el.textContent=text;el.classList.toggle("error",error);}
function escapeHtml(v){const d=document.createElement("div");d.textContent=String(v||"");return d.innerHTML;}
