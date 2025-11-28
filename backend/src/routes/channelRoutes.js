// backend/src/routes/channelRoutes.js
import express from "express";
import { pool } from "../db.js";
import { authMiddleware, requireRole } from "../auth.js";

const router = express.Router();

// Lấy danh sách kênh + meta (dùng cho tab Kênh)
router.get("/", authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    let result;
    if (user.role === "admin") {
      result = await pool.query(
        `
        SELECT
          c.id,
          c.name,
          c.youtube_channel_id,
          c.network_id,
          c.team_id,
          c.manager_id,
          c.status,
          n.name AS network_name,
          t.name AS team_name,
          m.name AS manager_name
        FROM channels c
        LEFT JOIN networks n ON c.network_id = n.id
        LEFT JOIN teams t ON c.team_id = t.id
        LEFT JOIN staff_users m ON c.manager_id = m.id
        WHERE c.status = 'active'
        ORDER BY c.created_at DESC;
        `
      );
    } else {
      // non-admin: chỉ thấy kênh được gán
      result = await pool.query(
        `
        SELECT
          c.id,
          c.name,
          c.youtube_channel_id,
          c.network_id,
          c.team_id,
          c.manager_id,
          c.status,
          n.name AS network_name,
          t.name AS team_name,
          m.name AS manager_name
        FROM channels c
        INNER JOIN staff_channels sc ON sc.channel_id = c.id
        LEFT JOIN networks n ON c.network_id = n.id
        LEFT JOIN teams t ON c.team_id = t.id
        LEFT JOIN staff_users m ON c.manager_id = m.id
        WHERE sc.staff_id = $1
          AND c.status = 'active'
        ORDER BY c.created_at DESC;
        `,
        [user.id]
      );
    }

    res.json(result.rows);
  } catch (err) {
    console.error("List channels error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

// Update meta kênh: Network / Team / Manager / Status / Name
router.put("/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, network_id, team_id, manager_id, status } = req.body;

    const result = await pool.query(
      `
      UPDATE channels
      SET
        name        = COALESCE($1, name),
        network_id  = $2,
        team_id     = $3,
        manager_id  = $4,
        status      = COALESCE($5, status)
      WHERE id = $6
      RETURNING *;
      `,
      [
        name || null,
        network_id || null,
        team_id || null,
        manager_id || null,
        status || null,
        id
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Channel not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update channel error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

// Assign channel cho staff (mapping phụ)
router.post("/assign", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { staff_id, channel_id, role } = req.body;
    if (!staff_id || !channel_id) {
      return res.status(400).json({ error: "staff_id and channel_id required" });
    }
    await pool.query(
      `
      INSERT INTO staff_channels (staff_id, channel_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (staff_id, channel_id) DO UPDATE SET role = EXCLUDED.role;
      `,
      [staff_id, channel_id, role || "manager"]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Assign channel error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

// XÓA kênh (soft delete: đổi status = 'deleted')
router.delete("/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.query(
      `UPDATE channels SET status = 'deleted' WHERE id = $1;`,
      [id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Delete channel error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
