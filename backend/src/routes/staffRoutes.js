import express from "express";
import { pool } from "../db.js";
import { authMiddleware, requireRole } from "../auth.js";

const router = express.Router();

/**
 * List staff for admin.
 * Hide "deleted" users.
 */
router.get("/", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, name, email, role
      FROM staff_users
      WHERE role IS NULL OR role <> 'deleted'
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
 * Soft delete staff:
 * - remove mappings in staff_channels
 * - mark role = 'deleted'
 */
router.delete("/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    await client.query("BEGIN");

    await client.query(
      "DELETE FROM staff_channels WHERE staff_id = $1;",
      [id]
    );

    await client.query(
      "UPDATE staff_users SET role = 'deleted' WHERE id = $1;",
      [id]
    );

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Delete staff error:", err);
    res.status(500).json({ error: "DB error" });
  } finally {
    client.release();
  }
});

export default router;