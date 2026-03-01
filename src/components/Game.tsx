import React, { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Shield, Target, Zap } from "lucide-react";
import HUD from "./HUD";
import { translations, Language } from "../translations";
import { Joystick } from "react-joystick-component";

interface GameProps {
  user: any;
  roomId: string;
}

export default function Game({ user, roomId }: GameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [health, setHealth] = useState(100);
  const [isMobile, setIsMobile] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [currentMap, setCurrentMap] = useState("Warehouse");
  const currentMapRef = useRef("Warehouse");

  const MAP_THEMES: Record<string, any> = {
    "Warehouse": { bg: "#0f172a", grid: "rgba(255,255,255,0.03)", obs: ["#334155", "#475569", "#1e293b"] },
    "Cyberpunk": { bg: "#020617", grid: "rgba(236,72,153,0.1)", obs: ["#701a75", "#4a044e", "#1e1b4b"] },
    "Desert": { bg: "#451a03", grid: "rgba(251,191,36,0.1)", obs: ["#78350f", "#92400e", "#b45309"] },
    "Snow": { bg: "#f8fafc", grid: "rgba(56,189,248,0.2)", obs: ["#e2e8f0", "#cbd5e1", "#94a3b8"] },
    "Shipyard": { bg: "#1c1917", grid: "rgba(120,113,108,0.1)", obs: ["#44403c", "#292524", "#57534e"] },
    "Laboratory": { bg: "#f1f5f9", grid: "rgba(14,165,233,0.1)", obs: ["#ffffff", "#e2e8f0", "#94a3b8"] },
    "Temple": { bg: "#064e3b", grid: "rgba(16,185,129,0.1)", obs: ["#065f46", "#047857", "#059669"] },
    "Castle": { bg: "#171717", grid: "rgba(255,255,255,0.05)", obs: ["#262626", "#404040", "#525252"] },
    "Metro": { bg: "#0c0a09", grid: "rgba(168,162,158,0.1)", obs: ["#292524", "#44403c", "#57534e"] },
    "Rooftop": { bg: "#075985", grid: "rgba(255,255,255,0.2)", obs: ["#0c4a6e", "#0369a1", "#0284c7"] }
  };
  const [userData, setUserData] = useState<any>(null);
  const [currentWeaponIndex, setCurrentWeaponIndex] = useState(0);
  const currentWeaponIndexRef = useRef(0);
  const [lastShootTimeState, setLastShootTimeState] = useState(0);
  const [showStartModal, setShowStartModal] = useState(true);
  const showStartModalRef = useRef(true);
  const userDataRef = useRef<any>(null);
  const [lang] = useState<Language>((localStorage.getItem("lang") as Language) || "en");
  const t = translations[lang];
  const socketRef = useRef<Socket | null>(null);
  
  const [joystickData, setJoystickData] = useState<{ x: number, y: number } | null>(null);
  const joystickDataRef = useRef<{ x: number, y: number } | null>(null);
  const shootRef = useRef<() => void>(() => {});
  
  const playersRef = useRef<Record<string, any>>({});
  const obstaclesRef = useRef<any[]>([]);
  const bulletsRef = useRef<any[]>([]);
  const playerPos = useRef({ x: 0, y: 0 });
  const playerRotation = useRef(0);
  const mousePos = useRef({ x: 0, y: 0 });
  const lastShootTime = useRef(0);
  const muzzleFlashRef = useRef<number>(0);
  const recoilRef = useRef<number>(0);
  const tracersRef = useRef<any[]>([]);
  const shakeRef = useRef<number>(0);
  const hitEffectsRef = useRef<any[]>([]);
  const switchEffectRef = useRef<number>(0);
  const smokeParticlesRef = useRef<any[]>([]);

  useEffect(() => {
    const fetchUserData = async () => {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/user/data", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUserData(data);
        userDataRef.current = data;
      }
    };
    fetchUserData();
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    checkMobile();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const generateObstacles = (mapName: string) => {
      const theme = MAP_THEMES[mapName] || MAP_THEMES["Warehouse"];
      const obstacles: any[] = [];
      const seed = mapName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      let currentSeed = seed;
      const seededRandom = () => {
        currentSeed = (currentSeed * 9301 + 49297) % 233280;
        return currentSeed / 233280;
      };

      for (let i = 0; i < 60; i++) {
        const size = Math.floor(seededRandom() * 60) + 40;
        obstacles.push({
          x: Math.floor(seededRandom() * 3000 - 1500),
          y: Math.floor(seededRandom() * 3000 - 1500),
          w: size,
          h: size,
          color: theme.obs[Math.floor(seededRandom() * theme.obs.length)]
        });
      }
      obstaclesRef.current = obstacles;
    };

    generateObstacles(currentMap);

    const keys = { w: false, a: false, s: false, d: false };
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT") return;
      if (e.key.toLowerCase() in keys) keys[e.key.toLowerCase() as keyof typeof keys] = true;
      
      const loadout = userDataRef.current?.user?.loadout?.split(",") || ["pistol", "revolver", "none", "none", "none", "none"];
      const selectSlot = (idx: number) => {
        if (loadout[idx] && loadout[idx] !== 'none') {
          setCurrentWeaponIndex(idx);
          currentWeaponIndexRef.current = idx;
          switchEffectRef.current = 10;
        }
      };

      if (e.key === "1") selectSlot(0);
      if (e.key === "2") selectSlot(1);
      if (e.key === "3") selectSlot(2);
      if (e.key === "4") selectSlot(3);
      if (e.key === "5") selectSlot(4);
      if (e.key === "6") selectSlot(5);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() in keys) keys[e.key.toLowerCase() as keyof typeof keys] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const onMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMouseMove);

    const onWheel = (e: WheelEvent) => {
      const loadout = userDataRef.current?.user?.loadout?.split(",") || ["pistol", "revolver", "none", "none", "none", "none"];
      let nextIdx = currentWeaponIndexRef.current + (e.deltaY > 0 ? 1 : -1);
      
      // Wrap around
      if (nextIdx < 0) nextIdx = loadout.length - 1;
      if (nextIdx >= loadout.length) nextIdx = 0;
      
      // Skip 'none' slots
      let attempts = 0;
      while (loadout[nextIdx] === 'none' && attempts < loadout.length) {
        nextIdx = nextIdx + (e.deltaY > 0 ? 1 : -1);
        if (nextIdx < 0) nextIdx = loadout.length - 1;
        if (nextIdx >= loadout.length) nextIdx = 0;
        attempts++;
      }

      setCurrentWeaponIndex(nextIdx);
      currentWeaponIndexRef.current = nextIdx;
    };
    window.addEventListener("wheel", onWheel);

    const socket = io();
    socketRef.current = socket;

    socket.on("connect", () => {
      // Don't join immediately, wait for modal
    });

    const joinGame = () => {
      const freshUser = userDataRef.current?.user || user;
      const loadout = freshUser.loadout?.split(",") || ["pistol", "revolver", "none", "none"];
      const skin = freshUser.skin || "default";
      const weapon = loadout[currentWeaponIndexRef.current] || "pistol";
      socket.emit("joinRoom", { roomId, username: freshUser.username, role: freshUser.role, weapon, loadout, skin });
      setShowStartModal(false);
      showStartModalRef.current = false;
    };

    socket.on("mapUpdate", (mapName) => {
      setCurrentMap(mapName);
      currentMapRef.current = mapName;
      generateObstacles(mapName);
    });
    socket.on("chatMessage", (msg) => setMessages(prev => [...prev.slice(-50), msg]));
    socket.on("players", (allPlayers) => { playersRef.current = allPlayers; });
    socket.on("playerMoved", (data) => {
      if (playersRef.current[data.id]) {
        playersRef.current[data.id].position = data.position;
        playersRef.current[data.id].rotation = data.rotation;
        playersRef.current[data.id].weapon = data.weapon;
      }
    });
    socket.on("playerDisconnected", (id) => { delete playersRef.current[id]; });
    socket.on("playerDied", (data) => {
      if (data.victimId === socket.id) {
        playerPos.current = { x: data.newPosition.x * 10, y: data.newPosition.z * 10 };
        setHealth(100);
      } else if (playersRef.current[data.victimId]) {
        playersRef.current[data.victimId].position = { x: data.newPosition.x * 10, y: 0, z: data.newPosition.z * 10 };
      }
    });
    socket.on("healthUpdate", (data) => {
      if (data.id === socket.id) setHealth(data.health);
    });

    const handleJoinGameEvent = () => joinGame();
    window.addEventListener('joinGame', handleJoinGameEvent);

    socket.on("shoot", (data) => {
      // Don't add bullet if it's our own (already predicted locally)
      if (data.id === socket.id) return;

      // Add bullet projectile
      bulletsRef.current.push({
        x: data.position.x * 10,
        y: data.position.z * 10,
        vx: data.direction.x * 800, // Slightly slower for visibility
        vy: data.direction.z * 800,
        life: 1.5,
        ownerId: data.id,
        trail: []
      });

      // Add tracer (instant flash)
      tracersRef.current.push({
        x1: data.position.x * 10,
        y1: data.position.z * 10,
        x2: data.position.x * 10 + data.direction.x * 150, // Short flash
        y2: data.position.z * 10 + data.direction.z * 150,
        alpha: 0.8
      });
    });

    const shoot = (e?: MouseEvent | React.TouchEvent | React.MouseEvent) => {
      // Prevent shooting if clicking on UI elements
      if (e && (e.target as HTMLElement).closest('.pointer-events-auto')) return;
      
      if (showStartModalRef.current) return;
      
      const loadout = userDataRef.current?.user?.loadout?.split(",") || ["pistol", "revolver", "none", "none", "none", "none"];
      const currentWeapon = loadout[currentWeaponIndexRef.current];
      if (!currentWeapon || currentWeapon === 'none') return;

      const now = performance.now();
      const fireRate = 200;
      if (now - lastShootTime.current < fireRate) return; // Fire rate
      lastShootTime.current = now;
      setLastShootTimeState(now);
      muzzleFlashRef.current = 5; // Show for 5 frames
      recoilRef.current = 10; // Recoil amount
      shakeRef.current = 5; // Screen shake amount

      const angle = playerRotation.current;
      const dir = { x: Math.cos(angle), z: Math.sin(angle) };
      const pos = { x: playerPos.current.x / 10, y: 0, z: playerPos.current.y / 10 };
      
      socket.emit("shoot", { roomId, position: pos, direction: dir, weapon: currentWeapon });
      
      // Local bullet prediction for instant feedback
      bulletsRef.current.push({
        x: playerPos.current.x,
        y: playerPos.current.y,
        vx: dir.x * 800,
        vy: dir.z * 800,
        life: 1.5,
        ownerId: socket.id,
        trail: []
      });

      // Hit detection
      Object.keys(playersRef.current).forEach(id => {
        if (id === socket.id) return;
        const p = playersRef.current[id];
        const dx = p.position.x * 10 - playerPos.current.x;
        const dy = p.position.z * 10 - playerPos.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const targetAngle = Math.atan2(dy, dx);
        
        const angleDiff = Math.abs(targetAngle - angle);
        const normalizedDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);
        
        if (dist < 500 && normalizedDiff < 0.15) {
          socket.emit("hit", { roomId, targetId: id, weapon: currentWeapon });
          // Local hit effect
          hitEffectsRef.current.push({
            x: p.position.x * 10,
            y: p.position.z * 10,
            life: 1.0
          });
        }
      });
    };
    shootRef.current = shoot;
    window.addEventListener("mousedown", shoot);

    let lastTime = performance.now();
    const animate = (time: number) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      // Movement
      const speed = 300;
      let dx = 0, dy = 0;
      
      if (joystickDataRef.current) {
        dx = joystickDataRef.current.x;
        dy = -joystickDataRef.current.y;
      } else {
        if (keys.w) dy -= 1;
        if (keys.s) dy += 1;
        if (keys.a) dx -= 1;
        if (keys.d) dx += 1;
      }
      
      if (dx !== 0 || dy !== 0) {
        const mag = Math.sqrt(dx * dx + dy * dy);
        playerPos.current.x += (dx / mag) * speed * delta;
        playerPos.current.y += (dy / mag) * speed * delta;
      }

      // Rotation
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      
      if (joystickDataRef.current && (Math.abs(joystickDataRef.current.x) > 0.1 || Math.abs(joystickDataRef.current.y) > 0.1)) {
        playerRotation.current = Math.atan2(-joystickDataRef.current.y, joystickDataRef.current.x);
      } else if (!isMobile) {
        playerRotation.current = Math.atan2(mousePos.current.y - centerY, mousePos.current.x - centerX);
      }

      const loadout = userDataRef.current?.user?.loadout?.split(",") || ["pistol", "revolver", "none", "none", "none", "none"];
      const currentWeapon = loadout[currentWeaponIndexRef.current];

      socket.emit("move", {
        roomId,
        position: { x: playerPos.current.x / 10, y: 0, z: playerPos.current.y / 10 },
        rotation: { y: playerRotation.current },
        weapon: currentWeapon
      });

      // Bullets update
      bulletsRef.current = bulletsRef.current.filter(b => {
        // Store trail
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 5) b.trail.shift();

        b.x += b.vx * delta;
        b.y += b.vy * delta;
        b.life -= delta;
        return b.life > 0;
      });

      // Tracers update
      tracersRef.current = tracersRef.current.filter(t => {
        t.alpha -= delta * 5;
        return t.alpha > 0;
      });

      // Recoil update
      if (recoilRef.current > 0) recoilRef.current -= delta * 100;
      if (recoilRef.current < 0) recoilRef.current = 0;

      // Shake update
      if (shakeRef.current > 0) shakeRef.current -= delta * 20;
      if (shakeRef.current < 0) shakeRef.current = 0;

      // Switch effect update
      if (switchEffectRef.current > 0) switchEffectRef.current -= delta * 50;
      if (switchEffectRef.current < 0) switchEffectRef.current = 0;

      // Hit effects update
      hitEffectsRef.current = hitEffectsRef.current.filter(h => {
        h.life -= delta * 3;
        return h.life > 0;
      });

      // Smoke particles update
      smokeParticlesRef.current = smokeParticlesRef.current.filter(p => {
        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.life -= delta;
        p.size += delta * 10;
        return p.life > 0;
      });

      // Generate smoke for players with smoke skin
      Object.keys(playersRef.current).forEach(id => {
        const p = playersRef.current[id];
        if (p.skin === 'smoke') {
          if (Math.random() < 0.3) {
            smokeParticlesRef.current.push({
              x: p.position.x * 10,
              y: p.position.z * 10,
              vx: (Math.random() - 0.5) * 20,
              vy: (Math.random() - 0.5) * 20,
              life: 1.0 + Math.random(),
              size: 5 + Math.random() * 5,
              color: `rgba(200, 200, 200, ${0.2 + Math.random() * 0.3})`
            });
          }
        }
      });

      // Local player smoke
      if (userDataRef.current?.user?.skin === 'smoke') {
        if (Math.random() < 0.3) {
          smokeParticlesRef.current.push({
            x: playerPos.current.x,
            y: playerPos.current.y,
            vx: (Math.random() - 0.5) * 20,
            vy: (Math.random() - 0.5) * 20,
            life: 1.0 + Math.random(),
            size: 5 + Math.random() * 5,
            color: `rgba(200, 200, 200, ${0.2 + Math.random() * 0.3})`
          });
        }
      }

      // Render
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const theme = MAP_THEMES[currentMapRef.current] || MAP_THEMES["Warehouse"];
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      const shakeX = (Math.random() - 0.5) * shakeRef.current;
      const shakeY = (Math.random() - 0.5) * shakeRef.current;
      ctx.translate(centerX - playerPos.current.x + shakeX, centerY - playerPos.current.y + shakeY);

      // Floor Grid
      ctx.strokeStyle = theme.grid;
      ctx.lineWidth = 1;
      for (let x = -2000; x <= 2000; x += 100) {
        ctx.beginPath(); ctx.moveTo(x, -2000); ctx.lineTo(x, 2000); ctx.stroke();
      }
      for (let y = -2000; y <= 2000; y += 100) {
        ctx.beginPath(); ctx.moveTo(-2000, y); ctx.lineTo(2000, y); ctx.stroke();
      }

      // Obstacles
      obstaclesRef.current.forEach(obs => {
        ctx.fillStyle = obs.color;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      });

      // Smoke particles
      smokeParticlesRef.current.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Tracers
      tracersRef.current.forEach(t => {
        ctx.strokeStyle = `rgba(251, 191, 36, ${t.alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(t.x1, t.y1);
        ctx.lineTo(t.x2, t.y2);
        ctx.stroke();
      });

      // Bullets
      bulletsRef.current.forEach(b => {
        // Draw trail
        if (b.trail.length > 1) {
          ctx.beginPath();
          ctx.strokeStyle = "rgba(251, 191, 36, 0.3)";
          ctx.lineWidth = 2;
          ctx.moveTo(b.trail[0].x, b.trail[0].y);
          for (let i = 1; i < b.trail.length; i++) {
            ctx.lineTo(b.trail[i].x, b.trail[i].y);
          }
          ctx.stroke();
        }

        // Draw bullet head
        ctx.fillStyle = "#fbbf24";
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#fbbf24";
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Hit Effects
      hitEffectsRef.current.forEach(h => {
        ctx.fillStyle = `rgba(239, 68, 68, ${h.life})`;
        ctx.beginPath();
        ctx.arc(h.x, h.y, 20 * (1 - h.life), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 255, 255, ${h.life})`;
        ctx.stroke();
      });

      // Other Players
      Object.keys(playersRef.current).forEach(id => {
        if (id === socket.id) return;
        const p = playersRef.current[id];
        ctx.save();
        ctx.translate(p.position.x * 10, p.position.z * 10);
        ctx.rotate(p.rotation.y);
        
        // Player Body (Skin)
        const pSkin = p.skin || 'default';
        ctx.fillStyle = pSkin === 'gold' ? "#fbbf24" : pSkin === 'neon' ? "#22d3ee" : pSkin === 'ruby' ? "#ef4444" : pSkin === 'smoke' ? "#71717a" : (p.role === 'owner' ? "#ef4444" : "#22c55e");
        if (pSkin === 'neon') {
          ctx.shadowBlur = 15;
          ctx.shadowColor = "rgba(34,211,238,0.5)";
        }
        ctx.fillRect(-20, -20, 40, 40);
        ctx.shadowBlur = 0;

        // Weapon
        if (p.weapon && p.weapon !== 'none') {
          ctx.fillStyle = p.weapon === 'revolver' ? "#64748b" : p.weapon === 'rifle' ? "#1e293b" : "#475569";
          const gunLen = p.weapon === 'rifle' ? 35 : p.weapon === 'revolver' ? 22 : 25;
          const gunWid = p.weapon === 'revolver' ? 8 : 6;
          ctx.fillRect(15, 5, gunLen, gunWid);
        }

        ctx.fillStyle = "#fff";
        ctx.fillRect(12, -4, 12, 8); // Eyes
        ctx.restore();
        
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        const displayName = `${p.username} [${(p.role || 'player').toUpperCase()}]`;
        const nameWidth = ctx.measureText(displayName).width;
        ctx.fillRect(p.position.x * 10 - nameWidth / 2 - 4, p.position.z * 10 - 48, nameWidth + 8, 16);
        
        ctx.fillStyle = p.role === 'owner' ? "#ef4444" : p.role === 'admin' ? "#10b981" : "#fff";
        ctx.font = "bold 12px Inter";
        ctx.textAlign = "center";
        ctx.fillText(displayName, p.position.x * 10, p.position.z * 10 - 35);
        
        // Health bar
        ctx.fillStyle = "#000";
        ctx.fillRect(p.position.x * 10 - 20, p.position.z * 10 - 30, 40, 4);
        ctx.fillStyle = p.health > 30 ? "#10b981" : "#ef4444";
        ctx.fillRect(p.position.x * 10 - 20, p.position.z * 10 - 30, (p.health / 100) * 40, 4);
      });

      // Local Player
      ctx.save();
      ctx.translate(playerPos.current.x, playerPos.current.y);
      ctx.rotate(playerRotation.current);
      
      // Recoil offset
      ctx.translate(-recoilRef.current, 0);

      // Player Body (Skin)
      const mySkin = userDataRef.current?.user?.skin || 'default';
      const switchScale = 1 + (switchEffectRef.current / 50);
      ctx.scale(switchScale, switchScale);
      
      ctx.fillStyle = mySkin === 'gold' ? "#fbbf24" : mySkin === 'neon' ? "#22d3ee" : mySkin === 'ruby' ? "#ef4444" : mySkin === 'smoke' ? "#71717a" : (user.role === 'owner' ? "#ef4444" : "#3b82f6");
      if (mySkin === 'neon') {
        ctx.shadowBlur = 15;
        ctx.shadowColor = "rgba(34,211,238,0.5)";
      }
      ctx.fillRect(-20, -20, 40, 40);
      ctx.shadowBlur = 0;

      // Weapon
      if (currentWeapon && currentWeapon !== 'none') {
        ctx.fillStyle = currentWeapon === 'revolver' ? "#64748b" : 
                        currentWeapon === 'rifle' ? "#1e293b" : 
                        currentWeapon === 'mp5' ? "#334155" : 
                        currentWeapon === 'magnum' ? "#475569" : "#475569";
        
        const gunLen = currentWeapon === 'rifle' ? 35 : 
                       currentWeapon === 'mp5' ? 28 : 
                       currentWeapon === 'revolver' ? 22 : 
                       currentWeapon === 'magnum' ? 25 : 25;
        
        const gunWid = currentWeapon === 'revolver' ? 8 : 
                       currentWeapon === 'magnum' ? 6 : 6;
        
        ctx.fillRect(15, 5, gunLen, gunWid);

        // Muzzle Flash
        if (muzzleFlashRef.current > 0) {
          ctx.fillStyle = "#fbbf24";
          ctx.beginPath();
          ctx.arc(gunLen + 20, 8, 8 + Math.random() * 5, 0, Math.PI * 2);
          ctx.fill();
          muzzleFlashRef.current--;
        }
      }

      ctx.fillStyle = "#fff";
      ctx.fillRect(12, -4, 12, 8); // Eyes
      ctx.restore();

      ctx.restore();

      requestAnimationFrame(animate);
    };
    const animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("mousedown", shoot);
      window.removeEventListener('joinGame', handleJoinGameEvent);
      socket.disconnect();
    };
  }, [user, roomId]);

  const sendChatMessage = (text: string) => {
    socketRef.current?.emit("chatMessage", { roomId, text });
  };

  const handleLeave = () => {
    window.location.href = "/";
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0a0a]">
      <canvas ref={canvasRef} className="w-full h-full" />
      
      <HUD 
        health={health} 
        user={userData?.user || user} 
        isMobile={isMobile} 
        messages={messages} 
        onSendMessage={sendChatMessage}
        onLeave={handleLeave}
        currentMap={currentMap}
        ownedItems={userDataRef.current?.items}
        loadout={userDataRef.current?.user?.loadout?.split(",") || ["pistol", "revolver", "none", "none", "none", "none"]}
        currentWeaponIndex={currentWeaponIndex}
        onSelectWeapon={(idx) => {
          setCurrentWeaponIndex(idx);
          currentWeaponIndexRef.current = idx;
          switchEffectRef.current = 10;
        }}
        lastShootTime={lastShootTimeState}
      />

      {isMobile && !showStartModal && (
        <>
          <div className="absolute bottom-12 left-12 pointer-events-auto">
            <Joystick 
              size={100} 
              sticky={false} 
              baseColor="rgba(0,0,0,0.5)" 
              stickColor="rgba(16,185,129,0.5)" 
              move={(e: any) => {
                joystickDataRef.current = { x: e.x || 0, y: e.y || 0 };
              }} 
              stop={() => {
                joystickDataRef.current = null;
              }} 
            />
          </div>
          <div className="absolute bottom-12 right-12 pointer-events-auto flex flex-col gap-4 items-end">
            <button 
              onMouseDown={() => shootRef.current()} 
              onTouchStart={(e) => { e.preventDefault(); shootRef.current(); }}
              className="w-24 h-24 bg-emerald-600/40 border-4 border-emerald-500 rounded-full flex items-center justify-center active:scale-95 transition-all shadow-2xl shadow-emerald-500/20"
            >
              <Zap className="w-10 h-10 text-white fill-white" />
            </button>
          </div>
        </>
      )}

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-20">
        <Target className="w-12 h-12 text-white" />
      </div>

      {showStartModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
          <div className="bg-zinc-900 border border-white/10 p-12 rounded-[40px] shadow-2xl text-center max-w-md w-full relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
            
            <h2 className="text-5xl font-black uppercase italic tracking-tighter mb-2 text-white">{t.readyToFight}</h2>
            <p className="text-emerald-500 font-black uppercase tracking-[0.3em] text-[10px] mb-12">{t.selectArena}: {currentMap}</p>
            
            <div className="mb-12">
              <button 
                onClick={() => {
                  const loadout = userData?.user?.loadout?.split(",") || ["pistol", "revolver", "none", "none", "none", "none"];
                  let nextIdx = (currentWeaponIndex + 1) % loadout.length;
                  while (loadout[nextIdx] === 'none' && nextIdx !== currentWeaponIndex) {
                    nextIdx = (nextIdx + 1) % loadout.length;
                  }
                  setCurrentWeaponIndex(nextIdx);
                  currentWeaponIndexRef.current = nextIdx;
                }}
                className="w-full bg-white/5 border border-white/10 p-8 rounded-3xl flex flex-col items-center gap-3 hover:bg-white/10 hover:border-emerald-500/50 transition-all group active:scale-95"
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-emerald-500 transition-colors">Click to Change Weapon</span>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                    <Target className="w-6 h-6 text-emerald-500" />
                  </div>
                  <span className="text-3xl font-black uppercase italic tracking-tighter text-white">
                    {userData?.user?.loadout?.split(",")[currentWeaponIndex] || 'pistol'}
                  </span>
                </div>
              </button>
            </div>

            <button 
              onClick={() => {
                window.dispatchEvent(new CustomEvent('joinGame'));
              }}
              className="w-full bg-emerald-500 text-white py-6 rounded-2xl font-black uppercase tracking-[0.2em] text-sm hover:bg-emerald-400 shadow-[0_20px_40px_rgba(16,185,129,0.2)] transition-all active:scale-95"
            >
              {t.clickToStart}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
