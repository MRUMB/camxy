import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server, Socket } from "socket.io";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);
  
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Socket.io logic
  setupSocket(io);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// --- Matching Logic ---

type Gender = "Male" | "Female";
type Preference = "Male" | "Female" | "Random";

interface User {
  id: string;
  socket: Socket;
  gender: Gender;
  preference: Preference;
  partnerId: string | null;
}

const users = new Map<string, User>();
const waitingQueue = new Set<string>();

function setupSocket(io: Server) {
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    io.emit("active_users", io.engine.clientsCount);

    socket.on("join", ({ gender, preference }: { gender: Gender; preference: Preference }) => {
      const user: User = {
        id: socket.id,
        socket,
        gender,
        preference,
        partnerId: null,
      };
      users.set(socket.id, user);
      tryMatch(user);
    });

    socket.on("message", (text: string) => {
      const user = users.get(socket.id);
      if (user && user.partnerId) {
        io.to(user.partnerId).emit("message", text);
      }
    });

    socket.on("typing", (isTyping: boolean) => {
      const user = users.get(socket.id);
      if (user && user.partnerId) {
        io.to(user.partnerId).emit("typing", isTyping);
      }
    });

    socket.on("next", () => {
      const user = users.get(socket.id);
      if (user) {
        disconnectPartner(user);
        tryMatch(user);
      }
    });

    socket.on("leave", () => {
      const user = users.get(socket.id);
      if (user) {
        disconnectPartner(user);
        waitingQueue.delete(user.id);
        users.delete(user.id);
      }
    });

    socket.on("disconnect", () => {
      const user = users.get(socket.id);
      if (user) {
        disconnectPartner(user);
        waitingQueue.delete(user.id);
        users.delete(user.id);
      }
      console.log("User disconnected:", socket.id);
      io.emit("active_users", io.engine.clientsCount);
    });
  });

  function disconnectPartner(user: User) {
    if (user.partnerId) {
      const partner = users.get(user.partnerId);
      if (partner) {
        partner.partnerId = null;
        partner.socket.emit("partner_disconnected");
      }
      user.partnerId = null;
    }
  }

  function tryMatch(user: User) {
    if (user.partnerId) return;

    waitingQueue.delete(user.id);

    let candidates = Array.from(waitingQueue)
      .map((id) => users.get(id))
      .filter((u): u is User => u !== undefined && u.id !== user.id);

    // Filter by strict preferences
    let validCandidates = candidates.filter((candidate) => {
      if (user.preference !== "Random" && user.preference !== candidate.gender) return false;
      if (candidate.preference !== "Random" && candidate.preference !== user.gender) return false;
      return true;
    });

    let bestMatch: User | null = null;

    if (validCandidates.length > 0) {
      if (user.preference === "Random") {
        // Apply bias
        const targetGenderIsMale = user.gender === "Female" ? Math.random() < 0.95 : Math.random() < 0.90;
        const targetGender = targetGenderIsMale ? "Male" : "Female";
        
        const preferredCandidates = validCandidates.filter(c => c.gender === targetGender);
        
        if (preferredCandidates.length > 0) {
          bestMatch = preferredCandidates[Math.floor(Math.random() * preferredCandidates.length)];
        } else {
          bestMatch = validCandidates[Math.floor(Math.random() * validCandidates.length)];
        }
      } else {
        bestMatch = validCandidates[Math.floor(Math.random() * validCandidates.length)];
      }
    }

    if (bestMatch) {
      waitingQueue.delete(bestMatch.id);
      user.partnerId = bestMatch.id;
      bestMatch.partnerId = user.id;

      user.socket.emit("matched");
      bestMatch.socket.emit("matched");
    } else {
      waitingQueue.add(user.id);
      user.socket.emit("waiting");
    }
  }
}

startServer();
