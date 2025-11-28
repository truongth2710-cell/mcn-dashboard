import express from "express";
import { pool } from "../db.js";
import { authMiddleware, requireRole } from "../auth.js";

const router = express.Router();

// List networks
router.get("/", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, description FROM networks ORDER BY name ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("List networks error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

// Create network
router.post("/", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    const result = await pool.query(
      `
      INSERT INTO networks (name, description)
      VALUES ($1, $2)
      RETURNING *;
      `,
      [name, description || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create network error:", err);
    res.status(500).json({ error: "DB error" });
  }
});


router.delete("/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.query("DELETE FROM networks WHERE id = $1;", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete network error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
