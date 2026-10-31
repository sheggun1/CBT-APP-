const express = require('express');
const cors = require('cors');
const path = require('path');
const studentRoutes = require('./routes/student');
const adminRoutes = require('./routes/admin');
const { startAutoBackupScheduler } = require('./utils/backup');

const app = express();
let serverInstance = null;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/exam', express.static(path.join(__dirname, '../client/student')));
app.use('/media', express.static(path.join(__dirname, '../../uploads')));
app.use('/api/student', studentRoutes);
app.use('/api/admin', adminRoutes);

function startServer(port = 3000) {
  serverInstance = app.listen(port, '0.0.0.0', () => {
    console.log(`[CBT SERVER] Listening on http://0.0.0.0:${port}`);
  });
  startAutoBackupScheduler(10);
  return serverInstance;
}

function stopServer() {
  if (serverInstance) serverInstance.close();
}

module.exports = { app, startServer, stopServer };
