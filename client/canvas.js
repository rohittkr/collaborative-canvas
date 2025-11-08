// ============================================
// CANVAS MANAGER - Handles all drawing operations
// ============================================

class CanvasManager {
    constructor(canvasId) {
        // Get the canvas element and its 2D drawing context
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        // Drawing state
        this.isDrawing = false;
        this.currentTool = 'brush'; // 'brush' or 'eraser'
        this.currentColor = '#000000';
        this.brushSize = 5;
        
        // Store last position for smooth lines
        this.lastX = 0;
        this.lastY = 0;
        
        // Initialize canvas size
        this.resizeCanvas();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Drawing history for undo/redo (we'll use this later)
        this.history = [];
        this.historyStep = -1;
        
        console.log('✅ Canvas Manager initialized');
    }
    
    // ============================================
    // CANVAS SETUP
    // ============================================
    
    resizeCanvas() {
        // Make canvas fill its container
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth - 40;
        this.canvas.height = container.clientHeight - 40;
        
        // Set default canvas styles
        this.setupCanvasContext();
        
        console.log(`Canvas resized to: ${this.canvas.width}x${this.canvas.height}`);
    }
    
    setupCanvasContext() {
        // IMPORTANT: Reset all context properties after clear or resize
        this.ctx.lineCap = 'round'; // Smooth line ends
        this.ctx.lineJoin = 'round'; // Smooth line joins
        this.ctx.globalCompositeOperation = 'source-over'; // Normal drawing mode
    }
    
    // ============================================
    // EVENT LISTENERS - Mouse/Touch Events
    // ============================================
    
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());
        
        // Touch events for mobile (bonus feature!)
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const mouseEvent = new MouseEvent('mouseup', {});
            this.canvas.dispatchEvent(mouseEvent);
        });
        
        // Window resize
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    // ============================================
    // DRAWING FUNCTIONS
    // ============================================
    
    startDrawing(e) {
        // Check if connected to server
        if (window.socketManager && !window.socketManager.isConnected) {
            console.warn('⚠️ Not connected to server - drawing disabled');
            if (window.notificationManager) {
                window.notificationManager.warning('Cannot draw - not connected to server', 2000);
            }
            return;
        }
        
        this.isDrawing = true;
        
        // Generate unique stroke ID for this drawing session
        this.currentStrokeId = `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Get mouse position relative to canvas
        const rect = this.canvas.getBoundingClientRect();
        this.lastX = e.clientX - rect.left;
        this.lastY = e.clientY - rect.top;
        
        console.log(`Started drawing stroke: ${this.currentStrokeId}`);
    }
    
    draw(e) {
        // Only draw if mouse is pressed
        if (!this.isDrawing) return;
        
        // Get current mouse position
        const rect = this.canvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        
        // Draw line from last position to current position
        this.drawLine(this.lastX, this.lastY, currentX, currentY);
        
        // Emit drawing data to other users WITH stroke ID
        if (window.socketManager) {
            window.socketManager.emitDrawing({
                type: 'draw',
                tool: this.currentTool,
                color: this.currentColor,
                size: this.brushSize,
                fromX: this.lastX,
                fromY: this.lastY,
                toX: currentX,
                toY: currentY,
                strokeId: this.currentStrokeId // Add stroke ID
            });
        }
        
        // Update last position
        this.lastX = currentX;
        this.lastY = currentY;
    }
    
    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            console.log(`Stopped drawing stroke: ${this.currentStrokeId}`);
            
            // Send canvas snapshot to server for undo/redo
            if (window.socketManager) {
                const canvasData = this.canvas.toDataURL();
                window.socketManager.saveCanvasSnapshot(canvasData);
            }
            
            // Clear stroke ID
            this.currentStrokeId = null;
        }
    }
    
    // ============================================
    // CORE DRAWING OPERATIONS
    // ============================================
    
    drawLine(fromX, fromY, toX, toY, color = null, size = null, tool = null) {
        // Use provided parameters or current settings
        const drawColor = color !== null ? color : this.currentColor;
        const drawSize = size !== null ? size : this.brushSize;
        const drawTool = tool !== null ? tool : this.currentTool;
        
        // Save current context state
        this.ctx.save();
        
        // Set drawing style based on tool
        if (drawTool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.lineWidth = drawSize;
        } else {
            // Brush mode
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = drawColor;
            this.ctx.lineWidth = drawSize;
        }
        
        // Draw the line
        this.ctx.beginPath();
        this.ctx.moveTo(fromX, fromY);
        this.ctx.lineTo(toX, toY);
        this.ctx.stroke();
        
        // Restore context state
        this.ctx.restore();
        
        console.log(`Drew line with color: ${drawColor}, tool: ${drawTool}`);
    }
    
    // Draw line from remote user (called by WebSocket)
    drawRemoteLine(data) {
        this.drawLine(
            data.fromX,
            data.fromY,
            data.toX,
            data.toY,
            data.color,
            data.size,
            data.tool
        );
    }
    
    // ============================================
    // TOOL MANAGEMENT
    // ============================================
    
    setTool(tool) {
        console.log(`⚠️ setTool called with: ${tool}`);
        this.currentTool = tool;
        
        // Reset canvas context when switching tools
        if (tool === 'brush') {
            this.ctx.globalCompositeOperation = 'source-over';
            console.log('✅ Switched to brush mode');
        } else if (tool === 'eraser') {
            console.log('✅ Switched to eraser mode');
        }
        
        console.log(`✅ Tool changed to: ${tool}`);
    }
    
    setColor(color) {
        console.log(`⚠️ setColor called with: ${color}`);
        console.log(`Current color before: ${this.currentColor}`);
        
        this.currentColor = color;
        
        console.log(`Current color after: ${this.currentColor}`);
        console.log(`Current tool: ${this.currentTool}`);
        
        // If brush is active, update strokeStyle immediately
        if (this.currentTool === 'brush') {
            this.ctx.strokeStyle = color;
            console.log(`✅ Updated canvas strokeStyle to: ${color}`);
        }
        
        console.log(`✅ Color changed to: ${color}`);
    }
    
    setBrushSize(size) {
        this.brushSize = parseInt(size);
        console.log(`Brush size changed to: ${size}`);
    }
    
    clearCanvas() {
        // Properly clear and reset context
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Reset all canvas context properties after clear
        this.setupCanvasContext();
        
        // Reset to current tool settings
        if (this.currentTool === 'brush') {
            this.ctx.strokeStyle = this.currentColor;
        }
        this.ctx.lineWidth = this.brushSize;
        
        console.log('Canvas cleared and context reset');
        
        // Emit clear to other users
        if (window.socketManager) {
            window.socketManager.emitClear();
        }
    }
    
    // Clear from remote user
    clearRemoteCanvas() {
        // Same as clearCanvas but don't emit to server
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.setupCanvasContext();
        
        if (this.currentTool === 'brush') {
            this.ctx.strokeStyle = this.currentColor;
        }
        this.ctx.lineWidth = this.brushSize;
        
        console.log('Canvas cleared by remote user');
    }
    
    // ============================================
    // HISTORY MANAGEMENT (for undo/redo)
    // ============================================
    
    saveState() {
        // Save current canvas as image data
        this.historyStep++;
        
        // Remove any states after current step (for redo)
        if (this.historyStep < this.history.length) {
            this.history.length = this.historyStep;
        }
        
        // Save canvas state
        this.history.push(this.canvas.toDataURL());
        
        // Limit history to 50 states (to save memory)
        if (this.history.length > 50) {
            this.history.shift();
            this.historyStep--;
        }
    }
    
    undo() {
        if (this.historyStep > 0) {
            this.historyStep--;
            this.restoreState(this.history[this.historyStep]);
            console.log(`Undo: Step ${this.historyStep}`);
        } else {
            console.log('Nothing to undo');
        }
    }
    
    redo() {
        if (this.historyStep < this.history.length - 1) {
            this.historyStep++;
            this.restoreState(this.history[this.historyStep]);
            console.log(`Redo: Step ${this.historyStep}`);
        } else {
            console.log('Nothing to redo');
        }
    }
    
    restoreState(dataUrl) {
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0);
            
            // Reset context after restoring
            this.setupCanvasContext();
            if (this.currentTool === 'brush') {
                this.ctx.strokeStyle = this.currentColor;
            }
            this.ctx.lineWidth = this.brushSize;
        };
    }
    
    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    
    getCanvasData() {
        // Get canvas as base64 string (for sending to server)
        return this.canvas.toDataURL();
    }
    
    loadCanvasData(dataUrl) {
        // Load canvas from base64 string (when joining room)
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0);
            
            // Reset context after loading
            this.setupCanvasContext();
            if (this.currentTool === 'brush') {
                this.ctx.strokeStyle = this.currentColor;
            }
            this.ctx.lineWidth = this.brushSize;
        };
    }
}

// Make CanvasManager available globally
window.CanvasManager = CanvasManager;

// ============================================
// CURSOR MANAGER - Visual User Cursors
// ============================================

class CursorManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.cursors = new Map();
        this.cursorContainer = null;
        
        this.init();
        console.log('✅ Cursor Manager initialized');
    }
    
    init() {
        this.cursorContainer = document.createElement('div');
        this.cursorContainer.id = 'cursor-container';
        this.cursorContainer.style.position = 'absolute';
        this.cursorContainer.style.top = '0';
        this.cursorContainer.style.left = '0';
        this.cursorContainer.style.width = '100%';
        this.cursorContainer.style.height = '100%';
        this.cursorContainer.style.pointerEvents = 'none';
        this.cursorContainer.style.zIndex = '10';
        
        const canvasContainer = this.canvas.parentElement;
        canvasContainer.style.position = 'relative';
        canvasContainer.appendChild(this.cursorContainer);
        
        this.startCleanupInterval();
    }
    
    updateCursor(data) {
        const { userId, userName, color, x, y } = data;
        
        let cursorElement = this.cursors.get(userId);
        
        if (!cursorElement) {
            cursorElement = this.createCursorElement(userId, userName, color);
            this.cursors.set(userId, cursorElement);
            this.cursorContainer.appendChild(cursorElement.container);
        }
        
        this.positionCursor(cursorElement, x, y);
        cursorElement.lastUpdate = Date.now();
        cursorElement.container.style.opacity = '1';
    }
    
    createCursorElement(userId, userName, color) {
        const container = document.createElement('div');
        container.className = 'user-cursor';
        container.style.position = 'absolute';
        container.style.transition = 'all 0.05s ease-out';
        container.style.pointerEvents = 'none';
        
        const dot = document.createElement('div');
        dot.style.width = '12px';
        dot.style.height = '12px';
        dot.style.borderRadius = '50%';
        dot.style.backgroundColor = color;
        dot.style.border = '2px solid white';
        dot.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        
        const label = document.createElement('div');
        label.textContent = userName;
        label.style.position = 'absolute';
        label.style.top = '15px';
        label.style.left = '0';
        label.style.padding = '3px 8px';
        label.style.backgroundColor = color;
        label.style.color = 'white';
        label.style.borderRadius = '3px';
        label.style.fontSize = '11px';
        label.style.fontWeight = 'bold';
        label.style.whiteSpace = 'nowrap';
        label.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        
        container.appendChild(dot);
        container.appendChild(label);
        
        return {
            container: container,
            dot: dot,
            label: label,
            userId: userId,
            lastUpdate: Date.now()
        };
    }
    
    positionCursor(cursorElement, x, y) {
        const rect = this.canvas.getBoundingClientRect();
        const containerRect = this.cursorContainer.getBoundingClientRect();
        
        const offsetX = rect.left - containerRect.left;
        const offsetY = rect.top - containerRect.top;
        
        cursorElement.container.style.left = (offsetX + x) + 'px';
        cursorElement.container.style.top = (offsetY + y) + 'px';
    }
    
    removeCursor(userId) {
        const cursorElement = this.cursors.get(userId);
        
        if (cursorElement) {
            cursorElement.container.style.transition = 'opacity 0.3s ease-out';
            cursorElement.container.style.opacity = '0';
            
            setTimeout(() => {
                if (cursorElement.container.parentElement) {
                    cursorElement.container.parentElement.removeChild(cursorElement.container);
                }
                this.cursors.delete(userId);
            }, 300);
        }
    }
    
    startCleanupInterval() {
        setInterval(() => {
            const now = Date.now();
            const staleTimeout = 5000;
            
            this.cursors.forEach((cursorElement, userId) => {
                if (now - cursorElement.lastUpdate > staleTimeout) {
                    this.removeCursor(userId);
                }
            });
        }, 2000);
    }
    
    clearAllCursors() {
        this.cursors.forEach((cursorElement, userId) => {
            this.removeCursor(userId);
        });
    }
}

// Make CursorManager available globally
window.CursorManager = CursorManager;