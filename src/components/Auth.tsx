import React, { useState } from "react";
import { motion } from "motion/react";
import { Eye, EyeOff } from "lucide-react";

interface AuthProps {
  onLogin: (user: any, token: string) => void;
}

export default function Auth({ onLogin }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const endpoint = isLogin ? "/api/login" : "/api/register";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error("Server response was not valid JSON");
      }

      if (res.ok) {
        if (isLogin) {
          onLogin(data.user, data.token);
        } else {
          setIsLogin(true);
          alert("Account created! Please login.");
        }
      } else {
        setError(data.error || "An unknown error occurred");
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(err.message === "Failed to fetch" ? "Cannot connect to server. Is it running?" : "Something went wrong");
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-zinc-950">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 bg-zinc-900 rounded-2xl border border-white/10 shadow-2xl"
      >
        <h1 className="text-4xl font-bold mb-8 text-center tracking-tighter uppercase italic">
          Rivals <span className="text-emerald-500">3D</span>
        </h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-zinc-800 border border-white/5 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="Enter username"
              required
            />
          </div>
          <div className="relative">
            <label className="block text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-800 border border-white/5 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="Enter password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-emerald-500 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          {error && <p className="text-red-500 text-sm">{error}</p>}
          
          <button 
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg transition-all transform active:scale-95 uppercase tracking-widest"
          >
            {isLogin ? "Login" : "Create Account"}
          </button>
        </form>
        
        <p className="mt-6 text-center text-zinc-400 text-sm">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-emerald-500 hover:underline font-semibold"
          >
            {isLogin ? "Sign Up" : "Login"}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
