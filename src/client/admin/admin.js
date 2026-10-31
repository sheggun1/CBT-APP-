window.addEventListener('DOMContentLoaded', async () => {
  if (window.electronAPI) {
    const info = await window.electronAPI.getServerInfo();
    document.getElementById('ip').textContent = `Host: ${info.ip}:${info.port}`;
  }
  loadStats();
});

function tab(name) {
  ['dash','q-import','s-import','monitor'].forEach(id => {
    document.getElementById(id).style.display = (id === name) ? 'block' : 'none';
  });
}

async function loadStats() {
  const res = await fetch('http://127.0.0.1:3000/api/admin/dashboard-overview');
  const d = await res.json();
  document.getElementById('s-count').textContent = d.studentsCount;
  document.getElementById('q-count').textContent = d.questionsCount;
  document.getElementById('e-count').textContent = d.liveExamsCount;
}

async function uploadQuestions() {
  const f = document.getElementById('q-file').files[0];
  if (!f) return alert("Select file");
  const fd = new FormData();
  fd.append('file', f);
  fd.append('subject_id', document.getElementById('q-sub').value);

  const res = await fetch('http://127.0.0.1:3000/api/admin/questions/bulk-upload', { method: 'POST', body: fd });
  const data = await res.json();
  if (data.validCount > 0) {
    await fetch('http://127.0.0.1:3000/api/admin/questions/confirm-commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ validRows: data.token })
    });
    alert(`Successfully committed ${data.validCount} questions!`);
    loadStats();
  } else {
    alert("No valid rows found: " + JSON.stringify(data.errors));
  }
}

async function uploadStudents() {
  const f = document.getElementById('s-file').files[0];
  if (!f) return alert("Select file");
  const fd = new FormData();
  fd.append('file', f);
  const res = await fetch('http://127.0.0.1:3000/api/admin/students/bulk-upload', { method: 'POST', body: fd });
  const data = await res.json();
  alert(`Imported ${data.importedCount} students!`);
  loadStats();
}

async function loadMonitor() {
  const examId = document.getElementById('m-exam').value;
  const res = await fetch(`http://127.0.0.1:3000/api/admin/exams/${examId}/monitor`);
  const data = await res.json();
  const body = document.getElementById('m-body');
  body.innerHTML = '';
  data.sessions.forEach(s => {
    body.innerHTML += `
      <tr>
        <td>${s.reg_no}</td><td>${s.full_name}</td><td>${s.status}</td><td>${s.score}</td>
        <td>
          <button onclick="extend(${s.session_id})">+5m</button>
          <button onclick="resetLock(${s.session_id})">Reset Lock</button>
        </td>
      </tr>
    `;
  });
}

async function extend(id) {
  await fetch(`http://127.0.0.1:3000/api/admin/sessions/${id}/action`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'extend', minutes: 5 })
  });
  loadMonitor();
}

async function resetLock(id) {
  await fetch(`http://127.0.0.1:3000/api/admin/sessions/${id}/action`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset' })
  });
  loadMonitor();
}
