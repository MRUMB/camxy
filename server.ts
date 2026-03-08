import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';

interface WaitingUser {
  id: string;
  socket: any;
  gender: string;
  preference: string;
  giftScore: number;
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  let waitingUsers: WaitingUser[] = [];

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('find_partner', (data: { gender: string, preference: string, giftScore: number }) => {
      const { gender, preference, giftScore } = data || { gender: 'other', preference: 'random', giftScore: 0 };
      
      // Sort waiting users by giftScore descending (Tier system implicitly handled by sorting)
      waitingUsers.sort((a, b) => b.giftScore - a.giftScore);

      // Try to find a match
      const matchIndex = waitingUsers.findIndex(user => {
        if (user.id === socket.id) return false;
        
        const iMatchThem = user.preference === 'random' || user.preference === gender;
        const theyMatchMe = preference === 'random' || preference === user.gender;
        
        return iMatchThem && theyMatchMe;
      });

      if (matchIndex !== -1) {
        const matchedUser = waitingUsers[matchIndex];
        waitingUsers.splice(matchIndex, 1); // Remove from waiting list

        const room = `room_${socket.id}_${matchedUser.id}`;
        socket.join(room);
        matchedUser.socket.join(room);

        io.to(matchedUser.id).emit('paired', { room, initiator: true, partnerGiftScore: giftScore });
        io.to(socket.id).emit('paired', { room, initiator: false, partnerGiftScore: matchedUser.giftScore });
      } else {
        // Remove existing entry if user is already waiting
        waitingUsers = waitingUsers.filter(u => u.id !== socket.id);
        
        waitingUsers.push({
          id: socket.id,
          socket,
          gender,
          preference,
          giftScore
        });
      }
    });

    socket.on('signal', (data) => {
      socket.to(data.room).emit('signal', {
        sender: socket.id,
        signal: data.signal
      });
    });

    socket.on('leave_room', (room) => {
      socket.leave(room);
      socket.to(room).emit('partner_left');
    });

    socket.on('send_message', (data) => {
      socket.to(data.room).emit('receive_message', { text: data.text });
    });

    socket.on('send_gift', (data) => {
      socket.to(data.room).emit('receive_gift', { gift: data.gift, score: data.score });
    });

    socket.on('cancel_search', () => {
      waitingUsers = waitingUsers.filter(u => u.id !== socket.id);
    });

    socket.on('disconnect', () => {
      waitingUsers = waitingUsers.filter(u => u.id !== socket.id);
      for (const room of socket.rooms) {
        if (room !== socket.id) {
          socket.to(room).emit('partner_left');
        }
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
