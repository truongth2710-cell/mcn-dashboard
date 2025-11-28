import express from "express";
import { pool } from "../db.js";
import { authMiddleware } from "../auth.js";

const router = express.Router();

/**
 * List projects – ai đăng nhập cũng xem được.
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, name, description, start_date, end_date
      FROM projects
      ORDER BY id DESC;
      `
    );
    res.json(result.rows);
  } catch (err) {
    console.error("List projects error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

/**
 * Tạo project (admin).
 */
router.post("/", authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { name, description, start_date, end_date } = req.body;
    const result = await pool.query(
      `
      INSERT INTO projects (name, description, start_date, end_date)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
      `,
      [name, description || null, start_date || null, end_date || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create project error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

/**
 * Sửa project (admin).
 */
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const id = Number(req.params.id);
    const { name, description, start_date, end_date } = req.body;
    const result = await pool.query(
      `
      UPDATE projects
      SET
        name        = COALESCE($1, name),
        description = COALESCE($2, description),
        start_date  = COALESCE($3, start_date),
        end_date    = COALESCE($4, end_date)
      WHERE id = $5
      RETURNING *;
      `,
      [name || null, description || null, start_date || null, end_date || null, id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update project error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

/**
 * Xóa project (admin).
 */
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const id = Number(req.params.id);
    await pool.query(
      `
      DELETE FROM projects
      WHERE id = $1;
      `,
      [id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Delete project error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

export default router;