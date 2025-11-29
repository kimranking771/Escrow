/* =========================
   EscrowSwap — SERVER
   ========================= */

const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const bodyParser = require("body-parser");
const Datastore = require("nedb-promises");

const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));

app.use(
    session({
        secret: "escrowswap_secret_key_2025",
        resave: false,
        saveUninitialized: true,
        cookie: { maxAge: 24 * 60 * 60 * 1000 }
    })
);

/* =========================
   DATABASE SETUP (NeDB)
   ========================= */

const usersDB = Datastore.create({
    filename: "./database_users.db",
    autoload: true
});

// Create unique index for email
usersDB.ensureIndex({ fieldName: "email", unique: true });

/* =========================
   DEFAULT ADMIN USER
   ========================= */

async function createAdminUser() {
    const adminEmail = "lkimtai90@gmail.com";
    const adminPassword = "@2030Abc";

    const existing = await usersDB.findOne({ email: adminEmail });

    if (existing) {
        console.log("✔ Admin already exists");
        return;
    }

    const hash = bcrypt.hashSync(adminPassword, 10);

    await usersDB.insert({
        email: adminEmail,
        password: hash,
        phone: "0000000000",
        verified: 1,
        role: "admin"
    });

    console.log("✔ Admin created:", adminEmail);
}

createAdminUser();

/* =========================
   SIGNUP — Create Account
   ========================= */

app.post("/signup", async (req, res) => {
    const { email, password, phone } = req.body;

    if (!email || !password) {
        return res.json({ success: false, message: "Missing fields." });
    }

    try {
        const hash = bcrypt.hashSync(password, 10);

        const user = await usersDB.insert({
            email,
            password: hash,
            phone,
            verified: 0,
            role: "user"
        });

        res.json({ success: true, userId: user._id });
    } catch (err) {
        res.json({ success: false, message: "Email already exists." });
    }
});

/* =========================
   EMAIL VERIFICATION
   ========================= */

app.post("/verify-email", async (req, res) => {
    const { email } = req.body;

    try {
        await usersDB.update(
            { email },
            { $set: { verified: 1 } }
        );

        res.json({ success: true });
    } catch {
        res.json({ success: false });
    }
});

/* =========================
   LOGIN — Check Credentials
   ========================= */

app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await usersDB.findOne({ email });
        if (!user) {
            return res.json({ success: false, message: "Email not found." });
        }

        const match = bcrypt.compareSync(password, user.password);
        if (!match) {
            return res.json({ success: false, message: "Incorrect password." });
        }

        req.session.userId = user._id;
        req.session.role = user.role;

        res.json({ success: true, role: user.role });
    } catch (err) {
        return res.json({ success: false, message: "Database error" });
    }
});

/* =========================
   AUTH MIDDLEWARE
   ========================= */

function requireLogin(req, res, next) {
    if (!req.session.userId) {
        return res.redirect("/login.html");
    }
    next();
}

/* =========================
   DASHBOARD ROUTES
   ========================= */

app.get("/dashboard", requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/admin", requireLogin, (req, res) => {
    if (req.session.role !== "admin") {
        return res.send("ACCESS DENIED");
    }
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

/* =========================
   SERVER START
   ========================= */

const PORT = 3000;
app.listen(PORT, () => {
    console.log("EscrowSwap server running on port " + PORT);
});
/* =========================
   PAYMENTS DATABASE
   ========================= */
const paymentsDB = Datastore.create({
    filename: "database/payments.db",
    autoload: true
});
