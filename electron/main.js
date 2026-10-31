const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const os = require('os');
const dgram = require('dgram');
const { startServer, stopServer } = require('../src/server/server');

let mainWindow;
const UDP_PORT = 3001;
const HTTP_PORT = 3000;
const isStudentMode = process.argv.includes('--student');

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const config of iface) {
      if (config.family === 'IPv4' && !config.internal) return config.address;
    }
  }
  return '127.0.0.1';
}

function startServerBeacon() {
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  socket.bind(() => {
    socket.setBroadcast(true);
    setInterval(() => {
      const msg = Buffer.from(JSON.stringify({
        type: 'CBT_SERVER_BEACON',
        ip: getLocalIpAddress(),
        port: HTTP_PORT
      }));
      socket.send(msg, 0, msg.length, UDP_PORT, '255.255.255.255');
    }, 3000);
  });
}

function discoverServer(callback) {
  const clientSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  clientSocket.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === 'CBT_SERVER_BEACON') {
        clientSocket.close();
        callback(data.ip, data.port);
      }
    } catch (e) {}
  });
  clientSocket.bind(UDP_PORT);
  setTimeout(() => { callback(null, HTTP_PORT); }, 6000);
}

function createAdminWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    title: "CBT Examination System - Host Server Console",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, '../src/client/admin/index.html'));
}

function createStudentLockdownWindow(serverIp) {
  mainWindow = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    alwaysOnTop: true,
    frame: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const targetUrl = serverIp 
    ? `http://${serverIp}:${HTTP_PORT}/exam` 
    : `file://${path.join(__dirname, '../src/client/student/connect.html')}`;

  mainWindow.loadURL(targetUrl);

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (
      (input.alt && input.key.toLowerCase() === 'f4') ||
      (input.control && input.key.toLowerCase() === 'r') ||
      (input.control && input.key.toLowerCase() === 'w') ||
      input.key === 'F5' || input.key === 'F11' || input.key === 'F12' ||
      (input.control && input.shift && input.key.toLowerCase() === 'i')
    ) {
      event.preventDefault();
    }
  });

  mainWindow.on('blur', () => {
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus();
    }, 100);
  });
}

app.whenReady().then(() => {
  if (isStudentMode) {
    discoverServer((ip, port) => {
      createStudentLockdownWindow(ip);
    });
  } else {
    startServer(HTTP_PORT);
    startServerBeacon();
    createAdminWindow();
  }

  globalShortcut.register('CommandOrControl+Q', () => {});
  ipcMain.handle('get-server-info', () => ({
    ip: getLocalIpAddress(),
    port: HTTP_PORT
  }));
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopServer();
});
