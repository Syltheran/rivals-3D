import React, { useState, useEffect } from "react";
import { Shield, Target, MessageSquare, Send, Plus, Zap, Crosshair, Volume2, VolumeX } from "lucide-react";
import { translations, Language } from "../translations";

interface HUDProps {
  health: number;
  user: any;
  isMobile: boolean;
  messages: any[];
  onSendMessage: (text: string) => void;
  onLeave: () => void;
  currentMap: string;
  ownedItems?: any[];
  loadout?: string[];
  currentWeaponIndex?: number;
  onSelectWeapon?: (index: number) => void;
  lastShootTime?: number;
  isMuted?: boolean;
  onToggleMute?: () => void;
}

export default function HUD({ health, user, isMobile, messages, onSendMessage, onLeave, currentMap, ownedItems = [], loadout = [], currentWeaponIndex = 0, onSelectWeapon, lastShootTime = 0, isMuted = false, onToggleMute }: HUDProps) {
  const [chatInput, setChatInput] = useState("");
  const [showChat, setShowChat] = useState(true);
  const [isShooting, setIsShooting] = useState(false);

  useEffect(() => {
    if (lastShootTime > 0) {
      setIsShooting(true);
      const timer = setTimeout(() => setIsShooting(false), 100);
      return () => clearTimeout(timer);
    }
  }, [lastShootTime]);
  
  const [lang, setLang] = useState<Language>((localStorage.getItem("lang") as Language) || "en");
  const [crosshairStyle, setCrosshairStyle] = useState(localStorage.getItem("crosshairStyle") || "default");
  const [crosshairColor, setCrosshairColor] = useState(localStorage.getItem("crosshairColor") || "#ffffff");

  const t = translations[lang];

  useEffect(() => {
    const handleStorage = () => {
      setLang((localStorage.getItem("lang") as Language) || "en");
      setCrosshairStyle(localStorage.getItem("crosshairStyle") || "default");
      setCrosshairColor(localStorage.getItem("crosshairColor") || "#ffffff");
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      onSendMessage(chatInput);
      setChatInput("");
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        {crosshairStyle === 'default' && <Target className="w-6 h-6" style={{ color: crosshairColor, opacity: 0.5 }} />}
        {crosshairStyle === 'dot' && <div className="w-1 h-1 rounded-full" style={{ backgroundColor: crosshairColor }} />}
        {crosshairStyle === 'circle' && <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: crosshairColor, opacity: 0.5 }} />}
        {crosshairStyle === 'square' && <div className="w-4 h-4 border-2" style={{ borderColor: crosshairColor, opacity: 0.5 }} />}
      </div>

      {/* Health Bar & Weapon Slots */}
      <div className={`absolute ${isMobile ? 'bottom-4 left-4 right-4' : 'bottom-12 left-12'} flex flex-col gap-2 ${isMobile ? 'max-w-none' : 'max-w-[500px]'}`}>
        {/* Weapon Slots (Logos) */}
        <div className={`flex gap-2 mb-2 ${isMobile ? 'justify-center overflow-x-auto pb-2' : ''}`}>
          {loadout.map((weaponId, idx) => (
            <button 
              key={idx}
              onClick={() => onSelectWeapon?.(idx)}
              className={`pointer-events-auto ${isMobile ? 'w-12 h-12' : 'w-16 h-16'} rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${currentWeaponIndex === idx ? 'bg-emerald-500/30 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] scale-110 z-10' : 'bg-black/60 border-white/10 hover:border-white/30'} ${currentWeaponIndex === idx && isShooting ? '-translate-y-2' : ''}`}
            >
              <div className={`absolute top-1 left-2 ${isMobile ? 'text-[8px]' : 'text-[10px]'} font-black text-white/20`}>{idx + 1}</div>
              <div className="flex-1 flex items-center justify-center mt-2">
                {weaponId === 'pistol' && <Target className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} text-white`} />}
                {weaponId === 'rifle' && <Shield className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} text-white`} />}
                {weaponId === 'mp5' && <Zap className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} text-white`} />}
                {weaponId === 'magnum' && <Crosshair className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} text-white`} />}
                {weaponId === 'revolver' && <Crosshair className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} text-zinc-400`} />}
                {weaponId === 'none' && <span className={`text-zinc-700 ${isMobile ? 'text-lg' : 'text-xl'} font-black`}>-</span>}
                {weaponId !== 'pistol' && weaponId !== 'rifle' && weaponId !== 'revolver' && weaponId !== 'magnum' && weaponId !== 'none' && (
                  <span className={`${isMobile ? 'text-[8px]' : 'text-xs'} font-black text-white uppercase italic`}>{weaponId.substring(0, 4)}</span>
                )}
              </div>
              <div className={`h-1 w-full mt-auto rounded-b-xl ${currentWeaponIndex === idx ? 'bg-emerald-500' : 'bg-transparent'}`} />
            </button>
          ))}
        </div>

        <div className={`w-full bg-black/40 backdrop-blur-md ${isMobile ? 'p-3' : 'p-4'} rounded-2xl border border-white/10`}>
          <div className="flex justify-between items-end mb-2">
            <span className={`${isMobile ? 'text-[8px]' : 'text-[10px]'} font-black uppercase tracking-widest text-zinc-500`}>{t.health}</span>
            <span className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-mono font-black text-white leading-none`}>{isNaN(health) ? 0 : health}</span>
          </div>
          <div className={`${isMobile ? 'h-2' : 'h-3'} bg-zinc-900 rounded-full overflow-hidden border border-white/5`}>
            <div 
              className={`h-full transition-all duration-300 ${health > 30 ? 'bg-emerald-500' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`}
              style={{ width: `${isNaN(health) ? 0 : health}%` }}
            />
          </div>
        </div>
      </div>

      {/* User Info & Map */}
      <div className={`absolute ${isMobile ? 'top-4 left-4' : 'top-12 left-12'} flex flex-col gap-2`}>
        <div className="flex items-center gap-3">
          <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} bg-zinc-900 border border-white/10 rounded-xl flex items-center justify-center font-bold text-xs`}>
            {user.username[0].toUpperCase()}
          </div>
          <div>
            <p className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold`}>{user.username}</p>
            <p className={`${isMobile ? 'text-[8px]' : 'text-[10px]'} text-emerald-500 uppercase font-bold tracking-widest flex items-center gap-1`}>
              {user.role === 'owner' && <Shield className="w-2 h-2" />}
              {user.role}
            </p>
          </div>
        </div>
        <div className={`px-2 py-0.5 bg-zinc-900/80 border border-white/5 rounded-lg inline-block`}>
          <p className={`${isMobile ? 'text-[8px]' : 'text-[10px]'} text-zinc-500 uppercase font-bold tracking-widest`}>{t.map}: <span className="text-white">{currentMap}</span></p>
        </div>
        <div className="flex gap-2 mt-2">
          <button 
            onClick={onLeave}
            className={`pointer-events-auto px-2 py-1 bg-red-900/20 border border-red-500/20 rounded-lg ${isMobile ? 'text-[8px]' : 'text-[10px]'} text-red-400 font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all`}
          >
            {t.leave}
          </button>
          <button 
            onClick={onToggleMute}
            className={`pointer-events-auto px-2 py-1 bg-zinc-900/80 border border-white/10 rounded-lg text-zinc-400 hover:text-white transition-all flex items-center gap-1`}
          >
            {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
            <span className={`${isMobile ? 'text-[8px]' : 'text-[10px]'} font-black uppercase tracking-widest`}>{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>
        </div>
      </div>

      {/* Chat Window */}
      <div className={`absolute ${isMobile ? 'top-4 right-4' : 'bottom-12 right-12'} ${isMobile ? 'w-48' : 'w-80'} pointer-events-auto flex flex-col gap-4`}>
        {(!showChat || (isMobile && !showChat)) && (
          <button 
            onClick={() => setShowChat(true)}
            className="self-end p-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-full hover:bg-white/10 transition-colors"
          >
            <MessageSquare className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
          </button>
        )}

        {showChat && (
          <div className={`flex flex-col ${isMobile ? 'h-40' : 'h-64'} bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden`}>
            <div className="p-2 border-bottom border-white/5 bg-white/5 flex justify-between items-center">
              <span className={`${isMobile ? 'text-[8px]' : 'text-[10px]'} font-black uppercase tracking-widest flex items-center gap-2`}>
                <MessageSquare className="w-3 h-3" /> {t.chat}
              </span>
              <button onClick={() => setShowChat(false)} className="p-1 hover:bg-white/10 rounded transition-colors">
                <Plus className="w-3 h-3 rotate-45" />
              </button>
            </div>
            <div className={`flex-1 overflow-y-auto p-2 space-y-1 font-mono ${isMobile ? 'text-[9px]' : 'text-[11px]'}`}>
              {messages.map((msg, i) => (
                <div key={i} className="break-words">
                  <span className={`font-bold ${msg.role === 'owner' ? 'text-red-500' : msg.role === 'admin' ? 'text-emerald-500' : 'text-zinc-400'}`}>
                    {msg.username}:
                  </span>{" "}
                  <span className="text-zinc-200">{msg.text}</span>
                </div>
              ))}
            </div>
            <form onSubmit={handleSend} className="p-1.5 bg-black/20 flex gap-1.5">
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={t.typeMessage}
                className={`flex-1 bg-zinc-900/50 border border-white/5 rounded-lg px-2 py-1.5 ${isMobile ? 'text-[9px]' : 'text-[11px]'} focus:outline-none focus:border-emerald-500`}
              />
              <button type="submit" className="p-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors">
                <Send className="w-3 h-3" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Admin Indicator */}
      {(user.role === 'owner' || user.role === 'admin') && (
        <div className={`absolute ${isMobile ? 'bottom-24 right-4' : 'top-12 right-12'} text-right`}>
          <p className={`${isMobile ? 'text-[8px]' : 'text-[10px]'} text-emerald-500 font-bold uppercase tracking-widest mb-1`}>{t.adminGear}</p>
          <div className="flex gap-2 justify-end">
             <div className={`px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded ${isMobile ? 'text-[8px]' : 'text-[10px]'} text-emerald-400 font-bold`}>PICKAXE</div>
          </div>
        </div>
      )}

      {/* Special Weapon Indicator for non-admins */}
      <div className="absolute top-24 right-12 text-right">
        <div className="flex gap-2 justify-end">
          {ownedItems.some(item => item.item_id === "omega_gun") && (
            <div className="px-2 py-1 bg-red-500/20 border border-red-500/40 rounded text-[10px] text-red-400 font-black animate-pulse">{t.omegaActive}</div>
          )}
        </div>
      </div>
    </div>
  );
}
