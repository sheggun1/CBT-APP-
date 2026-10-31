const xlsx = require('xlsx');
const db = require('../db');

function generateAccessCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function importStudentsFromSheet(filePath) {
  const wb = xlsx.readFile(filePath);
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  const validRows = [], errors = [];
  const classMap = new Map();
  db.prepare('SELECT id, name FROM classes').all().forEach(c => classMap.set(c.name.toLowerCase(), c.id));

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const regNo = String(row['RegNo'] || '').trim();
    const name = String(row['FullName'] || row['Name'] || '').trim();
    const className = String(row['Class'] || '').trim();

    if (!regNo || !name || !className) {
      errors.push({ row: rowNum, reason: "RegNo, FullName, and Class are required." });
      return;
    }

    let classId = classMap.get(className.toLowerCase());
    if (!classId) {
      const res = db.prepare('INSERT INTO classes (name) VALUES (?)').run(className);
      classId = res.lastInsertRowid;
      classMap.set(className.toLowerCase(), classId);
    }

    validRows.push({ reg_no: regNo, full_name: name, class_id: classId, access_code: generateAccessCode() });
  });

  return { validRows, errors };
}

function commitStudents(validRows) {
  const ins = db.prepare(`
    INSERT INTO students (reg_no, full_name, class_id, access_code) VALUES (@reg_no, @full_name, @class_id, @access_code)
    ON CONFLICT(reg_no) DO UPDATE SET full_name = excluded.full_name, class_id = excluded.class_id, access_code = excluded.access_code
  `);
  db.transaction((items) => {
    for (const item of items) ins.run(item);
  })(validRows);
  return validRows.length;
}

module.exports = { importStudentsFromSheet, commitStudents };
