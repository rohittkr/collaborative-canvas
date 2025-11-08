# 🎨 Real-Time Collaborative Drawing Canvas

A multi-user drawing application where multiple people can draw simultaneously on the same canvas with real-time synchronization using WebSockets.

## 📋 Features

### ✅ Core Features Implemented

- **Real-time Drawing Sync** - See other users' drawings as they draw (not after they finish)
- **Drawing Tools** - Brush, eraser, color picker, adjustable stroke width
- **User Cursors** - See where other users are currently drawing with colored cursors
- **Global Undo/Redo** - Any user can undo/redo any action across all users
- **User Management** - Online users list with unique colors
- **Connection Status** - Real-time latency display and reconnection handling
- **Multi-tab Support** - Open multiple tabs to test collaboration
- **Touch Support** - Works on mobile devices

### 🏗️ Architecture Highlights

- **Snapshot-based Undo/Redo** - Efficient canvas state management
- **Separated Concerns** - Modular architecture (rooms.js, drawing-state.js)
- **Error Handling** - Graceful disconnection and reconnection
- **Real-time Sync** - Low-latency drawing synchronization
- **Scalable Design** - Multi-room support ready for expansion

---

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd collaborative-canvas

# Install dependencies
npm install

# Start the server
npm start
```

The application will be available at `http://localhost:3000`

---

## 🧪 Testing with Multiple Users

### Local Testing

1. **Start the server:**
   ```bash
   npm start
   ```

2. **Open multiple browser tabs/windows:**
   - Open `http://localhost:3000` in 2-3 different tabs
   - Or open in different browsers (Chrome, Firefox, Safari)

3. **Test features:**
   - Draw in one tab → See it appear instantly in other tabs
   - Move mouse → See your cursor in other tabs
   - Click Undo → Watch drawings disappear in all tabs
   - Clear canvas → Everyone sees the clear

### Network Testing (Same Network)

1. Find your local IP address:
   - Windows: `ipconfig` → Look for IPv4 Address
   - Mac/Linux: `ifconfig` → Look for inet address

2. Share the URL with others on the same network:
   ```
   http://YOUR_IP_ADDRESS:3000
   ```

---

## 🎮 How to Use

### Drawing Tools

- **Brush** - Click brush button or press `B`
- **Eraser** - Click eraser button or press `E`
- **Color** - Click color picker to choose color
- **Size** - Use slider to adjust brush/eraser size
  - Or press `[` to decrease, `]` to increase

### Undo/Redo

- **Undo** - Click ↩️ button or press `Ctrl+Z`
- **Redo** - Click ↪️ button or press `Ctrl+Shift+Z`
- **Note:** Undo/Redo works globally across all users!

### Clear Canvas

- Click the 🗑️ Clear button
- Confirms before clearing (affects all users)

---

## 📁 Project Structure

```
collaborative-canvas/
├── client/                 # Frontend files
│   ├── index.html         # Main HTML structure
│   ├── style.css          # Styling and animations
│   ├── canvas.js          # Canvas drawing logic + cursor manager
│   ├── websocket.js       # WebSocket client communication
│   └── main.js            # App initialization + notification manager
├── server/                # Backend files
│   ├── server.js          # Express + Socket.IO server
│   ├── rooms.js           # Room management logic
│   └── drawing-state.js   # Canvas state & undo/redo management
├── package.json           # Dependencies and scripts
├── README.md              # This file
└── ARCHITECTURE.md        # Technical architecture documentation
```

---

## 🔧 Technical Stack

### Frontend
- **Vanilla JavaScript** - No frameworks, pure DOM manipulation
- **HTML5 Canvas API** - For drawing operations
- **Socket.IO Client** - WebSocket communication

### Backend
- **Node.js** - Runtime environment
- **Express** - Web server
- **Socket.IO** - Real-time bidirectional communication

### Key Libraries
- `express@4.18.2` - Web framework
- `socket.io@4.6.1` - WebSocket library

---

## ⚙️ Configuration

### Port Configuration

Default port is `3000`. To change:

```javascript
// In server/server.js
const PORT = process.env.PORT || 3000;
```

Or set environment variable:
```bash
PORT=8080 npm start
```

### Canvas Size

Canvas automatically resizes to fit container. To customize:

```javascript
// In client/canvas.js - resizeCanvas() method
this.canvas.width = YOUR_WIDTH;
this.canvas.height = YOUR_HEIGHT;
```

---

## 🐛 Known Limitations

### Current Limitations

1. **No Persistence** - Drawings are lost when all users disconnect
2. **Single Room** - All users join the same global room (multi-room ready but not exposed in UI)
3. **No Authentication** - Users assigned random names (User_XXX)
4. **Canvas Size** - Fixed to container size (not responsive to window resize during session)
5. **History Limit** - Undo/redo limited to last 20 actions per room

### Browser Compatibility

- ✅ Chrome (Recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ⚠️ Mobile browsers (touch support included but may have quirks)

---

## 🔍 Troubleshooting

### Server won't start

```bash
# Check if port 3000 is in use
# Windows:
netstat -ano | findstr :3000

# Mac/Linux:
lsof -i :3000

# Kill the process or change port
```

### Can't connect to server

1. Check server is running (see terminal output)
2. Check firewall settings
3. Try `http://localhost:3000` instead of `127.0.0.1:3000`
4. Check browser console (F12) for errors

### Drawing not syncing

1. Check connection status (top of page)
2. Open browser console (F12) and look for errors
3. Check server terminal for connection logs
4. Try refreshing the page

### Undo/Redo not working

1. Make sure you've drawn something first
2. Check browser console for errors
3. Verify server logs show snapshot saving
4. Try drawing a new stroke

---

## 📊 Performance Notes

### Optimizations Implemented

- **Event Throttling** - Cursor position updates throttled to 50ms
- **Canvas Snapshots** - Only stores 20 most recent states
- **Operation Batching** - Drawing operations sent in real-time but batched for history
- **Efficient Redrawing** - Uses canvas snapshots instead of replaying operations

### Scalability Considerations

- Current design handles 10-20 concurrent users per room comfortably
- For 100+ users, consider:
  - Redis for state management
  - WebSocket scaling with Socket.IO adapter
  - CDN for static assets
  - Database for persistence

---

## 🎯 Development

### Adding New Features

See `ARCHITECTURE.md` for detailed information on:
- Data flow diagrams
- WebSocket protocol
- State management
- Adding new drawing tools

### Running in Development Mode

```bash
# With auto-restart on file changes
npm install -g nodemon
nodemon server/server.js
```

---

## 📈 API Endpoints

### REST API

- `GET /` - Serve main application
- `GET /api/rooms` - List all rooms
- `GET /api/stats` - Get server statistics

### WebSocket Events

See `ARCHITECTURE.md` for complete WebSocket protocol documentation.

---

## ⏱️ Time Spent

**Total Development Time: ~8-10 hours**

Breakdown:
- Initial setup and basic canvas: 2 hours
- Real-time synchronization: 2 hours
- Undo/Redo implementation: 3 hours
- UI/UX polish and cursors: 1.5 hours
- Testing and debugging: 1.5 hours

---

## 🙏 Acknowledgments

Built as a technical assessment to demonstrate:
- Vanilla JavaScript proficiency
- Real-time architecture design
- State synchronization strategies
- Clean code organization

---

## 📝 License

MIT License - Feel free to use for learning and portfolio purposes.

---

## 📧 Contact

For questions or feedback about this implementation, please reach out through the GitHub repository.

---

**Note:** This is a demo application built for assessment purposes. For production use, consider adding authentication, persistence, and additional security measures.