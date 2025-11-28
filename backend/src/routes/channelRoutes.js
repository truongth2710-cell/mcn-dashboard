// backend/src/routes/channelRoutes.js
import express from "express";
import { pool } from "../db.js";
import { authMiddleware, requireRole } from "../auth.js";

const router = express.Router();

/**
 * Lấy danh sách kênh cho tab Kênh:
 * - Nếu admin: toàn bộ kênh active
 * - Nếu không: chỉ kênh user đó được gán (staff_channels)
 * - Có kèm Network / Team / Manager (từ staff_channels role = 'manager')
 */
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
          n.name  AS network_name,
          t.name  AS team_name,
          m.id    AS manager_id,
          m.name  AS manager_name
        FROM channels c
        LEFT JOIN networks n ON c.network_id = n.id
        LEFT JOIN teams    t ON c.team_id    = t.id
        LEFT JOIN staff_channels scm
          ON scm.channel_id = c.id AND scm.role = 'manager'
        LEFT JOIN staff_users m
          ON m.id = scm.staff_id
        WHERE c.status = 'active'
        ORDER BY c.created_at DESC;
        `
      );
    } else {
      // chỉ kênh user đó được gán (bất kỳ role)
      result = await pool.query(
        `
        SELECT
          c.id,
          c.name,
          c.youtube_channel_id,
          c.network_id,
          c.team_id,
          n.name  AS network_name,
          t.name  AS team_name,
          m.id    AS manager_id,
          m.name  AS manager_name
        FROM channels c
        INNER JOIN staff_channels sc
          ON sc.channel_id = c.id AND sc.staff_id = $1
        LEFT JOIN networks n ON c.network_id = n.id
        LEFT JOIN teams    t ON c.team_id    = t.id
        LEFT JOIN staff_channels scm
          ON scm.channel_id = c.id AND scm.role = 'manager'
        LEFT JOIN staff_users m
          ON m.id = scm.staff_id
        WHERE c.status = 'active'
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

/**
 * Cập nhật metadata kênh:
 * - name, network_id, team_id, status
 * - manager_id: được lưu trong bảng staff_channels (role = 'manager')
 */
router.put("/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    const {
      name,
      network_id,
      team_id,
      status,
      manager_id // có thể undefined / null / number
    } = req.body;

    await client.query("BEGIN");

    // update thông tin chính của kênh (KHÔNG đụng cột manager_id vì ta dùng staff_channels)
    const updateRes = await client.query(
      `
      UPDATE channels
      SET
        name       = COALESCE($1, name),
        network_id = $2,
        team_id    = $3,
        status     = COALESCE($4, status)
      WHERE id = $5
      RETURNING *;
      `,
      [
        name || null,
        network_id || null,
        team_id || null,
        status || null,
        id
      ]
    );

    if (!updateRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Channel not found" });
    }

    // Xử lý manager nếu body có field manager_id
    const hasManagerField = Object.prototype.hasOwnProperty.call(
      req.body,
      "manager_id"
    );

    if (hasManagerField) {
      // Xoá manager cũ
      await client.query(
        `
        DELETE FROM staff_channels
        WHERE channel_id = $1 AND role = 'manager';
        `,
        [id]
      );

      // Ghi manager mới nếu có
      if (manager_id) {
        await client.query(
          `
          INSERT INTO staff_channels (staff_id, channel_id, role)
          VALUES ($1, $2, 'manager')
          ON CONFLICT (staff_id, channel_id) DO UPDATE
            SET role = EXCLUDED.role;
          `,
          [Number(manager_id), id]
        );
      }
    }

    await client.query("COMMIT");

    res.json(updateRes.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update channel error:", err);
    res.status(500).json({ error: "DB error" });
  } finally {
    client.release();
  }
});

/**
 * Gán kênh cho nhân sự với role bất kỳ (manager/editor…) – dùng cho tab Nhân sự nếu cần.
 */
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
      ON CONFLICT (staff_id, channel_id) DO UPDATE
        SET role = EXCLUDED.role;
      `,
      [Number(staff_id), Number(channel_id), role || "manager"]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Assign channel error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

/**
 * Xoá kênh (soft delete: status = 'deleted')
 */
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
