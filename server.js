// ==============================
// IMPORTS
// ==============================
const express = require("express");
const path = require("path");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();

// ==============================
// APP INITIALIZATION
// ==============================
const app = express();
const PORT = process.env.PORT || 8080;

// ==============================
// DATABASE SETUP
// ==============================
const db = new sqlite3.Database("./database.db", (err) => {
    if (err) {
        console.log("Database connection error:", err);
    } else {
        console.log("Connected to SQLite database");
    }
});

// Create users table if missing
db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// ==============================
// MIDDLEWARE
// ==============================
app.use(express.urlencoded({ extended: true }));

// FIXED: Serve static public folder correctly
app.use(express.static(path.join(__dirname, "public")));

// FIXED: Persistent session store for production
app.use(
    session({
        store: new SQLiteStore({ db: "sessions.db", dir: "./" }),
        secret: "supersecretkey",
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 1000 * 60 * 60 * 24, // 1 day
        }
    })
);

// ==============================
// AUTH MIDDLEWARE
// ==============================
function protect(req, res, next) {
    if (!req.session.user) return res.redirect("/login.html");
    next();
}

// ==============================
// ROUTES
// ==============================

// Protected home
app.get("/", protect, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// Register (POST)
app.post("/register", (req, res) => {
    const { email, password } = req.body;

    const hashed = bcrypt.hashSync(password, 10);

    db.run(
        `INSERT INTO users (email, password) VALUES (?, ?)`,
        [email, hashed],
        (err) => {
            if (err) return res.send("Error: Email already taken");

            res.redirect("/login.html");
        }
    );
});

// Login (POST)
app.post("/login", (req, res) => {
    const { email, password } = req.body;

    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (!user) return res.send("User not found");

        const match = bcrypt.compareSync(password, user.password);
        if (!match) return res.send("Incorrect password");

        req.session.user = { id: user.id, email: user.email };
        res.redirect("/");
    });
});

// Logout
app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/login.html");
    });
});

// ==============================
// 404 FALLBACK
// ==============================
app.use((req, res) => {
    res.status(404).send("404 - Page not found");
});

// ==============================
// START SERVER
// ==============================
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
