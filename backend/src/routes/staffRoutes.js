import express from "express";
import { pool } from "../db.js";
import { authMiddleware } from "../auth.js";

const router = express.Router();

/**
 * Danh sách nhân sự (admin).
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const result = await pool.query(
      `
      SELECT id, name, email, role
      FROM staff_users
      WHERE role <> 'deleted'
      ORDER BY id DESC;
      `
    );
    res.json(result.rows);
  } catch (err) {
    console.error("List staff error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

/**
 * Soft delete nhân sự:
 * - xóa mapping staff_channels
 * - set role = 'deleted'
 */
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const id = Number(req.params.id);

    await pool.query(
      `
      DELETE FROM staff_channels
      WHERE staff_id = $1;
      `,
      [id]
    );

    await pool.query(
      `
      UPDATE staff_users
      SET role = 'deleted'
      WHERE id = $1;
      `,
      [id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Delete staff error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

export default router;