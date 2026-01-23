const express = require("express");
const cors = require("cors");
const { WebSocketServer } = require("ws");
const http = require("http");

const app = express();
const PORT = 3001;

// CORS configuration - must be before other middleware
app.use(cors({
  origin: '*', // Allow all origins for development
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Create HTTP server first
const server = http.createServer(app);

// Attach WebSocket server to the HTTP server (correct syntax)
const wss = new WebSocketServer({ server });

let sseClients = [];

// SSE endpoint
app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  const clientId = Date.now();
  const newClient = { id: clientId, res: res };
  sseClients.push(newClient);

  console.log(`SSE Connection opened: ${clientId} (Total: ${sseClients.length})`);

  req.on("close", () => {
    console.log(`SSE Connection closed: ${clientId}`);
    sseClients = sseClients.filter((client) => client.id !== clientId);
  });
});

// Attendance broadcast endpoint
app.post("/broadcast-attendance", (req, res) => {
  const { message, type } = req.body;
  const timestamp = new Date().toLocaleTimeString();
  const payload = JSON.stringify({ message, type, timestamp });

  sseClients.forEach((client) => {
    client.res.write(`data: ${payload}\n\n`);
  });

  res.json({ success: true, broadcastCount: sseClients.length });
});

//  HEALTH ENDPOINT
app.get("/health", (req, res) => {
  const uptime = process.uptime(); // in seconds
  const memoryUsage = process.memoryUsage().rss; // in bytes
  const memoryMB = Math.round(memoryUsage / 1024 / 1024); // Convert to MB

  res.json({
    uptime: uptime,
    memory: memoryMB,
    timestamp: new Date().toISOString(),
    status: "healthy"
  });
});

// WebSocket connection handling
wss.on("connection", (ws) => {
  console.log("🔌 WebSocket client connected");

  ws.on("message", (data) => {
    const message = data.toString();
    if (message === "PING") {
      console.log(" Received PING, sending PONG");
      ws.send("PONG");
    }
  });

  ws.on("close", () => {
    console.log(" WebSocket client disconnected");
  });

  ws.on("error", (error) => {
    console.error(" WebSocket error:", error);
  });
});

// Start the server using the HTTP server instance (not app.listen)
server.listen(PORT, (error) => {
  if (!error) {
    console.log(` Server started on port ${PORT}`);
    console.log(` SSE: http://localhost:${PORT}/events`);
    console.log(` WebSocket: ws://localhost:${PORT}`);
    console.log(`  Health: http://localhost:${PORT}/health`);
  } else {
    console.log(" Server startup error:", error);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log(' SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});