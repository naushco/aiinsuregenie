// src/server.js — Express server entry point
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { migrate } = require("./database");

// Initialize database
migrate();

var app = express();
var PORT = process.env.PORT || 3001;

// ============================================================
// MIDDLEWARE
// ============================================================

// Security headers
app.use(helmet());

// CORS — allow your chatbot frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Parse JSON bodies
app.use(express.json({ limit: "1mb" }));

// Rate limiting — prevent abuse
var leadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,             // 30 leads per minute per IP
  message: { error: "Too many requests. Please slow down." },
});

var adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
});

// Request logging
app.use(function (req, res, next) {
  var start = Date.now();
  res.on("finish", function () {
    var duration = Date.now() - start;
    if (req.path !== "/health") {
      console.log(
        new Date().toISOString(),
        req.method,
        req.path,
        res.statusCode,
        duration + "ms",
        req.ip
      );
    }
  });
  next();
});

// ============================================================
// ROUTES
// ============================================================

// Health check
app.get("/health", function (req, res) {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Lead submission API (from chatbot)
app.use("/api/leads", leadLimiter, require("./routes/leads"));

// Admin dashboard API
app.use("/api/admin", adminLimiter, require("./routes/admin"));

// ============================================================
// ERROR HANDLING
// ============================================================
app.use(function (err, req, res, next) {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// 404
app.use(function (req, res) {
  res.status(404).json({ error: "Not found" });
});

// ============================================================
// START
// ============================================================
app.listen(PORT, function () {
  console.log("");
  console.log("===========================================");
  console.log("  AI InsureGenie Lead Distribution System");
  console.log("  Running on port " + PORT);
  console.log("  Mode: " + (process.env.DISTRIBUTION_MODE || "hybrid"));
  console.log("  Environment: " + (process.env.NODE_ENV || "development"));
  console.log("===========================================");
  console.log("");
});

module.exports = app;
