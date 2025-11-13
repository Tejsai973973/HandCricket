# 🏏 Hand Cricket: Ultimate Number Cricket Experience ⚡

**Hand Cricket** is a real-time multiplayer number-based cricket game built with Node.js, Express, and Socket.IO. It transforms the classic classroom hand-cricket into a competitive, modern digital sport with live batting/bowling, tournaments, and AI opponents.

---

## 🚀 Live Demo & How to Play

The game is currently deployed and live on Render.

**Live URL:** `https://hand-cricket-of04.onrender.com`

### Multiplayer Setup (The intended experience)

1. Open the **Live URL** on your device.  
2. Share the **exact same URL** with a friend.  
3. Both players enter their **Username** on the Setup screen.  
4. **Player 1 (Host):** Click **Multiplayer → Create Room** to get a 5-digit Room ID.  
5. **Player 2 (Joiner):** Enters the Room ID and clicks **Join Room**.  
6. The live cricket match begins instantly — ball by ball, fully synced!

---

## 💡 Core Mechanics (Advanced Hand Cricket Rules)

This is not the basic hand cricket you played in school — this version includes overs, wickets, prediction strategy, and real-time sync.

### 1. Scoring & Dismissal Rules

| Event | Condition | Effect |
|------|-----------|--------|
| **OUT!** | Bowler number = Batsman number | Wicket falls immediately |
| **Runs** | Numbers differ | Runs added = Batsman’s number |
| **Innings End** | 10 wickets OR 30 balls (5 overs) | Switch to next innings |
| **Victory** | After 2 innings | Higher score wins |

### 2. Live Match Flow

- Toss → Winner chooses **Bat** or **Bowl**  
- First innings sets the **target**  
- Second innings is a **live chase**  
- Automatic winner detection  
- Full real-time sync with Socket.IO  

### 3. Game Modes

#### 🤖 Player vs AI  
Three difficulty levels:

| Difficulty | Behavior |
|-----------|----------|
| **Easy** | Random numbers |
| **Medium** | Learns patterns |
| **Hard** | Predictive + anti-pattern logic |

#### 👥 1v1 Online  
- Create or Join Room  
- Share Room ID  
- Real-time synced gameplay  

#### 🏆 Tournament Mode  
Supports **4, 8, or 16 players**:

- Auto-generating brackets  
- Random seeding  
- Progressive knockout rounds  
- Winners advance automatically  
- Live bracket viewer  

---

## 🛠️ Technology Stack & Setup

The game uses WebSockets to deliver real-time cricket gameplay.

- **Backend:** Node.js + Express  
- **Realtime:** Socket.IO  
- **Frontend:** HTML5, CSS3, JavaScript  
- **Deployment:** Render  

---

## ⚙️ Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/hand-cricket.git
   cd hand-cricket

2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Start the server:**
    ```bash
    npm start
    ```
4.  Open your browser to `http://localhost:3000`. Use an incognito window or another device to simulate a second player.

---



Made with ❤️ for cricket lovers everywhere.

