const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getDb } = require("../db");

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET || "dev-secret-change-me",
    { expiresIn: "7d" }
  );
}

router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email and password are required" });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: "password must be at least 6 characters" });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const db = getDb();

    const existing = await db.get("SELECT id FROM users WHERE email = ?", cleanEmail);
    if (existing) {
      return res.status(409).json({ error: "email already registered" });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const result = await db.run(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
      String(name).trim(),
      cleanEmail,
      passwordHash
    );

    const user = { id: result.lastID, name: String(name).trim(), email: cleanEmail };
    const token = createToken(user);

    return res.status(201).json({ message: "Registered successfully", token, user });
  } catch (err) {
    return next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const db = getDb();

    const user = await db.get(
      "SELECT id, name, email, password_hash FROM users WHERE email = ?",
      cleanEmail
    );

    if (!user) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const isValid = await bcrypt.compare(String(password), user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const token = createToken(user);
    return res.status(200).json({
      message: "Login successful",
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
