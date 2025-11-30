// server.js
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- simple request logger ----------
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

// ---------- favicon quick handler ----------
app.get("/favicon.ico", (req, res) => res.status(204).end());

// ---------- database setup ----------
const dbPath = path.join(__dirname, "database", "payments.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Database connection error:", err);
  } else {
    console.log("Connected to SQLite database:", dbPath);
  }
});

db.serialize(() => {
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
});

// ---------- views, static, body parser ----------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: false }));

// ---------- session ----------
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
  })
);

// ---------- health check ----------
app.get("/health", (req, res) => res.status(200).send("ok"));

// ---------- protect middleware ----------
function protect(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

// ---------- routes ----------
// Safe root route: attempt to render home, fallback to minimal page on render errors
app.get("/", protect, (req, res) => {
  try {
    res.render("home", { user: req.session.user }, (err, html) => {
      if (err) {
        console.error("EJS render error for / (home):", err);
        // respond with minimal HTML so Railway sees 200 and doesn't mark app as unresponsive
        return res.status(200).send(
          `<!doctype html><html><head><meta charset="utf-8"><title>Home</title></head><body><h1>Welcome</h1><p>Site is up (fallback).</p></body></html>`
        );
      }
      return res.send(html);
    });
  } catch (err) {
    console.error("Unhandled error in / route:", err);
    return res.status(200).send(
      `<!doctype html><html><body><h1>Welcome</h1><p>Running (fallback).</p></body></html>`
    );
  }
});

app.get("/register", (req, res) => {
  // render register safely
  res.render("register", {}, (err, html) => {
    if (err) {
      console.error("Render error register:", err);
      return res.status(200).send("<h1>Register page temporarily unavailable</h1>");
    }
    res.send(html);
  });
});

app.post("/register", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).send("Email and password required");

  const hashed = bcrypt.hashSync(password, 10);

  db.run(`INSERT INTO users (email, password) VALUES (?, ?)`, [email, hashed], (err) => {
    if (err) {
      console.error("Register error:", err);
      return res.status(400).send("Error: Email already taken or invalid input");
    }
    res.redirect("/login");
  });
});

app.get("/login", (req, res) => {
  res.render("login", {}, (err, html) => {
    if (err) {
      console.error("Render error login:", err);
      return res.status(200).send("<h1>Login page temporarily unavailable</h1>");
    }
    res.send(html);
  });
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

// 404 handler
app.use((req, res) => {
  res.status(404).send("404 - Page not found");
});

// central error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (!res.headersSent) res.status(500).send("Internal server error");
});

// ---------- start server ----------
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// graceful shutdown & global error handlers
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
