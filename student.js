import { db } from './firebase-config.js';
import { doc, getDoc, setDoc, getDocs, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

let EXAM = null;
let Q = [];
let cur = 0;
let ans = [];
let rev = [];
let seconds = 0;
let totalSeconds = 0;
let timerInt = null;
let student = '';
let phone = '';
let code = '';
let eid = '';
let warnings = 0;
let started = false;
let submitting = false;

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function windowCheck() {
  const now = new Date();
  if (EXAM.start && now < new Date(EXAM.start)) return 'NOT_STARTED';
  if (EXAM.end && now > new Date(EXAM.end)) return 'CLOSED';
  return 'OPEN';
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

async function calculateCurrentRank(score, timeTakenSec) {
  try {
    const snap = await getDocs(collection(db, 'exams', eid, 'attempts'));
    const rows = [];
    snap.forEach(d => rows.push(d.data()));
    rows.push({ score, timeTakenSec, submittedAt: { seconds: Date.now() / 1000 }, currentStudent: true });

    rows.sort((a, b) => {
      if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
      if ((a.timeTakenSec || 999999) !== (b.timeTakenSec || 999999)) {
        return (a.timeTakenSec || 999999) - (b.timeTakenSec || 999999);
      }
      return (a.submittedAt?.seconds || 0) - (b.submittedAt?.seconds || 0);
    });

    let lastScore = null;
    let lastRank = 0;
    for (let i = 0; i < rows.length; i++) {
      if (lastScore === null || rows[i].score !== lastScore) {
        lastRank = i + 1;
        lastScore = rows[i].score;
      }
      rows[i].rank = lastRank;
      if (rows[i].currentStudent) return lastRank;
    }
    return rows.length;
  } catch (e) {
    console.warn('Rank calculation skipped:', e);
    return '-';
  }
}

document.addEventListener('contextmenu', e => {
  if (started) e.preventDefault();
});

document.addEventListener('copy', e => {
  if (started) e.preventDefault();
});

document.addEventListener('visibilitychange', () => {
  if (started && document.hidden) {
    warnings++;
    $('warns').innerText = warnings;
  }
});

window.studentLogin = async () => {
  $('loginMsg').textContent = '';
  student = $('stName').value.trim();
  phone = $('stPhone').value.trim();
  eid = $('stExamId').value.trim().toUpperCase();
  code = $('stCode').value.trim().toUpperCase().replace(/\s+/g, '');

  if (!student || !phone || !eid || !code) {
    return alert('Name, Phone, Exam ID, Exam Code అన్ని enter చేయండి');
  }

  try {
    const ex = await getDoc(doc(db, 'exams', eid));
    if (!ex.exists()) return alert('Invalid Exam ID');
    EXAM = ex.data();

    const cd = await getDoc(doc(db, 'exams', eid, 'codes', code));
    if (!cd.exists()) return alert('Invalid code. Admin Generated Codes box లో ఉన్న NEW code మాత్రమే వాడండి.');

    const codeData = cd.data();
    if (codeData.active === false) return alert('This code is not active');
    if (codeData.used === true) return alert('This code already used');

    const at = await getDoc(doc(db, 'exams', eid, 'attempts', code));
    if (at.exists()) return alert('Already submitted with this code');

    const status = windowCheck();
    if (status === 'NOT_STARTED') return alert('Exam ఇంకా start కాలేదు');
    if (status === 'CLOSED') return alert('Exam closed');

    Q = JSON.parse(JSON.stringify(EXAM.questions || [])).map((q, qi) => ({
      originalIndex: qi,
      subject: q.subject,
      q: q.q,
      o: q.o.map((x, i) => ({ text: x, correct: i === q.a }))
    }));

    if (!Q.length) return alert('Questions not found');

    if (EXAM.shuffleQ) shuffle(Q);
    if (EXAM.shuffleO) Q.forEach(q => shuffle(q.o));

    ans = Array(Q.length).fill(null);
    rev = Array(Q.length).fill(false);
    totalSeconds = Q.length * (EXAM.sec || 45);
    seconds = totalSeconds;

    $('mainTitle').innerText = EXAM.title || eid;
    $('examTitle').innerText = EXAM.title || eid;
    $('login').classList.add('hide');
    $('exam').classList.remove('hide');

    started = true;
    show();
    tick();

    timerInt = setInterval(() => {
      seconds--;
      tick();
      if (seconds <= 0 || windowCheck() === 'CLOSED') submitExam(true);
    }, 1000);
  } catch (e) {
    alert('Login error: ' + e.message);
  }
};

function tick() {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  $('timer').innerText = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function show() {
  const q = Q[cur];
  $('prog').innerText = 'Question ' + (cur + 1) + ' of ' + Q.length + ' | ' + (q.subject || 'DSC');

  let html = '<div class="q">' + esc(q.q) + '</div>';
  q.o.forEach((op, i) => {
    html += '<label class="opt"><input type="radio" name="op" ' +
      (ans[cur] === i ? 'checked' : '') +
      ' onchange="sel(' + i + ')"> ' +
      String.fromCharCode(65 + i) + ') ' + esc(op.text) + '</label>';
  });

  $('qcard').innerHTML = html;
  pal();
}

window.sel = (i) => {
  ans[cur] = i;
  pal();
};

window.next = () => {
  if (cur < Q.length - 1) {
    cur++;
    show();
  }
};

window.prev = () => {
  if (cur > 0) {
    cur--;
    show();
  }
};

window.mark = () => {
  rev[cur] = !rev[cur];
  pal();
};

window.go = (i) => {
  cur = i;
  show();
};

function pal() {
  let html = '';
  for (let i = 0; i < Q.length; i++) {
    html += '<div class="num ' +
      (ans[i] != null ? 'ans ' : '') +
      (rev[i] ? 'rev ' : '') +
      (i === cur ? 'cur' : '') +
      '" onclick="go(' + i + ')">' + (i + 1) + '</div>';
  }
  $('palette').innerHTML = html;
}

window.submitExam = async (auto) => {
  if (submitting) return;
  if (!auto && !confirm('Submit చేయాలా?')) return;

  submitting = true;

  try {
    started = false;
    if (timerInt) clearInterval(timerInt);

    $('qcard').innerHTML = '<h2>Submitting...</h2><p>దయచేసి wait చేయండి. Back/Refresh చేయవద్దు.</p>';

    let correct = 0;
    let wrong = 0;
    let attempted = 0;

    const answerDetails = Q.map((q, i) => {
      const selectedIndex = ans[i];
      const selected = selectedIndex != null ? q.o[selectedIndex] : null;
      const correctOption = q.o.find(x => x.correct);
      const isCorrect = !!(selected && selected.correct);

      if (selectedIndex != null) {
        attempted++;
        if (isCorrect) correct++;
        else wrong++;
      }

      return {
        originalIndex: q.originalIndex,
        qNo: i + 1,
        question: q.q,
        selectedText: selected ? selected.text : '',
        correctText: correctOption ? correctOption.text : '',
        isCorrect
      };
    });

    const score = (correct * (EXAM.marks || 1)) - (wrong * (EXAM.neg || 0));
    const total = Q.length * (EXAM.marks || 1);
    const pctNum = Math.round((score / total) * 10000) / 100;
    const pct = pctNum + '%';
    const timeTakenSec = Math.max(0, totalSeconds - seconds);

    await setDoc(doc(db, 'exams', eid, 'attempts', code), {
      name: student,
      phone,
      code,
      examId: eid,
      score,
      total,
      pct,
      correct,
      wrong,
      attempted,
      warnings,
      timeTakenSec,
      answerDetails,
      submittedAt: serverTimestamp()
    }, { merge: false });

    await setDoc(doc(db, 'exams', eid, 'codes', code), {
      used: true,
      studentName: student,
      phone,
      usedAt: serverTimestamp()
    }, { merge: true });

    const rank = await calculateCurrentRank(score, timeTakenSec);
    const passMark = Number(EXAM.passMark || 35);
    const statusText = pctNum >= passMark ? 'PASS ✅' : 'FAIL ❌';

    $('exam').classList.add('hide');
    $('result').classList.remove('hide');

    $('result').innerHTML = EXAM.showResult
      ? `<h2>🎉 Exam Submitted Successfully</h2>
         <div class="big-rank">${rank === '-' ? '🏆' : medal(rank)} Rank ${rank}</div>
         <h3>${esc(student)}</h3>
         <p><b>Score:</b> ${score} / ${total}</p>
         <p><b>Percentage:</b> ${pct}</p>
         <p><b>Time Taken:</b> ${formatTime(timeTakenSec)}</p>
         <p><b>Status:</b> <span class="${pctNum >= passMark ? 'pass' : 'fail'}">${statusText}</span></p>`
      : '<h2>Submitted Successfully</h2><p>Result adminకి save అయింది.</p>';

    alert('Submitted successfully');
  } catch (e) {
    console.error(e);
    submitting = false;
    alert('Submit failed: ' + e.message + '\nInternet check చేసి మళ్లీ Submit నొక్కండి.');
    show();
  }
};
