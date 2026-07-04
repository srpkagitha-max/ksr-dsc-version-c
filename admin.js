import { db, auth } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import { doc, setDoc, getDoc, collection, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

let CODES = [];
let RESULTS = [];
let CURRENT_EXAM = null;
const $ = (id) => document.getElementById(id);

onAuthStateChanged(auth, (u) => {
  $('loginCard').classList.toggle('hide', !!u);
  $('panel').classList.toggle('hide', !u);
});

window.adminLogin = async () => {
  try {
    await signInWithEmailAndPassword(auth, $('email').value.trim(), $('pass').value);
  } catch (e) {
    alert('Login failed: ' + e.message);
  }
};

window.logout = () => signOut(auth);

function gen(n, prefix) {
  const out = [];
  const used = new Set();
  const p = (prefix || 'DSC').trim().toUpperCase();
  while (out.length < n) {
    const c = p + Math.floor(100000 + Math.random() * 900000);
    if (!used.has(c)) {
      used.add(c);
      out.push(c);
    }
  }
  return out;
}

function opt(line) {
  const patterns = [
    /^([A-Da-d])[\.)]\s*(.*)$/,
    /^([A-Da-d])\s*[:\-]\s*(.*)$/,
    /^(ఎ|బి|సి|డి|అ|ఆ|ఇ|ఈ)[\.)]\s*(.*)$/,
    /^(ఎ|బి|సి|డి|అ|ఆ|ఇ|ఈ)\s*[:\-]\s*(.*)$/
  ];
  for (const p of patterns) {
    const m = line.match(p);
    if (m) {
      const k = m[1];
      const i = /[A-Da-d]/.test(k)
        ? 'ABCD'.indexOf(k.toUpperCase())
        : { 'ఎ': 0, 'అ': 0, 'బి': 1, 'ఆ': 1, 'సి': 2, 'ఇ': 2, 'డి': 3, 'ఈ': 3 }[k];
      return { index: i, text: m[2].trim() };
    }
  }
  return null;
}

function isQ(l) {
  return /^(\d+[\.)]|Q\d+[\.)]|ప్రశ్న\s*\d+)/i.test(l);
}

function cleanQ(l) {
  return l
    .replace(/^Q\d+[\.)]\s*/i, '')
    .replace(/^ప్రశ్న\s*\d+[\.)]?\s*/i, '')
    .replace(/^\d+[\.)]\s*/, '')
    .trim();
}

function parseBits(raw) {
  const lines = raw.replace(/\u200b/g, '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const qs = [];
  let subject = 'DSC';
  let cur = null;

  function flush() {
    if (cur && cur.o.length === 4) {
      if (cur.a == null) cur.a = 0;
      cur.q = cur.q.trim();
      qs.push(cur);
    }
    cur = null;
  }

  for (const line of lines) {
    if (line.startsWith('*') && line.endsWith('*')) {
      subject = line.replace(/\*/g, '').trim() || 'DSC';
      continue;
    }
    if (line === 'ఆప్షన్లు:' || line === 'UTF DSC EXAM') continue;

    const an = line.match(/^(సమాధానం|Answer|Ans)[:：]?\s*([A-Da-d])/i);
    if (an && cur) {
      cur.a = 'ABCD'.indexOf(an[2].toUpperCase());
      continue;
    }

    const o = opt(line);
    if (o && cur) {
      let t = o.text;
      if (/[●⚫•*]/.test(t)) cur.a = o.index;
      t = t.replace(/[●⚫•*]/g, '').trim();
      cur.o.push(t);
      continue;
    }

    if (isQ(line)) {
      if (cur && cur.o.length === 4) flush();
      cur = { subject, q: cleanQ(line), o: [], a: null };
      continue;
    }

    if (cur) cur.q += '\n' + line;
  }

  flush();
  return qs;
}

function medal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '🏆';
}

function formatTime(sec) {
  sec = Number(sec || 0);
  return Math.floor(sec / 60) + 'm ' + (sec % 60) + 's';
}

function passMark() {
  return Number(CURRENT_EXAM?.passMark || $('passMark')?.value || 35);
}

function pctNum(r) {
  return (Number(r.score || 0) / Number(r.total || 1)) * 100;
}

function enrichRanks(rows) {
  rows.sort((a, b) => {
    if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
    if ((a.timeTakenSec || 999999) !== (b.timeTakenSec || 999999)) {
      return (a.timeTakenSec || 999999) - (b.timeTakenSec || 999999);
    }
    return (a.submittedAt?.seconds || 0) - (b.submittedAt?.seconds || 0);
  });

  let lastScore = null;
  let lastRank = 0;
  rows.forEach((r, i) => {
    if (lastScore === null || r.score !== lastScore) {
      lastRank = i + 1;
      lastScore = r.score;
    }
    r.rank = lastRank;
    r.medal = medal(lastRank);
  });
  return rows;
}

function renderStats(rows) {
  const total = rows.length;
  const scores = rows.map(r => Number(r.score || 0));
  const high = total ? Math.max(...scores) : 0;
  const low = total ? Math.min(...scores) : 0;
  const avg = total ? (scores.reduce((a, b) => a + b, 0) / total).toFixed(2) : 0;
  const avgPct = total ? (rows.reduce((a, r) => a + pctNum(r), 0) / total).toFixed(2) : 0;
  const pm = passMark();
  const pass = rows.filter(r => pctNum(r) >= pm).length;
  const fail = total - pass;
  const passPct = total ? ((pass / total) * 100).toFixed(1) + '%' : '0%';
  const warn = rows.reduce((a, r) => a + Number(r.warnings || 0), 0);
  const avgTime = total ? Math.round(rows.reduce((a, r) => a + Number(r.timeTakenSec || 0), 0) / total) : 0;

  $('statsBox').innerHTML = `
    <div class="stat"><div class="label">Total Attempts</div><div class="value">${total}</div></div>
    <div class="stat"><div class="label">Highest Score</div><div class="value">${high}</div></div>
    <div class="stat"><div class="label">Lowest Score</div><div class="value">${low}</div></div>
    <div class="stat"><div class="label">Average Score</div><div class="value">${avg}</div></div>
    <div class="stat"><div class="label">Average %</div><div class="value">${avgPct}%</div></div>
    <div class="stat"><div class="label">Pass Mark</div><div class="value">${pm}%</div></div>
    <div class="stat"><div class="label">Pass %</div><div class="value">${passPct}</div></div>
    <div class="stat"><div class="label">Pass Count</div><div class="value">${pass}</div></div>
    <div class="stat"><div class="label">Fail Count</div><div class="value">${fail}</div></div>
    <div class="stat"><div class="label">Warnings</div><div class="value">${warn}</div></div>
    <div class="stat"><div class="label">Avg Time</div><div class="value">${formatTime(avgTime)}</div></div>`;
}

window.uploadExam = async () => {
  try {
    $('status').innerHTML = 'Uploading...';
    const id = $('examId').value.trim().toUpperCase();
    if (!id) return alert('Exam ID enter చేయండి');

    const questions = parseBits($('bits').value);
    if (!questions.length) {
      $('status').innerHTML = '<span class="bad">Questions detect కాలేదు.</span>';
      return alert('Questions detect కాలేదు. ప్రతి question కి 4 options ఉండాలి. Correct answer దగ్గర ● పెట్టండి.');
    }

    await setDoc(doc(db, 'exams', id), {
      title: $('title').value.trim() || id,
      start: $('start').value,
      end: $('end').value,
      sec: Number($('sec').value) || 45,
      marks: Number($('marks').value) || 1,
      neg: Number($('neg').value) || 0,
      passMark: Number($('passMark').value) || 35,
      showResult: $('showResult').value === 'yes',
      shuffleQ: true,
      shuffleO: true,
      questions,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser ? auth.currentUser.email : 'admin',
      version: 'G-question-analysis'
    });

    CODES = gen(Number($('count').value) || 100, $('prefix').value || 'DSC');

    for (const code of CODES) {
      await setDoc(doc(db, 'exams', id, 'codes', code), {
        code,
        examId: id,
        used: false,
        active: true,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser ? auth.currentUser.email : 'admin',
        studentName: '',
        phone: ''
      });
    }

    $('codesBox').textContent = CODES.join('\n');
    $('leadExamId').value = id;
    $('status').innerHTML = '<span class="ok">Success: ' + questions.length + ' questions uploaded. ' + CODES.length + ' codes generated.</span>';
    alert('Exam uploaded successfully!');
  } catch (e) {
    console.error(e);
    alert('Upload error: ' + e.message);
    $('status').innerHTML = '<span class="bad">' + e.message + '</span>';
  }
};

window.copyCodes = async () => {
  await navigator.clipboard.writeText(CODES.join('\n'));
  alert('Codes copied');
};

window.downloadCodes = () => {
  download('S.No,Exam ID,Code\n' + CODES.map((c, i) => `${i + 1},${$('examId').value.trim().toUpperCase()},${c}`).join('\n'), 'codes.csv');
};

window.loadSample = () => {
  $('bits').value = '1. భారత రాజధాని ఏది?\nA) ముంబై\nB) ఢిల్లీ ●\nC) చెన్నై\nD) హైదరాబాద్\n\n2. 2 + 2 ఎంత?\nA) 3\nB) 4 ●\nC) 5\nD) 6';
};

window.loadResults = async () => {
  try {
    const id = $('leadExamId').value.trim().toUpperCase();
    const ex = await getDoc(doc(db, 'exams', id));
    CURRENT_EXAM = ex.exists() ? ex.data() : null;
    if (CURRENT_EXAM?.passMark && $('passMark')) $('passMark').value = CURRENT_EXAM.passMark;

    const snap = await getDocs(collection(db, 'exams', id, 'attempts'));
    RESULTS = [];
    snap.forEach(d => RESULTS.push(d.data()));
    RESULTS = enrichRanks(RESULTS);
    renderStats(RESULTS);
    renderTable(RESULTS);
    renderTop10();
  } catch (e) {
    alert('Load results error: ' + e.message);
  }
};

function renderTable(rows) {
  let html = '<table><tr><th>Rank</th><th>Name</th><th>Phone</th><th>Code</th><th>Score</th><th>Total</th><th>%</th><th>Time</th><th>Warnings</th><th>Status</th><th>Certificate</th></tr>';
  rows.forEach((r) => {
    const pct = pctNum(r);
    const status = pct >= passMark() ? '<span class="pass">PASS</span>' : '<span class="fail">FAIL</span>';
    const cls = r.rank === 1 ? 'rank1' : r.rank === 2 ? 'rank2' : r.rank === 3 ? 'rank3' : '';
    html += `<tr class="${cls}">
      <td>${r.medal} ${r.rank}</td>
      <td>${r.name || ''}</td>
      <td>${r.phone || ''}</td>
      <td>${r.code || ''}</td>
      <td>${r.score || 0}</td>
      <td>${r.total || 0}</td>
      <td>${r.pct || ''}</td>
      <td>${formatTime(r.timeTakenSec)}</td>
      <td>${r.warnings || 0}</td>
      <td>${status}</td>
      <td><button class="s" onclick="printCertificate('${r.code || ''}')">Print</button></td>
    </tr>`;
  });
  html += '</table>';
  $('leader').innerHTML = html;
}

window.searchStudent = () => {
  const q = $('searchBox').value.trim().toLowerCase();
  if (!q) return renderTable(RESULTS);
  const filtered = RESULTS.filter(r =>
    String(r.name || '').toLowerCase().includes(q) ||
    String(r.phone || '').toLowerCase().includes(q) ||
    String(r.code || '').toLowerCase().includes(q)
  );
  renderTable(filtered);
};

window.clearSearch = () => {
  $('searchBox').value = '';
  renderTable(RESULTS);
};

function renderTop10() {
  let t = '🏆 KSR DSC TOP 10\n\n';
  RESULTS.slice(0, 10).forEach(r => {
    const status = pctNum(r) >= passMark() ? 'PASS' : 'FAIL';
    t += `${r.medal} Rank ${r.rank}: ${r.name || 'Student'} - ${r.score || 0}/${r.total || 0} (${r.pct || ''}) ${status}\n`;
  });
  $('top10').textContent = t;
}

window.copyTop10 = async () => {
  await navigator.clipboard.writeText($('top10').textContent);
  alert('Top 10 copied');
};

window.printCertificate = (studentCode) => {
  const r = RESULTS.find(x => String(x.code || '') === String(studentCode || ''));
  if (!r) return alert('Student not found');
  const status = pctNum(r) >= passMark() ? 'PASS' : 'FAIL';
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>Result Certificate</title><style>
    body{font-family:Arial,sans-serif;background:#f3f6fb;padding:30px}.cert{max-width:800px;margin:auto;background:white;border:8px solid #0b57d0;border-radius:20px;padding:40px;text-align:center}
    h1{color:#0b57d0;margin-bottom:5px}.sub{font-size:18px;color:#555}.name{font-size:32px;font-weight:900;margin:25px 0}.rank{font-size:36px;font-weight:900;color:#0b57d0}
    .pass{color:#137333;font-weight:900}.fail{color:#d93025;font-weight:900}table{margin:25px auto;border-collapse:collapse}td{border:1px solid #ddd;padding:10px 20px;text-align:left}
    button{padding:12px 18px;border:0;border-radius:10px;background:#0b57d0;color:white;font-weight:900}@media print{button{display:none}body{background:white}}
    </style></head><body><div class="cert">
    <h1>KSR DSC Online Exam</h1><div class="sub">Result Certificate</div><div class="name">${r.name || 'Student'}</div><div class="rank">${r.medal || '🏆'} Rank ${r.rank}</div>
    <table><tr><td>Exam ID</td><td>${$('leadExamId').value.trim().toUpperCase()}</td></tr><tr><td>Phone</td><td>${r.phone || ''}</td></tr><tr><td>Code</td><td>${r.code || ''}</td></tr>
    <tr><td>Score</td><td>${r.score || 0} / ${r.total || 0}</td></tr><tr><td>Percentage</td><td>${r.pct || ''}</td></tr><tr><td>Time Taken</td><td>${formatTime(r.timeTakenSec)}</td></tr>
    <tr><td>Status</td><td class="${status === 'PASS' ? 'pass' : 'fail'}">${status}</td></tr></table><button onclick="window.print()">Print / Save PDF</button></div></body></html>`);
  win.document.close();
};

window.renderQuestionAnalysis = () => {
  if (!CURRENT_EXAM || !CURRENT_EXAM.questions) return alert('First Load Results');
  const qs = CURRENT_EXAM.questions || [];
  const analysis = qs.map((q, i) => ({
    no: i + 1,
    question: q.q,
    correctText: q.o?.[q.a] || '',
    attempted: 0,
    correct: 0,
    wrong: 0,
    blank: 0
  }));

  RESULTS.forEach(r => {
    if (Array.isArray(r.answerDetails)) {
      r.answerDetails.forEach((d, idx) => {
        if (!analysis[idx]) return;
        if (d.selectedText) analysis[idx].attempted++;
        else analysis[idx].blank++;
        if (d.isCorrect) analysis[idx].correct++;
        else if (d.selectedText) analysis[idx].wrong++;
      });
    }
  });

  let html = '<table><tr><th>Q.No</th><th>Question</th><th>Correct Answer</th><th>Attempted</th><th>Correct</th><th>Wrong</th><th>Blank</th><th>Accuracy</th></tr>';
  analysis.forEach(a => {
    const acc = a.attempted ? ((a.correct / a.attempted) * 100).toFixed(1) + '%' : '0%';
    html += `<tr><td>${a.no}</td><td>${a.question || ''}</td><td>${a.correctText || ''}</td><td>${a.attempted}</td><td>${a.correct}</td><td>${a.wrong}</td><td>${a.blank}</td><td>${acc}</td></tr>`;
  });
  html += '</table>';
  $('analysisBox').innerHTML = html;
};

window.printAnswerKey = () => {
  if (!CURRENT_EXAM || !CURRENT_EXAM.questions) return alert('First Load Results');
  const win = window.open('', '_blank');
  let rows = '';
  (CURRENT_EXAM.questions || []).forEach((q, i) => {
    rows += `<tr><td>${i + 1}</td><td>${q.q || ''}</td><td>${q.o?.[q.a] || ''}</td></tr>`;
  });
  win.document.write(`<html><head><title>Answer Key</title><style>body{font-family:Arial;padding:25px}h1{text-align:center;color:#0b57d0}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}th{background:#f1f3f5}@media print{button{display:none}}</style></head><body><h1>KSR DSC Answer Key</h1><button onclick="window.print()">Print / Save PDF</button><table><tr><th>Q.No</th><th>Question</th><th>Correct Answer</th></tr>${rows}</table></body></html>`);
  win.document.close();
};

window.downloadResults = () => {
  const csv = 'Rank,Name,Phone,Code,Score,Total,Percentage,Correct,Wrong,Attempted,TimeTaken,Warnings,Status\n' +
    RESULTS.map(r => {
      const status = pctNum(r) >= passMark() ? 'PASS' : 'FAIL';
      return `${r.rank},"${r.name || ''}","${r.phone || ''}",${r.code || ''},${r.score || 0},${r.total || 0},${r.pct || ''},${r.correct || 0},${r.wrong || 0},${r.attempted || 0},${formatTime(r.timeTakenSec)},${r.warnings || 0},${status}`;
    }).join('\n');
  download(csv, 'results_with_rank.csv');
};

function download(text, name) {
  const blob = new Blob([text], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}
