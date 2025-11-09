// ============================================
// CANVAS MANAGER - Handles all drawing operations
// ============================================

class CanvasManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.currentTool = 'brush';
        this.currentColor = '#000000';
        this.brushSize = 5;
        this.lastX = 0;
        this.lastY = 0;

        this.resizeCanvas();
        this.setupEventListeners();
        this.history = [];
        this.historyStep = -1;

        console.log('✅ Canvas Manager initialized');
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth - 20;
        this.canvas.height = container.clientHeight - 20;
        this.setupCanvasContext();
    }

    setupCanvasContext() {
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.globalCompositeOperation = 'source-over';
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        // ✅ Preserve drawings on resize
        window.addEventListener('resize', () => {
            const temp = document.createElement('canvas');
            temp.width = this.canvas.width;
            temp.height = this.canvas.height;
            temp.getContext('2d').drawImage(this.canvas, 0, 0);

            this.resizeCanvas();
            this.ctx.drawImage(temp, 0, 0);
        });
    }

    startDrawing(e) {
        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        this.lastX = e.clientX - rect.left;
        this.lastY = e.clientY - rect.top;
    }

    draw(e) {
        if (!this.isDrawing) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.drawLine(this.lastX, this.lastY, x, y);

        if (window.socketManager)
            window.socketManager.emitDrawing({
                fromX: this.lastX,
                fromY: this.lastY,
                toX: x,
                toY: y,
                color: this.currentColor,
                size: this.brushSize,
                tool: this.currentTool,
            });

        this.lastX = x;
        this.lastY = y;
    }

    stopDrawing() {
        this.isDrawing = false;
    }

    drawLine(fromX, fromY, toX, toY, color = this.currentColor, size = this.brushSize, tool = this.currentTool) {
        this.ctx.save();
        if (tool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.lineWidth = size;
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = size;
        }

        this.ctx.beginPath();
        this.ctx.moveTo(fromX, fromY);
        this.ctx.lineTo(toX, toY);
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawRemoteLine(data) {
        this.drawLine(data.fromX, data.fromY, data.toX, data.toY, data.color, data.size, data.tool);
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.setupCanvasContext();
        if (window.socketManager) window.socketManager.emitClear();
    }

    clearRemoteCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.setupCanvasContext();
    }
}

window.CanvasManager = CanvasManager;
