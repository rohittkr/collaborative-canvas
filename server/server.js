// ============================================
// SERVER - Snapshot-Based Undo/Redo (Render-Optimized)
// ============================================

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const RoomManager = require('./rooms');
const DrawingStateManager = require('./drawing-state');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

const io = socketIO(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket'],
  pingTimeout: 10000,
  pingInterval: 10000,
});

const PORT = process.env.PORT || 3000;
const roomManager = new RoomManager();
const drawingStateManager = new DrawingStateManager();

app.use(express.static(path.join(__dirname, '../client')));

app.get('/', (_, res) =>
  res.sendFile(path.join(__dirname, '../client/index.html'))
);

app.get('/healthz', (_, res) =>
  res.status(200).json({ status: 'ok', uptime: process.uptime() })
);

io.on('connection', (socket) => {
  console.log(`🔌 New connection: ${socket.id}`);
  let currentUser = null;
  let currentRoomId = roomManager.defaultRoomId;

  socket.on('join-room', (data) => {
    const { userId, userName } = data;
    currentUser = { socketId: socket.id, userId, userName, color: '#'+Math.floor(Math.random()*16777215).toString(16) };
    roomManager.addUserToRoom(currentRoomId, currentUser);
    socket.join(currentRoomId);
    socket.emit('welcome', currentUser);
  });

  socket.on('draw', (data) => {
    socket.to(currentRoomId).emit('drawing-data', data);
  });

  socket.on('clear-canvas', (data) => {
    io.to(currentRoomId).emit('canvas-cleared', data);
  });

  socket.on('ping', (data) => {
    socket.emit('pong', { clientTime: data.timestamp, serverTime: Date.now() });
  });

  socket.on('disconnect', () => {
    console.log(`👋 ${currentUser?.userName || 'User'} disconnected`);
    roomManager.removeUserFromRoom(currentRoomId, currentUser?.userId);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
