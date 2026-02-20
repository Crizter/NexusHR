import "dotenv/config";
import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    database: "connected",
    env: process.env.NODE_ENV,
  });
});

// ─── Routes (add here as you build them) ──────────────────────────────────────
// app.use('/api/auth',      authRoutes);
// app.use('/api/employees', employeeRoutes);
// app.use('/api/leaves',    leaveRoutes);

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
  });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
const start = async () => {
  await connectDB(); // Connect DB first
  app.listen(PORT, () => {
    console.log('listening on port',PORT) ; 
  });
};

start();
