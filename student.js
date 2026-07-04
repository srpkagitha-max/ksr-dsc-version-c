import { db } from './firebase-config.js';
import { doc, getDoc, setDoc, getDocs, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';
let EXAM=null,Q=[],cur=0,ans=[],rev=[],seconds=0,totalSeconds=0,timerInt=null,student='',phone='',code='',eid='',warnings=0,started=false,submitting=false;const $=id=>document.getElementById(id);
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}function shuffle(a){for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}function windowCheck(){let now=new Date();if(EXAM.start&&now<new Date(EXAM.start))return'NOT_STARTED';if(EXAM.end&&now>new Date(EXAM.end))return'CLOSED';return'OPEN'}function medal(r){return r===1?'🥇':r===2?'🥈':r===3?'🥉':'🏆'}function formatTime(sec){sec=Number(sec||0);return Math.floor(sec/60)+'m '+(sec%60)+'s'}function applyBranding(b){if(!b)return;document.documentElement.style.setProperty('--blue',b.themeColor||'#0b57d0');$('mainTitle').textContent=b.instituteName||'KSR Online Exam Platform';$('mainSub').textContent=(b.examCategory||'Online Exam')+' - '+(b.instituteTagline||'CBT Practice');$('loginTitle').textContent=(b.examCategory||'Exam')+' Student Login';if(b.logoUrl){$('studentLogo').src=b.logoUrl;$('studentLogo').classList.remove('hide')}}
async function calculateCurrentRank(score,timeTakenSec){try{let snap=await getDocs(collection(db,'exams',eid,'attempts')),rows=[];snap.forEach(d=>rows.push(d.data()));rows.push({score,timeTakenSec,submittedAt:{seconds:Date.now()/1000},currentStudent:true});rows.sort((a,b)=>(b.score||0)-(a.score||0)||(a.timeTakenSec||999999)-(b.timeTakenSec||999999));let lastScore=null,lastRank=0;for(let i=0;i<rows.length;i++){if(lastScore===null||rows[i].score!==lastScore){lastRank=i+1;lastScore=rows[i].score}if(rows[i].currentStudent)return lastRank}return rows.length}catch(e){return'-'}}
window.printHallTicketFromLogin=async()=>{let name=$('stName').value.trim()||'Student',ph=$('stPhone').value.trim(),id=$('stExamId').value.trim().toUpperCase(),cd=$('stCode').value.trim().toUpperCase();if(!id||!cd)return alert('Exam ID + Code enter చేయండి');let ex=await getDoc(doc(db,'exams',id));if(!ex.exists())return alert('Invalid Exam ID');let e=ex.data(),b=e.branding||{};let win=window.open('','_blank');win.document.write(`<html><head><title>Hall Ticket</title><style>body{font-family:Arial;background:#f3f6fb;padding:30px}.card{max-width:700px;margin:auto;background:white;border:6px solid ${b.themeColor||'#0b57d0'};border-radius:18px;padding:30px;text-align:center}td{padding:10px;border:1px solid #ddd}table{margin:auto;border-collapse:collapse}@media print{button{display:none}}</style></head><body><div class="card"><h1>${b.instituteName||'KSR Exam Platform'}</h1><h2>Hall Ticket</h2><table><tr><td>Name</td><td>${name}</td></tr><tr><td>Phone</td><td>${ph}</td></tr><tr><td>Exam</td><td>${e.title||id}</td></tr><tr><td>Exam ID</td><td>${id}</td></tr><tr><td>Exam Code</td><td>${cd}</td></tr><tr><td>Category</td><td>${b.examCategory||''}</td></tr></table><button onclick="window.print()">Print / Save PDF</button></div></body></html>`);win.document.close()};
document.addEventListener('contextmenu',e=>{if(started)e.preventDefault()});document.addEventListener('copy',e=>{if(started)e.preventDefault()});document.addEventListener('visibilitychange',()=>{if(started&&document.hidden){warnings++;$('warns').innerText=warnings}});
window.studentLogin=async()=>{student=$('stName').value.trim();phone=$('stPhone').value.trim();eid=$('stExamId').value.trim().toUpperCase();code=$('stCode').value.trim().toUpperCase().replace(/\s+/g,'');if(!student||!phone||!eid||!code)return alert('Name, Phone, Exam ID, Exam Code అన్ని enter చేయండి');try{let ex=await getDoc(doc(db,'exams',eid));if(!ex.exists())return alert('Invalid Exam ID');EXAM=ex.data();applyBranding(EXAM.branding);let cd=await getDoc(doc(db,'exams',eid,'codes',code));if(!cd.exists())return alert('Invalid code');let codeData=cd.data();if(codeData.used===true)return alert('This code already used');let status=windowCheck();if(status==='NOT_STARTED')return alert('Exam ఇంకా start కాలేదు');if(status==='CLOSED')return alert('Exam closed');Q=JSON.parse(JSON.stringify(EXAM.questions||[])).map((q,qi)=>({originalIndex:qi,subject:q.subject,q:q.q,o:q.o.map((x,i)=>({text:x,correct:i===q.a}))}));if(!Q.length)return alert('Questions not found');if(EXAM.shuffleQ)shuffle(Q);if(EXAM.shuffleO)Q.forEach(q=>shuffle(q.o));ans=Array(Q.length).fill(null);rev=Array(Q.length).fill(false);totalSeconds=Q.length*(EXAM.sec||45);seconds=totalSeconds;$('examTitle').innerText=EXAM.title||eid;$('login').classList.add('hide');$('exam').classList.remove('hide');started=true;show();tick();timerInt=setInterval(()=>{seconds--;tick();if(seconds<=0||windowCheck()==='CLOSED')submitExam(true)},1000)}catch(e){alert('Login error: '+e.message)}};
function tick(){let m=Math.floor(seconds/60),s=seconds%60;$('timer').innerText=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')}function show(){let q=Q[cur];$('prog').innerText='Question '+(cur+1)+' of '+Q.length+' | '+(q.subject||'General');let html='<div class="q">'+esc(q.q)+'</div>';q.o.forEach((op,i)=>html+='<label class="opt"><input type="radio" name="op" '+(ans[cur]===i?'checked':'')+' onchange="sel('+i+')"> '+String.fromCharCode(65+i)+') '+esc(op.text)+'</label>');$('qcard').innerHTML=html;pal()}window.sel=i=>{ans[cur]=i;pal()};window.next=()=>{if(cur<Q.length-1){cur++;show()}};window.prev=()=>{if(cur>0){cur--;show()}};window.mark=()=>{rev[cur]=!rev[cur];pal()};window.go=i=>{cur=i;show()};function pal(){let html='';for(let i=0;i<Q.length;i++)html+='<div class="num '+(ans[i]!=null?'ans ':'')+(rev[i]?'rev ':'')+(i===cur?'cur':'')+'" onclick="go('+i+')">'+(i+1)+'</div>';$('palette').innerHTML=html}
window.submitExam=async(auto)=>{if(submitting)return;if(!auto&&!confirm('Submit చేయాలా?'))return;submitting=true;try{started=false;if(timerInt)clearInterval(timerInt);$('qcard').innerHTML='<h2>Submitting...</h2><p>దయచేసి wait చేయండి.</p>';let correct=0,wrong=0,attempted=0;let answerDetails=Q.map((q,i)=>{let selectedIndex=ans[i],selected=selectedIndex!=null?q.o[selectedIndex]:null,correctOption=q.o.find(x=>x.correct),isCorrect=!!(selected&&selected.correct);if(selectedIndex!=null){attempted++;if(isCorrect)correct++;else wrong++}return{originalIndex:q.originalIndex,qNo:i+1,question:q.q,selectedText:selected?selected.text:'',correctText:correctOption?correctOption.text:'',isCorrect}});let score=(correct*(EXAM.marks||1))-(wrong*(EXAM.neg||0)),total=Q.length*(EXAM.marks||1),pctNum=Math.round((score/total)*10000)/100,pct=pctNum+'%',timeTakenSec=Math.max(0,totalSeconds-seconds);await setDoc(doc(db,'exams',eid,'attempts',code),{name:student,phone,code,examId:eid,score,total,pct,correct,wrong,attempted,warnings,timeTakenSec,answerDetails,submittedAt:serverTimestamp()},{merge:false});await setDoc(doc(db,'exams',eid,'codes',code),{used:true,studentName:student,phone,usedAt:serverTimestamp()},{merge:true});let rank=await calculateCurrentRank(score,timeTakenSec),passMark=Number(EXAM.passMark||35),statusText=pctNum>=passMark?'PASS ✅':'FAIL ❌',inst=EXAM.branding?.instituteName||'KSR Exam Platform';$('exam').classList.add('hide');$('result').classList.remove('hide');$('result').innerHTML=EXAM.showResult?`<h2>🎉 ${inst}</h2><h3>Exam Submitted Successfully</h3><div class="big-rank">${rank==='-'?'🏆':medal(rank)} Rank ${rank}</div><h3>${esc(student)}</h3><p><b>Score:</b> ${score} / ${total}</p><p><b>Percentage:</b> ${pct}</p><p><b>Time Taken:</b> ${formatTime(timeTakenSec)}</p><p><b>Status:</b> <span class="${pctNum>=passMark?'pass':'fail'}">${statusText}</span></p>`:'<h2>Submitted Successfully</h2>';alert('Submitted successfully')}catch(e){submitting=false;alert('Submit failed: '+e.message);show()}}


// Version J Phase 2 - Student Profile + My Dashboard + My Exams

window.showRegisterBox = async () => {
  const phone = document.getElementById('portalPhone').value.trim();
  let existing = {};
  if (phone) {
    try {
      const s = await getDoc(doc(db, 'students', phone));
      if (s.exists()) existing = s.data();
    } catch (e) {}
  }

  document.getElementById('studentPortalBox').innerHTML = `
    <div class="card">
      <h2>Profile Registration / Edit</h2>
      <div class="grid">
        <div><label>Full Name</label><input id="profName" value="${existing.name || ''}" placeholder="Full name"></div>
        <div><label>Phone</label><input id="profPhone" value="${phone || existing.phone || ''}" inputmode="numeric" placeholder="Phone"></div>
      </div>
      <div class="grid">
        <div><label>Email</label><input id="profEmail" value="${existing.email || ''}" placeholder="Email"></div>
        <div><label>District</label><input id="profDistrict" value="${existing.district || ''}" placeholder="District"></div>
      </div>
      <div class="grid3">
        <div><label>Gender</label><select id="profGender">
          <option ${existing.gender==='Male'?'selected':''}>Male</option>
          <option ${existing.gender==='Female'?'selected':''}>Female</option>
          <option ${existing.gender==='Other'?'selected':''}>Other</option>
        </select></div>
        <div><label>DOB</label><input id="profDob" type="date" value="${existing.dob || ''}"></div>
        <div><label>Qualification</label><input id="profQual" value="${existing.qualification || ''}" placeholder="Qualification"></div>
      </div>
      <div class="grid">
        <div><label>Course</label><input id="profCourse" value="${existing.course || document.getElementById('portalCourse').value || 'DSC'}"></div>
        <div><label>Institute</label><input id="profInstitute" value="${existing.institute || ''}" placeholder="Institute name"></div>
      </div>
      <div class="grid">
        <div><label>Photo URL</label><input id="profPhoto" value="${existing.photoUrl || ''}" placeholder="https://..."></div>
        <div><label>Address</label><input id="profAddress" value="${existing.address || ''}" placeholder="Address"></div>
      </div>
      <button class="p" onclick="saveStudentProfile()">Save Profile</button>
    </div>`;
};

window.saveStudentProfile = async () => {
  const phone = document.getElementById('profPhone').value.trim();
  const name = document.getElementById('profName').value.trim();
  if (!phone || !name) return alert('Name మరియు Phone తప్పనిసరి');

  const data = {
    name,
    phone,
    email: document.getElementById('profEmail').value.trim(),
    district: document.getElementById('profDistrict').value.trim(),
    gender: document.getElementById('profGender').value,
    dob: document.getElementById('profDob').value,
    qualification: document.getElementById('profQual').value.trim(),
    course: document.getElementById('profCourse').value.trim(),
    institute: document.getElementById('profInstitute').value.trim(),
    photoUrl: document.getElementById('profPhoto').value.trim(),
    address: document.getElementById('profAddress').value.trim(),
    updatedAt: serverTimestamp(),
    version: 'J2-profile'
  };

  await setDoc(doc(db, 'students', phone), data, { merge: true });
  document.getElementById('portalPhone').value = phone;
  alert('Profile saved successfully');
  loadMyDashboard();
};

window.registerStudent = async () => {
  showRegisterBox();
};

window.loadMyDashboard = async () => {
  const phone = document.getElementById('portalPhone').value.trim();
  if (!phone) return alert('Phone number enter చేయండి');

  const sdoc = await getDoc(doc(db, 'students', phone));
  const profile = sdoc.exists() ? sdoc.data() : { phone, name: '', course: document.getElementById('portalCourse').value };

  const examsSnap = await getDocs(collection(db, 'exams'));
  const attempts = [];
  const upcoming = [];
  const now = new Date();

  for (const exDoc of examsSnap.docs) {
    const e = exDoc.data();
    const b = e.branding || {};
    const end = e.end ? new Date(e.end) : null;
    const start = e.start ? new Date(e.start) : null;
    if (!end || end >= now) upcoming.push({ id: exDoc.id, exam: e });

    const asnap = await getDocs(collection(db, 'exams', exDoc.id, 'attempts'));
    asnap.forEach(d => {
      const a = d.data();
      if (String(a.phone || '') === String(phone)) attempts.push({ examId: exDoc.id, exam: e, attempt: a });
    });
  }

  const total = attempts.length;
  const passed = attempts.filter(x => ((Number(x.attempt.score||0)/Number(x.attempt.total||1))*100) >= Number(x.exam.passMark || 35)).length;
  const failed = total - passed;
  const highest = total ? Math.max(...attempts.map(x => Number(x.attempt.score || 0))) : 0;
  const avg = total ? (attempts.reduce((a,x)=>a+Number(x.attempt.score||0),0)/total).toFixed(2) : 0;

  let html = `<div class="card">
    <div class="top">
      <div>
        <h2>${profile.photoUrl ? `<img src="${profile.photoUrl}" class="profile-avatar">` : '👤'} ${profile.name || 'Student'}</h2>
        <p><b>Phone:</b> ${phone} | <b>Course:</b> ${profile.course || ''} | <b>District:</b> ${profile.district || ''}</p>
      </div>
      <button class="s" onclick="showRegisterBox()">Edit Profile</button>
    </div>
    <div class="stat-grid">
      <div class="stat"><div class="label">Total Exams</div><div class="value">${total}</div></div>
      <div class="stat"><div class="label">Passed</div><div class="value">${passed}</div></div>
      <div class="stat"><div class="label">Failed</div><div class="value">${failed}</div></div>
      <div class="stat"><div class="label">Highest</div><div class="value">${highest}</div></div>
      <div class="stat"><div class="label">Average</div><div class="value">${avg}</div></div>
    </div>
  </div>`;

  html += '<div class="card"><h2>📚 My Exams</h2>';
  if (!attempts.length) html += '<p>No attempts yet.</p>';
  attempts.forEach(x => {
    const a = x.attempt, e = x.exam, b = e.branding || {};
    const pct = (Number(a.score||0)/Number(a.total||1))*100;
    const status = pct >= Number(e.passMark || 35) ? 'PASS ✅' : 'FAIL ❌';
    html += `<div class="exam-card">
      <h3>${e.title || x.examId}</h3>
      <span class="pill">${b.examCategory || 'Exam'}</span>
      <p><b>Score:</b> ${a.score}/${a.total} | <b>%:</b> ${a.pct} | <b>Rank:</b> ${a.rank || '-'} | <b>Status:</b> ${status}</p>
      <button class="s" onclick="printMyCertificate('${x.examId}','${a.code}')">Certificate</button>
      <button class="s" onclick="fillExamLogin('${x.examId}','${a.code}')">Use Exam Login</button>
    </div>`;
  });
  html += '</div>';

  html += '<div class="card"><h2>📅 Upcoming / Available Exams</h2>';
  upcoming.slice(0, 20).forEach(x => {
    const e = x.exam, b = e.branding || {};
    html += `<div class="exam-card">
      <h3>${e.title || x.id}</h3>
      <span class="pill">${b.examCategory || 'Exam'}</span>
      <p>${b.instituteName || ''} | Start: ${e.start || '-'} | End: ${e.end || '-'}</p>
      <button class="s" onclick="document.getElementById('stExamId').value='${x.id}'">Use Exam ID</button>
    </div>`;
  });
  html += '</div>';

  document.getElementById('studentPortalBox').innerHTML = html;
};

window.fillExamLogin = (examId, examCode) => {
  document.getElementById('stExamId').value = examId;
  document.getElementById('stCode').value = examCode;
};

window.printMyCertificate = async (examId, examCode) => {
  const ex = await getDoc(doc(db, 'exams', examId));
  const at = await getDoc(doc(db, 'exams', examId, 'attempts', examCode));
  if (!ex.exists() || !at.exists()) return alert('Certificate data not found');

  const e = ex.data(), a = at.data(), b = e.branding || {};
  const pct = (Number(a.score||0)/Number(a.total||1))*100;
  const status = pct >= Number(e.passMark || 35) ? 'PASS' : 'FAIL';
  const color = b.themeColor || '#0b57d0';
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>Certificate</title><style>
    body{font-family:Arial;background:#f3f6fb;padding:30px}.cert{max-width:800px;margin:auto;background:white;border:8px solid ${color};border-radius:20px;padding:40px;text-align:center}
    h1{color:${color}}td{border:1px solid #ddd;padding:10px 20px}table{margin:25px auto;border-collapse:collapse}@media print{button{display:none}}
    </style></head><body><div class="cert">
    <h1>${b.instituteName || 'KSR Exam Platform'}</h1><h2>Result Certificate</h2>
    <h1>${a.name || 'Student'}</h1><h2>Rank ${a.rank || '-'}</h2>
    <table><tr><td>Exam</td><td>${e.title || examId}</td></tr><tr><td>Score</td><td>${a.score}/${a.total}</td></tr><tr><td>Percentage</td><td>${a.pct}</td></tr><tr><td>Status</td><td>${status}</td></tr></table>
    <button onclick="window.print()">Print / Save PDF</button></div></body></html>`);
  win.document.close();
};
