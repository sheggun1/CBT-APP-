const path = require('path');
const fs = require('fs');
const db = require('../db');

const backupDir = path.join(process.cwd(), 'backups');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

async function createLiveHotBackup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(backupDir, `cbt_backup_${stamp}.sqlite`);
  try {
    await db.backup(target);
    console.log(`[BACKUP] Snapshot written to ${target}`);
  } catch (e) {
    console.error(`[BACKUP ERROR]`, e.message);
  }
}

function startAutoBackupScheduler(min = 10) {
  setInterval(async () => {
    const live = db.prepare('SELECT count(*) as count FROM exams WHERE is_live = 1').get().count;
    if (live > 0) await createLiveHotBackup();
  }, min * 60 * 1000);
}

module.exports = { createLiveHotBackup, startAutoBackupScheduler };
