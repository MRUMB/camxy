import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Users, Lock, PlayCircle, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { Gender, Preference } from '../types';
import { showRewardedAd } from '../services/adService';

interface Props {
  activeUsers: number;
  onStart: (gender: Gender, preference: Preference) => void;
}

export default function GenderSelection({ activeUsers, onStart }: Props) {
  const [gender, setGender] = useState<Gender | null>(null);
  const [preference, setPreference] = useState<Preference>('Random');
  const [is18Plus, setIs18Plus] = useState(false);
  const [unlockedPreferences, setUnlockedPreferences] = useState<Record<string, boolean>>({
    Random: true,
    Male: false,
    Female: false,
  });
  const [isWatchingAd, setIsWatchingAd] = useState(false);

  const handlePreferenceClick = async (p: Preference) => {
    if (unlockedPreferences[p]) {
      setPreference(p);
    } else {
      setIsWatchingAd(true);
      const success = await showRewardedAd();
      setIsWatchingAd(false);
      if (success) {
        setUnlockedPreferences(prev => ({ ...prev, [p]: true }));
        setPreference(p);
      }
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/50 rounded-3xl p-8 shadow-2xl"
      >
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight mb-3 bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">Camxy</h1>
          <p className="text-zinc-400 text-sm">meet and chat</p>
          <div className="mt-5 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {activeUsers.toLocaleString()} online now
          </div>
        </div>

        <div className="space-y-8">
          {/* My Gender */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-300 ml-1">I am a...</label>
            <div className="grid grid-cols-2 gap-3">
              {(['Male', 'Female'] as Gender[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={cn(
                    "py-3.5 px-4 rounded-2xl border transition-all duration-300 flex items-center justify-center gap-2 font-medium",
                    gender === g 
                      ? "bg-zinc-100 border-zinc-100 text-zinc-900 shadow-lg shadow-white/10" 
                      : "bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  )}
                >
                  <User size={18} className={gender === g ? "text-zinc-900" : "text-zinc-500"} />
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Preference */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-300 ml-1">I want to chat with...</label>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => handlePreferenceClick('Random')}
                className={cn(
                  "py-3.5 px-4 rounded-2xl border transition-all duration-300 flex items-center justify-between font-medium",
                  preference === 'Random' 
                    ? "bg-zinc-100 border-zinc-100 text-zinc-900 shadow-lg shadow-white/10" 
                    : "bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                )}
              >
                <div className="flex items-center gap-2">
                  <Users size={18} className={preference === 'Random' ? "text-zinc-900" : "text-zinc-500"} />
                  <span>Random</span>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider opacity-60">Free</span>
              </button>

              <div className="grid grid-cols-2 gap-3">
                {(['Male', 'Female'] as Preference[]).map((p) => {
                  const isUnlocked = unlockedPreferences[p];
                  const isSelected = preference === p;
                  return (
                    <button
                      key={p}
                      onClick={() => handlePreferenceClick(p)}
                      disabled={isWatchingAd}
                      className={cn(
                        "py-3.5 px-4 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center gap-1.5 font-medium relative overflow-hidden",
                        isSelected 
                          ? "bg-zinc-100 border-zinc-100 text-zinc-900 shadow-lg shadow-white/10" 
                          : "bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
                        !isUnlocked && !isSelected && "border-dashed border-zinc-600 hover:border-emerald-500/50 hover:bg-emerald-500/5"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {isUnlocked ? <User size={16} /> : <Lock size={14} className="text-emerald-400" />}
                        <span>{p}</span>
                      </div>
                      {!isUnlocked && (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold uppercase tracking-wide">
                          <PlayCircle size={10} /> Watch Ad
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Age Verification */}
          <div className="flex items-center gap-3 mt-4">
            <button
              type="button"
              onClick={() => setIs18Plus(!is18Plus)}
              className={cn(
                "w-6 h-6 rounded-md border flex items-center justify-center transition-all shrink-0",
                is18Plus 
                  ? "bg-emerald-500 border-emerald-500 text-zinc-950" 
                  : "bg-zinc-800/50 border-zinc-700/50 text-transparent hover:border-zinc-600"
              )}
            >
              <Check size={14} strokeWidth={3} />
            </button>
            <span 
              className="text-sm text-zinc-400 cursor-pointer select-none" 
              onClick={() => setIs18Plus(!is18Plus)}
            >
              I confirm that I am 18 years of age or older.
            </span>
          </div>

          <button
            onClick={() => gender && is18Plus && onStart(gender, preference)}
            disabled={!gender || !is18Plus || isWatchingAd}
            className="w-full py-4 rounded-2xl bg-emerald-500 text-zinc-950 font-bold text-lg transition-all hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none mt-6"
          >
            {isWatchingAd ? "Loading Ad..." : "Start Chatting"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
