# 🏗️ Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Data Flow Diagram](#data-flow-diagram)
3. [WebSocket Protocol](#websocket-protocol)
4. [Undo/Redo Strategy](#undoredo-strategy)
5. [Performance Decisions](#performance-decisions)
6. [Conflict Resolution](#conflict-resolution)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT SIDE                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   main.js    │  │  canvas.js   │  │ websocket.js │     │
│  │              │  │              │  │              │     │
│  │ - Init app   │  │ - Drawing    │  │ - Socket.IO  │     │
│  │ - UI events  │  │ - Rendering  │  │ - Events     │     │
│  │ - Keyboard   │  │ - Cursors    │  │ - Sync       │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                 │                   │             │
│         └─────────────────┴───────────────────┘             │
│                           │                                 │
└───────────────────────────┼─────────────────────────────────┘
                            │
                    WebSocket (Socket.IO)
                            │
┌───────────────────────────┼─────────────────────────────────┐
│                      SERVER SIDE                             │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  server.js   │  │   rooms.js   │  │drawing-state │     │
│  │              │  │              │  │     .js      │     │
│  │ - Socket.IO  │  │ - Room mgmt  │  │ - Snapshots  │     │
│  │ - Routing    │  │ - Users      │  │ - Undo/Redo  │     │
│  │ - Events     │  │ - Colors     │  │ - History    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### Client Side

**main.js**
- Application initialization
- DOM event binding
- Keyboard shortcuts
- Notification manager (toast messages)

**canvas.js**
- HTML5 Canvas drawing operations
- Mouse/touch event handling
- Drawing tools (brush, eraser)
- Cursor manager for multi-user cursors
- Canvas snapshot management

**websocket.js**
- Socket.IO client connection
- Event emission and handling
- Connection state management
- Latency tracking
- User session management

#### Server Side

**server.js**
- Express HTTP server
- Socket.IO WebSocket server
- Event routing and broadcasting
- API endpoints
- Connection lifecycle management

**rooms.js**
- Room creation and deletion
- User join/leave operations
- User color assignment
- Room statistics

**drawing-state.js**
- Canvas snapshot storage
- Undo/redo history management
- Drawing operations tracking
- State persistence (in-memory)

---

## Data Flow Diagram

### Drawing Flow (User A draws, User B sees it)

```
┌─────────────┐
│   User A    │
│  (Browser)  │
└──────┬──────┘
       │ 1. Mouse Move
       ▼
┌─────────────────────────────────────────────┐
│           canvas.js                         │
│  - Capture mouse position                   │
│  - Draw line on local canvas (immediate)    │
│  - Prepare drawing data                     │
└──────┬──────────────────────────────────────┘
       │ 2. Emit 'draw' event
       ▼
┌─────────────────────────────────────────────┐
│          websocket.js                       │
│  - Add userId, timestamp                    │
│  - Send via Socket.IO                       │
└──────┬──────────────────────────────────────┘
       │ 3. WebSocket message
       ▼
┌─────────────────────────────────────────────┐
│      Server (server.js)                     │
│  - Receive 'draw' event                     │
│  - Store in drawing-state.js                │
│  - Broadcast to other users in room         │
└──────┬──────────────────────────────────────┘
       │ 4. Broadcast 'drawing-data'
       ▼
┌─────────────────────────────────────────────┐
│   User B websocket.js                       │
│  - Receive 'drawing-data' event             │
│  - Call canvas.drawRemoteLine()             │
└──────┬──────────────────────────────────────┘
       │ 5. Render on canvas
       ▼
┌─────────────┐
│   User B    │
│  (Browser)  │
│  Sees line! │
└─────────────┘

Total Latency: ~10-100ms depending on network
```

### Undo/Redo Flow

```
┌─────────────┐
│  User clicks│
│  UNDO button│
└──────┬──────┘
       │ 1. Click event
       ▼
┌─────────────────────────────────────────────┐
│           main.js                           │
│  - Check connection                         │
│  - Call socketManager.emitUndo()            │
└──────┬──────────────────────────────────────┘
       │ 2. Emit 'undo-request'
       ▼
┌─────────────────────────────────────────────┐
│      Server (server.js)                     │
│  - Receive 'undo-request'                   │
│  - Call drawingStateManager.undo()          │
└──────┬──────────────────────────────────────┘
       │ 3. Get previous snapshot
       ▼
┌─────────────────────────────────────────────┐
│      drawing-state.js                       │
│  - historyIndex--                           │
│  - Return snapshot at new index             │
│  - Return: { canvasDataURL, index }         │
└──────┬──────────────────────────────────────┘
       │ 4. Broadcast to ALL users
       ▼
┌─────────────────────────────────────────────┐
│      Server (server.js)                     │
│  - io.to(room).emit('global-undo', data)   │
│  - Sends to ALL users (including sender)    │
└──────┬──────────────────────────────────────┘
       │ 5. Receive 'global-undo'
       ▼
┌─────────────────────────────────────────────┐
│   ALL Users - websocket.js                  │
│  - Receive canvasDataURL                    │
│  - Call canvas.loadFromDataURL()            │
└──────┬──────────────────────────────────────┘
       │ 6. Load image
       ▼
┌─────────────────────────────────────────────┐
│   ALL Users - canvas.js                     │
│  - Clear canvas                             │
│  - Load image from dataURL                  │
│  - Canvas state synchronized!               │
└─────────────────────────────────────────────┘

Key: Everyone sees the same canvas state instantly!
```

---

## WebSocket Protocol

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `join-room` | `{userId, userName, roomId?}` | User joins a room |
| `draw` | `{type, tool, color, size, fromX, fromY, toX, toY, strokeId}` | Drawing operation |
| `save-snapshot` | `{canvasData, userId, userName, timestamp}` | Save canvas snapshot |
| `undo-request` | `{userId, userName}` | Request undo |
| `redo-request` | `{userId, userName}` | Request redo |
| `clear-canvas` | `{userId, userName}` | Clear entire canvas |
| `cursor-move` | `{x, y}` | Cursor position update |
| `ping` | `{timestamp}` | Latency check |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `welcome` | `{userId, userName, color, roomId, message}` | Welcome message with assigned color |
| `canvas-state` | `{canvasData}` | Current canvas snapshot |
| `drawing-history` | `[operations]` | Recent drawing operations |
| `drawing-data` | `{operation}` | Real-time drawing from another user |
| `global-undo` | `{userId, userName, canvasDataURL, index}` | Undo broadcast to all |
| `global-redo` | `{userId, userName, canvasDataURL, index}` | Redo broadcast to all |
| `canvas-cleared` | `{userId, userName}` | Canvas was cleared |
| `user-joined` | `{userId, userName, color}` | New user joined |
| `user-left` | `{userId, userName}` | User left |
| `users-update` | `[{userId, userName, color}]` | Updated users list |
| `user-cursor` | `{userId, userName, color, x, y}` | User cursor position |
| `undo-failed` | `{message}` | Undo failed (nothing to undo) |
| `redo-failed` | `{message}` | Redo failed (nothing to redo) |
| `pong` | `{clientTime, serverTime}` | Latency response |

### Message Examples

**Drawing Event:**
```javascript
// Client sends:
{
  type: 'draw',
  tool: 'brush',
  color: '#FF6B6B',
  size: 5,
  fromX: 100,
  fromY: 150,
  toX: 105,
  toY: 155,
  strokeId: 'stroke_1234567890_abc123',
  userId: 'user_1234567890_xyz789',
  userName: 'User_457',
  timestamp: 1699123456789
}
```

**Undo Event:**
```javascript
// Server broadcasts:
{
  userId: 'user_1234567890_xyz789',
  userName: 'User_457',
  canvasDataURL: 'data:image/png;base64,iVBORw0KGgo...',
  index: 3
}
```

---

## Undo/Redo Strategy

### Design Decision: Snapshot-Based Approach

**Why Snapshots Over Operation Replay?**

We chose a snapshot-based approach after evaluating multiple strategies:

#### ❌ Operation Replay Approach (Rejected)
```javascript
// Store individual operations
operations = [
  {draw: line1}, // 50 operations for one circle
  {draw: line2},
  ...
  {draw: line50}
]

// Undo = Remove last operation and replay all
// Problem: 1000 operations = slow redraw
```

**Issues:**
- Slow for complex drawings (1000+ operations)
- Complex stroke grouping logic
- Difficult to handle tool changes mid-stroke
- Memory grows unbounded

#### ✅ Canvas Snapshot Approach (Chosen)
```javascript
// Store canvas as image after each stroke
history = [
  {dataURL: 'data:image/png;base64,...', timestamp},
  {dataURL: 'data:image/png;base64,...', timestamp},
  ...
]

// Undo = Load previous snapshot
// Fast, simple, reliable!
```

**Advantages:**
- ✅ **Fast** - O(1) undo/redo (just load image)
- ✅ **Simple** - No complex replay logic
- ✅ **Reliable** - Exact state restoration
- ✅ **Works with any tool** - Even future features

**Trade-offs:**
- ❌ More memory per snapshot (~50-200KB)
- ✅ Limited to 20 snapshots (manageable)

### Implementation Details

**Snapshot Storage:**
```javascript
class DrawingStateManager {
  state = {
    history: [
      {dataURL: '...', timestamp: 123},
      {dataURL: '...', timestamp: 456}
    ],
    historyIndex: 1, // Current position
  }
  
  saveSnapshot(canvasDataURL) {
    // Remove future history if we're in the past
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    
    // Add new snapshot
    this.history.push({dataURL: canvasDataURL, timestamp: Date.now()});
    this.historyIndex++;
    
    // Limit to 20 snapshots
    if (this.history.length > 20) {
      this.history.shift();
      this.historyIndex--;
    }
  }
}
```

**Undo/Redo Logic:**
```javascript
undo() {
  if (this.historyIndex <= 0) {
    return {success: false, message: 'Nothing to undo'};
  }
  
  this.historyIndex--;
  return {
    success: true,
    canvasDataURL: this.history[this.historyIndex].dataURL
  };
}

redo() {
  if (this.historyIndex >= this.history.length - 1) {
    return {success: false, message: 'Nothing to redo'};
  }
  
  this.historyIndex++;
  return {
    success: true,
    canvasDataURL: this.history[this.historyIndex].dataURL
  };
}
```

### Global Undo/Redo Synchronization

**Challenge:** How do all users see the same state after undo/redo?

**Solution:** Broadcast the snapshot to ALL users (including sender)

```javascript
// Server side
socket.on('undo-request', () => {
  const result = drawingStateManager.undo(roomId);
  
  // Send to EVERYONE in the room
  io.to(roomId).emit('global-undo', {
    canvasDataURL: result.canvasDataURL
  });
});

// Client side
socket.on('global-undo', (data) => {
  // Everyone loads the same snapshot
  canvasManager.loadFromDataURL(data.canvasDataURL);
});
```

**Result:** Perfect synchronization across all users!

---

## Performance Decisions

### 1. Event Throttling

**Problem:** Mouse move events fire 60-120 times per second

**Solution:** Throttle cursor updates
```javascript
// websocket.js
emitCursorMove(x, y) {
  if (!this.cursorThrottle) {
    this.cursorThrottle = true;
    this.socket.emit('cursor-move', {x, y});
    
    setTimeout(() => {
      this.cursorThrottle = false;
    }, 50); // Max 20 updates/sec
  }
}
```

**Impact:** Reduces network traffic by 80% with minimal UX impact

### 2. Canvas Drawing Optimization

**Technique:** Use `ctx.save()` and `ctx.restore()`
```javascript
drawLine(fromX, fromY, toX, toY, color, size, tool) {
  this.ctx.save(); // Save current state
  
  // Set styles
  this.ctx.strokeStyle = color;
  this.ctx.lineWidth = size;
  
  // Draw
  this.ctx.beginPath();
  this.ctx.moveTo(fromX, fromY);
  this.ctx.lineTo(toX, toY);
  this.ctx.stroke();
  
  this.ctx.restore(); // Restore state
}
```

**Why:** Prevents context pollution, allows concurrent drawing

### 3. Snapshot Compression

**Current:** Base64 PNG (unoptimized)
```javascript
canvas.toDataURL('image/png'); // ~200KB per snapshot
```

**Future Optimization:**
```javascript
canvas.toDataURL('image/jpeg', 0.8); // ~50KB per snapshot
```

**Trade-off:** JPEG has lossy compression, may affect quality

### 4. History Limitation

**Decision:** Limit to 20 snapshots per room

**Reasoning:**
- 20 snapshots × 200KB = ~4MB per room
- Sufficient for typical use cases
- Prevents memory leaks
- Older snapshots unlikely to be needed

### 5. Real-time Drawing: No Batching

**Decision:** Send each line segment immediately

**Why:**
- Low latency is critical for UX
- Drawing operations are small (~100 bytes)
- Batching adds delay (bad UX)

**Alternative Considered:** Batch operations every 50ms
- ❌ Adds 50ms delay (noticeable lag)
- ✅ Reduces messages by 80%
- **Verdict:** UX > bandwidth savings

### 6. New User Onboarding

**Strategy:** Send recent operations + latest snapshot

```javascript
socket.on('join-room', () => {
  // Send snapshot for instant full canvas
  socket.emit('canvas-state', {
    canvasData: getCurrentSnapshot()
  });
  
  // Send recent ops for smooth drawing continuity
  socket.emit('drawing-history', 
    getRecentOperations(100)
  );
});
```

**Why both?**
- Snapshot = instant full canvas
- Operations = ensure recent strokes are smooth

---

## Conflict Resolution

### Drawing Conflicts

**Scenario:** User A and User B draw at the same location simultaneously

**Resolution:** Last-write-wins (no conflict)

**Why it works:**
- Canvas operations are additive (drawing over existing)
- No data loss - both drawings preserved
- Natural behavior - like physical paper

**Example:**
```
Time: 0ms - User A draws red line
Time: 5ms - User B draws blue line
Result: Both lines visible, blue slightly on top
```

### Undo/Redo Conflicts

**Scenario:** User A undoes while User B is drawing

**Resolution:** Undo overwrites everything

**Flow:**
```
1. User B is drawing...
2. User A clicks undo
3. Server broadcasts snapshot to ALL users
4. User B's incomplete drawing is lost
5. User B must redraw
```

**Why this approach:**
- Undo/redo requires global consistency
- Incomplete strokes are not saved
- User B sees immediate feedback (drawing disappeared)

**Alternative Considered:** Queue undo until all strokes complete
- ❌ Too complex
- ❌ Delayed undo (bad UX)
- **Verdict:** Immediate undo is better

### Clear Canvas Conflicts

**Scenario:** User A clears while others are drawing

**Resolution:** Clear wins, all drawings lost

```javascript
socket.on('clear-canvas', () => {
  drawingStateManager.clearOperations(roomId);
  io.to(roomId).emit('canvas-cleared');
});
```

**Mitigation:** Confirm dialog warns user

### Connection Conflicts

**Scenario:** User disconnects mid-drawing

**Resolution:** Incomplete stroke is lost

**Handling:**
```javascript
// Client side
window.addEventListener('beforeunload', () => {
  if (canvasManager.isDrawing) {
    // Could send 'stroke-cancel' event
    // Current: Just disconnect (stroke lost)
  }
});
```

**Future Enhancement:** Send stroke-cancel event

---

## Scalability Considerations

### Current Capacity

- **Users per room:** 10-20 (comfortable)
- **Total rooms:** Limited by memory (~100 rooms)
- **Total users:** ~1000 across all rooms
- **Network:** Single server, no load balancing

### Scaling to 1000+ Concurrent Users

**Required Changes:**

1. **Horizontal Scaling**
```javascript
// Use Redis adapter for Socket.IO
const io = socketIO(server);
io.adapter(redisAdapter({ 
  host: 'redis-server', 
  port: 6379 
}));
```

2. **State Persistence**
```javascript
// Use Redis/MongoDB for state
class DrawingStateManager {
  async saveSnapshot(roomId, data) {
    await redis.set(`room:${roomId}:snapshot`, data);
  }
}
```

3. **Load Balancing**
```
           Nginx Load Balancer
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
    Server 1   Server 2   Server 3
        │          │          │
        └──────────┴──────────┘
                   │
              Redis Pub/Sub
```

4. **CDN for Static Assets**
- Serve HTML/CSS/JS from CDN
- Reduces server load

---

## Security Considerations

### Current Implementation (Development)

- ❌ No authentication
- ❌ No rate limiting
- ❌ No input validation
- ⚠️ XSS vulnerable (user names)

### Production Requirements

1. **Authentication**
```javascript
socket.on('join-room', async (data, callback) => {
  const user = await verifyToken(data.token);
  if (!user) return callback({error: 'Invalid token'});
  // ... join logic
});
```

2. **Rate Limiting**
```javascript
const rateLimit = require('socket.io-rate-limit');

io.use(rateLimit({
  interval: 1000,
  max: 100 // Max 100 events per second
}));
```

3. **Input Validation**
```javascript
socket.on('draw', (data) => {
  if (!validateDrawing(data)) {
    return socket.emit('error', 'Invalid drawing data');
  }
  // ... process
});
```

4. **XSS Protection**
```javascript
const sanitize = require('sanitize-html');

const userName = sanitize(data.userName, {
  allowedTags: [],
  allowedAttributes: {}
});
```

---

## Testing Strategy

### Manual Testing

**Multi-tab Testing:**
```bash
# Terminal 1
npm start

# Browser
# Open 3 tabs: localhost:3000
# Draw in each, test undo/redo
```

**Network Testing:**
```bash
# Find IP: ipconfig (Windows) or ifconfig (Mac/Linux)
# Share: http://YOUR_IP:3000
```

### Automated Testing (Future)

**Unit Tests:**
```javascript
describe('DrawingStateManager', () => {
  it('should save and retrieve snapshots', () => {
    const manager = new DrawingStateManager();
    manager.saveSnapshot('room1', 'data:image/png...');
    expect(manager.getCurrentSnapshot('room1')).toBe('data:image/png...');
  });
  
  it('should undo correctly', () => {
    // ... test undo logic
  });
});
```

**Integration Tests:**
```javascript
describe('Socket Events', () => {
  it('should broadcast drawing to other users', (done) => {
    // Create 2 socket clients
    // Client 1 draws
    // Client 2 should receive drawing-data event
  });
});
```

---

## Future Enhancements

### Short-term (1-2 weeks)

1. **Shapes Tool** - Rectangle, circle, line
2. **Text Tool** - Add text to canvas
3. **Export** - Download as PNG/JPG
4. **Room Selection** - UI for multiple rooms

### Medium-term (1-2 months)

1. **User Authentication** - Login system
2. **Persistence** - Save drawings to database
3. **Drawing Templates** - Predefined backgrounds
4. **Color Palettes** - Saved color schemes

### Long-term (3+ months)

1. **Mobile App** - Native iOS/Android
2. **Voice Chat** - Integrated communication
3. **AI Assistant** - Drawing suggestions
4. **Collaborative Games** - Pictionary, etc.

---

## Conclusion

This architecture prioritizes:
1. ✅ **Simplicity** - Easy to understand and maintain
2. ✅ **Performance** - Low latency, smooth UX
3. ✅ **Reliability** - Robust error handling
4. ✅ **Scalability** - Ready for future growth

The snapshot-based undo/redo strategy, while using more memory, provides a superior user experience and simpler codebase compared to operation replay approaches.

---

**Document Version:** 1.0  
**Last Updated:** November 2024  
**Author:** Technical Assessment Submission