import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Gender, Preference, ChatState, Message } from './types';
import GenderSelection from './components/GenderSelection';
import ChatRoom from './components/ChatRoom';

let socket: Socket | null = null;

export default function App() {
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const [step, setStep] = useState<'gender_selection' | 'chat'>('gender_selection');
  
  const [chatState, setChatState] = useState<ChatState>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStrangerTyping, setIsStrangerTyping] = useState(false);

  useEffect(() => {
    if (!socket) {
      socket = io();
    }

    socket.on('active_users', (count: number) => {
      setActiveUsers(count);
    });

    socket.on('waiting', () => {
      setChatState('waiting');
      setMessages([]); // Clear messages on new search
      setIsStrangerTyping(false);
    });

    socket.on('matched', () => {
      setChatState('matched');
      setMessages([]); // Clear messages when matched
      setIsStrangerTyping(false);
    });

    socket.on('message', (text: string) => {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), text, sender: 'stranger' }]);
      setIsStrangerTyping(false);
    });

    socket.on('typing', (isTyping: boolean) => {
      setIsStrangerTyping(isTyping);
    });

    socket.on('partner_disconnected', () => {
      setChatState('disconnected');
      setIsStrangerTyping(false);
    });

    return () => {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
    };
  }, []);

  const handleStart = (gender: Gender, preference: Preference) => {
    if (socket) {
      setStep('chat');
      setChatState('waiting');
      setMessages([]);
      socket.emit('join', { gender, preference });
    }
  };

  const handleSendMessage = (text: string) => {
    if (socket && chatState === 'matched') {
      socket.emit('message', text);
      setMessages(prev => [...prev, { id: crypto.randomUUID(), text, sender: 'me' }]);
    }
  };

  const handleTyping = (isTyping: boolean) => {
    if (socket && chatState === 'matched') {
      socket.emit('typing', isTyping);
    }
  };

  const handleNext = () => {
    if (socket) {
      socket.emit('next');
      setChatState('waiting');
      setMessages([]);
      setIsStrangerTyping(false);
    }
  };

  const handleDisconnect = () => {
    if (socket) {
      socket.emit('leave');
    }
    setStep('gender_selection');
    setChatState('idle');
    setMessages([]);
    setIsStrangerTyping(false);
  };

  return (
    <>
      {step === 'gender_selection' ? (
        <GenderSelection activeUsers={activeUsers} onStart={handleStart} />
      ) : (
        <ChatRoom
          chatState={chatState}
          messages={messages}
          isStrangerTyping={isStrangerTyping}
          onSendMessage={handleSendMessage}
          onTyping={handleTyping}
          onNext={handleNext}
          onDisconnect={handleDisconnect}
        />
      )}
    </>
  );
}
