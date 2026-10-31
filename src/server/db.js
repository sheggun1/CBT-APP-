const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let dataDir = path.join(process.cwd(), 'data');
try {
  const { app } = require('electron');
  if (app && app.isPackaged) {
    dataDir = path.join(app.getPath('userData'), 'database');
  }
} catch (e) {}

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'cbt_database.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reg_no TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      class_id INTEGER NOT NULL,
      access_code TEXT NOT NULL,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_option TEXT NOT NULL,
      marks REAL DEFAULT 1.0,
      topic TEXT,
      difficulty TEXT DEFAULT 'medium',
      image_path TEXT,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      marks_per_question REAL DEFAULT 1.0,
      pass_mark REAL DEFAULT 50.0,
      shuffle_questions INTEGER DEFAULT 1,
      shuffle_options INTEGER DEFAULT 1,
      is_live INTEGER DEFAULT 0,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS exam_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      UNIQUE(exam_id, class_id)
    );
    CREATE TABLE IF NOT EXISTS exam_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      exam_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      allocated_minutes INTEGER NOT NULL,
      time_extension_minutes INTEGER DEFAULT 0,
      last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'in_progress',
      violation_count INTEGER DEFAULT 0,
      score REAL DEFAULT 0,
      percentage REAL DEFAULT 0,
      UNIQUE(student_id, exam_id)
    );
    CREATE TABLE IF NOT EXISTS session_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      display_order INTEGER NOT NULL,
      shuffled_options TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS session_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      chosen_option TEXT,
      is_flagged INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id, question_id)
    );
  `);

  const check = db.prepare('SELECT count(*) as count FROM admins').get();
  if (check.count === 0) {
    const bcrypt = require('bcryptjs');
    db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)')
      .run('admin', bcrypt.hashSync('Admin@Pass123', 10));
  }
}
initSchema();
module.exports = db;
