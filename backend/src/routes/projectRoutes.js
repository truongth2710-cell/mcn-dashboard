import express from "express";
import { pool } from "../db.js";
import { authMiddleware, requireRole } from "../auth.js";

const router = express.Router();

// List projects
router.get("/", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, description, start_date, end_date FROM projects ORDER BY name ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("List projects error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

// Create project
router.post("/", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { name, description, start_date, end_date } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
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


router.delete("/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.query("DELETE FROM projects WHERE id = $1;", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete project error:", err);
    res.status(500).json({ error: "DB error" });
  }
});


export default router;
