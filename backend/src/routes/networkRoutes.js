import express from "express";
import { pool } from "../db.js";
import { authMiddleware, requireRole } from "../auth.js";

const router = express.Router();

// list networks
router.get("/", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, description FROM networks ORDER BY id DESC;"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("List networks error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

// create network (admin)
router.post("/", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { name, description } = req.body;
    const result = await pool.query(
      "INSERT INTO networks (name, description) VALUES ($1, $2) RETURNING *;",
      [name, description || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create network error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

// update network (admin)
router.put("/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, description } = req.body;
    const result = await pool.query(
      `
      UPDATE networks
      SET
        name        = COALESCE($1, name),
        description = COALESCE($2, description)
      WHERE id = $3
      RETURNING *;
      `,
      [name || null, description || null, id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Network not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update network error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

// delete network (admin)
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