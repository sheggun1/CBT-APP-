const express = require('express');
const multer = require('multer');
const fs = require('fs');
const xlsx = require('xlsx');
const db = require('../db');
const { parseQuestionsFile, commitQuestions } = require('../utils/importer');
const { importStudentsFromSheet, commitStudents } = require('../utils/student_importer');
const { generateStudentResultSlip } = require('../utils/pdf_generator');

const router = express.Router();
const upload = multer({ dest: 'uploads/temp/' });

router.get('/dashboard-overview', (req, res) => {
  const s = db.prepare('SELECT count(*) as count FROM students').get().count;
  const q = db.prepare('SELECT count(*) as count FROM questions').get().count;
  const l = db.prepare('SELECT count(*) as count FROM exams WHERE is_live = 1').get().count;
  res.json({ studentsCount: s, questionsCount: q, liveExamsCount: l });
});

router.post('/questions/bulk-upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });
  try {
    const { validRows, errors } = parseQuestionsFile(req.file.path, parseInt(req.body.subject_id));
    fs.unlinkSync(req.file.path);
    res.json({ totalParsed: validRows.length + errors.length, validCount: validRows.length, errorCount: errors.length, errors, token: validRows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/questions/confirm-commit', (req, res) => {
  const count = commitQuestions(req.body.validRows);
  res.json({ status: "success", insertedCount: count });
});

router.post('/students/bulk-upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });
  try {
    const { validRows, errors } = importStudentsFromSheet(req.file.path);
    fs.unlinkSync(req.file.path);
    const count = commitStudents(validRows);
    res.json({ importedCount: count, errors });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/exams/:id/monitor', (req, res) => {
  const sessions = db.prepare(`
    SELECT es.id as session_id, s.reg_no, s.full_name, c.name as class_name,
           es.status, es.violation_count, es.score, es.percentage,
           (SELECT COUNT(*) FROM session_answers WHERE session_id = es.id AND chosen_option IS NOT NULL) as answered_count
    FROM exam_sessions es
    JOIN students s ON s.id = es.student_id
    JOIN classes c ON c.id = s.class_id
    WHERE es.exam_id = ?
  `).all(req.params.id);
  res.json({ sessions });
});

router.post('/sessions/:id/action', (req, res) => {
  const { action, minutes } = req.body;
  if (action === 'extend') {
    db.prepare('UPDATE exam_sessions SET time_extension_minutes = time_extension_minutes + ? WHERE id = ?').run(parseInt(minutes) || 5, req.params.id);
    return res.json({ status: "Extended" });
  }
  if (action === 'reset') {
    db.prepare("UPDATE exam_sessions SET last_heartbeat = '2000-01-01 00:00:00' WHERE id = ?").run(req.params.id);
    return res.json({ status: "Lock reset" });
  }
  res.status(400).json({ error: "Invalid action" });
});

router.get('/sessions/:id/pdf-slip', (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Result_${req.params.id}.pdf"`);
    generateStudentResultSlip(req.params.id, res);
  } catch (e) { res.status(404).send(e.message); }
});

module.exports = router;
