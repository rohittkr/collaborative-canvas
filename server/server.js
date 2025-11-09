// ============================================
// SERVER - Snapshot-Based Undo/Redo (Render-Optimized)
// ============================================

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

// Import modules
const RoomManager = require('./rooms');
const DrawingStateManager = require('./drawing-state');

// Initialize
const app = express();
app.set('trust proxy', 1); // ✅ Helps Render handle HTTPS sockets properly
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIO(server, {
  cors: {
    origin: '*', // or "https://collaborative-canvas-spoz.onrender.com"
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Config
const PORT = process.env.PORT || 3000;

// Managers
const roomManager = new RoomManager();
const drawingStateManager = new DrawingStateManager();

// ============================================
// STATIC + ROUTES
// ============================================

app.use(express.static(path.join(__dirname, '../client')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.get('/api/rooms', (req, res) =>
  res.json({ success: true, rooms: roomManager.listRooms() })
);

app.get('/api/stats', (req, res) =>
  res.json({
    success: true,
    roomStats: roomManager.getGlobalStats(),
    drawingStats: drawingStateManager.getGlobalStats(),
  })
);

// ============================================
// SOCKET EVENTS
// ============================================

io.on('connection', (socket) => {
  console.log(`🔌 New connection: ${socket.id}`);

  let currentUser = null;
  let currentRoomId = roomManager.defaultRoomId;

  socket.on('join-room', (data) => {
    const { userId, userName, roomId } = data;
    currentRoomId = roomId || roomManager.defaultRoomId;

    let room = roomManager.getRoom(currentRoomId);
    if (!room) room = roomManager.createRoom(currentRoomId);

    currentUser = { socketId: socket.id, userId, userName, color: null };
    const joined = roomManager.addUserToRoom(currentRoomId, currentUser);

    if (!joined) return socket.emit('join-failed', { message: 'Room full' });

    const roomUser = room.users.get(userId);
    currentUser.color = roomUser.color;
    socket.join(currentRoomId);

    socket.emit('welcome', {
      userId,
      userName,
      color: currentUser.color,
      roomId: currentRoomId,
      message: 'Connected successfully!',
    });

    const snapshot = drawingStateManager.getCurrentSnapshot(currentRoomId);
    if (snapshot) socket.emit('canvas-state', { canvasData: snapshot });

    const recentOps = drawingStateManager.getRecentOperations(currentRoomId, 100);
    if (recentOps.length > 0) socket.emit('drawing-history', recentOps);

    io.to(currentRoomId).emit('user-joined', currentUser);
    broadcastUsersList(currentRoomId);
  });

  socket.on('draw', (data) => {
    if (!currentUser || !currentRoomId) return;
    const op = drawingStateManager.addOperation(currentRoomId, {
      ...data,
      userId: currentUser.userId,
      userName: currentUser.userName,
    });
    socket.to(currentRoomId).emit('drawing-data', op);
  });

  socket.on('save-snapshot', (data) => {
    if (!currentUser || !currentRoomId) return;
    drawingStateManager.saveSnapshot(currentRoomId, data.canvasData);
  });

  socket.on('clear-canvas', () => {
    if (!currentUser || !currentRoomId) return;
    drawingStateManager.clearOperations(currentRoomId);
    io.to(currentRoomId).emit('canvas-cleared', currentUser);
  });

  socket.on('undo-request', () => {
    const result = drawingStateManager.undo(currentRoomId);
    if (result.success)
      io.to(currentRoomId).emit('global-undo', {
        ...result,
        userId: currentUser.userId,
        userName: currentUser.userName,
      });
    else socket.emit('undo-failed', { message: result.message });
  });

  socket.on('redo-request', () => {
    const result = drawingStateManager.redo(currentRoomId);
    if (result.success)
      io.to(currentRoomId).emit('global-redo', {
        ...result,
        userId: currentUser.userId,
        userName: currentUser.userName,
      });
    else socket.emit('redo-failed', { message: result.message });
  });

  socket.on('cursor-move', (data) => {
    if (!currentUser || !currentRoomId) return;
    socket.to(currentRoomId).emit('user-cursor', {
      ...data,
      userId: currentUser.userId,
      userName: currentUser.userName,
      color: currentUser.color,
    });
  });

  socket.on('ping', (data) => {
    socket.emit('pong', { clientTime: data.timestamp, serverTime: Date.now() });
  });

  socket.on('disconnect', () => {
    if (!currentUser || !currentRoomId) return;
    roomManager.removeUserFromRoom(currentRoomId, currentUser.userId);
    io.to(currentRoomId).emit('user-left', currentUser);
    broadcastUsersList(currentRoomId);
  });
});

// ============================================
// HELPERS + SERVER START
// ============================================

function broadcastUsersList(roomId) {
  io.to(roomId).emit('users-update', roomManager.getUsersInRoom(roomId));
}

setInterval(() => {
  drawingStateManager.cleanup(24 * 60 * 60 * 1000);
}, 60 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ Ready on https://collaborative-canvas-spoz.onrender.com`);
});
