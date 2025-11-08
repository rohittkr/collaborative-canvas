// ============================================
// DRAWING STATE MANAGER - Simplified Canvas Snapshots
// ============================================

class DrawingStateManager {
    constructor() {
        this.states = new Map(); // roomId -> state
        console.log('✅ Drawing State Manager initialized');
    }
    
    // ============================================
    // STATE INITIALIZATION
    // ============================================
    
    initializeRoomState(roomId) {
        if (this.states.has(roomId)) {
            return this.states.get(roomId);
        }
        
        const state = {
            roomId: roomId,
            history: [], // Canvas snapshots for undo/redo
            historyIndex: -1, // Current position in history
            operations: [], // For new users joining
            metadata: {
                createdAt: Date.now(),
                lastModified: Date.now()
            }
        };
        
        this.states.set(roomId, state);
        console.log(`📋 Initialized state for room: ${roomId}`);
        
        return state;
    }
    
    getState(roomId) {
        if (!this.states.has(roomId)) {
            return this.initializeRoomState(roomId);
        }
        return this.states.get(roomId);
    }
    
    deleteState(roomId) {
        this.states.delete(roomId);
        console.log(`🗑️ Deleted state for room: ${roomId}`);
    }
    
    // ============================================
    // OPERATION MANAGEMENT (for new users)
    // ============================================
    
    addOperation(roomId, operation) {
        const state = this.getState(roomId);
        
        const op = {
            ...operation,
            operationId: this.generateOperationId(),
            timestamp: Date.now()
        };
        
        state.operations.push(op);
        state.metadata.lastModified = Date.now();
        
        // Limit operations
        const MAX_OPERATIONS = 500;
        if (state.operations.length > MAX_OPERATIONS) {
            state.operations.shift();
        }
        
        return op;
    }
    
    getRecentOperations(roomId, count = 100) {
        const state = this.getState(roomId);
        return state.operations.slice(-count);
    }
    
    clearOperations(roomId) {
        const state = this.getState(roomId);
        state.operations = [];
        state.history = [];
        state.historyIndex = -1;
        state.metadata.lastModified = Date.now();
        
        console.log(`🗑️ Cleared all data for room: ${roomId}`);
    }
    
    // ============================================
    // SNAPSHOT-BASED UNDO/REDO
    // ============================================
    
    saveSnapshot(roomId, canvasDataURL) {
        const state = this.getState(roomId);
        
        // Remove any history after current index (for new drawing after undo)
        if (state.historyIndex < state.history.length - 1) {
            state.history = state.history.slice(0, state.historyIndex + 1);
        }
        
        // Add new snapshot
        state.history.push({
            dataURL: canvasDataURL,
            timestamp: Date.now()
        });
        
        state.historyIndex = state.history.length - 1;
        
        // Limit history to 20 snapshots
        const MAX_HISTORY = 20;
        if (state.history.length > MAX_HISTORY) {
            state.history.shift();
            state.historyIndex--;
        }
        
        console.log(`💾 Saved snapshot for room ${roomId} (index: ${state.historyIndex}, total: ${state.history.length})`);
        
        return true;
    }
    
    undo(roomId) {
        const state = this.getState(roomId);
        
        if (state.historyIndex <= 0) {
            return {
                success: false,
                message: 'Nothing to undo'
            };
        }
        
        state.historyIndex--;
        const snapshot = state.history[state.historyIndex];
        
        console.log(`↩️ Undo in room ${roomId} to index ${state.historyIndex}`);
        
        return {
            success: true,
            canvasDataURL: snapshot.dataURL,
            index: state.historyIndex
        };
    }
    
    redo(roomId) {
        const state = this.getState(roomId);
        
        if (state.historyIndex >= state.history.length - 1) {
            return {
                success: false,
                message: 'Nothing to redo'
            };
        }
        
        state.historyIndex++;
        const snapshot = state.history[state.historyIndex];
        
        console.log(`↪️ Redo in room ${roomId} to index ${state.historyIndex}`);
        
        return {
            success: true,
            canvasDataURL: snapshot.dataURL,
            index: state.historyIndex
        };
    }
    
    canUndo(roomId) {
        const state = this.getState(roomId);
        return state.historyIndex > 0;
    }
    
    canRedo(roomId) {
        const state = this.getState(roomId);
        return state.historyIndex < state.history.length - 1;
    }
    
    getCurrentSnapshot(roomId) {
        const state = this.getState(roomId);
        
        if (state.historyIndex >= 0 && state.historyIndex < state.history.length) {
            return state.history[state.historyIndex].dataURL;
        }
        
        return null;
    }
    
    // Legacy function for compatibility
    getCanvasData(roomId) {
        return this.getCurrentSnapshot(roomId);
    }
    
    // Legacy function for compatibility
    saveCanvasData(roomId, canvasData) {
        // Just save as a snapshot
        return this.saveSnapshot(roomId, canvasData);
    }
    
    // ============================================
    // STATISTICS
    // ============================================
    
    getStateStats(roomId) {
        const state = this.getState(roomId);
        
        return {
            roomId: roomId,
            operationCount: state.operations.length,
            historySize: state.history.length,
            historyIndex: state.historyIndex,
            canUndo: this.canUndo(roomId),
            canRedo: this.canRedo(roomId),
            createdAt: state.metadata.createdAt,
            lastModified: state.metadata.lastModified
        };
    }
    
    getGlobalStats() {
        const stats = {
            totalRooms: this.states.size,
            totalOperations: 0,
            rooms: []
        };
        
        this.states.forEach((state, roomId) => {
            stats.totalOperations += state.operations.length;
            stats.rooms.push(this.getStateStats(roomId));
        });
        
        return stats;
    }
    
    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    
    generateOperationId() {
        return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    cleanup(maxAge = 24 * 60 * 60 * 1000) {
        const now = Date.now();
        let cleaned = 0;
        
        this.states.forEach((state, roomId) => {
            const age = now - state.metadata.lastModified;
            
            if (age > maxAge && state.operations.length === 0) {
                this.deleteState(roomId);
                cleaned++;
            }
        });
        
        if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} inactive room states`);
        }
        
        return cleaned;
    }
}

module.exports = DrawingStateManager;