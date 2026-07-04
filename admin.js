import { db, auth } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import { doc, setDoc, getDoc, collection, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';
let CODES=[],RESULTS=[],CURRENT_EXAM=null;const $=id=>document.getElementById(id);
onAuthStateChanged(auth,u=>{$('loginCard').classList.toggle('hide',!!u);$('panel').classList.toggle('hide',!u)});
window.adminLogin=async()=>{try{await signInWithEmailAndPassword(auth,$('email').value.trim(),$('pass').value)}catch(e){alert('Login failed: '+e.message)}};window.logout=()=>signOut(auth);
function getBranding(){let cat=$('examCategory').value==='Custom'?($('customCategory').value.trim()||'Custom Exam'):$('examCategory').value;return{instituteName:$('instituteName').value.trim()||'KSR Coaching Center',instituteTagline:$('instituteTagline').value.trim()||'Online CBT Practice Platform',examCategory:cat,logoUrl:$('logoUrl').value.trim(),contactNo:$('contactNo').value.trim(),themeColor:$('themeColor').value||'#0b57d0'}}
function applyBranding(b){if(!b)return;document.documentElement.style.setProperty('--blue',b.themeColor||'#0b57d0');$('adminBrand').textContent=b.instituteName||'KSR Exam Admin Dashboard';$('adminSub').textContent=(b.examCategory||'Exam')+' Admin - '+(b.instituteTagline||'');if(b.logoUrl){$('adminLogo').src=b.logoUrl;$('adminLogo').classList.remove('hide')}else $('adminLogo').classList.add('hide')}
function gen(n,prefix){let out=[],used=new Set(),p=(prefix||'KSR').trim().toUpperCase();while(out.length<n){let c=p+Math.floor(100000+Math.random()*900000);if(!used.has(c)){used.add(c);out.push(c)}}return out}
function opt(line){for(const p of [/^([A-Da-d])[\.)]\s*(.*)$/,/^([A-Da-d])\s*[:\-]\s*(.*)$/,/^(ఎ|బి|సి|డి|అ|ఆ|ఇ|ఈ)[\.)]\s*(.*)$/,/^(ఎ|బి|సి|డి|అ|ఆ|ఇ|ఈ)\s*[:\-]\s*(.*)$/]){let m=line.match(p);if(m){let k=m[1],i=/[A-Da-d]/.test(k)?'ABCD'.indexOf(k.toUpperCase()):{'ఎ':0,'అ':0,'బి':1,'ఆ':1,'సి':2,'ఇ':2,'డి':3,'ఈ':3}[k];return{index:i,text:m[2].trim()}}}return null}
function isQ(l){return /^(\d+[\.)]|Q\d+[\.)]|ప్రశ్న\s*\d+)/i.test(l)}function cleanQ(l){return l.replace(/^Q\d+[\.)]\s*/i,'').replace(/^ప్రశ్న\s*\d+[\.)]?\s*/i,'').replace(/^\d+[\.)]\s*/,'').trim()}
function parseBits(raw){let lines=raw.replace(/\u200b/g,'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),qs=[],subject='General',cur=null;function flush(){if(cur&&cur.o.length===4){if(cur.a==null)cur.a=0;cur.q=cur.q.trim();qs.push(cur)}cur=null}for(const line of lines){if(line.startsWith('*')&&line.endsWith('*')){subject=line.replace(/\*/g,'').trim()||'General';continue}let an=line.match(/^(సమాధానం|Answer|Ans)[:：]?\s*([A-Da-d])/i);if(an&&cur){cur.a='ABCD'.indexOf(an[2].toUpperCase());continue}let o=opt(line);if(o&&cur){let t=o.text;if(/[●⚫•*]/.test(t))cur.a=o.index;t=t.replace(/[●⚫•*]/g,'').trim();cur.o.push(t);continue}if(isQ(line)){if(cur&&cur.o.length===4)flush();cur={subject,q:cleanQ(line),o:[],a:null};continue}if(cur)cur.q+='\n'+line}flush();return qs}
function medal(r){return r===1?'🥇':r===2?'🥈':r===3?'🥉':'🏆'}function formatTime(sec){sec=Number(sec||0);return Math.floor(sec/60)+'m '+(sec%60)+'s'}function passMark(){return Number(CURRENT_EXAM?.passMark||$('passMark')?.value||35)}function pctNum(r){return(Number(r.score||0)/Number(r.total||1))*100}
function enrichRanks(rows){rows.sort((a,b)=>{if((b.score||0)!==(a.score||0))return(b.score||0)-(a.score||0);if((a.timeTakenSec||999999)!==(b.timeTakenSec||999999))return(a.timeTakenSec||999999)-(b.timeTakenSec||999999);return(a.submittedAt?.seconds||0)-(b.submittedAt?.seconds||0)});let lastScore=null,lastRank=0;rows.forEach((r,i)=>{if(lastScore===null||r.score!==lastScore){lastRank=i+1;lastScore=r.score}r.rank=lastRank;r.medal=medal(lastRank)});return rows}
function renderStats(rows){let total=rows.length,scores=rows.map(r=>Number(r.score||0)),high=total?Math.max(...scores):0,low=total?Math.min(...scores):0,avg=total?(scores.reduce((a,b)=>a+b,0)/total).toFixed(2):0,avgPct=total?(rows.reduce((a,r)=>a+pctNum(r),0)/total).toFixed(2):0,pm=passMark(),pass=rows.filter(r=>pctNum(r)>=pm).length,fail=total-pass,passPct=total?((pass/total)*100).toFixed(1)+'%':'0%',warn=rows.reduce((a,r)=>a+Number(r.warnings||0),0),avgTime=total?Math.round(rows.reduce((a,r)=>a+Number(r.timeTakenSec||0),0)/total):0;$('statsBox').innerHTML=`<div class="stat"><div class="label">Total Attempts</div><div class="value">${total}</div></div><div class="stat"><div class="label">Highest Score</div><div class="value">${high}</div></div><div class="stat"><div class="label">Lowest Score</div><div class="value">${low}</div></div><div class="stat"><div class="label">Average Score</div><div class="value">${avg}</div></div><div class="stat"><div class="label">Average %</div><div class="value">${avgPct}%</div></div><div class="stat"><div class="label">Pass Mark</div><div class="value">${pm}%</div></div><div class="stat"><div class="label">Pass %</div><div class="value">${passPct}</div></div><div class="stat"><div class="label">Pass Count</div><div class="value">${pass}</div></div><div class="stat"><div class="label">Fail Count</div><div class="value">${fail}</div></div><div class="stat"><div class="label">Warnings</div><div class="value">${warn}</div></div><div class="stat"><div class="label">Avg Time</div><div class="value">${formatTime(avgTime)}</div></div>`}
window.loadExamManager=async()=>{let snap=await getDocs(collection(db,'exams')),html='';snap.forEach(d=>{let e=d.data(),b=e.branding||{};html+=`<div class="manager-card"><b>${d.id}</b> <span class="pill">${b.examCategory||'Exam'}</span><br><b>${e.title||''}</b><br><span class="small">${b.instituteName||''} | Questions: ${(e.questions||[]).length} | Pass: ${e.passMark||35}%</span><br><button class="s" onclick="fillExam('${d.id}')">Edit / Load</button><button class="g" onclick="loadExamResults('${d.id}')">Results</button><button class="o" onclick="printExamHallTickets('${d.id}')">Hall Tickets</button></div>`});$('examManager').innerHTML=html||'No exams found'};
window.fillExam=async(id)=>{let ex=await getDoc(doc(db,'exams',id));if(!ex.exists())return;let e=ex.data(),b=e.branding||{};$('examId').value=id;$('title').value=e.title||'';$('start').value=e.start||'';$('end').value=e.end||'';$('sec').value=e.sec||45;$('marks').value=e.marks||1;$('neg').value=e.neg||0;$('passMark').value=e.passMark||35;$('showResult').value=e.showResult?'yes':'no';$('instituteName').value=b.instituteName||'';$('instituteTagline').value=b.instituteTagline||'';$('examCategory').value=['DSC','Bank','Constable','SI','Groups','TET','APPSC','TSPSC','Railway'].includes(b.examCategory)?b.examCategory:'Custom';$('customCategory').value=$('examCategory').value==='Custom'?b.examCategory:'';$('logoUrl').value=b.logoUrl||'';$('contactNo').value=b.contactNo||'';$('themeColor').value=b.themeColor||'#0b57d0';applyBranding(b);alert('Exam loaded. అవసరమైతే edit చేసి Upload Exam నొక్కండి.')};
window.loadExamResults=(id)=>{$('leadExamId').value=id;loadResults()};window.printExamHallTickets=async(id)=>{let ex=await getDoc(doc(db,'exams',id));if(!ex.exists())return;let e=ex.data(),b=e.branding||{},snap=await getDocs(collection(db,'exams',id,'codes')),rows='';snap.forEach(d=>{let c=d.data();rows+=`<tr><td>${c.code}</td><td>${c.used?'Used':'Fresh'}</td><td>${c.studentName||''}</td><td>${c.phone||''}</td></tr>`});let win=window.open('','_blank');win.document.write(`<html><head><title>Hall Tickets</title><style>body{font-family:Arial;padding:20px}h1{color:${b.themeColor||'#0b57d0'}}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}@media print{button{display:none}}</style></head><body><h1>${b.instituteName||'KSR'} Hall Ticket Codes</h1><h3>${e.title||id}</h3><button onclick="window.print()">Print / Save PDF</button><table><tr><th>Exam Code</th><th>Status</th><th>Name</th><th>Phone</th></tr>${rows}</table></body></html>`);win.document.close()};
window.uploadExam=async()=>{try{$('status').innerHTML='Uploading...';let id=$('examId').value.trim().toUpperCase();if(!id)return alert('Exam ID enter చేయండి');let questions=parseBits($('bits').value);let old=await getDoc(doc(db,'exams',id));if(!questions.length&&old.exists())questions=old.data().questions||[];if(!questions.length)return alert('Questions paste చేయండి');let branding=getBranding();applyBranding(branding);await setDoc(doc(db,'exams',id),{title:$('title').value.trim()||id,start:$('start').value,end:$('end').value,sec:Number($('sec').value)||45,marks:Number($('marks').value)||1,neg:Number($('neg').value)||0,passMark:Number($('passMark').value)||35,showResult:$('showResult').value==='yes',shuffleQ:true,shuffleO:true,questions,branding,updatedAt:serverTimestamp(),createdBy:auth.currentUser?auth.currentUser.email:'admin',version:'I-exam-manager'});CODES=gen(Number($('count').value)||100,$('prefix').value||'KSR');for(const code of CODES){await setDoc(doc(db,'exams',id,'codes',code),{code,examId:id,used:false,active:true,createdAt:serverTimestamp(),studentName:'',phone:''},{merge:false})}$('codesBox').textContent=CODES.join('\n');$('leadExamId').value=id;$('status').innerHTML='<span class="ok">Success: Exam saved. '+CODES.length+' codes generated.</span>';alert('Exam saved successfully!')}catch(e){alert('Upload error: '+e.message);$('status').innerHTML='<span class="bad">'+e.message+'</span>'}};
window.copyCodes=async()=>{await navigator.clipboard.writeText(CODES.join('\n'));alert('Codes copied')};window.downloadCodes=()=>download('S.No,Exam ID,Code\n'+CODES.map((c,i)=>`${i+1},${$('examId').value.trim().toUpperCase()},${c}`).join('\n'),'codes.csv');window.loadSample=()=>{$('bits').value='1. భారత రాజధాని ఏది?\\nA) ముంబై\\nB) ఢిల్లీ ●\\nC) చెన్నై\\nD) హైదరాబాద్\\n\\n2. 2 + 2 ఎంత?\\nA) 3\\nB) 4 ●\\nC) 5\\nD) 6'};
window.loadResults=async()=>{try{let id=$('leadExamId').value.trim().toUpperCase(),ex=await getDoc(doc(db,'exams',id));CURRENT_EXAM=ex.exists()?ex.data():null;if(CURRENT_EXAM?.branding)applyBranding(CURRENT_EXAM.branding);let snap=await getDocs(collection(db,'exams',id,'attempts'));RESULTS=[];snap.forEach(d=>RESULTS.push(d.data()));RESULTS=enrichRanks(RESULTS);renderStats(RESULTS);renderTable(RESULTS);renderTop10()}catch(e){alert('Load results error: '+e.message)}};
function renderTable(rows){let html='<table><tr><th>Rank</th><th>Name</th><th>Phone</th><th>Code</th><th>Score</th><th>Total</th><th>%</th><th>Time</th><th>Warnings</th><th>Status</th><th>Certificate</th></tr>';rows.forEach(r=>{let status=pctNum(r)>=passMark()?'<span class="pass">PASS</span>':'<span class="fail">FAIL</span>';html+=`<tr><td>${r.medal} ${r.rank}</td><td>${r.name||''}</td><td>${r.phone||''}</td><td>${r.code||''}</td><td>${r.score||0}</td><td>${r.total||0}</td><td>${r.pct||''}</td><td>${formatTime(r.timeTakenSec)}</td><td>${r.warnings||0}</td><td>${status}</td><td><button class="s" onclick="printCertificate('${r.code||''}')">Print</button></td></tr>`});$('leader').innerHTML=html+'</table>'}
window.searchStudent=()=>{let q=$('searchBox').value.trim().toLowerCase();renderTable(q?RESULTS.filter(r=>String(r.name||'').toLowerCase().includes(q)||String(r.phone||'').toLowerCase().includes(q)||String(r.code||'').toLowerCase().includes(q)):RESULTS)};window.clearSearch=()=>{$('searchBox').value='';renderTable(RESULTS)}
function renderTop10(){let title=CURRENT_EXAM?.branding?.instituteName||'KSR';let t='🏆 '+title+' TOP 10\n\n';RESULTS.slice(0,10).forEach(r=>t+=`${r.medal} Rank ${r.rank}: ${r.name||'Student'} - ${r.score||0}/${r.total||0} (${r.pct||''})\n`);$('top10').textContent=t}window.copyTop10=async()=>{await navigator.clipboard.writeText($('top10').textContent);alert('Top 10 copied')};
window.printCertificate=(studentCode)=>{let r=RESULTS.find(x=>String(x.code||'')===String(studentCode||''));if(!r)return alert('Student not found');let b=CURRENT_EXAM?.branding||{},status=pctNum(r)>=passMark()?'PASS':'FAIL',color=b.themeColor||'#0b57d0',win=window.open('','_blank');win.document.write(`<html><head><title>Certificate</title><style>body{font-family:Arial;background:#f3f6fb;padding:30px}.cert{max-width:800px;margin:auto;background:white;border:8px solid ${color};border-radius:20px;padding:40px;text-align:center}h1{color:${color}}td{border:1px solid #ddd;padding:10px 20px}table{margin:25px auto;border-collapse:collapse}@media print{button{display:none}}</style></head><body><div class="cert"><h1>${b.instituteName||'KSR'}</h1><h2>Result Certificate</h2><h1>${r.name||'Student'}</h1><h2>${r.medal||'🏆'} Rank ${r.rank}</h2><table><tr><td>Exam</td><td>${CURRENT_EXAM?.title||''}</td></tr><tr><td>Score</td><td>${r.score||0}/${r.total||0}</td></tr><tr><td>Percentage</td><td>${r.pct||''}</td></tr><tr><td>Status</td><td>${status}</td></tr></table><button onclick="window.print()">Print / Save PDF</button></div></body></html>`);win.document.close()};
window.renderQuestionAnalysis=()=>{if(!CURRENT_EXAM)return alert('First Load Results');let qs=CURRENT_EXAM.questions||[],analysis=qs.map((q,i)=>({no:i+1,question:q.q,correctText:q.o?.[q.a]||'',attempted:0,correct:0,wrong:0,blank:0}));RESULTS.forEach(r=>{if(Array.isArray(r.answerDetails))r.answerDetails.forEach(d=>{let idx=Number(d.originalIndex);if(!analysis[idx])return;if(d.selectedText)analysis[idx].attempted++;else analysis[idx].blank++;if(d.isCorrect)analysis[idx].correct++;else if(d.selectedText)analysis[idx].wrong++})});let html='<table><tr><th>Q.No</th><th>Question</th><th>Correct</th><th>Attempted</th><th>Right</th><th>Wrong</th><th>Blank</th></tr>';analysis.forEach(a=>html+=`<tr><td>${a.no}</td><td>${a.question}</td><td>${a.correctText}</td><td>${a.attempted}</td><td>${a.correct}</td><td>${a.wrong}</td><td>${a.blank}</td></tr>`);$('analysisBox').innerHTML=html+'</table>'};
window.printAnswerKey=()=>{if(!CURRENT_EXAM)return alert('First Load Results');let rows='';(CURRENT_EXAM.questions||[]).forEach((q,i)=>rows+=`<tr><td>${i+1}</td><td>${q.q}</td><td>${q.o?.[q.a]||''}</td></tr>`);let win=window.open('','_blank');win.document.write(`<html><body><h1>Answer Key</h1><button onclick="window.print()">Print</button><table border="1" cellpadding="8"><tr><th>No</th><th>Question</th><th>Answer</th></tr>${rows}</table></body></html>`);win.document.close()};
window.downloadResults=()=>download('Rank,Name,Phone,Code,Score,Total,Percentage\n'+RESULTS.map(r=>`${r.rank},"${r.name||''}","${r.phone||''}",${r.code||''},${r.score||0},${r.total||0},${r.pct||''}`).join('\n'),'results.csv');function download(text,name){let blob=new Blob([text],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click()}


// Version J Phase 2 - Student Manager
window.loadStudents = async () => {
  try {
    const q = document.getElementById('adminStudentSearch').value.trim().toLowerCase();
    const snap = await getDocs(collection(db, 'students'));
    let rows = [];
    snap.forEach(d => {
      const s = d.data();
      const text = `${s.name||''} ${s.phone||''} ${s.course||''} ${s.institute||''}`.toLowerCase();
      if (!q || text.includes(q)) rows.push(s);
    });

    let html = `<table><tr><th>Name</th><th>Phone</th><th>Course</th><th>District</th><th>Qualification</th><th>Institute</th></tr>`;
    rows.forEach(s => {
      html += `<tr><td>${s.name||''}</td><td>${s.phone||''}</td><td>${s.course||''}</td><td>${s.district||''}</td><td>${s.qualification||''}</td><td>${s.institute||''}</td></tr>`;
    });
    html += '</table>';
    document.getElementById('studentsBox').innerHTML = rows.length ? html : '<p>No students found.</p>';
  } catch (e) {
    alert('Students load failed: ' + e.message);
  }
};


// Version K Phase 1 - Super Admin + Institute Management
function safeInstId(v) {
  return String(v || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

window.clearInstituteForm = () => {
  ['instId','instName','instAdminEmail','instContact','instExpiry','instLogo','instAddress'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('instPlan').value = 'Free';
  document.getElementById('instStatus').value = 'Active';
  document.getElementById('instTheme').value = '#0b57d0';
};

window.saveInstitute = async () => {
  const id = safeInstId(document.getElementById('instId').value);
  const name = document.getElementById('instName').value.trim();

  if (!id || !name) {
    return alert('Institute ID మరియు Institute Name తప్పనిసరి');
  }

  const data = {
    instituteId: id,
    name,
    adminEmail: document.getElementById('instAdminEmail').value.trim(),
    contact: document.getElementById('instContact').value.trim(),
    plan: document.getElementById('instPlan').value,
    status: document.getElementById('instStatus').value,
    expiryDate: document.getElementById('instExpiry').value,
    logoUrl: document.getElementById('instLogo').value.trim(),
    themeColor: document.getElementById('instTheme').value || '#0b57d0',
    address: document.getElementById('instAddress').value.trim(),
    updatedAt: serverTimestamp(),
    version: 'K1-institute'
  };

  await setDoc(doc(db, 'institutes', id), data, { merge: true });

  if (data.adminEmail) {
    await setDoc(doc(db, 'instituteAdmins', data.adminEmail), {
      email: data.adminEmail,
      instituteId: id,
      instituteName: name,
      status: data.status,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  alert('Institute saved successfully');
  loadInstitutes();
};

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
      </div>`;
      count++;
    });

    document.getElementById('institutesBox').innerHTML = count ? html : '<p>No institutes found.</p>';
  } catch (e) {
    alert('Load institutes failed: ' + e.message);
  }
};

window.editInstitute = async (id) => {
  const d = await getDoc(doc(db, 'institutes', id));
  if (!d.exists()) return alert('Institute not found');
  const x = d.data();

  document.getElementById('instId').value = id;
  document.getElementById('instName').value = x.name || '';
  document.getElementById('instAdminEmail').value = x.adminEmail || '';
  document.getElementById('instContact').value = x.contact || '';
  document.getElementById('instPlan').value = x.plan || 'Free';
  document.getElementById('instStatus').value = x.status || 'Active';
  document.getElementById('instExpiry').value = x.expiryDate || '';
  document.getElementById('instLogo').value = x.logoUrl || '';
  document.getElementById('instTheme').value = x.themeColor || '#0b57d0';
  document.getElementById('instAddress').value = x.address || '';

  alert('Institute loaded for editing');
};

window.blockInstitute = async (id) => {
  if (!confirm('Block this institute?')) return;
  await setDoc(doc(db, 'institutes', id), { status: 'Blocked', updatedAt: serverTimestamp() }, { merge: true });
  loadInstitutes();
};

window.activateInstitute = async (id) => {
  await setDoc(doc(db, 'institutes', id), { status: 'Active', updatedAt: serverTimestamp() }, { merge: true });
  loadInstitutes();
};

window.useInstituteBranding = async (id) => {
  const d = await getDoc(doc(db, 'institutes', id));
  if (!d.exists()) return alert('Institute not found');
  const x = d.data();

  document.getElementById('instituteName').value = x.name || '';
  document.getElementById('instituteTagline').value = x.plan ? `${x.plan} Online Exam Platform` : 'Online Exam Platform';
  document.getElementById('logoUrl').value = x.logoUrl || '';
  document.getElementById('contactNo').value = x.contact || '';
  document.getElementById('themeColor').value = x.themeColor || '#0b57d0';

  if (typeof applyBranding === 'function') {
    applyBranding({
      instituteName: x.name || '',
      instituteTagline: x.plan ? `${x.plan} Online Exam Platform` : 'Online Exam Platform',
      logoUrl: x.logoUrl || '',
      contactNo: x.contact || '',
      themeColor: x.themeColor || '#0b57d0',
      examCategory: document.getElementById('examCategory').value || 'Exam'
    });
  }

  alert('Institute branding applied to exam form');
};
