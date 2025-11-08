// ============================================
// ROOM MANAGEMENT - Handles multiple drawing rooms
// ============================================

class RoomManager {
    constructor() {
        this.rooms = new Map();
        this.defaultRoomId = 'global';
        
        // Create default global room
        this.createRoom(this.defaultRoomId);
        
        console.log('✅ Room Manager initialized');
    }
    
    // ============================================
    // ROOM OPERATIONS
    // ============================================
    
    createRoom(roomId, config = {}) {
        if (this.rooms.has(roomId)) {
            console.log(`⚠️ Room ${roomId} already exists`);
            return this.rooms.get(roomId);
        }
        
        const room = {
            id: roomId,
            name: config.name || roomId,
            users: new Map(),
            maxUsers: config.maxUsers || 50,
            createdAt: Date.now(),
            isPublic: config.isPublic !== false,
            password: config.password || null
        };
        
        this.rooms.set(roomId, room);
        console.log(`🚪 Created room: ${roomId}`);
        
        return room;
    }
    
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
    
    deleteRoom(roomId) {
        if (roomId === this.defaultRoomId) {
            console.log('⚠️ Cannot delete default room');
            return false;
        }
        
        const room = this.rooms.get(roomId);
        if (room && room.users.size === 0) {
            this.rooms.delete(roomId);
            console.log(`🗑️ Deleted room: ${roomId}`);
            return true;
        }
        
        return false;
    }
    
    listRooms() {
        return Array.from(this.rooms.values()).map(room => ({
            id: room.id,
            name: room.name,
            userCount: room.users.size,
            maxUsers: room.maxUsers,
            isPublic: room.isPublic,
            createdAt: room.createdAt
        }));
    }
    
    // ============================================
    // USER MANAGEMENT
    // ============================================
    
    addUserToRoom(roomId, user) {
        const room = this.getRoom(roomId);
        
        if (!room) {
            console.log(`⚠️ Room ${roomId} not found`);
            return false;
        }
        
        if (room.users.size >= room.maxUsers) {
            console.log(`⚠️ Room ${roomId} is full`);
            return false;
        }
        
        // Assign color to user if not already assigned
        if (!user.color) {
            user.color = this.generateUserColor(room);
        }
        
        room.users.set(user.userId, {
            ...user,
            joinedAt: Date.now()
        });
        
        console.log(`👤 User ${user.userName} joined room ${roomId} (${room.users.size}/${room.maxUsers})`);
        
        return true;
    }
    
    removeUserFromRoom(roomId, userId) {
        const room = this.getRoom(roomId);
        
        if (!room) {
            return false;
        }
        
        const user = room.users.get(userId);
        room.users.delete(userId);
        
        console.log(`👋 User ${user?.userName || userId} left room ${roomId} (${room.users.size} remaining)`);
        
        // Auto-delete empty non-default rooms
        if (room.users.size === 0 && roomId !== this.defaultRoomId) {
            setTimeout(() => {
                if (room.users.size === 0) {
                    this.deleteRoom(roomId);
                }
            }, 60000); // Delete after 1 minute of being empty
        }
        
        return true;
    }
    
    getUsersInRoom(roomId) {
        const room = this.getRoom(roomId);
        
        if (!room) {
            return [];
        }
        
        return Array.from(room.users.values()).map(user => ({
            userId: user.userId,
            userName: user.userName,
            color: user.color,
            joinedAt: user.joinedAt
        }));
    }
    
    findUserRoom(userId) {
        for (const [roomId, room] of this.rooms) {
            if (room.users.has(userId)) {
                return roomId;
            }
        }
        return null;
    }
    
    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    
    generateUserColor(room) {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
            '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
            '#F8B739', '#52B788', '#E63946', '#457B9D',
            '#E76F51', '#2A9D8F', '#E9C46A', '#F4A261'
        ];
        
        // Get colors already in use
        const usedColors = new Set(
            Array.from(room.users.values()).map(u => u.color)
        );
        
        // Find an unused color
        const availableColors = colors.filter(c => !usedColors.has(c));
        
        if (availableColors.length > 0) {
            return availableColors[Math.floor(Math.random() * availableColors.length)];
        }
        
        // If all colors used, return random color
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    getRoomStats(roomId) {
        const room = this.getRoom(roomId);
        
        if (!room) {
            return null;
        }
        
        return {
            id: room.id,
            name: room.name,
            userCount: room.users.size,
            maxUsers: room.maxUsers,
            users: this.getUsersInRoom(roomId),
            uptime: Date.now() - room.createdAt
        };
    }
    
    getGlobalStats() {
        const totalUsers = Array.from(this.rooms.values())
            .reduce((sum, room) => sum + room.users.size, 0);
        
        return {
            totalRooms: this.rooms.size,
            totalUsers: totalUsers,
            rooms: this.listRooms()
        };
    }
}

// Export for use in server
module.exports = RoomManager;