import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { LogOut, Play, Shield, Users, Gift, Map as MapIcon, ShoppingBag, Target, Key, Plus, ChevronRight, Settings as SettingsIcon, Zap, Crosshair } from "lucide-react";
import { io, Socket } from "socket.io-client";
import { translations, Language } from "../translations";

interface LobbyProps {
  user: any;
  onLogout: () => void;
  onJoinRoom: (roomId: string) => void;
}

const MAPS = ["Warehouse", "Cyberpunk", "Desert", "Snow", "Shipyard", "Laboratory", "Temple", "Castle", "Metro", "Rooftop"];

export default function Lobby({ user, onLogout, onJoinRoom }: LobbyProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"rounds" | "shop" | "missions" | "admin" | "settings" | "skins">("rounds");
  const [userData, setUserData] = useState<any>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [selectedMap, setSelectedMap] = useState("Warehouse");
  const [startingWeapon, setStartingWeapon] = useState("pistol");
  
  // Inventory state
  const [selectedSlot, setSelectedSlot] = useState(0);
  
  // Settings state
  const [language, setLanguage] = useState<Language>((localStorage.getItem("lang") as Language) || "en");
  const [crosshairStyle, setCrosshairStyle] = useState(localStorage.getItem("crosshairStyle") || "default");
  const [crosshairColor, setCrosshairColor] = useState(localStorage.getItem("crosshairColor") || "#ffffff");

  const t = translations[language];
  const [promoteUsername, setPromoteUsername] = useState("");
  const [promoteStatus, setPromoteStatus] = useState("");
  const [giveKeysUsername, setGiveKeysUsername] = useState("");
  const [giveKeysAmount, setGiveKeysAmount] = useState(1);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    fetchUserData();
    const socket = io();
    socketRef.current = socket;
    
    socket.on("connect", () => {
      socket.emit("registerSocket", user.username);
    });
    socket.emit("getRooms");
    socket.on("roomList", (list) => setRooms(list));
    socket.on("keysUpdated", (data) => {
      console.log("Keys updated received:", data);
      fetchUserData();
    });
    socket.on("roomCreated", (id) => {
      onJoinRoom(id);
      navigate("/play");
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchUserData = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/user/data", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setUserData(data);
    } else if (res.status === 401) {
      onLogout();
    }
  };

  const handleCreateRoom = () => {
    socketRef.current?.emit("createRoom", { name: newRoomName, map: selectedMap, startingWeapon });
  };

  const handleJoinRoom = (id: string) => {
    onJoinRoom(id);
    navigate("/play");
  };

  const handleBuyKey = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/shop/buy-key", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (res.ok) {
      fetchUserData();
      alert("Key purchased!");
    } else {
      const data = await res.json();
      if (res.status === 401) {
        onLogout();
      } else {
        alert(data.error);
      }
    }
  };

  const handleClaimMission = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/missions/claim", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (res.ok) {
      fetchUserData();
      alert("Mission reward claimed!");
    }
  };

  const handlePromote = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/admin/promote", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ username: promoteUsername }),
    });
    if (res.ok) {
      setPromoteStatus("User promoted!");
      setPromoteUsername("");
    } else {
      const data = await res.json();
      if (res.status === 401) {
        onLogout();
      } else {
        setPromoteStatus(data.error);
      }
    }
  };

  const handleGiveKeys = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/admin/give-keys", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ username: giveKeysUsername, amount: giveKeysAmount }),
    });
    if (res.ok) {
      alert(`Gave ${giveKeysAmount} keys to ${giveKeysUsername}`);
      setGiveKeysUsername("");
      fetchUserData();
    } else {
      const data = await res.json();
      if (res.status === 401) {
        onLogout();
      } else {
        alert(data.error);
      }
    }
  };

  const handleBuyWithKeys = async (itemId: string, type: string) => {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/shop/buy-with-keys", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ itemId, type }),
    });
    if (res.ok) {
      fetchUserData();
      alert("Item purchased!");
    } else {
      const data = await res.json();
      if (res.status === 401) {
        onLogout();
      } else {
        alert(data.error);
      }
    }
  };

  const handleUpdateLoadout = async (newLoadout: string[], newSkin: string) => {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/user/update-loadout", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ loadout: newLoadout.join(","), skin: newSkin }),
    });
    if (res.ok) {
      fetchUserData();
    } else if (res.status === 401) {
      onLogout();
    }
  };

  const handleEquipWeapon = (weaponId: string) => {
    const currentLoadout = (userData?.user?.loadout || "pistol,revolver,none,none,none,none").split(",");
    currentLoadout[selectedSlot] = weaponId;
    handleUpdateLoadout(currentLoadout, userData?.user?.skin || "default");
  };

  const handleEquipSkin = (skinId: string) => {
    const currentLoadout = (userData?.user?.loadout || "pistol,revolver,none,none,none,none").split(",");
    handleUpdateLoadout(currentLoadout, skinId);
  };

  const handleUpdateWeaponSkin = async (newWeaponSkin: string) => {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/user/update-loadout", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ weapon_skin: newWeaponSkin }),
    });
    if (res.ok) {
      fetchUserData();
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem("lang", language);
    localStorage.setItem("crosshairStyle", crosshairStyle);
    localStorage.setItem("crosshairColor", crosshairColor);
    alert(language === "en" ? "Settings saved!" : "Ustawienia zapisane!");
  };

  const currentRole = userData?.user?.role || user.role;

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 relative overflow-hidden bg-zinc-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-900/10 via-zinc-950 to-zinc-950 -z-10" />
      
      {/* Header */}
      <div className="w-full max-w-6xl flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-emerald-600 rounded-2xl flex items-center justify-center text-3xl font-black shadow-2xl shadow-emerald-500/20 rotate-3">
            {user.username[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter flex items-center gap-2">
              {user.username}
              {currentRole === 'owner' && <Shield className="w-6 h-6 text-emerald-500" />}
            </h1>
            <div className="flex gap-4 mt-1">
              <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1 rounded-full border border-white/5">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-mono font-bold text-emerald-500 uppercase tracking-widest">{currentRole}</span>
              </div>
              <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1 rounded-full border border-white/5">
                <ShoppingBag className="w-3 h-3 text-zinc-500" />
                <span className="text-xs font-mono font-bold text-zinc-300">{userData?.user?.currency || 0}</span>
              </div>
              <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1 rounded-full border border-white/5">
                <Key className="w-3 h-3 text-zinc-500" />
                <span className="text-xs font-mono font-bold text-zinc-300">{userData?.user?.keys || 0}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 bg-zinc-900/50 p-1.5 rounded-2xl border border-white/5 backdrop-blur-xl overflow-x-auto max-w-full no-scrollbar">
          <TabButton active={activeTab === 'rounds'} onClick={() => setActiveTab('rounds')} icon={<Play className="w-4 h-4" />} label={t.rounds} />
          <TabButton active={activeTab === 'skins'} onClick={() => setActiveTab('skins')} icon={<Gift className="w-4 h-4" />} label={t.mySkins} />
          <TabButton active={activeTab === 'shop'} onClick={() => setActiveTab('shop')} icon={<ShoppingBag className="w-4 h-4" />} label={t.shop} />
          <TabButton active={activeTab === 'missions'} onClick={() => setActiveTab('missions')} icon={<Target className="w-4 h-4" />} label={t.missions} />
          {(currentRole === 'owner' || currentRole === 'admin') && (
            <TabButton active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<Shield className="w-4 h-4" />} label={t.admin} />
          )}
          <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<SettingsIcon className="w-4 h-4" />} label={t.settings} />
          <button onClick={onLogout} className="p-3 text-zinc-500 hover:text-red-500 transition-colors"><LogOut className="w-5 h-5" /></button>
        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-6xl flex-1">
        <AnimatePresence mode="wait">
          {activeTab === 'rounds' && (
            <motion.div key="rounds" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-black uppercase italic tracking-tighter">{t.activeRounds}</h2>
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-[9px] text-emerald-500 font-black uppercase tracking-widest">{t.robloxEngine}</span>
                    </div>
                  </div>
                  <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest transition-all active:scale-95">
                    <Plus className="w-5 h-5" /> {t.createRound}
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rooms.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-zinc-900/30 rounded-3xl border border-dashed border-white/10">
                      <p className="text-zinc-500 font-bold uppercase tracking-widest">{t.noRounds}</p>
                    </div>
                  ) : (
                    rooms.map(room => (
                      <button key={room.id} onClick={() => handleJoinRoom(room.id)} className="group relative bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 hover:border-emerald-500/50 p-6 rounded-3xl transition-all text-left">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-xl font-black uppercase italic tracking-tighter">{room.name}</h3>
                            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-2">
                              <MapIcon className="w-3 h-3" /> {room.map}
                            </p>
                          </div>
                          <div className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                            {room.playerCount} Players
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-6">
                          <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Click to join</span>
                          <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-500 transition-colors" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
              
              <div className="space-y-6">
                <h2 className="text-2xl font-black uppercase italic tracking-tighter">{t.quickPlay}</h2>
                <div className="bg-zinc-900/50 border border-white/10 p-8 rounded-3xl relative overflow-hidden group">
                  <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/rivals/800/800')] opacity-10 group-hover:opacity-20 transition-opacity bg-cover" />
                  <div className="relative z-10">
                    <p className="text-sm text-zinc-400 font-bold uppercase tracking-widest mb-2">Random Arena</p>
                    <h3 className="text-3xl font-black uppercase italic tracking-tighter mb-6 leading-none">Enter the Chaos</h3>
                    <button onClick={() => rooms.length > 0 ? handleJoinRoom(rooms[0].id) : setShowCreateModal(true)} className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all active:scale-95">
                      {t.matchmake}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'skins' && (
            <motion.div key="skins" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-12">
              {/* Loadout Section */}
              <div className="bg-zinc-900/50 border border-white/10 p-8 rounded-3xl">
                <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-6 flex items-center gap-2">
                  <Target className="w-6 h-6 text-emerald-500" /> {t.loadout}
                </h2>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-8">
                  {userData?.user?.loadout?.split(",").map((weaponId: string, idx: number) => (
                    <button 
                      key={idx} 
                      onClick={() => setSelectedSlot(idx)}
                      className={`relative aspect-square rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${selectedSlot === idx ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'bg-zinc-800/50 border-white/5 hover:border-white/20'}`}
                    >
                      <span className="absolute top-2 left-2 text-[10px] font-black text-zinc-600">{idx + 1}</span>
                      <div className="flex-1 flex items-center justify-center">
                        {weaponId === 'pistol' && <Target className="w-8 h-8 text-white" />}
                        {weaponId === 'rifle' && <Shield className="w-8 h-8 text-white" />}
                        {weaponId === 'mp5' && <Zap className="w-8 h-8 text-white" />}
                        {weaponId === 'magnum' && <Crosshair className="w-8 h-8 text-white" />}
                        {weaponId === 'revolver' && <Crosshair className="w-8 h-8 text-zinc-400" />}
                        {weaponId === 'sniper' && <Target className="w-8 h-8 text-emerald-500" />}
                        {weaponId === 'shotgun' && <Shield className="w-8 h-8 text-red-500" />}
                        {weaponId === 'omega_gun' && <Zap className="w-8 h-8 text-yellow-500 animate-pulse" />}
                        {weaponId === 'none' && <Plus className="w-6 h-6 text-zinc-700" />}
                      </div>
                      <div className="pb-2 text-[9px] font-black uppercase tracking-widest text-zinc-500">
                        {weaponId === 'none' ? 'Empty' : weaponId}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Equip to Slot {selectedSlot + 1}</p>
                  <div className="flex flex-wrap gap-2">
                    {userData?.availableWeapons?.filter((w: any) => w.price === 0 || userData?.items?.some((i: any) => i.item_id === w.id && i.type === 'weapon')).map((weapon: any) => (
                      <button 
                        key={weapon.id} 
                        onClick={() => handleEquipWeapon(weapon.id)}
                        className="px-4 py-2 bg-zinc-800 hover:bg-emerald-600 border border-white/5 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                      >
                        {weapon.name}
                      </button>
                    ))}
                    <button 
                      onClick={() => handleEquipWeapon('none')}
                      className="px-4 py-2 bg-zinc-900 hover:bg-red-900/40 border border-red-500/20 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-red-400"
                    >
                      Clear Slot
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-6 flex items-center gap-2">
                  <Gift className="w-6 h-6 text-emerald-500" /> {t.mySkins}
                </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {userData?.availableSkins?.filter((skin: any) => {
                  const isOwned = userData?.items?.some((i: any) => i.item_id === skin.id && i.type === 'skin') || skin.keyPrice === 0;
                  if (skin.id === 'smoke' && user.role !== 'owner') return false;
                  return isOwned;
                }).map((skin: any) => {
                  const isEquipped = userData?.user?.skin === skin.id;
                  return (
                    <div key={skin.id} className="bg-zinc-900/50 border border-white/5 p-6 rounded-3xl flex flex-col items-center text-center">
                      <div className={`w-12 h-12 rounded-lg mb-4 bg-zinc-800 border-2 border-white/10 ${skin.id === 'gold' ? 'bg-yellow-500' : skin.id === 'neon' ? 'bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)]' : skin.id === 'ruby' ? 'bg-red-600' : skin.id === 'smoke' ? 'bg-zinc-400 shadow-[0_0_15px_rgba(255,255,255,0.2)]' : ''}`} />
                      <h3 className="text-lg font-black uppercase italic tracking-tighter mb-1">{skin.name}</h3>
                      <button 
                        onClick={() => handleEquipSkin(skin.id)}
                        className={`w-full py-2 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${isEquipped ? 'bg-emerald-500 text-white cursor-default' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                      >
                        {isEquipped ? t.equipped : t.equip}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

          {activeTab === 'shop' && (
            <motion.div key="shop" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-zinc-900/50 border border-white/10 p-8 rounded-3xl flex flex-col items-center text-center">
                  <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mb-6">
                    <Key className="w-10 h-10 text-emerald-500" />
                  </div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2">{t.standardKey}</h3>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-8">Unlock skins & weapons</p>
                  <button onClick={handleBuyKey} className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-black uppercase tracking-widest transition-all">
                    200 Credits
                  </button>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-6 flex items-center gap-2">
                  <Shield className="w-6 h-6 text-emerald-500" /> {t.weapons}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {userData?.availableWeapons?.filter((weapon: any) => {
                    const isOwned = userData?.items?.some((i: any) => i.item_id === weapon.id && i.type === 'weapon') || weapon.keyPrice === 0;
                    return !isOwned;
                  }).map((weapon: any) => {
                    return (
                      <div key={weapon.id} className="bg-zinc-900/50 border border-white/5 p-6 rounded-3xl flex flex-col items-center text-center">
                        <div className="w-12 h-12 rounded-lg mb-4 bg-zinc-800 border border-white/10 flex items-center justify-center">
                          {weapon.id === 'pistol' && <Target className="w-6 h-6 text-white" />}
                          {weapon.id === 'rifle' && <Shield className="w-6 h-6 text-white" />}
                          {weapon.id === 'mp5' && <Zap className="w-6 h-6 text-white" />}
                          {weapon.id === 'revolver' && <Crosshair className="w-6 h-6 text-zinc-400" />}
                          {weapon.id === 'magnum' && <Crosshair className="w-6 h-6 text-white" />}
                          {weapon.id === 'sniper' && <Target className="w-6 h-6 text-emerald-500" />}
                          {weapon.id === 'shotgun' && <Shield className="w-6 h-6 text-red-500" />}
                          {weapon.id === 'omega_gun' && <Zap className="w-6 h-6 text-yellow-500 animate-pulse" />}
                        </div>
                        <h3 className="text-lg font-black uppercase italic tracking-tighter mb-1">{weapon.name}</h3>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-4">{weapon.keyPrice} Keys</p>
                        <button 
                          onClick={() => handleBuyWithKeys(weapon.id, 'weapon')}
                          className="w-full py-2 rounded-xl font-black uppercase tracking-widest text-xs transition-all bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                          {t.buyWithKeys}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-6 flex items-center gap-2">
                  <Plus className="w-6 h-6 text-emerald-500" /> {t.skins}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {userData?.availableSkins?.filter((skin: any) => {
                    const isOwned = userData?.items?.some((i: any) => i.item_id === skin.id && i.type === 'skin') || skin.keyPrice === 0;
                    if (skin.id === 'smoke' && user.role !== 'owner') return false;
                    return !isOwned;
                  }).map((skin: any) => {
                    return (
                      <div key={skin.id} className="bg-zinc-900/50 border border-white/5 p-6 rounded-3xl flex flex-col items-center text-center">
                        <div className={`w-12 h-12 rounded-lg mb-4 bg-zinc-800 border-2 border-white/10 ${skin.id === 'gold' ? 'bg-yellow-500' : skin.id === 'neon' ? 'bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)]' : skin.id === 'ruby' ? 'bg-red-600' : skin.id === 'smoke' ? 'bg-zinc-400 shadow-[0_0_15px_rgba(255,255,255,0.2)]' : ''}`} />
                        <h3 className="text-lg font-black uppercase italic tracking-tighter mb-1">{skin.name}</h3>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-4">{skin.keyPrice} Keys</p>
                        <button 
                          onClick={() => handleBuyWithKeys(skin.id, 'skin')}
                          className="w-full py-2 rounded-xl font-black uppercase tracking-widest text-xs transition-all bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                          {t.buyWithKeys}
                        </button>
                      </div>
                    );
                  })}
                  {userData?.availableSkins?.filter((skin: any) => {
                    const isOwned = userData?.items?.some((i: any) => i.item_id === skin.id && i.type === 'skin') || skin.keyPrice === 0;
                    if (skin.id === 'smoke' && user.role !== 'owner') return false;
                    return !isOwned;
                  }).length === 0 && (
                    <div className="col-span-full py-10 text-center bg-zinc-900/30 rounded-3xl border border-dashed border-white/10">
                      <p className="text-zinc-500 font-bold uppercase tracking-widest">All skins owned!</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'missions' && (
            <motion.div key="missions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <MissionCard title={language === 'pl' ? "Pierwsza Krew" : "First Blood"} description={language === 'pl' ? "Zdobądź 1 zabójstwo" : "Get 1 kill in any round"} reward={100} onClaim={handleClaimMission} />
              <MissionCard title={language === 'pl' ? "Mistrz Areny" : "Arena Master"} description={language === 'pl' ? "Wygraj rundę na Warehouse" : "Win a round in Warehouse"} reward={250} onClaim={handleClaimMission} />
              <MissionCard title={language === 'pl' ? "Towarzyski" : "Socialite"} description={language === 'pl' ? "Wyślij 5 wiadomości na czacie" : "Send 5 messages in chat"} reward={50} onClaim={handleClaimMission} />
            </motion.div>
          )}

          {activeTab === 'admin' && (
            <motion.div key="admin" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-4xl">
              <div className="bg-zinc-900/50 border border-white/10 p-8 rounded-3xl">
                <h3 className="text-xl font-black uppercase italic tracking-tighter mb-6 flex items-center gap-2">
                  <Shield className="w-6 h-6 text-emerald-500" /> Roles & Permissions
                </h3>
                <div className="space-y-6">
                  {currentRole === 'owner' && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Promote to Admin</label>
                      <div className="flex gap-2">
                        <input type="text" value={promoteUsername} onChange={(e) => setPromoteUsername(e.target.value)} placeholder="Username" className="flex-1 bg-zinc-800 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500" />
                        <button onClick={handlePromote} className="bg-white text-black px-6 py-3 rounded-xl font-black uppercase tracking-widest hover:bg-zinc-200 transition-colors">Promote</button>
                      </div>
                      {promoteStatus && <p className="text-xs text-emerald-500 mt-2 font-bold">{promoteStatus}</p>}
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Give Keys</label>
                    <div className="space-y-2">
                      <input type="text" value={giveKeysUsername} onChange={(e) => setGiveKeysUsername(e.target.value)} placeholder="Username" className="w-full bg-zinc-800 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500" />
                      <div className="flex gap-2">
                        <input type="number" value={giveKeysAmount || 0} onChange={(e) => setGiveKeysAmount(parseInt(e.target.value) || 0)} className="w-24 bg-zinc-800 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500" />
                        <button onClick={handleGiveKeys} className="flex-1 bg-emerald-600 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest hover:bg-emerald-500 transition-colors">Give Keys</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-2xl space-y-8">
              <div className="bg-zinc-900/50 border border-white/10 p-8 rounded-3xl">
                <h3 className="text-xl font-black uppercase italic tracking-tighter mb-8 flex items-center gap-2">
                  <SettingsIcon className="w-6 h-6 text-emerald-500" /> {t.settings}
                </h3>
                
                <div className="space-y-8">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">{t.language}</label>
                    <div className="flex gap-4">
                      <button onClick={() => setLanguage('en')} className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest transition-all ${language === 'en' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>English</button>
                      <button onClick={() => setLanguage('pl')} className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest transition-all ${language === 'pl' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>Polski</button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">{t.crosshair}</label>
                    <div className="grid grid-cols-3 gap-4">
                      {['default', 'dot', 'circle', 'square', 'none'].map(style => (
                        <button key={style} onClick={() => setCrosshairStyle(style)} className={`py-3 rounded-xl font-black uppercase tracking-widest transition-all text-[10px] ${crosshairStyle === style ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">{t.crosshairColor}</label>
                    <div className="flex gap-4 items-center">
                      <input type="color" value={crosshairColor} onChange={(e) => setCrosshairColor(e.target.value)} className="w-16 h-12 bg-transparent border-none cursor-pointer" />
                      <span className="font-mono text-zinc-400">{crosshairColor.toUpperCase()}</span>
                    </div>
                  </div>

                  <button onClick={handleSaveSettings} className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all active:scale-95 mt-8">
                    {t.save}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-lg bg-zinc-900 border border-white/10 p-8 rounded-3xl shadow-2xl">
            <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-8">{t.createNewRound}</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">{t.roundName}</label>
                <input type="text" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="Epic Battle" className="w-full bg-zinc-800 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">{t.selectArena}</label>
                <div className="grid grid-cols-3 gap-2">
                  {MAPS.map(map => (
                    <button key={map} onClick={() => setSelectedMap(map)} className={`px-3 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedMap === map ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'}`}>
                      {map}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Starting Weapon</label>
                <div className="grid grid-cols-2 gap-2">
                  {userData?.availableWeapons?.filter((w: any) => w.price === 0 || userData?.items?.some((i: any) => i.item_id === w.id)).map((weapon: any) => (
                    <button key={weapon.id} onClick={() => setStartingWeapon(weapon.id)} className={`px-3 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${startingWeapon === weapon.id ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'}`}>
                      {weapon.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setShowCreateModal(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-4 rounded-2xl font-black uppercase tracking-widest transition-all">{t.cancel}</button>
                <button onClick={handleCreateRoom} className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-4 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95">{t.create}</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${active ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}>
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function MissionCard({ title, description, reward, onClaim }: any) {
  return (
    <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-6 group hover:border-emerald-500/30 transition-all">
      <div className="flex items-center gap-6">
        <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
          <Target className="w-8 h-8 text-zinc-500 group-hover:text-emerald-500 transition-colors" />
        </div>
        <div>
          <h3 className="text-xl font-black uppercase italic tracking-tighter">{title}</h3>
          <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-6 w-full md:w-auto">
        <div className="text-right">
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Reward</p>
          <p className="text-xl font-mono font-black text-emerald-500">{reward} Credits</p>
        </div>
        <button onClick={onClaim} className="flex-1 md:flex-none bg-white text-black px-8 py-3 rounded-xl font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all active:scale-95">
          Claim
        </button>
      </div>
    </div>
  );
}
