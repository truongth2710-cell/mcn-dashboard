import express from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { authMiddleware, createStaff, findStaffByEmail, generateToken } from "../auth.js";

const router = express.Router();

// Register
router.post("/register", async (req, res) => {
  try {
    const { email, name, password, role } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const existing = await findStaffByEmail(email);
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const count = await pool.query("SELECT COUNT(*)::int AS count FROM staff_users");
    const isFirst = count.rows[0].count === 0;
    const finalRole = isFirst ? "admin" : role || "viewer";

    const user = await createStaff({ email, name, password, role: finalRole });
    const token = generateToken(user);
    res.json({ user, token, firstUser: isFirst });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await findStaffByEmail(email);
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    const { password_hash, ...safeUser } = user;
    const token = generateToken(safeUser);
    res.json({ user: safeUser, token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Me
router.get("/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

export default router;
