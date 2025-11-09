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
        const serverURL =
            window.location.hostname === 'localhost'
                ? 'http://localhost:3000'
                : window.location.origin;

        // ✅ Optimized WebSocket settings for Render & Mobile
        this.socket = io(serverURL, {
            transports: ['websocket'],
            secure: true,
            reconnectionAttempts: 8,
            reconnectionDelay: 1000,
            timeout: 5000,
            pingInterval: 10000,
            pingTimeout: 5000,
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

            this.socket.emit('join-room', {
                userId: this.userId,
                userName: this.userName,
            });
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ Disconnected from server:', reason);
            this.isConnected = false;
            this.updateConnectionStatus(false);
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error);
            this.isConnected = false;
            this.updateConnectionStatus(false);
        });

        this.socket.on('reconnect', () => {
            console.log('✅ Reconnected!');
            this.isConnected = true;
        });

        // ============================================
        // DRAWING EVENTS (with normalization)
        // ============================================

        this.socket.on('welcome', (data) => {
            console.log('👋 Welcome!', data);
            this.userColor = data.color;
        });

        // ✅ Scaled drawing reception (so it aligns across screen sizes)
        this.socket.on('drawing-data', (data) => {
            const scaled = {
                ...data,
                fromX: data.fromX * window.innerWidth,
                fromY: data.fromY * window.innerHeight,
                toX: data.toX * window.innerWidth,
                toY: data.toY * window.innerHeight,
            };
            if (scaled.userId !== this.userId) {
                window.canvasManager.drawRemoteLine(scaled);
            }
        });

        this.socket.on('canvas-state', (data) => {
            if (data.canvasData) window.canvasManager.loadCanvasData(data.canvasData);
        });

        this.socket.on('canvas-cleared', (data) => {
            if (data.userId !== this.userId) window.canvasManager.clearRemoteCanvas();
        });

        // ============================================
        // USER EVENTS
        // ============================================

        this.socket.on('users-update', (users) => this.updateUsersList(users));
        this.socket.on('user-left', (data) => this.removeUserCursor(data.userId));

        // ============================================
        // LATENCY HANDLING
        // ============================================

        this.socket.on('pong', (data) => {
            const latency = Date.now() - data.clientTime;
            this.latency = latency;
            this.updateLatencyDisplay(latency);
        });
    }

    // ============================================
    // EMIT EVENTS
    // ============================================

    emitDrawing(drawingData) {
        if (!this.isConnected) return;

        // ✅ Normalize coordinates to percentages
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
            userName: this.userName,
        });
    }

    emitClear() {
        if (this.isConnected)
            this.socket.emit('clear-canvas', {
                userId: this.userId,
                userName: this.userName,
            });
    }

    emitUndo() {
        if (this.isConnected)
            this.socket.emit('undo-request', {
                userId: this.userId,
                userName: this.userName,
            });
    }

    emitRedo() {
        if (this.isConnected)
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
    // LATENCY DISPLAY
    // ============================================

    startLatencyCheck() {
        setInterval(() => {
            if (this.isConnected) this.socket.emit('ping', { timestamp: Date.now() });
        }, 3000);
    }

    updateLatencyDisplay(latency) {
        const el = document.getElementById('connectionStatus');
        if (!el) return;
        let color = '#28a745';
        if (latency > 150) color = '#ffc107';
        if (latency > 300) color = '#dc3545';
        el.textContent = `🟢 Connected (${latency}ms)`;
        el.style.color = color;
    }

    updateConnectionStatus(connected) {
        const status = document.getElementById('connectionStatus');
        const overlay = document.getElementById('disconnectOverlay');
        if (connected) {
            status.textContent = '🟢 Connected';
            if (overlay) overlay.style.display = 'none';
        } else {
            status.textContent = '🔴 Disconnected';
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

    generateUserId() {
        return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

window.SocketManager = SocketManager;
