import { db, auth } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import { doc, setDoc, getDoc, collection, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

let CODES=[],RESULTS=[],CURRENT_EXAM=null;const $=id=>document.getElementById(id);
onAuthStateChanged(auth,u=>{$('loginCard').classList.toggle('hide',!!u);$('panel').classList.toggle('hide',!u); if(u) checkAdminAccess();});
window.adminLogin=async()=>{try{await signInWithEmailAndPassword(auth,$('email').value.trim(),$('pass').value)}catch(e){alert('Login failed: '+e.message)}};window.logout=()=>signOut(auth);
function adminEmail(){return auth.currentUser?auth.currentUser.email:''}function safeInstId(v){return String(v||'').trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'')}
window.checkAdminAccess=async()=>{const email=adminEmail();$('currentAdminEmail').textContent=email||'-';if(!email)return $('currentInstituteAccess').textContent='Not logged in';try{const d=await getDoc(doc(db,'instituteAdmins',email));if(d.exists()){const x=d.data();$('currentInstituteAccess').textContent=`${x.instituteName||x.instituteId} (${x.status||'Active'})`}else $('currentInstituteAccess').textContent='Super Admin / All Institutes'}catch(e){$('currentInstituteAccess').textContent='Access check failed'}};
window.clearInstituteForm=()=>{['instId','instName','instAdminEmail','instContact','instExpiry','instLogo','instAddress'].forEach(id=>{let el=$(id);if(el)el.value=''});$('instPlan').value='Free';$('instStatus').value='Active';$('instTheme').value='#0b57d0'};
window.saveInstitute=async()=>{const id=safeInstId($('instId').value),name=$('instName').value.trim();if(!id||!name)return alert('Institute ID మరియు Institute Name తప్పనిసరి');const data={instituteId:id,name,adminEmail:$('instAdminEmail').value.trim(),contact:$('instContact').value.trim(),plan:$('instPlan').value,status:$('instStatus').value,expiryDate:$('instExpiry').value,logoUrl:$('instLogo').value.trim(),themeColor:$('instTheme').value||'#0b57d0',address:$('instAddress').value.trim(),createdBy:adminEmail(),updatedAt:serverTimestamp(),version:'K1-verified'};await setDoc(doc(db,'institutes',id),data,{merge:true});if(data.adminEmail)await setDoc(doc(db,'instituteAdmins',data.adminEmail),{email:data.adminEmail,instituteId:id,instituteName:name,status:data.status,plan:data.plan,expiryDate:data.expiryDate,updatedAt:serverTimestamp()},{merge:true});alert('Institute saved successfully');loadInstitutes()};
window.loadInstitutes=async()=>{try{const snap=await getDocs(collection(db,'institutes'));let html='<h3>🏢 Institutes List</h3>',count=0;snap.forEach(d=>{const x=d.data(),cls=x.status==='Active'?'status-active':'status-blocked';html+=`<div class="inst-card"><div class="inst-head">${x.logoUrl?`<img src="${x.logoUrl}" class="inst-logo-small">`:'<div class="inst-logo-small"></div>'}<div><b>${x.name||''}</b> <span class="pill">${d.id}</span><br><span class="${cls}">${x.status||''}</span> | ${x.plan||'Free'} | Expiry: ${x.expiryDate||'-'}</div></div><p class="small">Admin: ${x.adminEmail||'-'}<br>Contact: ${x.contact||'-'}<br>Address: ${x.address||'-'}</p><button class="s" onclick="editInstitute('${d.id}')">Edit</button><button class="o" onclick="useInstituteBranding('${d.id}')">Use Branding</button><button class="d" onclick="blockInstitute('${d.id}')">Block</button><button class="g" onclick="activateInstitute('${d.id}')">Activate</button></div>`;count++});$('institutesBox').innerHTML=count?html:'<p>No institutes found.</p>'}catch(e){alert('Load institutes failed: '+e.message)}};
window.editInstitute=async(id)=>{const d=await getDoc(doc(db,'institutes',id));if(!d.exists())return alert('Institute not found');const x=d.data();$('instId').value=id;$('instName').value=x.name||'';$('instAdminEmail').value=x.adminEmail||'';$('instContact').value=x.contact||'';$('instPlan').value=x.plan||'Free';$('instStatus').value=x.status||'Active';$('instExpiry').value=x.expiryDate||'';$('instLogo').value=x.logoUrl||'';$('instTheme').value=x.themeColor||'#0b57d0';$('instAddress').value=x.address||'';alert('Institute loaded for editing')};
window.blockInstitute=async(id)=>{if(!confirm('Block this institute?'))return;await setDoc(doc(db,'institutes',id),{status:'Blocked',updatedAt:serverTimestamp()},{merge:true});const d=await getDoc(doc(db,'institutes',id));if(d.exists()&&d.data().adminEmail)await setDoc(doc(db,'instituteAdmins',d.data().adminEmail),{status:'Blocked',updatedAt:serverTimestamp()},{merge:true});loadInstitutes()};
window.activateInstitute=async(id)=>{await setDoc(doc(db,'institutes',id),{status:'Active',updatedAt:serverTimestamp()},{merge:true});const d=await getDoc(doc(db,'institutes',id));if(d.exists()&&d.data().adminEmail)await setDoc(doc(db,'instituteAdmins',d.data().adminEmail),{status:'Active',updatedAt:serverTimestamp()},{merge:true});loadInstitutes()};
window.useInstituteBranding=async(id)=>{const d=await getDoc(doc(db,'institutes',id));if(!d.exists())return alert('Institute not found');const x=d.data();$('instId').value=id;$('instituteName').value=x.name||'';$('instituteTagline').value=x.plan?`${x.plan} Online Exam Platform`:'Online Exam Platform';$('logoUrl').value=x.logoUrl||'';$('contactNo').value=x.contact||'';$('themeColor').value=x.themeColor||'#0b57d0';applyBranding({instituteName:x.name||'',instituteTagline:$('instituteTagline').value,logoUrl:x.logoUrl||'',contactNo:x.contact||'',themeColor:x.themeColor||'#0b57d0',examCategory:$('examCategory').value||'Exam'});alert('Institute branding applied to exam form')};

function getBranding(){let cat=$('examCategory').value==='Custom'?($('customCategory').value.trim()||'Custom Exam'):$('examCategory').value;return{instituteName:$('instituteName').value.trim()||'KSR Coaching Center',instituteTagline:$('instituteTagline').value.trim()||'Online CBT Practice Platform',examCategory:cat,logoUrl:$('logoUrl').value.trim(),contactNo:$('contactNo').value.trim(),themeColor:$('themeColor').value||'#0b57d0'}}
function applyBranding(b){if(!b)return;document.documentElement.style.setProperty('--blue',b.themeColor||'#0b57d0');$('adminBrand').textContent=b.instituteName||'KSR Exam Admin Dashboard';$('adminSub').textContent=(b.examCategory||'Exam')+' Admin - '+(b.instituteTagline||'');if(b.logoUrl){$('adminLogo').src=b.logoUrl;$('adminLogo').classList.remove('hide')}else $('adminLogo').classList.add('hide')}
function gen(n,prefix){let out=[],used=new Set(),p=(prefix||'KSR').trim().toUpperCase();while(out.length<n){let c=p+Math.floor(100000+Math.random()*900000);if(!used.has(c)){used.add(c);out.push(c)}}return out}
function opt(line){for(const p of [/^([A-Da-d])[\.)]\s*(.*)$/,/^([A-Da-d])\s*[:\-]\s*(.*)$/,/^(ఎ|బి|సి|డి|అ|ఆ|ఇ|ఈ)[\.)]\s*(.*)$/,/^(ఎ|బి|సి|డి|అ|ఆ|ఇ|ఈ)\s*[:\-]\s*(.*)$/]){let m=line.match(p);if(m){let k=m[1],i=/[A-Da-d]/.test(k)?'ABCD'.indexOf(k.toUpperCase()):{'ఎ':0,'అ':0,'బి':1,'ఆ':1,'సి':2,'ఇ':2,'డి':3,'ఈ':3}[k];return{index:i,text:m[2].trim()}}}return null}
function isQ(l){return /^(\d+[\.)]|Q\d+[\.)]|ప్రశ్న\s*\d+)/i.test(l)}function cleanQ(l){return l.replace(/^Q\d+[\.)]\s*/i,'').replace(/^ప్రశ్న\s*\d+[\.)]?\s*/i,'').replace(/^\d+[\.)]\s*/,'').trim()}
function parseBits(raw){let lines=raw.replace(/\u200b/g,'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),qs=[],subject='General',cur=null;function flush(){if(cur&&cur.o.length===4){if(cur.a==null)cur.a=0;cur.q=cur.q.trim();qs.push(cur)}cur=null}for(const line of lines){if(line.startsWith('*')&&line.endsWith('*')){subject=line.replace(/\*/g,'').trim()||'General';continue}let an=line.match(/^(సమాధానం|Answer|Ans)[:：]?\s*([A-Da-d])/i);if(an&&cur){cur.a='ABCD'.indexOf(an[2].toUpperCase());continue}let o=opt(line);if(o&&cur){let t=o.text;if(/[●⚫•*]/.test(t))cur.a=o.index;t=t.replace(/[●⚫•*]/g,'').trim();cur.o.push(t);continue}if(isQ(line)){if(cur&&cur.o.length===4)flush();cur={subject,q:cleanQ(line),o:[],a:null};continue}if(cur)cur.q+='\n'+line}flush();return qs}
function medal(r){return r===1?'🥇':r===2?'🥈':r===3?'🥉':'🏆'}function formatTime(sec){sec=Number(sec||0);return Math.floor(sec/60)+'m '+(sec%60)+'s'}function passMark(){return Number(CURRENT_EXAM?.passMark||$('passMark')?.value||35)}function pctNum(r){return(Number(r.score||0)/Number(r.total||1))*100}
function enrichRanks(rows){rows.sort((a,b)=>{if((b.score||0)!==(a.score||0))return(b.score||0)-(a.score||0);return(a.timeTakenSec||999999)-(b.timeTakenSec||999999)});let lastScore=null,lastRank=0;rows.forEach((r,i)=>{if(lastScore===null||r.score!==lastScore){lastRank=i+1;lastScore=r.score}r.rank=lastRank;r.medal=medal(lastRank)});return rows}
function renderStats(rows){let total=rows.length,scores=rows.map(r=>Number(r.score||0)),high=total?Math.max(...scores):0,avg=total?(scores.reduce((a,b)=>a+b,0)/total).toFixed(2):0,pm=passMark(),pass=rows.filter(r=>pctNum(r)>=pm).length;$('statsBox').innerHTML=`<div class="stat"><div class="label">Total Attempts</div><div class="value">${total}</div></div><div class="stat"><div class="label">Highest</div><div class="value">${high}</div></div><div class="stat"><div class="label">Average</div><div class="value">${avg}</div></div><div class="stat"><div class="label">Pass %</div><div class="value">${total?((pass/total)*100).toFixed(1):0}%</div></div>`}
window.uploadExam=async()=>{try{$('status').innerHTML='Uploading...';let id=$('examId').value.trim().toUpperCase();if(!id)return alert('Exam ID enter చేయండి');let questions=parseBits($('bits').value);let old=await getDoc(doc(db,'exams',id));if(!questions.length&&old.exists())questions=old.data().questions||[];if(!questions.length)return alert('Questions paste చేయండి');let branding=getBranding();applyBranding(branding);await setDoc(doc(db,'exams',id),{title:$('title').value.trim()||id,start:$('start').value,end:$('end').value,sec:Number($('sec').value)||45,marks:Number($('marks').value)||1,neg:Number($('neg').value)||0,passMark:Number($('passMark').value)||35,showResult:$('showResult').value==='yes',shuffleQ:true,shuffleO:true,questions,branding,instituteId:safeInstId($('instId')?.value||''),updatedAt:serverTimestamp(),createdBy:adminEmail(),version:'K1-verified'},{merge:true});CODES=gen(Number($('count').value)||100,$('prefix').value||'KSR');for(const code of CODES){await setDoc(doc(db,'exams',id,'codes',code),{code,examId:id,used:false,active:true,createdAt:serverTimestamp(),studentName:'',phone:''},{merge:false})}$('codesBox').textContent=CODES.join('\n');$('leadExamId').value=id;$('status').innerHTML='<span class="ok">Success: Exam saved. '+CODES.length+' codes generated.</span>';alert('Exam saved successfully!')}catch(e){alert('Upload error: '+e.message);$('status').innerHTML='<span class="bad">'+e.message+'</span>'}};
window.copyCodes=async()=>{await navigator.clipboard.writeText(CODES.join('\n'));alert('Codes copied')};window.downloadCodes=()=>download('S.No,Exam ID,Code\n'+CODES.map((c,i)=>`${i+1},${$('examId').value.trim().toUpperCase()},${c}`).join('\n'),'codes.csv');window.loadSample=()=>{$('bits').value='1. భారత రాజధాని ఏది?\\nA) ముంబై\\nB) ఢిల్లీ ●\\nC) చెన్నై\\nD) హైదరాబాద్\\n\\n2. 2 + 2 ఎంత?\\nA) 3\\nB) 4 ●\\nC) 5\\nD) 6'};
window.loadExamManager=async()=>{let snap=await getDocs(collection(db,'exams')),html='';snap.forEach(d=>{let e=d.data(),b=e.branding||{};html+=`<div class="manager-card"><b>${d.id}</b> <span class="pill">${b.examCategory||'Exam'}</span><br><b>${e.title||''}</b><br><span class="small">${b.instituteName||''} | InstituteID: ${e.instituteId||'-'} | Questions: ${(e.questions||[]).length}</span><br><button class="s" onclick="fillExam('${d.id}')">Edit / Load</button><button class="g" onclick="loadExamResults('${d.id}')">Results</button><button class="o" onclick="printExamHallTickets('${d.id}')">Hall Tickets</button></div>`});$('examManager').innerHTML=html||'No exams found'};
window.fillExam=async(id)=>{let ex=await getDoc(doc(db,'exams',id));if(!ex.exists())return;let e=ex.data(),b=e.branding||{};$('examId').value=id;$('title').value=e.title||'';$('start').value=e.start||'';$('end').value=e.end||'';$('sec').value=e.sec||45;$('marks').value=e.marks||1;$('neg').value=e.neg||0;$('passMark').value=e.passMark||35;$('showResult').value=e.showResult?'yes':'no';$('instId').value=e.instituteId||'';$('instituteName').value=b.instituteName||'';$('instituteTagline').value=b.instituteTagline||'';$('examCategory').value=['DSC','Bank','Constable','SI','Groups','TET','APPSC','TSPSC','Railway','SSC','RRB'].includes(b.examCategory)?b.examCategory:'Custom';$('customCategory').value=$('examCategory').value==='Custom'?b.examCategory:'';$('logoUrl').value=b.logoUrl||'';$('contactNo').value=b.contactNo||'';$('themeColor').value=b.themeColor||'#0b57d0';applyBranding(b);alert('Exam loaded')};
window.loadExamResults=(id)=>{$('leadExamId').value=id;loadResults()};window.printExamHallTickets=async(id)=>{let ex=await getDoc(doc(db,'exams',id));if(!ex.exists())return;let e=ex.data(),b=e.branding||{},snap=await getDocs(collection(db,'exams',id,'codes')),rows='';snap.forEach(d=>{let c=d.data();rows+=`<tr><td>${c.code}</td><td>${c.used?'Used':'Fresh'}</td><td>${c.studentName||''}</td><td>${c.phone||''}</td></tr>`});let win=window.open('','_blank');win.document.write(`<html><body><h1>${b.instituteName||'KSR'} Hall Ticket Codes</h1><h3>${e.title||id}</h3><button onclick="window.print()">Print</button><table border="1" cellpadding="8"><tr><th>Exam Code</th><th>Status</th><th>Name</th><th>Phone</th></tr>${rows}</table></body></html>`);win.document.close()};
window.loadResults=async()=>{try{let id=$('leadExamId').value.trim().toUpperCase(),ex=await getDoc(doc(db,'exams',id));CURRENT_EXAM=ex.exists()?ex.data():null;if(CURRENT_EXAM?.branding)applyBranding(CURRENT_EXAM.branding);let snap=await getDocs(collection(db,'exams',id,'attempts'));RESULTS=[];snap.forEach(d=>RESULTS.push(d.data()));RESULTS=enrichRanks(RESULTS);renderStats(RESULTS);renderTable(RESULTS);renderTop10()}catch(e){alert('Load results error: '+e.message)}};
function renderTable(rows){let html='<table><tr><th>Rank</th><th>Name</th><th>Phone</th><th>Code</th><th>Score</th><th>Total</th><th>%</th><th>Time</th><th>Warnings</th><th>Status</th><th>Certificate</th></tr>';rows.forEach(r=>{let status=pctNum(r)>=passMark()?'<span class="pass">PASS</span>':'<span class="fail">FAIL</span>';html+=`<tr><td>${r.medal} ${r.rank}</td><td>${r.name||''}</td><td>${r.phone||''}</td><td>${r.code||''}</td><td>${r.score||0}</td><td>${r.total||0}</td><td>${r.pct||''}</td><td>${formatTime(r.timeTakenSec)}</td><td>${r.warnings||0}</td><td>${status}</td><td><button class="s" onclick="printCertificate('${r.code||''}')">Print</button></td></tr>`});$('leader').innerHTML=html+'</table>'}
window.searchStudent=()=>{let q=$('searchBox').value.trim().toLowerCase();renderTable(q?RESULTS.filter(r=>String(r.name||'').toLowerCase().includes(q)||String(r.phone||'').toLowerCase().includes(q)||String(r.code||'').toLowerCase().includes(q)):RESULTS)};window.clearSearch=()=>{$('searchBox').value='';renderTable(RESULTS)}
function renderTop10(){let title=CURRENT_EXAM?.branding?.instituteName||'KSR';let t='🏆 '+title+' TOP 10\n\n';RESULTS.slice(0,10).forEach(r=>t+=`${r.medal} Rank ${r.rank}: ${r.name||'Student'} - ${r.score||0}/${r.total||0} (${r.pct||''})\n`);$('top10').textContent=t}window.copyTop10=async()=>{await navigator.clipboard.writeText($('top10').textContent);alert('Top 10 copied')};
window.printCertificate=(studentCode)=>{let r=RESULTS.find(x=>String(x.code||'')===String(studentCode||''));if(!r)return alert('Student not found');let b=CURRENT_EXAM?.branding||{},status=pctNum(r)>=passMark()?'PASS':'FAIL',color=b.themeColor||'#0b57d0',win=window.open('','_blank');win.document.write(`<html><head><title>Certificate</title><style>body{font-family:Arial;background:#f3f6fb;padding:30px}.cert{max-width:800px;margin:auto;background:white;border:8px solid ${color};border-radius:20px;padding:40px;text-align:center}h1{color:${color}}td{border:1px solid #ddd;padding:10px 20px}table{margin:25px auto;border-collapse:collapse}@media print{button{display:none}}</style></head><body><div class="cert"><h1>${b.instituteName||'KSR'}</h1><h2>Result Certificate</h2><h1>${r.name||'Student'}</h1><h2>${r.medal||'🏆'} Rank ${r.rank}</h2><table><tr><td>Exam</td><td>${CURRENT_EXAM?.title||''}</td></tr><tr><td>Score</td><td>${r.score||0}/${r.total||0}</td></tr><tr><td>Percentage</td><td>${r.pct||''}</td></tr><tr><td>Status</td><td>${status}</td></tr></table><button onclick="window.print()">Print / Save PDF</button></div></body></html>`);win.document.close()};
window.renderQuestionAnalysis=()=>{if(!CURRENT_EXAM)return alert('First Load Results');let qs=CURRENT_EXAM.questions||[],analysis=qs.map((q,i)=>({no:i+1,question:q.q,correctText:q.o?.[q.a]||'',attempted:0,correct:0,wrong:0,blank:0}));RESULTS.forEach(r=>{if(Array.isArray(r.answerDetails))r.answerDetails.forEach(d=>{let idx=Number(d.originalIndex);if(!analysis[idx])return;if(d.selectedText)analysis[idx].attempted++;else analysis[idx].blank++;if(d.isCorrect)analysis[idx].correct++;else if(d.selectedText)analysis[idx].wrong++})});let html='<table><tr><th>Q.No</th><th>Question</th><th>Correct</th><th>Attempted</th><th>Right</th><th>Wrong</th><th>Blank</th></tr>';analysis.forEach(a=>html+=`<tr><td>${a.no}</td><td>${a.question}</td><td>${a.correctText}</td><td>${a.attempted}</td><td>${a.correct}</td><td>${a.wrong}</td><td>${a.blank}</td></tr>`);$('analysisBox').innerHTML=html+'</table>'};
window.printAnswerKey=()=>{if(!CURRENT_EXAM)return alert('First Load Results');let rows='';(CURRENT_EXAM.questions||[]).forEach((q,i)=>rows+=`<tr><td>${i+1}</td><td>${q.q}</td><td>${q.o?.[q.a]||''}</td></tr>`);let win=window.open('','_blank');win.document.write(`<html><body><h1>Answer Key</h1><button onclick="window.print()">Print</button><table border="1" cellpadding="8"><tr><th>No</th><th>Question</th><th>Answer</th></tr>${rows}</table></body></html>`);win.document.close()};
window.downloadResults=()=>download('Rank,Name,Phone,Code,Score,Total,Percentage\n'+RESULTS.map(r=>`${r.rank},"${r.name||''}","${r.phone||''}",${r.code||''},${r.score||0},${r.total||0},${r.pct||''}`).join('\n'),'results.csv');function download(text,name){let blob=new Blob([text],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click()}
window.loadStudents=async()=>{try{const q=$('adminStudentSearch').value.trim().toLowerCase(),snap=await getDocs(collection(db,'students'));let rows=[];snap.forEach(d=>{let s=d.data(),text=`${s.name||''} ${s.phone||''} ${s.course||''} ${s.institute||''}`.toLowerCase();if(!q||text.includes(q))rows.push(s)});let html='<table><tr><th>Name</th><th>Phone</th><th>Course</th><th>District</th><th>Qualification</th><th>Institute</th></tr>';rows.forEach(s=>html+=`<tr><td>${s.name||''}</td><td>${s.phone||''}</td><td>${s.course||''}</td><td>${s.district||''}</td><td>${s.qualification||''}</td><td>${s.institute||''}</td></tr>`);$('studentsBox').innerHTML=rows.length?html+'</table>':'<p>No students found.</p>'}catch(e){alert('Students load failed: '+e.message)}};


// ================= Version K Complete - Question Editor =================
let QE_EXAM_ID = '';
let QE_EXAM_DATA = null;
let QE_QUESTIONS = [];

function qeEsc(s){
  return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

window.loadQuestionsForEdit = async () => {
  QE_EXAM_ID = (document.getElementById('qeExamId').value || document.getElementById('examId').value || '').trim().toUpperCase();
  if (!QE_EXAM_ID) return alert('Exam ID enter చేయండి');

  const ex = await getDoc(doc(db, 'exams', QE_EXAM_ID));
  if (!ex.exists()) return alert('Exam not found');

  QE_EXAM_DATA = ex.data();
  QE_QUESTIONS = JSON.parse(JSON.stringify(QE_EXAM_DATA.questions || []));
  renderQuestionEditor();
};

function renderQuestionEditor(){
  const box = document.getElementById('questionsEditorBox');
  if (!box) return;

  if (!QE_QUESTIONS.length) {
    box.innerHTML = '<p>No questions found.</p><button class="p" onclick="addNewQuestion()">Add First Question</button>';
    return;
  }

  let html = `<div class="top"><b>Total Questions: ${QE_QUESTIONS.length}</b>
    <div>
      <button class="p" onclick="addNewQuestion()">➕ Add Question</button>
      <button class="g" onclick="saveAllQuestions()">💾 Save All Changes</button>
    </div>
  </div>`;

  QE_QUESTIONS.forEach((q, i) => {
    const opts = q.o || ['', '', '', ''];
    html += `<div class="qedit">
      <div class="top">
        <span class="qno">Q${i+1}</span>
        <div>
          <button class="s" onclick="moveQuestion(${i},-1)">↑</button>
          <button class="s" onclick="moveQuestion(${i},1)">↓</button>
          <button class="d" onclick="deleteQuestion(${i})">Delete</button>
        </div>
      </div>

      <label>Subject</label>
      <input id="qe_sub_${i}" value="${qeEsc(q.subject || 'General')}">

      <label>Question</label>
      <textarea id="qe_q_${i}">${qeEsc(q.q || '')}</textarea>

      <div class="grid">
        <div><label>Option A</label><input id="qe_o_${i}_0" value="${qeEsc(opts[0] || '')}"></div>
        <div><label>Option B</label><input id="qe_o_${i}_1" value="${qeEsc(opts[1] || '')}"></div>
      </div>

      <div class="grid">
        <div><label>Option C</label><input id="qe_o_${i}_2" value="${qeEsc(opts[2] || '')}"></div>
        <div><label>Option D</label><input id="qe_o_${i}_3" value="${qeEsc(opts[3] || '')}"></div>
      </div>

      <label>Correct Answer</label>
      <select id="qe_a_${i}">
        <option value="0" ${Number(q.a||0)===0?'selected':''}>A</option>
        <option value="1" ${Number(q.a||0)===1?'selected':''}>B</option>
        <option value="2" ${Number(q.a||0)===2?'selected':''}>C</option>
        <option value="3" ${Number(q.a||0)===3?'selected':''}>D</option>
      </select>

      <button class="p" onclick="saveSingleQuestion(${i})">Save This Question</button>
    </div>`;
  });

  box.innerHTML = html;
}

function readQuestionFromForm(i){
  return {
    subject: document.getElementById(`qe_sub_${i}`).value.trim() || 'General',
    q: document.getElementById(`qe_q_${i}`).value.trim(),
    o: [
      document.getElementById(`qe_o_${i}_0`).value.trim(),
      document.getElementById(`qe_o_${i}_1`).value.trim(),
      document.getElementById(`qe_o_${i}_2`).value.trim(),
      document.getElementById(`qe_o_${i}_3`).value.trim()
    ],
    a: Number(document.getElementById(`qe_a_${i}`).value)
  };
}

function syncEditorToMemory(){
  QE_QUESTIONS = QE_QUESTIONS.map((_, i) => readQuestionFromForm(i));
}

window.saveSingleQuestion = async (i) => {
  QE_QUESTIONS[i] = readQuestionFromForm(i);
  if (!QE_QUESTIONS[i].q || QE_QUESTIONS[i].o.some(x => !x)) {
    return alert('Question + 4 options తప్పనిసరి');
  }

  await setDoc(doc(db, 'exams', QE_EXAM_ID), {
    questions: QE_QUESTIONS,
    updatedAt: serverTimestamp(),
    questionEditedAt: serverTimestamp(),
    version: 'K-complete-question-editor'
  }, { merge: true });

  alert(`Q${i+1} saved successfully`);
};

window.saveAllQuestions = async () => {
  syncEditorToMemory();

  for (const q of QE_QUESTIONS) {
    if (!q.q || q.o.some(x => !x)) {
      return alert('All questions must have question text + 4 options');
    }
  }

  await setDoc(doc(db, 'exams', QE_EXAM_ID), {
    questions: QE_QUESTIONS,
    updatedAt: serverTimestamp(),
    questionEditedAt: serverTimestamp(),
    version: 'K-complete-question-editor'
  }, { merge: true });

  alert('All questions saved successfully');
};

window.addNewQuestion = () => {
  try { if (QE_QUESTIONS.length) syncEditorToMemory(); } catch(e) {}

  QE_QUESTIONS.push({
    subject: 'General',
    q: 'New question?',
    o: ['Option A', 'Option B', 'Option C', 'Option D'],
    a: 0
  });

  renderQuestionEditor();
};

window.deleteQuestion = (i) => {
  if (!confirm(`Delete Q${i+1}?`)) return;
  try { syncEditorToMemory(); } catch(e) {}
  QE_QUESTIONS.splice(i, 1);
  renderQuestionEditor();
};

window.moveQuestion = (i, dir) => {
  try { syncEditorToMemory(); } catch(e) {}
  const j = i + dir;
  if (j < 0 || j >= QE_QUESTIONS.length) return;
  [QE_QUESTIONS[i], QE_QUESTIONS[j]] = [QE_QUESTIONS[j], QE_QUESTIONS[i]];
  renderQuestionEditor();
};


// ================= Version K Phase 3 - Logs + Backup + Delete =================
async function logActivity(action, details = {}) {
  try {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    await setDoc(doc(db, 'activityLogs', id), {
      action,
      details,
      user: auth.currentUser ? auth.currentUser.email : '',
      createdAt: serverTimestamp(),
      createdMs: Date.now(),
      version: 'K3'
    }, { merge: true });
  } catch(e) {
    console.warn('logActivity failed', e);
  }
}

// wrap existing functions with logs safely
const oldSaveInstituteK3 = window.saveInstitute;
window.saveInstitute = async () => {
  await oldSaveInstituteK3();
  await logActivity('SAVE_INSTITUTE', {
    instituteId: (document.getElementById('instId')?.value || '').trim().toUpperCase(),
    name: document.getElementById('instName')?.value || '',
    status: document.getElementById('instStatus')?.value || ''
  });
};

const oldUploadExamK3 = window.uploadExam;
window.uploadExam = async () => {
  await oldUploadExamK3();
  await logActivity('UPLOAD_EXAM', {
    examId: (document.getElementById('examId')?.value || '').trim().toUpperCase(),
    title: document.getElementById('title')?.value || '',
    instituteId: (document.getElementById('instId')?.value || '').trim().toUpperCase()
  });
};

if (typeof window.saveAllQuestions === 'function') {
  const oldSaveAllQuestionsK3 = window.saveAllQuestions;
  window.saveAllQuestions = async () => {
    await oldSaveAllQuestionsK3();
    await logActivity('SAVE_ALL_QUESTIONS', {
      examId: (document.getElementById('qeExamId')?.value || document.getElementById('examId')?.value || '').trim().toUpperCase()
    });
  };
}

// Add delete institute full action
window.deleteInstitute = async (id) => {
  if (!confirm(`Delete institute ${id}? This cannot be undone easily.`)) return;

  const d = await getDoc(doc(db, 'institutes', id));
  const data = d.exists() ? d.data() : {};

  await setDoc(doc(db, 'deletedInstitutes', id), {
    ...data,
    deletedAt: serverTimestamp(),
    deletedBy: auth.currentUser ? auth.currentUser.email : '',
    originalId: id
  }, { merge: true });

  // Firestore client SDK has no direct delete import in this file,
  // so we soft-delete by marking status Deleted. This is safer.
  await setDoc(doc(db, 'institutes', id), {
    status: 'Deleted',
    deletedAt: serverTimestamp(),
    deletedBy: auth.currentUser ? auth.currentUser.email : ''
  }, { merge: true });

  if (data.adminEmail) {
    await setDoc(doc(db, 'instituteAdmins', data.adminEmail), {
      status: 'Deleted',
      deletedAt: serverTimestamp()
    }, { merge: true });
  }

  await logActivity('DELETE_INSTITUTE_SOFT', { instituteId: id, name: data.name || '' });
  alert('Institute marked as Deleted');
  loadInstitutes();
};

// Patch loadInstitutes to show Delete button and Deleted status
const oldLoadInstitutesK3 = window.loadInstitutes;
window.loadInstitutes = async () => {
  try {
    const snap = await getDocs(collection(db, 'institutes'));
    let html = '<h3>🏢 Institutes List</h3>';
    let count = 0;

    snap.forEach(d => {
      const x = d.data();
      const statusClass = x.status === 'Active' ? 'status-active' : 'status-blocked';
      html += `<div class="inst-card">
        <div class="inst-head">
          ${x.logoUrl ? `<img src="${x.logoUrl}" class="inst-logo-small">` : '<div class="inst-logo-small"></div>'}
          <div>
            <b>${x.name || ''}</b> <span class="pill">${d.id}</span><br>
            <span class="${statusClass}">${x.status || ''}</span> | ${x.plan || 'Free'} | Expiry: ${x.expiryDate || '-'}
          </div>
        </div>
        <p class="small">
          Admin: ${x.adminEmail || '-'}<br>
          Contact: ${x.contact || '-'}<br>
          Address: ${x.address || '-'}
        </p>
        <button class="s" onclick="editInstitute('${d.id}')">Edit</button>
        <button class="o" onclick="useInstituteBranding('${d.id}')">Use Branding</button>
        <button class="d" onclick="blockInstitute('${d.id}')">Block</button>
        <button class="g" onclick="activateInstitute('${d.id}')">Activate</button>
        <button class="d" onclick="deleteInstitute('${d.id}')">Delete</button>
      </div>`;
      count++;
    });

    document.getElementById('institutesBox').innerHTML = count ? html : '<p>No institutes found.</p>';
  } catch (e) {
    alert('Load institutes failed: ' + e.message);
  }
};

window.loadActivityLogs = async () => {
  try {
    const q = (document.getElementById('logSearch')?.value || '').trim().toLowerCase();
    const snap = await getDocs(collection(db, 'activityLogs'));
    let logs = [];
    snap.forEach(d => logs.push({ id: d.id, ...d.data() }));
    logs.sort((a,b) => (b.createdMs || 0) - (a.createdMs || 0));

    if (q) {
      logs = logs.filter(x => JSON.stringify(x).toLowerCase().includes(q));
    }

    let html = '';
    logs.slice(0, 100).forEach(x => {
      const date = x.createdMs ? new Date(x.createdMs).toLocaleString() : '-';
      html += `<div class="log-card">
        <b>${x.action || ''}</b><br>
        <span class="small">User: ${x.user || '-'} | Time: ${date}</span>
        <pre class="backup-box">${JSON.stringify(x.details || {}, null, 2)}</pre>
      </div>`;
    });
    document.getElementById('logsBox').innerHTML = html || '<p>No logs found.</p>';
  } catch(e) {
    alert('Load logs failed: ' + e.message);
  }
};

async function collectionToArray(name) {
  const snap = await getDocs(collection(db, name));
  const arr = [];
  snap.forEach(d => arr.push({ id: d.id, data: d.data() }));
  return arr;
}

window.downloadFullBackup = async () => {
  try {
    const backup = {
      version: 'K3-backup',
      createdAt: new Date().toISOString(),
      createdBy: auth.currentUser ? auth.currentUser.email : '',
      institutes: await collectionToArray('institutes'),
      instituteAdmins: await collectionToArray('instituteAdmins'),
      students: await collectionToArray('students'),
      exams: []
    };

    const examsSnap = await getDocs(collection(db, 'exams'));
    for (const exDoc of examsSnap.docs) {
      const examObj = { id: exDoc.id, data: exDoc.data(), codes: [], attempts: [] };
      const codesSnap = await getDocs(collection(db, 'exams', exDoc.id, 'codes'));
      codesSnap.forEach(c => examObj.codes.push({ id: c.id, data: c.data() }));
      const attemptsSnap = await getDocs(collection(db, 'exams', exDoc.id, 'attempts'));
      attemptsSnap.forEach(a => examObj.attempts.push({ id: a.id, data: a.data() }));
      backup.exams.push(examObj);
    }

    const text = JSON.stringify(backup, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ksr-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();

    await logActivity('DOWNLOAD_BACKUP', {
      institutes: backup.institutes.length,
      students: backup.students.length,
      exams: backup.exams.length
    });
  } catch(e) {
    alert('Backup failed: ' + e.message);
  }
};

window.restoreBackupFromText = async () => {
  if (!confirm('Restore backup? Existing matching documents will be overwritten.')) return;

  try {
    const text = document.getElementById('restoreJson').value.trim();
    if (!text) return alert('Backup JSON paste చేయండి');

    const backup = JSON.parse(text);

    for (const item of (backup.institutes || [])) {
      await setDoc(doc(db, 'institutes', item.id), item.data, { merge: true });
    }
    for (const item of (backup.instituteAdmins || [])) {
      await setDoc(doc(db, 'instituteAdmins', item.id), item.data, { merge: true });
    }
    for (const item of (backup.students || [])) {
      await setDoc(doc(db, 'students', item.id), item.data, { merge: true });
    }
    for (const ex of (backup.exams || [])) {
      await setDoc(doc(db, 'exams', ex.id), ex.data, { merge: true });
      for (const c of (ex.codes || [])) {
        await setDoc(doc(db, 'exams', ex.id, 'codes', c.id), c.data, { merge: true });
      }
      for (const a of (ex.attempts || [])) {
        await setDoc(doc(db, 'exams', ex.id, 'attempts', a.id), a.data, { merge: true });
      }
    }

    await logActivity('RESTORE_BACKUP', {
      institutes: (backup.institutes || []).length,
      students: (backup.students || []).length,
      exams: (backup.exams || []).length
    });

    alert('Backup restored successfully');
  } catch(e) {
    alert('Restore failed: ' + e.message);
  }
};
