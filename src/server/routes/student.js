const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const router = express.Router();

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

router.post('/login', (req, res) => {
  const { regNo, accessCode } = req.body;
  const student = db.prepare('SELECT * FROM students WHERE reg_no = ? AND access_code = ?').get(regNo, accessCode);
  if (!student) return res.status(401).json({ error: "Invalid registration number or access code." });

  const exam = db.prepare(`
    SELECT e.* FROM exams e
    JOIN exam_assignments ea ON ea.exam_id = e.id
    WHERE ea.class_id = ? AND e.is_live = 1
  `).get(student.class_id);

  if (!exam) return res.status(403).json({ error: "No active live examination found for your class." });

  let session = db.prepare('SELECT * FROM exam_sessions WHERE student_id = ? AND exam_id = ?').get(student.id, exam.id);

  if (session) {
    if (session.status === 'submitted') return res.status(403).json({ error: "Exam already submitted." });
  } else {
    const token = crypto.randomBytes(24).toString('hex');
    const insert = db.prepare(`
      INSERT INTO exam_sessions (student_id, exam_id, token, allocated_minutes) VALUES (?, ?, ?, ?)
    `).run(student.id, exam.id, token, exam.duration_minutes);
    session = db.prepare('SELECT * FROM exam_sessions WHERE id = ?').get(insert.lastInsertRowid);

    let questions = db.prepare('SELECT * FROM questions WHERE subject_id = ?').all(exam.subject_id);
    if (exam.shuffle_questions) questions = shuffle(questions);
    questions = questions.slice(0, exam.total_questions);

    const insertSq = db.prepare(`
      INSERT INTO session_questions (session_id, question_id, display_order, shuffled_options)
      VALUES (?, ?, ?, ?)
    `);

    db.transaction(() => {
      questions.forEach((q, idx) => {
        let keys = ['A', 'B', 'C', 'D'];
        if (exam.shuffle_options) keys = shuffle(keys);
        const map = {
          A: `option_${keys[0].toLowerCase()}`,
          B: `option_${keys[1].toLowerCase()}`,
          C: `option_${keys[2].toLowerCase()}`,
          D: `option_${keys[3].toLowerCase()}`
        };
        insertSq.run(session.id, q.id, idx + 1, JSON.stringify(map));
      });
    })();
  }

  res.json({ token: session.token, studentName: student.full_name, examTitle: exam.title });
});

function auth(req, res, next) {
  const token = req.headers['authorization'];
  const session = db.prepare(`SELECT * FROM exam_sessions WHERE token = ? AND status = 'in_progress'`).get(token);
  if (!session) return res.status(401).json({ error: "Unauthorized session." });
  req.session = session;
  next();
}

router.get('/paper', auth, (req, res) => {
  const paper = db.prepare(`
    SELECT sq.display_order, sq.question_id, sq.shuffled_options,
           q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.image_path,
           sa.chosen_option, sa.is_flagged
    FROM session_questions sq
    JOIN questions q ON q.id = sq.question_id
    LEFT JOIN session_answers sa ON sa.session_id = sq.session_id AND sa.question_id = sq.question_id
    WHERE sq.session_id = ? ORDER BY sq.display_order ASC
  `).all(req.session.id);

  res.json({
    questions: paper.map(p => {
      const map = JSON.parse(p.shuffled_options);
      return {
        order: p.display_order,
        questionId: p.question_id,
        text: p.question_text,
        image: p.image_path,
        options: { A: p[map.A], B: p[map.B], C: p[map.C], D: p[map.D] },
        savedAnswer: p.chosen_option,
        isFlagged: !!p.is_flagged
      };
    })
  });
});

router.post('/heartbeat', auth, (req, res) => {
  db.prepare('UPDATE exam_sessions SET last_heartbeat = CURRENT_TIMESTAMP WHERE id = ?').run(req.session.id);
  const startMs = new Date(req.session.start_time).getTime();
  const totalMs = (req.session.allocated_minutes + req.session.time_extension_minutes) * 60 * 1000;
  const remaining = Math.max(0, Math.floor((totalMs - (Date.now() - startMs)) / 1000));
  if (remaining <= 0) autoSubmit(req.session.id);
  res.json({ remainingSeconds: remaining, forceSubmit: remaining <= 0 });
});

router.post('/save-answer', auth, (req, res) => {
  const { questionId, chosenOption, isFlagged } = req.body;
  db.prepare(`
    INSERT INTO session_answers (session_id, question_id, chosen_option, is_flagged, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(session_id, question_id) DO UPDATE SET
      chosen_option = excluded.chosen_option,
      is_flagged = excluded.is_flagged,
      updated_at = CURRENT_TIMESTAMP
  `).run(req.session.id, questionId, chosenOption || null, isFlagged ? 1 : 0);
  res.json({ status: "saved" });
});

router.post('/log-violation', auth, (req, res) => {
  db.prepare('UPDATE exam_sessions SET violation_count = violation_count + 1 WHERE id = ?').run(req.session.id);
  res.json({ status: "recorded" });
});

router.post('/submit', auth, (req, res) => {
  autoSubmit(req.session.id);
  res.json({ status: "submitted" });
});

function autoSubmit(sessionId) {
  const records = db.prepare(`
    SELECT sq.shuffled_options, sa.chosen_option, q.correct_option, q.marks
    FROM session_questions sq
    JOIN questions q ON q.id = sq.question_id
    LEFT JOIN session_answers sa ON sa.session_id = sq.session_id AND sa.question_id = sq.question_id
    WHERE sq.session_id = ?
  `).all(sessionId);

  let total = 0, max = 0;
  records.forEach(r => {
    max += r.marks;
    if (r.chosen_option) {
      const map = JSON.parse(r.shuffled_options);
      const actual = map[r.chosen_option].replace('option_', '').toUpperCase();
      if (actual === r.correct_option) total += r.marks;
    }
  });
  const pct = max > 0 ? (total / max) * 100 : 0;
  db.prepare(`UPDATE exam_sessions SET status = 'submitted', end_time = CURRENT_TIMESTAMP, score = ?, percentage = ? WHERE id = ?`).run(total, pct, sessionId);
}

module.exports = router;
