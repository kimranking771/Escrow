const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------- DATABASE ------------------------
const db = new sqlite3.Database("./database.db", (err) => {
    if (err) return console.log("Database error:", err);
    console.log("Connected to SQLite database");
});

db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// ------------------------ VIEW ENGINE -----------------------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ------------------------ MIDDLEWARE ------------------------
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: false }));

app.use(
    session({
        secret: "supersecretkey",
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 86400000 } // 1 day
    })
);

// ------------------------ AUTH MIDDLEWARE --------------------
function protect(req, res, next) {
    if (!req.session.user) return res.redirect("/login");
    next();
}

// ------------------------ ROUTES -----------------------------
app.get("/", protect, (req, res) => {
    res.render("home", { user: req.session.user });
});

// ----- REGISTER ------
app.get("/register", (req, res) => res.render("register"));

app.post("/register", (req, res) => {
    const { email, password } = req.body;

    const hashed = bcrypt.hashSync(password, 10);

    db.run(
        `INSERT INTO users (email, password) VALUES (?, ?)`,
        [email, hashed],
        (err) => {
            if (err) return res.send("Error: Email already taken");
            res.redirect("/login");
        }
    );
});

// ----- LOGIN ------
app.get("/login", (req, res) => res.render("login"));

app.post("/login", (req, res) => {
    const { email, password } = req.body;

    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (!user) return res.send("User not found");
        if (!bcrypt.compareSync(password, user.password))
            return res.send("Incorrect password");

        req.session.user = { id: user.id, email: user.email };

        res.redirect("/");
    });
});

// ----- LOGOUT ------
app.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/login"));
});

// -------------------- STATIC PAGES --------------------------
app.get("/dashboard", protect, (req, res) => res.render("dashboard"));
app.get("/chat", protect, (req, res) => res.render("chat"));
app.get("/order", protect, (req, res) => res.render("order"));
app.get("/payment", protect, (req, res) => res.render("payment"));
app.get("/refund", protect, (req, res) => res.render("refund"));
app.get("/select", protect, (req, res) => res.render("select"));
app.get("/signup", protect, (req, res) => res.render("signup"));
app.get("/success", protect, (req, res) => res.render("success"));
app.get("/terms", protect, (req, res) => res.render("terms"));
app.get("/verify", protect, (req, res) => res.render("verify"));
app.get("/index", protect, (req, res) => res.render("index"));

// -------------------- 404 HANDLER ---------------------------
app.use((req, res) => res.status(404).send("404 - Page not found"));

// -------------------- START SERVER --------------------------
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
