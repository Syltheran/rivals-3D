import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("game.db");

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'player',
    currency INTEGER DEFAULT 1000,
    keys INTEGER DEFAULT 0,
    loadout TEXT DEFAULT 'pistol,revolver,none,none,none,none',
    skin TEXT DEFAULT 'default',
    weapon_skin TEXT DEFAULT 'w_default'
  );

  CREATE TABLE IF NOT EXISTS owned_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    item_id TEXT,
    type TEXT, -- 'weapon' or 'skin'
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";
const userSockets = new Map<string, string>(); // username -> socketId

const MAPS = ["Warehouse", "Cyberpunk", "Desert", "Snow", "Shipyard", "Laboratory", "Temple", "Castle", "Metro", "Rooftop"];
const WEAPONS = [
  { id: "pistol", name: "Pistol", price: 0, keyPrice: 0 },
  { id: "revolver", name: "Revolver", price: 0, keyPrice: 0 },
  { id: "rifle", name: "Assault Rifle", price: 500, keyPrice: 5 },
  { id: "sniper", name: "Sniper", price: 1000, keyPrice: 10 },
  { id: "shotgun", name: "Shotgun", price: 750, keyPrice: 8 },
  { id: "mp5", name: "MP5", price: 600, keyPrice: 6 },
  { id: "magnum", name: "Magnum", price: 400, keyPrice: 4 },
  { id: "omega_gun", name: "Omega Gun", price: 5000, keyPrice: 50 }
];
const SKINS = [
  { id: "default", name: "Default Cube", keyPrice: 0 },
  { id: "smoke", name: "Smoke Cube (Owner)", keyPrice: 0 },
  { id: "gold", name: "Gold Cube", keyPrice: 20 },
  { id: "neon", name: "Neon Cube", keyPrice: 15 },
  { id: "camo", name: "Camo Cube", keyPrice: 10 },
  { id: "ruby", name: "Ruby Cube", keyPrice: 25 }
];
const WEAPON_SKINS = [
  { id: "w_default", name: "Default Skin", keyPrice: 0 },
  { id: "w_gold", name: "Gold Skin", keyPrice: 15 },
  { id: "w_lava", name: "Lava Skin", keyPrice: 20 },
  { id: "w_ice", name: "Ice Skin", keyPrice: 15 }
];

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  app.use(express.json());

  // Auth & User Data
  app.post("/api/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });

    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      const userCount = db.prepare("SELECT count(*) as count FROM users").get() as { count: number };
      const role = userCount.count === 0 ? "owner" : "player";
      
      const info = db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run(username, hashedPassword, role);
      // Give starter weapon
      db.prepare("INSERT INTO owned_items (user_id, item_id, type) VALUES (?, ?, ?)").run(info.lastInsertRowid, "pistol", "weapon");
      
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) {
      res.status(400).json({ error: "Username taken" });
    }
  });

  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;

    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
      res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.post("/api/admin/promote", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET) as any;
      if (decoded.role !== "owner") return res.status(403).json({ error: "Only owner can promote" });
      const { username } = req.body;
      const result = db.prepare("UPDATE users SET role = 'admin' WHERE LOWER(username) = LOWER(?)").run(username);
      if (result.changes === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true });
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.post("/api/admin/give-keys", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET) as any;
      if (decoded.role !== "owner" && decoded.role !== "admin") return res.status(403).json({ error: "Unauthorized" });
      const { username, amount } = req.body;
      const parsedAmount = parseInt(amount);
      if (isNaN(parsedAmount)) return res.status(400).json({ error: "Invalid amount" });
      
      const result = db.prepare("UPDATE users SET keys = keys + ? WHERE LOWER(username) = LOWER(?)").run(parsedAmount, username);
      
      if (result.changes === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      // Notify user if online (need to find their actual username casing for the map)
      const actualUser = db.prepare("SELECT username FROM users WHERE LOWER(username) = LOWER(?)").get(username) as any;
      if (actualUser) {
        const targetSocketId = userSockets.get(actualUser.username);
        if (targetSocketId) {
          io.to(targetSocketId).emit("keysUpdated", { amount: parsedAmount });
        }
      }

      res.json({ success: true });
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.post("/api/admin/give-weapon", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET) as any;
      if (decoded.role !== "owner" && decoded.role !== "admin") return res.status(403).json({ error: "Unauthorized" });
      const { username, weaponId } = req.body;
      const user = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as any;
      if (!user) return res.status(404).json({ error: "User not found" });
      
      // Check if already owns
      const existing = db.prepare("SELECT id FROM owned_items WHERE user_id = ? AND item_id = ?").get(user.id, weaponId);
      if (!existing) {
        db.prepare("INSERT INTO owned_items (user_id, item_id, type) VALUES (?, ?, ?)").run(user.id, weaponId, "weapon");
      }
      res.json({ success: true });
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.get("/api/user/data", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET) as any;
      const user = db.prepare("SELECT id, username, role, currency, keys, loadout, skin, weapon_skin FROM users WHERE id = ?").get(decoded.id) as any;
      const items = db.prepare("SELECT item_id, type FROM owned_items WHERE user_id = ?").all(decoded.id);
      res.json({ user, items, availableWeapons: WEAPONS, availableSkins: SKINS, availableWeaponSkins: WEAPON_SKINS });
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.post("/api/user/update-loadout", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET) as any;
      const { loadout, skin, weapon_skin } = req.body;
      if (loadout) db.prepare("UPDATE users SET loadout = ? WHERE id = ?").run(loadout, decoded.id);
      if (skin) db.prepare("UPDATE users SET skin = ? WHERE id = ?").run(skin, decoded.id);
      if (weapon_skin) db.prepare("UPDATE users SET weapon_skin = ? WHERE id = ?").run(weapon_skin, decoded.id);
      res.json({ success: true });
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.post("/api/shop/buy-with-keys", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET) as any;
      const { itemId, type } = req.body;
      
      let item;
      if (type === 'weapon') item = WEAPONS.find(w => w.id === itemId);
      else if (type === 'skin') item = SKINS.find(s => s.id === itemId);
      else if (type === 'weapon_skin') item = WEAPON_SKINS.find(s => s.id === itemId);

      if (!item) return res.status(404).json({ error: "Item not found" });

      const user = db.prepare("SELECT keys FROM users WHERE id = ?").get(decoded.id) as any;
      if (user.keys < item.keyPrice) return res.status(400).json({ error: "Not enough keys" });

      // Check if already owned
      const existing = db.prepare("SELECT id FROM owned_items WHERE user_id = ? AND item_id = ?").get(decoded.id, itemId);
      if (existing) return res.status(400).json({ error: "Already owned" });

      db.prepare("UPDATE users SET keys = keys - ? WHERE id = ?").run(item.keyPrice, decoded.id);
      db.prepare("INSERT INTO owned_items (user_id, item_id, type) VALUES (?, ?, ?)").run(decoded.id, itemId, type);
      
      res.json({ success: true });
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // Shop & Missions
  app.post("/api/shop/buy-key", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET) as any;
      const user = db.prepare("SELECT currency FROM users WHERE id = ?").get(decoded.id) as any;
      if (user.currency < 200) return res.status(400).json({ error: "Not enough currency" });
      
      db.prepare("UPDATE users SET currency = currency - 200, keys = keys + 1 WHERE id = ?").run(decoded.id);
      res.json({ success: true });
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.post("/api/missions/claim", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET) as any;
      db.prepare("UPDATE users SET currency = currency + 100 WHERE id = ?").run(decoded.id);
      res.json({ success: true, reward: 100 });
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // Game State
  const rooms: Record<string, { name: string, map: string, startingWeapon: string, players: Record<string, any> }> = {};

  const botInterval = setInterval(() => {
    Object.keys(rooms).forEach(roomId => {
      const room = rooms[roomId];
      const botIds = Object.keys(room.players).filter(id => room.players[id].isBot);
      
      // Add bots if less than 3
      if (botIds.length < 3) {
        const botId = `bot_${Math.random().toString(36).substr(2, 5)}`;
        room.players[botId] = {
          id: botId,
          username: `Bot_${botId.split('_')[1]}`,
          role: 'player',
          position: { x: Math.random() * 20 - 10, y: 0, z: Math.random() * 20 - 10 },
          rotation: { y: Math.random() * Math.PI * 2 },
          health: 100,
          weapon: 'rifle',
          loadout: ['rifle', 'pistol', 'none', 'none'],
          skin: 'default',
          isBot: true
        };
        io.to(roomId).emit("players", room.players);
      }

      botIds.forEach(botId => {
        const bot = room.players[botId];
        // Movement
        const speed = 0.5; // Faster bots
        bot.position.x += Math.cos(bot.rotation.y) * speed;
        bot.position.z += Math.sin(bot.rotation.y) * speed;
        
        // Keep in bounds
        if (Math.abs(bot.position.x) > 150 || Math.abs(bot.position.z) > 150) {
          bot.rotation.y += Math.PI;
        }

        // Randomly change direction or target player
        if (Math.random() < 0.05) {
          const players = Object.keys(room.players).filter(id => !room.players[id].isBot);
          if (players.length > 0) {
            const targetId = players[Math.floor(Math.random() * players.length)];
            const target = room.players[targetId];
            const dx = target.position.x - bot.position.x;
            const dz = target.position.z - bot.position.z;
            bot.rotation.y = Math.atan2(dz, dx) + (Math.random() - 0.5) * 0.5;
          } else {
            bot.rotation.y = Math.random() * Math.PI * 2;
          }
        }

        // Randomly shoot
        if (Math.random() < 0.1) {
          const players = Object.keys(room.players).filter(id => !room.players[id].isBot);
          if (players.length > 0) {
            const targetId = players[Math.floor(Math.random() * players.length)];
            const target = room.players[targetId];
            const dx = target.position.x - bot.position.x;
            const dz = target.position.z - bot.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            
            if (dist < 50) { // Only shoot if close
              bot.rotation.y = Math.atan2(dz, dx);
              
              io.to(roomId).emit("shoot", { 
                id: botId, 
                position: bot.position, 
                direction: { x: Math.cos(bot.rotation.y), z: Math.sin(bot.rotation.y) },
                weapon: bot.weapon
              });

              // Simple hit chance
              if (Math.random() < 0.2) {
                target.health -= 10;
                if (target.health <= 0) {
                  target.health = 100;
                  const newPos = { x: Math.random() * 40 - 20, y: 0, z: Math.random() * 40 - 20 };
                  target.position = newPos;
                  io.to(roomId).emit("playerDied", { victimId: targetId, killerId: botId, newPosition: newPos });
                }
                io.to(roomId).emit("healthUpdate", { id: targetId, health: target.health });
              }
            }
          }
        }
      });

      if (botIds.length > 0) {
        io.to(roomId).emit("players", room.players);
      }
    });
  }, 100);

  io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    socket.on("registerSocket", (username) => {
      userSockets.set(username, socket.id);
    });

    socket.on("createRoom", (data) => {
      const roomId = `room_${Math.random().toString(36).substr(2, 9)}`;
      rooms[roomId] = {
        name: data.name || "New Round",
        map: data.map || "Warehouse",
        startingWeapon: data.startingWeapon || "pistol",
        players: {}
      };
      io.emit("roomList", Object.entries(rooms).map(([id, r]) => ({ id, name: r.name, map: r.map, playerCount: Object.keys(r.players).length })));
      socket.emit("roomCreated", roomId);
    });

    socket.on("getRooms", () => {
      socket.emit("roomList", Object.entries(rooms).map(([id, r]) => ({ id, name: r.name, map: r.map, playerCount: Object.keys(r.players).length })));
    });

    socket.on("joinRoom", (data) => {
      const room = rooms[data.roomId];
      if (!room) return socket.emit("error", "Room not found");
      
      socket.join(data.roomId);
      room.players[socket.id] = {
        id: socket.id,
        username: data.username,
        role: data.role,
        position: { x: 0, y: 0, z: 0 },
        rotation: { y: 0 },
        health: 100,
        weapon: room.startingWeapon || data.weapon || "pistol",
        loadout: data.loadout || ["pistol", "revolver", "none", "none", "none", "none"],
        skin: data.skin || "default"
      };
      
      io.to(data.roomId).emit("players", room.players);
      socket.emit("mapUpdate", room.map);
      
      // Broadcast updated room list to everyone in lobby
      io.emit("roomList", Object.entries(rooms).map(([id, r]) => ({ 
        id, 
        name: r.name, 
        map: r.map, 
        playerCount: Object.keys(r.players).length 
      })));
    });

    socket.on("updateWeapon", (data) => {
      const room = rooms[data.roomId];
      if (room && room.players[socket.id]) {
        room.players[socket.id].weapon = data.weapon;
      }
    });

    socket.on("chatMessage", (data) => {
      const room = rooms[data.roomId];
      if (room && room.players[socket.id]) {
        io.to(data.roomId).emit("chatMessage", {
          username: room.players[socket.id].username,
          role: room.players[socket.id].role,
          text: data.text,
          timestamp: Date.now()
        });
      }
    });

    socket.on("move", (data) => {
      const room = rooms[data.roomId];
      if (room && room.players[socket.id]) {
        room.players[socket.id].position = data.position;
        room.players[socket.id].rotation = data.rotation;
        socket.to(data.roomId).emit("playerMoved", { id: socket.id, ...data });
      }
    });

    socket.on("hit", (data) => {
      const room = rooms[data.roomId];
      if (!room) return;
      const target = room.players[data.targetId];
      const shooter = room.players[socket.id];
      if (!target || !shooter) return;

      let damage = 20;
      if (data.weapon === "revolver") damage = 35;
      if (data.weapon === "magnum") damage = 45;
      if (data.weapon === "rifle") damage = 25;
      if (data.weapon === "mp5") damage = 18;
      if (data.weapon === "sniper") damage = 100;
      if (data.weapon === "shotgun") damage = 40;
      if (data.weapon === "omega_gun") damage = 1000;

      target.health -= damage;
      if (target.health <= 0) {
        target.health = 100;
        const newPos = { x: Math.random() * 20 - 10, y: 0, z: Math.random() * 20 - 10 };
        target.position = newPos;
        io.to(data.roomId).emit("playerDied", { victimId: data.targetId, killerId: socket.id, newPosition: newPos });
      }
      io.to(data.roomId).emit("healthUpdate", { id: data.targetId, health: target.health });
    });

    socket.on("nuke", (data) => {
      // Nuke functionality removed
    });

    socket.on("disconnect", () => {
      // Remove from userSockets
      for (const [username, id] of userSockets.entries()) {
        if (id === socket.id) {
          userSockets.delete(username);
          break;
        }
      }

      Object.keys(rooms).forEach(roomId => {
        if (rooms[roomId].players[socket.id]) {
          delete rooms[roomId].players[socket.id];
          io.to(roomId).emit("playerDisconnected", socket.id);
          if (Object.keys(rooms[roomId].players).length === 0) {
            delete rooms[roomId];
            io.emit("roomList", Object.entries(rooms).map(([id, r]) => ({ id, name: r.name, map: r.map, playerCount: Object.keys(r.players).length })));
          }
        }
      });
    });
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
