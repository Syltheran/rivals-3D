import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./components/Auth";
import Game from "./components/Game";
import Lobby from "./components/Lobby";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = (userData: any, token: string) => {
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    setUser(null);
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-zinc-950 text-white">Loading...</div>;

  return (
    <Router>
      <div className="min-h-screen bg-zinc-950 text-white font-sans">
        <Routes>
          <Route path="/auth" element={!user ? <Auth onLogin={login} /> : <Navigate to="/" />} />
          <Route path="/" element={user ? <Lobby user={user} onLogout={logout} onJoinRoom={(id) => setSelectedRoomId(id)} /> : <Navigate to="/auth" />} />
          <Route path="/play" element={user && selectedRoomId ? <Game user={user} roomId={selectedRoomId} /> : <Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}
