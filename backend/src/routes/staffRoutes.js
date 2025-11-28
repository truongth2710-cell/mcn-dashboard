import express from "express";
import { pool } from "../db.js";
import { authMiddleware, requireRole } from "../auth.js";

const router = express.Router();

// List staff
router.get("/", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, name, role, created_at FROM staff_users ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("List staff error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

// Channels for a staff
router.get("/:id/channels", authMiddleware, async (req, res) => {
  try {
    const staffId = parseInt(req.params.id, 10);
    const user = req.user;
    if (user.role !== "admin" && user.id !== staffId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const result = await pool.query(
      `
      SELECT c.*
      FROM channels c
      INNER JOIN staff_channels sc ON sc.channel_id = c.id
      WHERE sc.staff_id = $1;
      `,
      [staffId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Staff channels error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
