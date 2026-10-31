const PDFDocument = require('pdfkit');
const db = require('../db');

function generateStudentResultSlip(sessionId, stream) {
  const s = db.prepare(`
    SELECT es.*, st.reg_no, st.full_name, c.name as class_name, e.title as exam_title
    FROM exam_sessions es
    JOIN students st ON st.id = es.student_id
    JOIN classes c ON c.id = st.class_id
    JOIN exams e ON e.id = es.exam_id
    WHERE es.id = ?
  `).get(sessionId);

  if (!s) throw new Error("Session not found");
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.pipe(stream);

  doc.rect(25, 25, 545, 792).stroke('#091e42');
  doc.fontSize(20).text('CBT EXAMINATION SYSTEM', { align: 'center' });
  doc.fontSize(12).text('OFFICIAL RESULT TRANSCRIPT', { align: 'center' });
  doc.moveDown(2);

  doc.text(`Candidate Name: ${s.full_name}`);
  doc.text(`Registration No: ${s.reg_no}`);
  doc.text(`Class: ${s.class_name}`);
  doc.text(`Examination: ${s.exam_title}`);
  doc.moveDown(1.5);

  doc.fontSize(16).text(`Score: ${s.score.toFixed(1)}`);
  doc.text(`Percentage: ${s.percentage.toFixed(2)}%`);
  doc.text(`Status: ${s.status.toUpperCase()}`);
  doc.end();
}

module.exports = { generateStudentResultSlip };
