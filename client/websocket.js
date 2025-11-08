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
        this.socket = io('http://localhost:3000');
        this.setupSocketListeners();
        this.startLatencyCheck();
        
        console.log('🔌 Connecting to server...');
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
                userName: this.userName
            });
        });
        
        this.socket.on('disconnect', (reason) => {
            console.log('❌ Disconnected from server. Reason:', reason);
            this.isConnected = false;
            this.updateConnectionStatus(false);
            
            // Show user-friendly message
            if (window.notificationManager) {
                window.notificationManager.error('Disconnected from server', 5000);
            }
        });
        
        // Connection error
        this.socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error);
            this.isConnected = false;
            this.updateConnectionStatus(false);
            
            if (window.notificationManager) {
                window.notificationManager.error('Cannot connect to server. Is it running?', 5000);
            }
        });
        
        // Reconnection attempt
        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`🔄 Reconnection attempt ${attemptNumber}...`);
            
            if (window.notificationManager) {
                window.notificationManager.info(`Reconnecting... (attempt ${attemptNumber})`, 2000);
            }
        });
        
        // Reconnection success
        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`✅ Reconnected after ${attemptNumber} attempts`);
            this.isConnected = true;
            
            if (window.notificationManager) {
                window.notificationManager.success('Reconnected to server!', 3000);
            }
        });
        
        // Reconnection failed
        this.socket.on('reconnect_failed', () => {
            console.error('❌ Reconnection failed');
            
            if (window.notificationManager) {
                window.notificationManager.error('Failed to reconnect. Please refresh the page.', 10000);
            }
        });
        
        // Welcome message with assigned color
        this.socket.on('welcome', (data) => {
            console.log('👋 Welcome!', data);
            this.userColor = data.color;
            this.showNotification(`Connected as ${data.userName}`, 'success');
        });
        
        // ============================================
        // DRAWING EVENTS
        // ============================================
        
        this.socket.on('drawing-data', (data) => {
            // Don't draw our own strokes
            if (data.userId !== this.userId) {
                window.canvasManager.drawRemoteLine(data);
            }
        });
        
        this.socket.on('drawing-history', (operations) => {
            console.log(`📥 Received ${operations.length} drawing operations`);
            
            // Replay all operations
            operations.forEach(op => {
                if (op.userId !== this.userId) {
                    window.canvasManager.drawRemoteLine(op);
                }
            });
            
            this.showNotification(`Loaded ${operations.length} previous drawings`, 'info');
        });
        
        // ============================================
        // CANVAS STATE
        // ============================================
        
        this.socket.on('canvas-state', (data) => {
            console.log('📥 Received canvas state');
            if (data.canvasData) {
                window.canvasManager.loadCanvasData(data.canvasData);
                this.showNotification('Canvas loaded!', 'info');
            }
        });
        
        this.socket.on('canvas-cleared', (data) => {
            console.log('🗑️ Canvas cleared by:', data.userName);
            
            if (data.userId !== this.userId) {
                window.canvasManager.clearRemoteCanvas();
                this.showNotification(`${data.userName} cleared the canvas`, 'warning');
            }
        });
        
        // ============================================
        // USER MANAGEMENT
        // ============================================
        
        this.socket.on('users-update', (users) => {
            console.log('👥 Users update:', users);
            this.updateUsersList(users);
        });
        
        this.socket.on('user-joined', (data) => {
            console.log('👋 User joined:', data.userName);
            
            // Don't show notification for ourselves
            if (data.userId !== this.userId) {
                this.showNotification(`${data.userName} joined`, 'success');
            }
        });
        
        this.socket.on('user-left', (data) => {
            console.log('👋 User left:', data.userName);
            this.showNotification(`${data.userName} left`, 'info');
            
            // Remove their cursor
            this.removeUserCursor(data.userId);
        });
        
        // ============================================
        // CURSOR TRACKING (Phase 3)
        // ============================================
        
        this.socket.on('user-cursor', (data) => {
            // Update cursor position for this user
            this.updateUserCursor(data);
        });
        
        // ============================================
        // UNDO/REDO (Phase 3 - Global Implementation)
        // ============================================
        
        this.socket.on('global-undo', (data) => {
            console.log('========== GLOBAL UNDO RECEIVED ==========');
            console.log('Data:', data);
            console.log('Stroke ID:', data.strokeId);
            console.log('User:', data.userName);
            console.log('Remaining operations:', data.remainingOperations?.length || 0);
            
            // Use the new redraw method
            if (window.canvasManager) {
                console.log('📐 Canvas manager exists, calling redrawOperations');
                window.canvasManager.redrawOperations(data.remainingOperations || []);
            } else {
                console.error('❌ Canvas manager not found!');
            }
            
            this.showNotification(`${data.userName} undid a drawing`, 'info');
        });
        
        this.socket.on('global-redo', (data) => {
            console.log('========== GLOBAL REDO RECEIVED ==========');
            console.log('Data:', data);
            console.log('Operations to draw:', data.operations?.length || 0);
            
            // Draw all operations from the redone stroke
            if (window.canvasManager) {
                console.log('📐 Canvas manager exists, drawing operations');
                (data.operations || []).forEach((op, index) => {
                    console.log(`Drawing operation ${index + 1}/${data.operations.length}`);
                    window.canvasManager.drawRemoteLine(op);
                });
            } else {
                console.error('❌ Canvas manager not found!');
            }
            
            this.showNotification(`${data.userName} redid a drawing`, 'info');
        });
        
        this.socket.on('undo-action', (data) => {
            console.log('↩️ Undo action:', data);
            this.showNotification(`${data.userName} undid an action`, 'info');
        });
        
        this.socket.on('undo-failed', (data) => {
            console.log('⚠️ Undo failed:', data.message);
            this.showNotification(data.message, 'warning');
        });
        
        this.socket.on('redo-action', (data) => {
            console.log('↪️ Redo action:', data);
            this.showNotification(`${data.userName} redid an action`, 'info');
        });
        
        this.socket.on('redo-failed', (data) => {
            console.log('⚠️ Redo failed:', data.message);
            this.showNotification(data.message, 'warning');
        });
        
        // ============================================
        // LATENCY TRACKING
        // ============================================
        
        this.socket.on('pong', (data) => {
            const latency = Date.now() - data.clientTime;
            this.latency = latency;
            this.updateLatencyDisplay(latency);
        });
        
        // ============================================
        // ERROR HANDLING
        // ============================================
        
        this.socket.on('error', (error) => {
            console.error('❌ Socket error:', error);
            this.showNotification('Connection error', 'error');
        });
    }
    
    // ============================================
    // EMIT EVENTS (Send to server)
    // ============================================
    
    emitDrawing(drawingData) {
        if (!this.isConnected) {
            console.warn('⚠️ Not connected, cannot send drawing');
            return;
        }
        
        const data = {
            ...drawingData,
            userId: this.userId,
            userName: this.userName,
            timestamp: Date.now()
        };
        
        this.socket.emit('draw', data);
    }
    
    emitStrokeComplete(strokeId) {
        if (!this.isConnected) return;
        
        this.socket.emit('stroke-complete', {
            strokeId: strokeId,
            userId: this.userId,
            userName: this.userName,
            timestamp: Date.now()
        });
        
        console.log(`📤 Stroke complete: ${strokeId}`);
    }
    
    saveCanvasSnapshot(canvasDataURL) {
        if (!this.isConnected) return;
        
        this.socket.emit('save-snapshot', {
            canvasData: canvasDataURL,
            userId: this.userId,
            userName: this.userName,
            timestamp: Date.now()
        });
        
        console.log(`📤 Saved canvas snapshot`);
    }
    
    emitClear() {
        if (!this.isConnected) return;
        
        this.socket.emit('clear-canvas', {
            userId: this.userId,
            userName: this.userName
        });
    }
    
    emitCursorMove(x, y) {
        if (!this.isConnected) return;
        
        // Throttle cursor updates (send every 50ms max)
        if (!this.cursorThrottle) {
            this.cursorThrottle = true;
            
            this.socket.emit('cursor-move', { x, y });
            
            setTimeout(() => {
                this.cursorThrottle = false;
            }, 50);
        }
    }
    
    emitUndo() {
        console.log('📤 emitUndo called');
        console.log('Connected:', this.isConnected);
        console.log('Socket exists:', !!this.socket);
        
        if (!this.isConnected) {
            console.error('❌ Cannot emit undo - not connected');
            return;
        }
        
        const data = {
            userId: this.userId,
            userName: this.userName
        };
        
        console.log('📤 Emitting undo-request:', data);
        this.socket.emit('undo-request', data);
    }
    
    emitRedo() {
        console.log('📤 emitRedo called');
        console.log('Connected:', this.isConnected);
        
        if (!this.isConnected) {
            console.error('❌ Cannot emit redo - not connected');
            return;
        }
        
        const data = {
            userId: this.userId,
            userName: this.userName
        };
        
        console.log('📤 Emitting redo-request:', data);
        this.socket.emit('redo-request', data);
    }
    
    // ============================================
    // LATENCY MEASUREMENT
    // ============================================
    
    startLatencyCheck() {
        setInterval(() => {
            if (this.isConnected) {
                this.socket.emit('ping', {
                    timestamp: Date.now()
                });
            }
        }, 3000); // Check every 3 seconds
    }
    
    updateLatencyDisplay(latency) {
        const statusElement = document.getElementById('connectionStatus');
        
        let latencyColor = '#28a745'; // Green
        if (latency > 100) latencyColor = '#ffc107'; // Yellow
        if (latency > 300) latencyColor = '#dc3545'; // Red
        
        const latencyText = ` (${latency}ms)`;
        if (statusElement && statusElement.textContent.includes('Connected')) {
            statusElement.textContent = `🟢 Connected${latencyText}`;
            statusElement.style.color = latencyColor;
        }
    }
    
    // ============================================
    // UI UPDATES
    // ============================================
    
    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connectionStatus');
        const disconnectOverlay = document.getElementById('disconnectOverlay');
        
        if (connected) {
            statusElement.textContent = '🟢 Connected';
            statusElement.style.background = '#d4edda';
            statusElement.style.color = '#155724';
            
            // Hide disconnect overlay
            if (disconnectOverlay) {
                disconnectOverlay.style.display = 'none';
            }
        } else {
            statusElement.textContent = '🔴 Offline';
            statusElement.style.background = '#f8d7da';
            statusElement.style.color = '#721c24';
            
            // Show disconnect overlay
            if (disconnectOverlay) {
                disconnectOverlay.style.display = 'flex';
            }
        }
    }
    
    updateUsersList(users) {
        const usersList = document.getElementById('usersList');
        const usersOnline = document.getElementById('usersOnline');
        
        usersOnline.textContent = `Users: ${users.length}`;
        usersList.innerHTML = '';
        
        users.forEach(user => {
            const li = document.createElement('li');
            li.style.color = user.color || '#667eea';
            li.textContent = user.userName;
            
            if (user.userId === this.userId) {
                li.textContent += ' (You)';
                li.style.fontWeight = 'bold';
            }
            
            usersList.appendChild(li);
        });
    }
    
    showNotification(message, type = 'info') {
        console.log(`📢 ${message}`);
        
        // Use NotificationManager if available
        if (window.notificationManager) {
            window.notificationManager.show(message, type, 3000);
        }
    }
    
    // ============================================
    // CURSOR MANAGEMENT (Phase 3)
    // ============================================
    
    updateUserCursor(data) {
        this.userCursors.set(data.userId, {
            userId: data.userId,
            userName: data.userName,
            color: data.color,
            x: data.x,
            y: data.y,
            lastUpdate: Date.now()
        });
        
        // Render cursor (we'll implement the visual in Phase 3)
        if (window.cursorManager) {
            window.cursorManager.updateCursor(data);
        }
    }
    
    removeUserCursor(userId) {
        this.userCursors.delete(userId);
        
        if (window.cursorManager) {
            window.cursorManager.removeCursor(userId);
        }
    }
    
    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    
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

// Make SocketManager available globally
window.SocketManager = SocketManager;