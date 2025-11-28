import express from "express";
import { pool } from "../db.js";
import { authMiddleware } from "../auth.js";

const router = express.Router();

/**
 * Lấy danh sách kênh thô (nếu cần).
 * App frontend hiện chủ yếu dùng /dashboard/channels, nhưng giữ lại cho tương thích.
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        c.id,
        c.name,
        c.youtube_channel_id,
        c.network_id,
        c.team_id,
        c.status
      FROM channels c
      ORDER BY c.id DESC;
      `
    );
    res.json(result.rows);
  } catch (err) {
    console.error("List channels error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

/**
 * Cập nhật meta kênh (admin only):
 * - network_id
 * - team_id
 * - manager_id (qua staff_channels, role = 'manager')
 * - status
 */
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const id = Number(req.params.id);
    const { name, network_id, team_id, manager_id, status } = req.body;

    // update channels
    const result = await pool.query(
      `
      UPDATE channels
      SET
        name       = COALESCE($1, name),
        network_id = COALESCE($2, network_id),
        team_id    = COALESCE($3, team_id),
        status     = COALESCE($4, status)
      WHERE id = $5
      RETURNING *;
      `,
      [name || null, network_id || null, team_id || null, status || null, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Channel not found" });
    }

    // cập nhật manager (bảng staff_channels)
    if (manager_id !== undefined) {
      // xóa manager cũ
      await pool.query(
        `
        DELETE FROM staff_channels
        WHERE channel_id = $1
        AND role = 'manager';
        `,
        [id]
      );
      // nếu có manager mới -> insert
      if (manager_id) {
        await pool.query(
          `
          INSERT INTO staff_channels (staff_id, channel_id, role)
          VALUES ($1, $2, 'manager')
          ON CONFLICT (staff_id, channel_id, role) DO NOTHING;
          `,
          [manager_id, id]
        );
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update channel error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

/**
 * Soft delete channel (admin only): set status = 'deleted'
 */
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const id = Number(req.params.id);
    await pool.query(
      `
      UPDATE channels
      SET status = 'deleted'
      WHERE id = $1;
      `,
      [id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Delete channel error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

/**
 * Gán kênh cho nhân sự (admin).
 * body: { staff_id, channel_id, role }
 */
router.post("/assign", authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { staff_id, channel_id, role } = req.body;
    if (!staff_id || !channel_id) {
      return res.status(400).json({ error: "Missing staff_id or channel_id" });
    }

    await pool.query(
      `
      INSERT INTO staff_channels (staff_id, channel_id, role)
      VALUES ($1, $2, COALESCE($3, 'manager'))
      ON CONFLICT (staff_id, channel_id, role) DO NOTHING;
      `,
      [staff_id, channel_id, role || "manager"]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Assign channel error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

export default router;