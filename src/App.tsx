import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Video, VideoOff, Mic, MicOff, SkipForward, Play, Square, Send, Gift, Filter, PlayCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AdManager } from './AdManager';

const GIFTS = [
  { emoji: '🌹', name: 'Rose', cost: 10, score: 1 },
  { emoji: '🔥', name: 'Fire', cost: 20, score: 2 },
  { emoji: '💎', name: 'Diamond', cost: 50, score: 5 },
  { emoji: '👑', name: 'Crown', cost: 100, score: 10 },
];

interface ActiveGift {
  id: number;
  gift: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

interface Message {
  id: number;
  sender: 'me' | 'partner';
  text: string;
  isGift?: boolean;
}

export default function App() {
  const [status, setStatus] = useState<'idle' | 'searching' | 'connected' | 'fallback'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [activeGifts, setActiveGifts] = useState<ActiveGift[]>([]);

  const [myGender, setMyGender] = useState<string | null>(null);
  const [preference, setPreference] = useState<string>('random');
  const [filterUnlockedUntil, setFilterUnlockedUntil] = useState<number | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  
  const [coins, setCoins] = useState(() => parseInt(localStorage.getItem('coins') || '0'));
  const [giftScore, setGiftScore] = useState(() => parseInt(localStorage.getItem('giftScore') || '0'));
  const [partnerGiftScore, setPartnerGiftScore] = useState(0);

  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetIdleTimer = React.useCallback(() => {
    setIsIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setIsIdle(true);
    }, 5000);
  }, []);

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  useEffect(() => {
    localStorage.setItem('coins', coins.toString());
  }, [coins]);

  useEffect(() => {
    localStorage.setItem('giftScore', giftScore.toString());
  }, [giftScore]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const fallbackVideoRef = useRef<HTMLVideoElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  const addMessage = (msg: { sender: 'me' | 'partner', text: string, isGift?: boolean }) => {
    const id = Date.now() + Math.random();
    setMessages(prev => [...prev, { ...msg, id }]);
    // Auto-remove message after 10 seconds
    setTimeout(() => {
      setMessages(prev => prev.filter(m => m.id !== id));
    }, 10000);
  };

  useEffect(() => {
    AdManager.initialize();
    AdManager.showBannerAd('banner-top');
    AdManager.showBannerAd('banner-bottom');

    socketRef.current = io();

    socketRef.current.on('paired', async ({ room, initiator, partnerGiftScore }) => {
      console.log('Paired!', room, initiator);
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
      }
      setStatus('connected');
      roomIdRef.current = room;
      setPartnerGiftScore(partnerGiftScore || 0);

      await setupWebRTC(initiator);
    });

    socketRef.current.on('signal', async ({ sender, signal }) => {
      if (!peerConnectionRef.current) return;
      try {
        if (signal.type === 'offer') {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          socketRef.current?.emit('signal', { room: roomIdRef.current, signal: answer });
        } else if (signal.type === 'answer') {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
        } else if (signal.candidate) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(signal));
        }
      } catch (err) {
        console.error('Error handling signal:', err);
      }
    });

    socketRef.current.on('partner_left', () => {
      console.log('Partner left');
      handleNext();
    });

    socketRef.current.on('receive_message', ({ text }) => {
      addMessage({ sender: 'partner', text });
    });

    socketRef.current.on('receive_gift', ({ gift, score }) => {
      showGiftAnimation(gift);
      addMessage({ sender: 'partner', text: `Partner sent a ${gift}`, isGift: true });
      setGiftScore(prev => prev + (score || 0));
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getMedia = async () => {
    if (!localStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Failed to get media', err);
        alert('Camera and microphone access is required.');
        throw err;
      }
    }
  };

  const setupWebRTC = async (initiator: boolean) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });
    peerConnectionRef.current = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('signal', { room: roomIdRef.current, signal: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    if (initiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current?.emit('signal', { room: roomIdRef.current, signal: offer });
      } catch (err) {
        console.error('Error creating offer', err);
      }
    }
  };

  const cleanupWebRTC = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  const findPartner = () => {
    cleanupWebRTC();
    setMessages([]);
    setStatus('searching');
    
    // Check if filter expired
    let currentPref = preference;
    if (preference !== 'random' && filterUnlockedUntil && Date.now() > filterUnlockedUntil) {
      setPreference('random');
      currentPref = 'random';
      alert('Gender filter expired. Reset to Random.');
    }

    socketRef.current?.emit('find_partner', { gender: myGender, preference: currentPref, giftScore });

    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
    }
    fallbackTimerRef.current = setTimeout(() => {
      setStatus('fallback');
    }, 4000);
  };

  const handleStart = async () => {
    try {
      await getMedia();
      findPartner();
    } catch (err) {
      // Handled in getMedia
    }
  };

  const handleNext = () => {
    if (roomIdRef.current) {
      socketRef.current?.emit('leave_room', roomIdRef.current);
      roomIdRef.current = null;
    }
    findPartner();
  };

  const handleStop = () => {
    if (roomIdRef.current) {
      socketRef.current?.emit('leave_room', roomIdRef.current);
      roomIdRef.current = null;
    }
    cleanupWebRTC();
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
    }
    socketRef.current?.emit('cancel_search');
    setStatus('idle');
    setMessages([]);
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const sendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || !roomIdRef.current) return;
    socketRef.current?.emit('send_message', { room: roomIdRef.current, text: chatInput });
    addMessage({ sender: 'me', text: chatInput });
    setChatInput('');
  };

  const sendGift = (giftObj: typeof GIFTS[0]) => {
    if (coins < giftObj.cost) {
      alert('Not enough coins! Watch an ad to earn more.');
      return;
    }
    if (!roomIdRef.current) return;
    
    setCoins(c => c - giftObj.cost);
    socketRef.current?.emit('send_gift', { room: roomIdRef.current, gift: giftObj.emoji, score: giftObj.score });
    showGiftAnimation(giftObj.emoji);
    addMessage({ sender: 'me', text: `You sent a ${giftObj.emoji}`, isGift: true });
    setPartnerGiftScore(prev => prev + giftObj.score);
  };

  const showGiftAnimation = (gift: string) => {
    const newGifts = Array.from({ length: 12 }).map((_, i) => ({
      id: Date.now() + i,
      gift,
      x: (Math.random() - 0.5) * 400, // Random spread X
      y: (Math.random() - 0.5) * 400, // Random spread Y
      scale: 0.5 + Math.random() * 1.5, // Random size
      rotation: (Math.random() - 0.5) * 90, // Random rotation
    }));
    
    setActiveGifts(prev => [...prev, ...newGifts]);

    setTimeout(() => {
      setActiveGifts(prev => prev.filter(g => !newGifts.find(ng => ng.id === g.id)));
    }, 4000);
  };

  const handleUnlockFilter = async (targetGender: string) => {
    setIsWatchingAd(true);
    const success = await AdManager.showRewardedAd();
    setIsWatchingAd(false);
    
    if (success) {
      setPreference(targetGender);
      // Unlock for 10 minutes
      setFilterUnlockedUntil(Date.now() + 10 * 60 * 1000);
      setShowFilterModal(false);
    }
  };

  const handleWatchAdForCoins = async () => {
    setIsWatchingAd(true);
    const success = await AdManager.showRewardedAd();
    setIsWatchingAd(false);
    if (success) {
      setCoins(c => c + 20);
      alert('You earned 20 coins!');
    }
  };

  if (!myGender) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 font-sans text-white">
        <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 max-w-md w-full shadow-2xl">
          <h2 className="text-2xl font-bold mb-6 text-center text-emerald-400">Select your gender</h2>
          <div className="space-y-3">
            {['male', 'female', 'other'].map(g => (
              <button
                key={g}
                onClick={() => setMyGender(g)}
                className="w-full py-4 px-6 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-lg font-medium capitalize transition-colors border border-zinc-700 hover:border-emerald-500/50"
              >
                {g === 'other' ? 'Other / Prefer not to say' : g}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="h-screen w-screen bg-black text-white font-sans overflow-hidden relative flex flex-col"
      onMouseMove={resetIdleTimer}
      onTouchStart={resetIdleTimer}
      onTouchMove={resetIdleTimer}
      onClick={resetIdleTimer}
      onKeyDown={resetIdleTimer}
      onScrollCapture={resetIdleTimer}
    >
      
      {/* Main Video Background */}
      <div className="absolute inset-0 z-0">
        {status === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 bg-zinc-950">
            <Video className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">Click Start to meet someone new</p>
          </div>
        )}

        {status === 'searching' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 bg-zinc-900/80 backdrop-blur-sm">
            <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
            <p className="text-lg animate-pulse">Searching for a partner...</p>
          </div>
        )}

        {/* Remote Video Element */}
        <video 
          ref={remoteVideoRef}
          autoPlay 
          playsInline 
          className={`w-full h-full object-cover ${status === 'connected' ? 'block' : 'hidden'}`}
        />

        {/* Fallback Video Element */}
        {status === 'fallback' && (
           <video 
             ref={fallbackVideoRef}
             src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
             autoPlay 
             loop 
             muted
             playsInline 
             className="w-full h-full object-cover"
           />
        )}
      </div>

      {/* Top Header Overlay */}
      <header className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-40 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <div className="flex flex-col gap-2 pointer-events-auto">
          <h1 className="text-xl font-bold tracking-tight text-emerald-400 drop-shadow-md">RandomChat</h1>
          <div className="flex items-center gap-2">
            <div className="text-xs text-amber-400 font-bold px-3 py-1 bg-black/50 backdrop-blur-md border border-amber-500/30 rounded-full flex items-center gap-1 shadow-lg">
              🪙 {coins}
            </div>
            <div className="text-xs text-zinc-300 font-medium px-3 py-1 bg-black/50 backdrop-blur-md border border-white/10 rounded-full shadow-lg">
              {status === 'idle' && 'Ready'}
              {status === 'searching' && 'Searching...'}
              {status === 'connected' && 'Connected'}
              {status === 'fallback' && 'Fallback Stream'}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3 pointer-events-auto">
          {status === 'idle' && (
            <button 
              onClick={() => setShowFilterModal(true)}
              className="p-2.5 bg-black/50 backdrop-blur-md hover:bg-black/70 rounded-full text-zinc-300 hover:text-white transition-colors border border-white/10 shadow-lg"
              title="Match Preferences"
            >
              <Filter className="w-5 h-5" />
            </button>
          )}

          {/* Partner Gift Score Indicator */}
          {status === 'connected' && (
            <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2 shadow-xl">
              <span className="text-lg">🎁</span>
              <span className="text-white font-bold text-sm">{partnerGiftScore}</span>
            </div>
          )}

          {/* Local Video (PiP) */}
          {(status !== 'idle') && (
            <div className="w-24 sm:w-32 aspect-video bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-white/10 relative">
              <video 
                ref={localVideoRef}
                autoPlay 
                playsInline 
                muted 
                className={`w-full h-full object-cover transform -scale-x-100 ${isVideoOff ? 'hidden' : 'block'}`}
              />
              <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded-md flex items-center gap-1">
                <span className="text-[10px]">🎁</span>
                <span className="text-white font-bold text-[10px]">{giftScore}</span>
              </div>
              {isVideoOff && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                  <VideoOff className="w-6 h-6 text-zinc-500" />
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Floating Chat Messages */}
      <div 
        className="absolute bottom-40 left-4 w-64 sm:w-80 max-h-[40vh] overflow-y-auto flex flex-col justify-end gap-2 z-30 pointer-events-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, x: -20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.3 } }}
              className={`pointer-events-auto w-fit max-w-full rounded-2xl px-4 py-2 text-sm shadow-lg backdrop-blur-md ${
                msg.isGift 
                  ? 'bg-gradient-to-r from-pink-500/80 to-purple-500/80 text-white font-medium border border-pink-400/30' 
                  : msg.sender === 'me'
                    ? 'bg-emerald-600/80 text-white border border-emerald-500/30'
                    : 'bg-black/60 text-zinc-100 border border-white/10'
              }`}
            >
              <span className="opacity-70 text-[10px] mr-2 font-bold uppercase tracking-wider">
                {msg.sender === 'me' ? 'You' : 'Partner'}
              </span>
              {msg.text}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Gift Animation Overlay */}
      <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden flex items-center justify-center">
        <AnimatePresence>
          {activeGifts.map((g) => (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, scale: 0, x: 0, y: 0, rotate: 0 }}
              animate={{ 
                opacity: [0, 1, 1, 0], 
                scale: g.scale, 
                x: g.x, 
                y: g.y - 200, // Float upwards
                rotate: g.rotation 
              }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ 
                duration: 2.5 + Math.random() * 1.5, 
                ease: "easeOut",
                times: [0, 0.2, 0.8, 1]
              }}
              className="absolute text-6xl drop-shadow-2xl"
            >
              {g.gift}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom Overlays (Gifts, Chat, Controls) */}
      <div className="absolute bottom-0 left-0 right-0 z-40 flex flex-col items-center pointer-events-none pb-4 px-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-20">
        
        {(status === 'connected' || status === 'fallback') && (
          <div className="w-full max-w-md flex flex-col items-center gap-3 pointer-events-auto mb-4">
            
            {/* Watch Ad Button */}
            <button
              onClick={handleWatchAdForCoins}
              className={`flex items-center justify-center gap-1.5 px-4 py-1.5 bg-black/60 backdrop-blur-md hover:bg-black/80 text-amber-400 border border-amber-500/30 rounded-full text-xs font-semibold shadow-lg ${isIdle ? 'opacity-35 transition-all duration-500 ease-out' : 'opacity-100 transition-none'}`}
            >
              <PlayCircle className="w-3.5 h-3.5" />
              Watch Ad • Earn Coins
            </button>

            {/* Gift Bar */}
            <div 
              className={`flex items-center gap-2 overflow-x-auto w-full justify-center ${isIdle ? 'opacity-35 scale-95 transition-all duration-500 ease-out' : 'opacity-100 scale-100 transition-none'}`}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {GIFTS.map(g => (
                <button 
                  key={g.name}
                  onClick={() => sendGift(g)}
                  className="flex flex-col items-center justify-center gap-1 bg-black/50 backdrop-blur-md rounded-xl border border-white/10 hover:bg-white/10 px-3 py-1.5 shrink-0 transition-transform hover:scale-105 shadow-lg"
                  title={`Send ${g.name} (${g.cost} coins)`}
                >
                  <span className="text-2xl">{g.emoji}</span>
                  <span className="text-[10px] text-zinc-300 font-medium">{g.cost}</span>
                </button>
              ))}
            </div>

            {/* Chat Input */}
            <form onSubmit={sendMessage} className={`w-full flex gap-2 ${isIdle ? 'opacity-35 transition-all duration-500 ease-out' : 'opacity-100 transition-none'}`}>
              <input 
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-black/50 backdrop-blur-md border border-white/10 text-white rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-lg placeholder:text-zinc-400"
              />
              <button 
                type="submit"
                disabled={!chatInput.trim()}
                className="w-10 h-10 flex items-center justify-center bg-emerald-600/90 backdrop-blur-md hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600/90 text-white rounded-full transition-colors shrink-0 shadow-lg"
              >
                <Send className="w-4 h-4 ml-[-2px]" />
              </button>
            </form>
          </div>
        )}

        {/* Control Buttons */}
        <div className={`w-full max-w-md flex justify-between items-center pointer-events-auto ${isIdle ? 'opacity-35 transition-all duration-500 ease-out' : 'opacity-100 transition-none'}`}>
          {status === 'idle' ? (
            <button 
              onClick={handleStart}
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-semibold transition-all shadow-lg shadow-emerald-900/20"
            >
              <Play className="w-5 h-5" />
              Start Chat
            </button>
          ) : (
            <>
              {/* Left: Mic & Cam */}
              <div className="flex gap-2">
                <button onClick={toggleMute} className={`w-12 h-12 flex items-center justify-center rounded-full backdrop-blur-md transition-all shadow-lg ${isMuted ? 'bg-red-500/80 text-white border border-red-400/50' : 'bg-black/50 text-white hover:bg-black/70 border border-white/10'}`}>
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <button onClick={toggleVideo} className={`w-12 h-12 flex items-center justify-center rounded-full backdrop-blur-md transition-all shadow-lg ${isVideoOff ? 'bg-red-500/80 text-white border border-red-400/50' : 'bg-black/50 text-white hover:bg-black/70 border border-white/10'}`}>
                  {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </button>
              </div>
              
              {/* Center: Stop */}
              <button 
                onClick={handleStop}
                className="w-14 h-14 flex items-center justify-center bg-red-600/90 backdrop-blur-md hover:bg-red-500 text-white rounded-full transition-all shadow-lg border border-red-500/50"
                title="Stop"
              >
                <Square className="w-5 h-5" />
              </button>

              {/* Right: Next */}
              <button 
                onClick={handleNext}
                className="flex items-center justify-center gap-2 px-6 h-12 bg-emerald-600/90 backdrop-blur-md hover:bg-emerald-500 text-white rounded-full font-semibold transition-all shadow-lg border border-emerald-500/50"
              >
                <SkipForward className="w-5 h-5" />
                <span>Next</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Match Preferences Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 max-w-sm w-full shadow-2xl relative">
            <h2 className="text-xl font-bold mb-4 text-white">Who do you want to meet?</h2>
            
            <div className="space-y-3">
              <button
                onClick={() => { setPreference('random'); setShowFilterModal(false); }}
                className={`w-full py-3 px-4 rounded-xl text-left font-medium flex justify-between items-center border ${
                  preference === 'random' ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600 text-white'
                }`}
              >
                Random (Free)
                {preference === 'random' && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
              </button>

              {['male', 'female'].map(g => {
                const isUnlocked = preference === g && filterUnlockedUntil && Date.now() < filterUnlockedUntil;
                return (
                  <button
                    key={g}
                    onClick={() => isUnlocked ? setShowFilterModal(false) : handleUnlockFilter(g)}
                    className={`w-full py-3 px-4 rounded-xl text-left font-medium flex justify-between items-center border ${
                      preference === g ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600 text-white'
                    }`}
                  >
                    <span className="capitalize">{g}</span>
                    {isUnlocked ? (
                      <div className="text-xs text-emerald-500">Active</div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs bg-zinc-700 px-2 py-1 rounded-md text-zinc-300">
                        <PlayCircle className="w-3 h-3" /> Watch Ad
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <button 
              onClick={() => setShowFilterModal(false)}
              className="mt-6 w-full py-3 text-zinc-400 hover:text-white font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Simulated Ad Overlay */}
      {isWatchingAd && (
        <div className="fixed inset-0 bg-black z-[60] flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-zinc-800 border-t-emerald-500 rounded-full animate-spin mb-6"></div>
          <h2 className="text-2xl font-bold text-white mb-2">Playing Rewarded Ad...</h2>
          <p className="text-zinc-400">Please wait to unlock your reward.</p>
        </div>
      )}
    </div>
  );
}
