const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const db = new sqlite3.Database("./database.db", (err) => {
    if (err) {
        console.log("Database connection error:", err);
    } else {
        console.log("Connected to SQLite database");
    }
});

db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: false }));

app.use(
    session({
        secret: "supersecretkey",
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 1000 * 60 * 60 * 24 }
    })
);

function protect(req, res, next) {
    if (!req.session.user) return res.redirect("/login");
    next();
}

app.get("/", protect, (req, res) => {
    res.render("home", { user: req.session.user });
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.post("/register", (req, res) => {
    const { email, password } = req.body;

    const hashed = bcrypt.hashSync(password, 10);

    db.run(
        `INSERT INTO users (email, password) VALUES (?, ?)`,
        [email, hashed],
        (err) => {
            if (err) {
                return res.send("Error: Email already taken");
            }
            res.redirect("/login");
        }
    );
});

app.get("/login", (req, res) => {
    res.render("login");
});

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

app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/login");
});

app.use((req, res) => {
    res.status(404).send("404 - Page not found");
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
