const xlsx = require('xlsx');
const db = require('../db');

function parseQuestionsFile(filePath, subjectId) {
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

  const validRows = [];
  const errors = [];

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    const qText = String(row['Question'] || '').trim();
    const optA = String(row['OptionA'] || '').trim();
    const optB = String(row['OptionB'] || '').trim();
    const optC = String(row['OptionC'] || '').trim();
    const optD = String(row['OptionD'] || '').trim();
    const ans = String(row['Answer'] || '').trim().toUpperCase();

    if (!qText || !optA || !optB || !optC || !optD) {
      errors.push({ row: rowNum, reason: "Question text and all 4 options are required." });
      return;
    }
    if (!['A', 'B', 'C', 'D'].includes(ans)) {
      errors.push({ row: rowNum, reason: "Answer must be A, B, C, or D." });
      return;
    }

    validRows.push({
      subject_id: subjectId,
      question_text: qText,
      option_a: optA,
      option_b: optB,
      option_c: optC,
      option_d: optD,
      correct_option: ans,
      marks: parseFloat(row['Marks']) || 1.0,
      topic: String(row['Topic'] || 'General').trim(),
      difficulty: ['easy','medium','hard'].includes(String(row['Difficulty']).toLowerCase()) ? String(row['Difficulty']).toLowerCase() : 'medium'
    });
  });

  return { validRows, errors };
}

function commitQuestions(validRows) {
  const insert = db.prepare(`
    INSERT INTO questions (subject_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, topic, difficulty)
    VALUES (@subject_id, @question_text, @option_a, @option_b, @option_c, @option_d, @correct_option, @marks, @topic, @difficulty)
  `);
  db.transaction((items) => {
    for (const item of items) insert.run(item);
  })(validRows);
  return validRows.length;
}

module.exports = { parseQuestionsFile, commitQuestions };
