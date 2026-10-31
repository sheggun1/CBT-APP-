let token = '', questions = [], cur = 0, remaining = 0;

async function login() {
  const regNo = document.getElementById('regNo').value.trim();
  const accessCode = document.getElementById('code').value.trim();
  const res = await fetch('/api/student/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ regNo, accessCode })
  });
  const d = await res.json();
  if (!res.ok) return alert(d.error);
  token = d.token;
  document.getElementById('c-name').textContent = d.studentName;
  document.getElementById('login-pane').classList.add('hidden');
  document.getElementById('exam-pane').classList.remove('hidden');

  const pRes = await fetch('/api/student/paper', { headers: { 'Authorization': token } });
  const pData = await pRes.json();
  questions = pData.questions;
  renderPalette();
  render();
  setInterval(heartbeat, 10000);
  setInterval(() => {
    if (remaining > 0) {
      remaining--;
      const m = Math.floor(remaining / 60), s = remaining % 60;
      document.getElementById('timer').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
  }, 1000);
}

async function heartbeat() {
  const res = await fetch('/api/student/heartbeat', { method: 'POST', headers: { 'Authorization': token } });
  const d = await res.json();
  remaining = d.remainingSeconds;
  if (d.forceSubmit) submitExam();
}

function render() {
  const q = questions[cur];
  document.getElementById('q-num').textContent = `Question ${cur + 1} of ${questions.length}`;
  document.getElementById('q-txt').textContent = q.text;
  const opts = document.getElementById('opts');
  opts.innerHTML = '';
  ['A','B','C','D'].forEach(k => {
    const l = document.createElement('label');
    l.className = 'option-label';
    l.innerHTML = `<input type="radio" name="opt" value="${k}" ${q.savedAnswer === k ? 'checked':''} onchange="pick('${k}')"> <span><strong>${k}.</strong> ${q.options[k]}</span>`;
    opts.appendChild(l);
  });
  updatePalette();
}

function renderPalette() {
  const p = document.getElementById('palette');
  p.innerHTML = '';
  questions.forEach((q, idx) => {
    const box = document.createElement('div');
    box.className = 'p-box';
    box.id = `p-${idx}`;
    box.textContent = idx + 1;
    box.onclick = () => { cur = idx; render(); };
    p.appendChild(box);
  });
}

function updatePalette() {
  questions.forEach((q, idx) => {
    const b = document.getElementById(`p-${idx}`);
    if (!b) return;
    b.className = 'p-box';
    if (q.savedAnswer) b.classList.add('answered');
    if (idx === cur) b.classList.add('active');
  });
}

function nav(delta) {
  if (cur + delta >= 0 && cur + delta < questions.length) {
    cur += delta;
    render();
  }
}

async function pick(val) {
  questions[cur].savedAnswer = val;
  updatePalette();
  await fetch('/api/student/save-answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': token },
    body: JSON.stringify({ questionId: questions[cur].questionId, chosenOption: val })
  });
}

async function submitExam() {
  if (confirm("Are you sure you want to finalize and submit?")) {
    await fetch('/api/student/submit', { method: 'POST', headers: { 'Authorization': token } });
    document.body.innerHTML = "<div class='center'><h1>Exam Submitted Successfully. Workstation may now be closed.</h1></div>";
  }
}

// Invigilator Master Exit Sequence: Ctrl+Alt+Shift+X
window.addEventListener('keydown', e => {
  if (e.ctrlKey && e.altKey && e.shiftKey && e.key.toLowerCase() === 'x') {
    if (prompt("Enter Master Password to Exit Workstation:") === "Admin@Pass123") window.close();
  }
});
