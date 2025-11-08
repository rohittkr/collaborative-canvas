// ============================================
// NOTIFICATION MANAGER - Toast Notifications
// ============================================

class NotificationManager {
    constructor() {
        this.notifications = [];
        this.container = null;
        this.init();
        console.log('✅ Notification Manager initialized');
    }
    
    init() {
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.style.position = 'fixed';
        this.container.style.top = '80px';
        this.container.style.right = '20px';
        this.container.style.zIndex = '9999';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.gap = '10px';
        this.container.style.maxWidth = '350px';
        
        document.body.appendChild(this.container);
    }
    
    show(message, type = 'info', duration = 3000) {
        const notification = this.createNotification(message, type);
        
        this.container.appendChild(notification.element);
        this.notifications.push(notification);
        
        setTimeout(() => {
            notification.element.style.transform = 'translateX(0)';
            notification.element.style.opacity = '1';
        }, 10);
        
        setTimeout(() => {
            this.dismiss(notification);
        }, duration);
        
        return notification;
    }
    
    createNotification(message, type) {
        const element = document.createElement('div');
        element.className = `notification notification-${type}`;
        
        const styles = {
            info: { bg: '#d1ecf1', color: '#0c5460', icon: 'ℹ️' },
            success: { bg: '#d4edda', color: '#155724', icon: '✅' },
            warning: { bg: '#fff3cd', color: '#856404', icon: '⚠️' },
            error: { bg: '#f8d7da', color: '#721c24', icon: '❌' }
        };
        
        const style = styles[type] || styles.info;
        
        element.style.padding = '12px 16px';
        element.style.backgroundColor = style.bg;
        element.style.color = style.color;
        element.style.borderRadius = '8px';
        element.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        element.style.display = 'flex';
        element.style.alignItems = 'center';
        element.style.gap = '10px';
        element.style.fontSize = '14px';
        element.style.fontWeight = '500';
        element.style.transform = 'translateX(400px)';
        element.style.opacity = '0';
        element.style.transition = 'all 0.3s ease-out';
        element.style.cursor = 'pointer';
        
        const icon = document.createElement('span');
        icon.textContent = style.icon;
        icon.style.fontSize = '18px';
        
        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;
        messageSpan.style.flex = '1';
        
        const closeBtn = document.createElement('span');
        closeBtn.textContent = '×';
        closeBtn.style.fontSize = '20px';
        closeBtn.style.fontWeight = 'bold';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.opacity = '0.7';
        
        element.appendChild(icon);
        element.appendChild(messageSpan);
        element.appendChild(closeBtn);
        
        const notification = {
            element: element,
            message: message,
            type: type
        };
        
        element.addEventListener('click', () => {
            this.dismiss(notification);
        });
        
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.dismiss(notification);
        });
        
        return notification;
    }
    
    dismiss(notification) {
        notification.element.style.transform = 'translateX(400px)';
        notification.element.style.opacity = '0';
        
        setTimeout(() => {
            if (notification.element.parentElement) {
                notification.element.parentElement.removeChild(notification.element);
            }
            
            const index = this.notifications.indexOf(notification);
            if (index > -1) {
                this.notifications.splice(index, 1);
            }
        }, 300);
    }
    
    info(message, duration) {
        return this.show(message, 'info', duration);
    }
    
    success(message, duration) {
        return this.show(message, 'success', duration);
    }
    
    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }
    
    error(message, duration) {
        return this.show(message, 'error', duration);
    }
}

// Make NotificationManager available globally
window.NotificationManager = NotificationManager;

// ============================================
// MAIN APPLICATION - Phase 3 Complete
// ============================================

// Wait for page to fully load
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Application starting...');
    
    // Initialize Notification Manager
    window.notificationManager = new NotificationManager();
    
    // Initialize Canvas Manager
    window.canvasManager = new CanvasManager('drawingCanvas');
    
    // Initialize Cursor Manager
    window.cursorManager = new CursorManager('drawingCanvas');
    
    // Initialize Socket Manager
    window.socketManager = new SocketManager();
    
    // Connect to server
    window.socketManager.connect();
    
    // Setup UI controls
    setupToolbar();
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Setup cursor tracking
    setupCursorTracking();
    
    console.log('✅ Application initialized!');
    console.log('💡 Try opening multiple tabs to test real-time features!');
});

// ============================================
// TOOLBAR SETUP
// ============================================

function setupToolbar() {
    // Color Picker
    const colorPicker = document.getElementById('colorPicker');
    colorPicker.addEventListener('change', (e) => {
        const newColor = e.target.value;
        console.log('🎨 Color picker changed to:', newColor);
        
        window.canvasManager.setColor(newColor);
        
        // Auto-switch to brush when color changes (better UX)
        if (window.canvasManager.currentTool === 'eraser') {
            document.getElementById('brushBtn').click();
        }
    });
    
    // Brush Size
    const brushSize = document.getElementById('brushSize');
    const sizeValue = document.getElementById('sizeValue');
    
    brushSize.addEventListener('input', (e) => {
        const size = e.target.value;
        sizeValue.textContent = size;
        window.canvasManager.setBrushSize(size);
    });
    
    // Brush Button
    const brushBtn = document.getElementById('brushBtn');
    brushBtn.addEventListener('click', () => {
        setActiveTool('brush', brushBtn);
        window.canvasManager.setTool('brush');
    });
    
    // Eraser Button
    const eraserBtn = document.getElementById('eraserBtn');
    eraserBtn.addEventListener('click', () => {
        setActiveTool('eraser', eraserBtn);
        window.canvasManager.setTool('eraser');
    });
    
    // Undo Button (Global Undo)
    const undoBtn = document.getElementById('undoBtn');
    undoBtn.addEventListener('click', () => {
        console.log('========== UNDO CLICKED ==========');
        console.log('Socket connected:', window.socketManager?.isConnected);
        
        // Check if socket is connected
        if (!window.socketManager || !window.socketManager.isConnected) {
            console.error('❌ Not connected to server!');
            window.notificationManager.error('Not connected to server!', 3000);
            return;
        }
        
        console.log('✅ Emitting undo request...');
        window.socketManager.emitUndo();
    });
    
    // Redo Button (Global Redo)
    const redoBtn = document.getElementById('redoBtn');
    redoBtn.addEventListener('click', () => {
        console.log('========== REDO CLICKED ==========');
        console.log('Socket connected:', window.socketManager?.isConnected);
        
        // Check if socket is connected
        if (!window.socketManager || !window.socketManager.isConnected) {
            console.error('❌ Not connected to server!');
            window.notificationManager.error('Not connected to server!', 3000);
            return;
        }
        
        console.log('✅ Emitting redo request...');
        window.socketManager.emitRedo();
    });
    
    // Clear Button
    const clearBtn = document.getElementById('clearBtn');
    clearBtn.addEventListener('click', () => {
        if (confirm('Clear the entire canvas? This will affect all users!')) {
            window.canvasManager.clearCanvas();
            window.notificationManager.warning('Canvas cleared!', 2000);
        }
    });
    
    console.log('✅ Toolbar setup complete');
}

// Helper function to highlight active tool
function setActiveTool(tool, button) {
    // Remove active class from all tool buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
        if (btn !== document.getElementById('clearBtn') && 
            btn !== document.getElementById('undoBtn') && 
            btn !== document.getElementById('redoBtn')) {
            btn.classList.remove('active');
        }
    });
    
    // Add active class to clicked button
    button.classList.add('active');
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Z = Undo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('undoBtn').click();
            console.log('⌨️ Undo triggered (Ctrl+Z)');
        }
        
        // Ctrl/Cmd + Shift + Z = Redo (or Ctrl/Cmd + Y)
        if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === 'z' || e.key === 'y')) {
            e.preventDefault();
            document.getElementById('redoBtn').click();
            console.log('⌨️ Redo triggered (Ctrl+Shift+Z)');
        }
        
        // B = Brush tool
        if (e.key === 'b' || e.key === 'B') {
            if (!isTyping()) {
                document.getElementById('brushBtn').click();
            }
        }
        
        // E = Eraser tool
        if (e.key === 'e' || e.key === 'E') {
            if (!isTyping()) {
                document.getElementById('eraserBtn').click();
            }
        }
        
        // [ = Decrease brush size
        if (e.key === '[') {
            if (!isTyping()) {
                const brushSize = document.getElementById('brushSize');
                brushSize.value = Math.max(1, parseInt(brushSize.value) - 1);
                brushSize.dispatchEvent(new Event('input'));
            }
        }
        
        // ] = Increase brush size
        if (e.key === ']') {
            if (!isTyping()) {
                const brushSize = document.getElementById('brushSize');
                brushSize.value = Math.min(50, parseInt(brushSize.value) + 1);
                brushSize.dispatchEvent(new Event('input'));
            }
        }
    });
    
    console.log('✅ Keyboard shortcuts setup');
    console.log('💡 Shortcuts:');
    console.log('   • Ctrl+Z (Undo)');
    console.log('   • Ctrl+Shift+Z (Redo)');
    console.log('   • B (Brush), E (Eraser)');
    console.log('   • [ ] (Brush Size)');
}

// Helper to check if user is typing in an input
function isTyping() {
    const activeElement = document.activeElement;
    return activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA'
    );
}

// ============================================
// CURSOR TRACKING (Phase 3)
// ============================================

function setupCursorTracking() {
    const canvas = document.getElementById('drawingCanvas');
    
    canvas.addEventListener('mousemove', (e) => {
        if (window.socketManager && window.socketManager.isConnected) {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Send cursor position to server (throttled in socketManager)
            window.socketManager.emitCursorMove(x, y);
        }
    });
    
    // Hide cursor when mouse leaves canvas
    canvas.addEventListener('mouseleave', () => {
        // Could send cursor-hide event here if needed
    });
    
    console.log('✅ Cursor tracking setup');
}

// ============================================
// HANDLE PAGE CLOSE
// ============================================

window.addEventListener('beforeunload', () => {
    // Disconnect socket when leaving page
    if (window.socketManager) {
        window.socketManager.disconnect();
    }
});