// ============================================
// SERVER - Snapshot-Based Undo/Redo
// ============================================

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

// Import our modules
const RoomManager = require('./rooms');
const DrawingStateManager = require('./drawing-state');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

// Server configuration
const PORT = process.env.PORT || 3000;

// Initialize managers
const roomManager = new RoomManager();
const drawingStateManager = new DrawingStateManager();

// ============================================
// SERVE STATIC FILES
// ============================================

app.use(express.static(path.join(__dirname, '../client')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// ✅ HEALTH CHECK ROUTE (for Render)
app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// ============================================
// API ENDPOINTS
// ============================================

app.get('/api/rooms', (req, res) => {
    res.json({
        success: true,
        rooms: roomManager.listRooms()
    });
});

app.get('/api/stats', (req, res) => {
    res.json({
        success: true,
        roomStats: roomManager.getGlobalStats(),
        drawingStats: drawingStateManager.getGlobalStats()
    });
});

// ============================================
// SOCKET.IO CONNECTION HANDLING
// ============================================

io.on('connection', (socket) => {
    console.log(`🔌 New connection: ${socket.id}`);
    
    let currentUser = null;
    let currentRoomId = roomManager.defaultRoomId;
    
    // ============================================
    // USER JOINS ROOM
    // ============================================
    
    socket.on('join-room', (data) => {
        const { userId, userName, roomId } = data;
        
        currentRoomId = roomId || roomManager.defaultRoomId;
        
        let room = roomManager.getRoom(currentRoomId);
        if (!room) {
            room = roomManager.createRoom(currentRoomId);
        }
        
        currentUser = {
            socketId: socket.id,
            userId: userId,
            userName: userName,
            color: null
        };
        
        const joined = roomManager.addUserToRoom(currentRoomId, currentUser);
        
        if (!joined) {
            socket.emit('join-failed', {
                message: 'Could not join room (may be full)'
            });
            return;
        }
        
        const roomUser = room.users.get(userId);
        currentUser.color = roomUser.color;
        
        socket.join(currentRoomId);
        
        console.log(`👤 ${userName} joined room ${currentRoomId}`);
        
        socket.emit('welcome', {
            userId: userId,
            userName: userName,
            color: currentUser.color,
            roomId: currentRoomId,
            message: 'Connected successfully!'
        });
        
        // Send current canvas snapshot
        const canvasData = drawingStateManager.getCurrentSnapshot(currentRoomId);
        if (canvasData) {
            socket.emit('canvas-state', { canvasData });
            console.log(`📤 Sent canvas snapshot to ${userName}`);
        }
        
        // Send recent operations for smooth drawing
        const recentOps = drawingStateManager.getRecentOperations(currentRoomId, 100);
        if (recentOps.length > 0) {
            socket.emit('drawing-history', recentOps);
            console.log(`📤 Sent ${recentOps.length} operations to ${userName}`);
        }
        
        io.to(currentRoomId).emit('user-joined', {
            userId: userId,
            userName: userName,
            color: currentUser.color
        });
        
        broadcastUsersList(currentRoomId);
    });
    
    // ============================================
    // DRAWING EVENTS
    // ============================================
    
    socket.on('draw', (data) => {
        if (!currentUser || !currentRoomId) return;
        
        const operation = drawingStateManager.addOperation(currentRoomId, {
            ...data,
            userId: currentUser.userId,
            userName: currentUser.userName
        });
        
        socket.to(currentRoomId).emit('drawing-data', operation);
    });
    
    socket.on('save-snapshot', (data) => {
        if (!currentUser || !currentRoomId) return;
        
        console.log(`💾 Saving canvas snapshot for room ${currentRoomId}`);
        
        drawingStateManager.saveSnapshot(currentRoomId, data.canvasData);
        
        const stats = drawingStateManager.getStateStats(currentRoomId);
        console.log(`📊 Room ${currentRoomId}: ${stats.historySize} snapshots, index: ${stats.historyIndex}`);
    });
    
    socket.on('clear-canvas', () => {
        if (!currentUser || !currentRoomId) return;
        
        console.log(`🗑️ Canvas cleared by ${currentUser.userName} in room ${currentRoomId}`);
        drawingStateManager.clearOperations(currentRoomId);
        io.to(currentRoomId).emit('canvas-cleared', {
            userId: currentUser.userId,
            userName: currentUser.userName
        });
    });
    
    // ============================================
    // GLOBAL UNDO/REDO
    // ============================================
    
    socket.on('undo-request', () => {
        if (!currentUser || !currentRoomId) return;
        const result = drawingStateManager.undo(currentRoomId);
        if (!result.success) return socket.emit('undo-failed', { message: result.message });
        io.to(currentRoomId).emit('global-undo', {
            userId: currentUser.userId,
            userName: currentUser.userName,
            canvasDataURL: result.canvasDataURL,
            index: result.index
        });
    });
    
    socket.on('redo-request', () => {
        if (!currentUser || !currentRoomId) return;
        const result = drawingStateManager.redo(currentRoomId);
        if (!result.success) return socket.emit('redo-failed', { message: result.message });
        io.to(currentRoomId).emit('global-redo', {
            userId: currentUser.userId,
            userName: currentUser.userName,
            canvasDataURL: result.canvasDataURL,
            index: result.index
        });
    });
    
    // ============================================
    // CURSOR TRACKING
    // ============================================
    
    socket.on('cursor-move', (data) => {
        if (!currentUser || !currentRoomId) return;
        socket.to(currentRoomId).emit('user-cursor', {
            userId: currentUser.userId,
            userName: currentUser.userName,
            color: currentUser.color,
            x: data.x,
            y: data.y
        });
    });
    
    // ============================================
    // PING/PONG for latency
    // ============================================
    
    socket.on('ping', (data) => {
        socket.emit('pong', {
            clientTime: data.timestamp,
            serverTime: Date.now()
        });
    });
    
    // ============================================
    // DISCONNECTION
    // ============================================
    
    socket.on('disconnect', () => {
        if (currentUser && currentRoomId) {
            console.log(`👋 ${currentUser.userName} disconnected from room ${currentRoomId}`);
            roomManager.removeUserFromRoom(currentRoomId, currentUser.userId);
            io.to(currentRoomId).emit('user-left', {
                userId: currentUser.userId,
                userName: currentUser.userName
            });
            broadcastUsersList(currentRoomId);
        }
    });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function broadcastUsersList(roomId) {
    const users = roomManager.getUsersInRoom(roomId);
    io.to(roomId).emit('users-update', users);
}

// ============================================
// PERIODIC CLEANUP
// ============================================

setInterval(() => {
    console.log('🧹 Running periodic cleanup...');
    drawingStateManager.cleanup(24 * 60 * 60 * 1000);
}, 60 * 60 * 1000);

// ============================================
// START SERVER
// ============================================

server.listen(PORT, () => {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   🎨 Collaborative Canvas Server     ║');
    console.log('║    Snapshot-Based Undo/Redo v4.0     ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket server ready`);
    console.log(`🗂️  Room Manager initialized`);
    console.log(`📋 Drawing State Manager initialized`);
    console.log(`👥 Waiting for users to connect...`);
    console.log('');
    console.log('✨ Features:');
    console.log('   • Snapshot-based undo/redo');
    console.log('   • Real-time drawing sync');
    console.log('   • User cursor tracking');
    console.log('   • Multi-room support');
    console.log('════════════════════════════════════════');
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

process.on('SIGINT', () => {
    console.log('\n👋 Shutting down server...');
    const stats = roomManager.getGlobalStats();
    console.log(`📊 Final stats: ${stats.totalUsers} users in ${stats.totalRooms} rooms`);
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
