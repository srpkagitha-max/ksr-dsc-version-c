import { db, auth } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import { doc, setDoc, collection, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

let CODES = [];
let RESULTS = [];

const $ = (id) => document.getElementById(id);

onAuthStateChanged(auth, (user) => {
  $('loginCard').classList.toggle('hide', !!user);
  $('panel').classList.toggle('hide', !user);
});

window.adminLogin = async () => {
  try {
    await signInWithEmailAndPassword(auth, $('email').value.trim(), $('pass').value);
  } catch (e) {
    alert('Login failed: ' + e.message);
  }
};

window.logout = () => signOut(auth);

function generateCodes(count, prefix) {
  const codes = [];
  const used = new Set();
  const p = (prefix || 'DSC').trim().toUpperCase();

  while (codes.length < count) {
    const code = p + Math.floor(100000 + Math.random() * 900000);
    if (!used.has(code)) {
      used.add(code);
      codes.push(code);
    }
  }

  return codes;
}

function detectOption(line) {
  const patterns = [
    /^([A-Da-d])[\.)]\s*(.*)$/,
    /^([A-Da-d])\s*[:\-]\s*(.*)$/,
    /^(ఎ|బి|సి|డి|అ|ఆ|ఇ|ఈ)[\.)]\s*(.*)$/,
    /^(ఎ|బి|సి|డి|అ|ఆ|ఇ|ఈ)\s*[:\-]\s*(.*)$/
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      const key = match[1];
      const index = /[A-Da-d]/.test(key)
        ? 'ABCD'.indexOf(key.toUpperCase())
        : { 'ఎ': 0, 'అ': 0, 'బి': 1, 'ఆ': 1, 'సి': 2, 'ఇ': 2, 'డి': 3, 'ఈ': 3 }[key];

      return { index, text: match[2].trim() };
    }
  }

  return null;
}

function isQuestionLine(line) {
  return /^(\d+[\.)]|Q\d+[\.)]|ప్రశ్న\s*\d+)/i.test(line);
}

function cleanQuestion(line) {
  return line
    .replace(/^Q\d+[\.)]\s*/i, '')
    .replace(/^ప్రశ్న\s*\d+[\.)]?\s*/i, '')
    .replace(/^\d+[\.)]\s*/, '')
    .trim();
}

function parseBits(raw) {
  const lines = raw
    .replace(/\u200b/g, '')
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

  const questions = [];
  let subject = 'DSC';
  let current = null;

  function flush() {
    if (current && current.o.length === 4) {
      if (current.a === null || current.a === undefined) current.a = 0;
      current.q = current.q.trim();
      questions.push(current);
    }
    current = null;
  }

  for (const line of lines) {
    if (line.startsWith('*') && line.endsWith('*')) {
      subject = line.replace(/\*/g, '').trim() || 'DSC';
      continue;
    }

    if (line === 'ఆప్షన్లు:' || line === 'UTF DSC EXAM') continue;

    const answerLine = line.match(/^(సమాధానం|Answer|Ans)[:：]?\s*([A-Da-d])/i);
    if (answerLine && current) {
      current.a = 'ABCD'.indexOf(answerLine[2].toUpperCase());
      continue;
    }

    const option = detectOption(line);
    if (option && current) {
      let text = option.text;
      if (/[●⚫•*]/.test(text)) current.a = option.index;
      text = text.replace(/[●⚫•*]/g, '').trim();
      current.o.push(text);
      continue;
    }

    if (isQuestionLine(line)) {
      if (current && current.o.length === 4) flush();
      current = { subject, q: cleanQuestion(line), o: [], a: null };
      continue;
    }

    if (current) current.q += '\n' + line;
  }

  flush();
  return questions;
}

window.uploadExam = async () => {
  try {
    $('status').innerHTML = 'Uploading...';

    const id = $('examId').value.trim().toUpperCase();
    if (!id) {
      alert('Exam ID enter చేయండి');
      return;
    }

    const questions = parseBits($('bits').value);
    if (!questions.length) {
      alert('Questions detect కాలేదు. ప్రతి question కి 4 options ఉండాలి. Correct answer దగ్గర ● పెట్టండి.');
      $('status').innerHTML = '<span class="bad">Questions detect కాలేదు.</span>';
      return;
    }

    const data = {
      title: $('title').value.trim() || id,
      start: $('start').value,
      end: $('end').value,
      sec: Number($('sec').value) || 45,
      marks: Number($('marks').value) || 1,
      neg: Number($('neg').value) || 0,
      showResult: $('showResult').value === 'yes',
      shuffleQ: true,
      shuffleO: true,
      questions,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser ? auth.currentUser.email : 'admin',
      version: 'C-ready'
    };

    await setDoc(doc(db, 'exams', id), data);

    CODES = generateCodes(Number($('count').value) || 100, $('prefix').value || 'DSC');

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
  download(
    'S.No,Exam ID,Code\n' + CODES.map((c, i) => `${i + 1},${$('examId').value.trim().toUpperCase()},${c}`).join('\n'),
    'codes.csv'
  );
};

window.loadSample = () => {
  $('bits').value =
    '1. భారత రాజధాని ఏది?\nA) ముంబై\nB) ఢిల్లీ ●\nC) చెన్నై\nD) హైదరాబాద్\n\n' +
    '2. 2 + 2 ఎంత?\nA) 3\nB) 4 ●\nC) 5\nD) 6';
};

window.loadResults = async () => {
  try {
    const id = $('leadExamId').value.trim().toUpperCase();
    const snap = await getDocs(collection(db, 'exams', id, 'attempts'));
    RESULTS = [];
    snap.forEach((d) => RESULTS.push(d.data()));
    RESULTS.sort((a, b) => (b.score || 0) - (a.score || 0));

    let html = '<table><tr><th>Rank</th><th>Name</th><th>Phone</th><th>Code</th><th>Score</th><th>Total</th><th>%</th><th>Warnings</th></tr>';
    RESULTS.forEach((r, i) => {
      html += `<tr><td>${i + 1}</td><td>${r.name || ''}</td><td>${r.phone || ''}</td><td>${r.code || ''}</td><td>${r.score || 0}</td><td>${r.total || 0}</td><td>${r.pct || ''}</td><td>${r.warnings || 0}</td></tr>`;
    });
    html += '</table>';

    $('leader').innerHTML = html;
    renderTop10();
  } catch (e) {
    alert('Load results error: ' + e.message);
  }
};

function renderTop10() {
  let text = '🏆 DSC TEST TOP 10\n\n';
  RESULTS.slice(0, 10).forEach((r, i) => {
    text += `${i + 1}. ${r.name || 'Student'} - ${r.score || 0}/${r.total || 0} (${r.pct || ''})\n`;
  });
  $('top10').textContent = text;
}

window.copyTop10 = async () => {
  await navigator.clipboard.writeText($('top10').textContent);
  alert('Top 10 copied');
};

window.downloadResults = () => {
  download(
    'Rank,Name,Phone,Code,Score,Total,Percentage,Correct,Wrong,Attempted,Warnings\n' +
      RESULTS.map((r, i) => `${i + 1},"${r.name || ''}","${r.phone || ''}",${r.code || ''},${r.score || 0},${r.total || 0},${r.pct || ''},${r.correct || 0},${r.wrong || 0},${r.attempted || 0},${r.warnings || 0}`).join('\n'),
    'results.csv'
  );
};

function download(text, name) {
  const blob = new Blob([text], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}
