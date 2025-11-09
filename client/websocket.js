// ============================================
// SOCKET MANAGER - Enhanced Real-Time Communication
// ============================================

class SocketManager {
    constructor() {
        this.socket = null;
        this.userId = this.generateUserId();
        this.userName = `User_${Math.floor(Math.random() * 1000)}`;
        this.userColor = null;
        this.connectedUsers = new Map();
        this.latency = 0;
        this.isConnected = false;

        // Cursor tracking
        this.userCursors = new Map();

        console.log('🔌 Socket Manager created');
    }

    // ============================================
    // CONNECTION MANAGEMENT
    // ============================================

    connect() {
        // ✅ Detect correct server URL for both local & Render environments
        const serverURL =
            window.location.hostname === 'localhost'
                ? 'http://localhost:3000'
                : window.location.origin;

        // ✅ Use secure WebSocket + fallback polling
        this.socket = io(serverURL, {
        transports: ['websocket'], // ✅ Use pure WebSocket for low latency
        secure: true,
        reconnectionAttempts: 8,
        reconnectionDelay: 1000,
        timeout: 5000,
        pingInterval: 8000,
        pingTimeout: 4000,
});

        console.log(`🔌 Connecting to server at ${serverURL}...`);

        this.setupSocketListeners();
        this.startLatencyCheck();
    }

    setupSocketListeners() {
        // ============================================
        // CONNECTION EVENTS
        // ============================================

        this.socket.on('connect', () => {
            console.log('✅ Connected to server!');
            this.isConnected = true;
            this.updateConnectionStatus(true);

            // Join the drawing room
            this.socket.emit('join-room', {
                userId: this.userId,
                userName: this.userName,
            });
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ Disconnected from server. Reason:', reason);
            this.isConnected = false;
            this.updateConnectionStatus(false);

            if (window.notificationManager) {
                window.notificationManager.error('Disconnected from server', 5000);
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error);
            this.isConnected = false;
            this.updateConnectionStatus(false);

            if (window.notificationManager) {
                window.notificationManager.error(
                    'Cannot connect to server. Is it running?',
                    5000
                );
            }
        });

        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`🔄 Reconnection attempt ${attemptNumber}...`);
            if (window.notificationManager) {
                window.notificationManager.info(
                    `Reconnecting... (attempt ${attemptNumber})`,
                    2000
                );
            }
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`✅ Reconnected after ${attemptNumber} attempts`);
            this.isConnected = true;

            if (window.notificationManager) {
                window.notificationManager.success('Reconnected to server!', 3000);
            }
        });

        this.socket.on('reconnect_failed', () => {
            console.error('❌ Reconnection failed');
            if (window.notificationManager) {
                window.notificationManager.error(
                    'Failed to reconnect. Please refresh the page.',
                    10000
                );
            }
        });

        // ============================================
        // DRAWING & STATE EVENTS
        // ============================================

        this.socket.on('welcome', (data) => {
            console.log('👋 Welcome!', data);
            this.userColor = data.color;
            this.showNotification(`Connected as ${data.userName}`, 'success');
        });

 // ✅ Scale back normalized coordinates to fit current screen
this.socket.on('drawing-data', (data) => {
    if (data.userId !== this.userId) {
        const scaled = {
            ...data,
            fromX: data.fromX * window.innerWidth,
            fromY: data.fromY * window.innerHeight,
            toX: data.toX * window.innerWidth,
            toY: data.toY * window.innerHeight,
        };
        window.canvasManager.drawRemoteLine(scaled);
    }
});

        this.socket.on('drawing-history', (operations) => {
            console.log(`📥 Received ${operations.length} drawing operations`);
            operations.forEach((op) => {
                if (op.userId !== this.userId) {
                    window.canvasManager.drawRemoteLine(op);
                }
            });
            this.showNotification(`Loaded ${operations.length} previous drawings`, 'info');
        });

        this.socket.on('canvas-state', (data) => {
            if (data.canvasData) {
                window.canvasManager.loadCanvasData(data.canvasData);
                this.showNotification('Canvas loaded!', 'info');
            }
        });

        this.socket.on('canvas-cleared', (data) => {
            if (data.userId !== this.userId) {
                window.canvasManager.clearRemoteCanvas();
                this.showNotification(`${data.userName} cleared the canvas`, 'warning');
            }
        });

        // ============================================
        // USER MANAGEMENT
        // ============================================

        this.socket.on('users-update', (users) => this.updateUsersList(users));
        this.socket.on('user-joined', (data) => {
            if (data.userId !== this.userId)
                this.showNotification(`${data.userName} joined`, 'success');
        });
        this.socket.on('user-left', (data) => {
            this.showNotification(`${data.userName} left`, 'info');
            this.removeUserCursor(data.userId);
        });

        // ============================================
        // CURSOR, UNDO/REDO, LATENCY
        // ============================================

        this.socket.on('user-cursor', (data) => this.updateUserCursor(data));
        this.socket.on('global-undo', (data) => {
            if (window.canvasManager)
                window.canvasManager.redrawOperations(data.remainingOperations || []);
            this.showNotification(`${data.userName} undid a drawing`, 'info');
        });
        this.socket.on('global-redo', (data) => {
            if (window.canvasManager)
                (data.operations || []).forEach((op) => window.canvasManager.drawRemoteLine(op));
            this.showNotification(`${data.userName} redid a drawing`, 'info');
        });

        this.socket.on('pong', (data) => {
            const latency = Date.now() - data.clientTime;
            this.latency = latency;
            this.updateLatencyDisplay(latency);
        });

        this.socket.on('error', (error) => {
            console.error('❌ Socket error:', error);
            this.showNotification('Connection error', 'error');
        });
    }

    // ============================================
    // EMIT EVENTS (Send to server)
    // ============================================

    emitDrawing(drawingData) {
    if (!this.isConnected) return;

    // ✅ Normalize coordinates to 0–1 ratio for consistent positioning on all screens
    const normalized = {
        ...drawingData,
        fromX: drawingData.fromX / window.innerWidth,
        fromY: drawingData.fromY / window.innerHeight,
        toX: drawingData.toX / window.innerWidth,
        toY: drawingData.toY / window.innerHeight,
    };

    this.socket.emit('draw', { 
        ...normalized, 
        userId: this.userId, 
        userName: this.userName 
    });
}

    emitClear() {
        if (!this.isConnected) return;
        this.socket.emit('clear-canvas', {
            userId: this.userId,
            userName: this.userName,
        });
    }

    emitUndo() {
        if (!this.isConnected) return;
        this.socket.emit('undo-request', {
            userId: this.userId,
            userName: this.userName,
        });
    }

    emitRedo() {
        if (!this.isConnected) return;
        this.socket.emit('redo-request', {
            userId: this.userId,
            userName: this.userName,
        });
    }

    emitCursorMove(x, y) {
        if (!this.isConnected) return;
        if (!this.cursorThrottle) {
            this.cursorThrottle = true;
            this.socket.emit('cursor-move', { x, y });
            setTimeout(() => (this.cursorThrottle = false), 50);
        }
    }

    // ============================================
    // LATENCY + UI UPDATES
    // ============================================

    startLatencyCheck() {
        setInterval(() => {
            if (this.isConnected) {
                this.socket.emit('ping', { timestamp: Date.now() });
            }
        }, 3000);
    }

    updateLatencyDisplay(latency) {
        const statusElement = document.getElementById('connectionStatus');
        let color = '#28a745';
        if (latency > 100) color = '#ffc107';
        if (latency > 300) color = '#dc3545';
        if (statusElement) {
            statusElement.textContent = `🟢 Connected (${latency}ms)`;
            statusElement.style.color = color;
        }
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connectionStatus');
        const overlay = document.getElementById('disconnectOverlay');
        if (connected) {
            statusElement.textContent = '🟢 Connected';
            statusElement.style.background = '#d4edda';
            statusElement.style.color = '#155724';
            if (overlay) overlay.style.display = 'none';
        } else {
            statusElement.textContent = '🔴 Offline';
            statusElement.style.background = '#f8d7da';
            statusElement.style.color = '#721c24';
            if (overlay) overlay.style.display = 'flex';
        }
    }

    updateUsersList(users) {
        const list = document.getElementById('usersList');
        const count = document.getElementById('usersOnline');
        if (!list || !count) return;
        count.textContent = `Users: ${users.length}`;
        list.innerHTML = '';
        users.forEach((u) => {
            const li = document.createElement('li');
            li.textContent = u.userName + (u.userId === this.userId ? ' (You)' : '');
            li.style.color = u.color || '#667eea';
            list.appendChild(li);
        });
    }

    showNotification(message, type = 'info') {
        console.log(`📢 ${message}`);
        if (window.notificationManager)
            window.notificationManager.show(message, type, 3000);
    }

    updateUserCursor(data) {
        this.userCursors.set(data.userId, data);
        if (window.cursorManager) window.cursorManager.updateCursor(data);
    }

    removeUserCursor(userId) {
        this.userCursors.delete(userId);
        if (window.cursorManager) window.cursorManager.removeCursor(userId);
    }

    generateUserId() {
        return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            console.log('👋 Disconnected from server');
        }
    }
}

// Make SocketManager globally available
window.SocketManager = SocketManager;
