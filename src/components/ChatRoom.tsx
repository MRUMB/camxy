import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, XCircle, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { ChatState, Message } from '../types';
import BannerAd from './BannerAd';

interface Props {
  chatState: ChatState;
  messages: Message[];
  isStrangerTyping: boolean;
  onSendMessage: (text: string) => void;
  onTyping: (isTyping: boolean) => void;
  onNext: () => void;
  onDisconnect: () => void;
}

export default function ChatRoom({
  chatState,
  messages,
  isStrangerTyping,
  onSendMessage,
  onTyping,
  onNext,
  onDisconnect
}: Props) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingLocalRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStrangerTyping]);

  const setTyping = (typing: boolean) => {
    if (isTypingLocalRef.current !== typing) {
      isTypingLocalRef.current = typing;
      onTyping(typing);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || chatState !== 'matched') return;
    
    onSendMessage(inputText.trim());
    setInputText('');
    setTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputText(text);
    
    if (chatState === 'matched') {
      if (text.trim().length > 0) {
        setTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setTyping(false);
        }, 1500);
      } else {
        setTyping(false);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans h-[100dvh]">
      <BannerAd />

      {/* Status Bar */}
      <div className="bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 p-3 flex items-center justify-center shrink-0 z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={chatState}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex items-center gap-2 text-sm font-medium"
          >
            {chatState === 'waiting' && (
              <>
                <Loader2 size={16} className="animate-spin text-emerald-500" />
                <span className="text-zinc-300">Looking for a stranger...</span>
              </>
            )}
            {chatState === 'matched' && (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span className="text-zinc-100">You are now chatting with a stranger</span>
              </>
            )}
            {chatState === 'disconnected' && (
              <>
                <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                <span className="text-zinc-400">Stranger has disconnected</span>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={cn(
                "flex w-full",
                msg.sender === 'me' ? "justify-end" : msg.sender === 'stranger' ? "justify-start" : "justify-center"
              )}
            >
              {msg.sender === 'system' ? (
                <div className="text-xs font-medium text-zinc-500 bg-zinc-900/50 px-4 py-1.5 rounded-full border border-zinc-800/50 my-2">
                  {msg.text}
                </div>
              ) : (
                <div
                  className={cn(
                    "max-w-[85%] sm:max-w-[75%] px-5 py-3 rounded-3xl text-[15px] leading-relaxed shadow-sm",
                    msg.sender === 'me'
                      ? "bg-emerald-600 text-white rounded-br-sm shadow-emerald-900/20"
                      : "bg-zinc-800 text-zinc-100 rounded-bl-sm border border-zinc-700/50 shadow-black/20"
                  )}
                >
                  {msg.text}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isStrangerTyping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex justify-start"
          >
            <div className="bg-zinc-800 border border-zinc-700/50 rounded-3xl rounded-bl-sm px-5 py-4 flex gap-1.5 items-center shadow-sm">
              <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Controls & Input Area */}
      <div className="p-4 sm:p-6 bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-800 shrink-0">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Action Buttons */}
          <div className="flex justify-between items-center px-1">
            <button
              onClick={onDisconnect}
              className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all flex items-center gap-2 text-sm font-medium"
            >
              <XCircle size={16} />
              <span className="hidden sm:inline">Disconnect</span>
            </button>
            <button
              onClick={onNext}
              className="px-6 py-2 rounded-xl bg-zinc-100 text-zinc-900 hover:bg-white transition-all flex items-center gap-2 text-sm font-bold shadow-[0_0_15px_rgba(255,255,255,0.1)]"
            >
              <RefreshCw size={16} />
              Next Stranger
            </button>
          </div>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              disabled={chatState !== 'matched'}
              placeholder={chatState === 'matched' ? "Type a message..." : "Waiting for stranger..."}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-3.5 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 disabled:opacity-50 transition-all shadow-inner"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || chatState !== 'matched'}
              className="bg-emerald-500 text-zinc-950 px-5 rounded-2xl hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center shadow-lg shadow-emerald-900/20"
            >
              <Send size={20} className="ml-0.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
