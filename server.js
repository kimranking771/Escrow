// server.js (replace your current file with this)
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// ---- request logger middleware (simple)
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

// --------------------------
// DATABASE CONNECTION
// --------------------------
const dbPath = path.join(__dirname, "database", "payments.db"); // make sure file exists in repo/database

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Database connection error:", err);
    // Do not crash here — log and continue (Railway will show logs)
  } else {
    console.log("Connected to SQLite database:", dbPath);
  }
});

db.run(
  `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  (err) => {
    if (err) console.error("Error creating users table:", err);
    else console.log("Users table ready");
  }
);

// -----------------------------------
// VIEW ENGINE + PUBLIC FOLDER
// -----------------------------------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: false }));

// ------------------
// SESSION CONFIG
// ------------------
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
  })
);

// ------------------
// HEALTH CHECK (important for Railway)
// ------------------
app.get("/health", (req, res) => {
  // simple health check Railway can hit
  res.status(200).send("ok");
});

// ------------------
// PROTECT ROUTES
// ------------------
function protect(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

// ------------------
// ROUTES
// ------------------
app.get("/", protect, (req, res) => {
  // if views are missing this will throw — we'll catch it with the error handler below
  res.render("home", { user: req.session.user });
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).send("Email and password required");

  const hashed = bcrypt.hashSync(password, 10);

  db.run(`INSERT INTO users (email, password) VALUES (?, ?)`, [email, hashed], (err) => {
    if (err) {
      console.error("Register error:", err);
      return res.status(400).send("Error: Email already taken");
    }
    res.redirect("/login");
  });
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).send("Email and password required");

  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
    if (err) {
      console.error("DB error on login:", err);
      return res.status(500).send("Server error");
    }
    if (!user) return res.status(400).send("User not found");

    const match = bcrypt.compareSync(password, user.password);
    if (!match) return res.status(400).send("Incorrect password");

    req.session.user = { id: user.id, email: user.email };
    res.redirect("/");
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// 404 catch
app.use((req, res) => {
  res.status(404).send("404 - Page not found");
});

// central error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (!res.headersSent) res.status(500).send("Internal server error");
});

// ------------------------
// START SERVER (Railway OK)
// ------------------------
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown handlers and logging so Railway doesn't silently kill us
process.on("SIGTERM", () => {
  console.log("SIGTERM received: shutting down gracefully");
  server.close(() => {
    console.log("Closed out remaining connections");
    process.exit(0);
  });
  setTimeout(() => {
    console.error("Forcing shutdown");
    process.exit(1);
  }, 10000);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  process.exit(1);
});
