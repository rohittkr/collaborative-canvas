# 🎨 Real-Time Collaborative Drawing Canvas

A **multi-user real-time drawing platform** where multiple users can draw simultaneously on the same shared canvas — powered by **Node.js, Express, and Socket.IO** for live WebSocket synchronization.

---

## 🚀 Live Demo

🔗 **Hosted Link:** [https://collaborative-canvas-spoz.onrender.com](https://collaborative-canvas-spoz.onrender.com)

> ⏳ *Note:* The Render free plan may take up to **30–50 seconds to wake up** after inactivity.

---

## 📋 Features

### ✅ Core Functionalities

- 🎯 **Real-time Drawing Sync** — Instant synchronization across all connected clients
- 🖌️ **Drawing Tools** — Brush, Eraser, Color Picker, Adjustable Stroke Size
- 👥 **User Cursors** — Live colored cursors show where others are drawing
- ↩️ **Global Undo/Redo** — Undo or redo actions across all users
- 👤 **User Management** — Auto-generated usernames & color identification
- 🌐 **Multi-tab Support** — Open in multiple tabs for instant collaboration testing
- 📱 **Touch Support** — Works smoothly on mobile & tablet devices
- ⚡ **Connection Health** — Real-time latency display & auto reconnection

---

## 🏗️ Architecture Highlights

- 🧠 **Snapshot-based Undo/Redo System**
- 🧩 **Modular Code Structure** (Separated `rooms.js`, `drawing-state.js`)
- 🕸️ **Socket.IO Real-time Channel** for bi-directional event flow
- 🧱 **Scalable Design** — Supports multiple rooms (UI-ready)
- 🧩 **Cross-device Scaling** — Drawings align consistently across devices

---

## ⚙️ Installation & Setup

### 🧾 Prerequisites

- [Node.js](https://nodejs.org/) (v14+)
- npm (comes with Node)

### 🔧 Steps

```bash
# Clone the repository
git clone https://github.com/rohittkr/collaborative-canvas.git
cd collaborative-canvas

# Install dependencies
npm install

# Start the development server
npm start
