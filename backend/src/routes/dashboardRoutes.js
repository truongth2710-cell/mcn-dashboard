// backend/src/routes/dashboardRoutes.js
import express from "express";
import { pool } from "../db.js";
import { authMiddleware } from "../auth.js";

const router = express.Router();

/**
 * Xây WHERE chung cho tất cả query dashboard.
 * - Lọc theo ngày (from/to)
 * - Theo team / network
 * - Theo manager (dùng bảng staff_channels, KHÔNG cần cột manager_id trong channels)
 * - Hạn chế kênh theo user (nếu không phải admin)
 */
function buildFilterClause(query, user) {
  const { from, to, teamId, networkId, managerId } = query;

  const values = [];
  const whereParts = ["c.status = 'active'"];

  // Khoảng ngày
  if (from) {
    values.push(from);
    whereParts.push(`d.date >= $${values.length}`);
  }
  if (to) {
    values.push(to);
    whereParts.push(`d.date <= $${values.length}`);
  }

  // Theo team
  if (teamId) {
    values.push(Number(teamId));
    whereParts.push(`c.team_id = $${values.length}`);
  }

  // Theo network
  if (networkId) {
    values.push(Number(networkId));
    whereParts.push(`c.network_id = $${values.length}`);
  }

  // Theo manager: dùng staff_channels (mapping kênh ↔ staff)
  if (managerId) {
    values.push(Number(managerId));
    whereParts.push(
      `EXISTS (
        SELECT 1 FROM staff_channels sc
        WHERE sc.channel_id = c.id AND sc.staff_id = $${values.length}
      )`
    );
  }

  // Nếu không phải admin → chỉ thấy kênh mình được gán
  if (user.role !== "admin") {
    values.push(user.id);
    whereParts.push(
      `EXISTS (
        SELECT 1 FROM staff_channels sc2
        WHERE sc2.channel_id = c.id AND sc2.staff_id = $${values.length}
      )`
    );
  }

  const whereSql = "WHERE " + whereParts.join(" AND ");
  return { whereSql, values };
}

/* -------- SUMMARY TỔNG -------- */

router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const { whereSql, values } = buildFilterClause(req.query, user);

    const sql = `
      SELECT
        COALESCE(SUM(d.views), 0)               AS total_views,
        COALESCE(SUM(d.revenue), 0)             AS total_revenue,
        COALESCE(SUM(d.watch_time_minutes), 0)  AS total_watch_time,
        CASE
          WHEN SUM(d.views) > 0
            THEN SUM(d.revenue) * 1000.0 / SUM(d.views)
          ELSE 0
        END AS avg_rpm
      FROM channel_metrics_daily d
      JOIN channels c ON c.id = d.channel_id
      ${whereSql};
    `;

    const result = await pool.query(sql, values);
    const row = result.rows[0] || {};

    res.json({
      totalViews: Number(row.total_views || 0),
      totalRevenue: Number(row.total_revenue || 0),
      totalWatchTime: Number(row.total_watch_time || 0),
      avgRPM: Number(row.avg_rpm || 0)
    });
  } catch (err) {
    console.error("Dashboard summary error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

/* -------- DANH SÁCH KÊNH + METRICS -------- */

router.get("/channels", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const { whereSql, values } = buildFilterClause(req.query, user);

    const sql = `
      SELECT
        c.id AS channel_id,
        c.name,
        c.youtube_channel_id,
        c.network_id,
        c.team_id,
        -- Không bắt buộc có c.manager_id, dùng mapping staff_channels cho filter nên để NULL cũng được
        NULL::int AS manager_id,
        n.name AS network_name,
        t.name AS team_name,
        NULL::text AS manager_name,
        COALESCE(SUM(d.views), 0)    AS views,
        COALESCE(SUM(d.revenue), 0)  AS revenue,
        CASE
          WHEN SUM(d.views) > 0
            THEN SUM(d.revenue) * 1000.0 / SUM(d.views)
          ELSE 0
        END AS rpm
      FROM channels c
      LEFT JOIN channel_metrics_daily d ON d.channel_id = c.id
      LEFT JOIN networks n ON c.network_id = n.id
      LEFT JOIN teams t ON c.team_id = t.id
      ${whereSql}
      GROUP BY
        c.id,
        c.name,
        c.youtube_channel_id,
        c.network_id,
        c.team_id,
        n.name,
        t.name
      ORDER BY views DESC;
    `;

    const result = await pool.query(sql, values);
    res.json(result.rows);
  } catch (err) {
    console.error("Dashboard channels error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

/* -------- TỔNG THEO TEAM -------- */

router.get("/team-summary", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const { whereSql, values } = buildFilterClause(req.query, user);

    const sql = `
      SELECT
        t.id,
        t.name AS team_name,
        COALESCE(SUM(d.views), 0)   AS views,
        COALESCE(SUM(d.revenue), 0) AS revenue
      FROM channels c
      JOIN teams t ON c.team_id = t.id
      LEFT JOIN channel_metrics_daily d ON d.channel_id = c.id
      ${whereSql}
      GROUP BY t.id, t.name
      ORDER BY views DESC;
    `;

    const result = await pool.query(sql, values);
    res.json(result.rows);
  } catch (err) {
    console.error("Team summary error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

/* -------- TỔNG THEO NETWORK -------- */

router.get("/network-summary", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const { whereSql, values } = buildFilterClause(req.query, user);

    const sql = `
      SELECT
        n.id,
        n.name AS network_name,
        COALESCE(SUM(d.views), 0)   AS views,
        COALESCE(SUM(d.revenue), 0) AS revenue
      FROM channels c
      JOIN networks n ON c.network_id = n.id
      LEFT JOIN channel_metrics_daily d ON d.channel_id = c.id
      ${whereSql}
      GROUP BY n.id, n.name
      ORDER BY views DESC;
    `;

    const result = await pool.query(sql, values);
    res.json(result.rows);
  } catch (err) {
    console.error("Network summary error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

/* -------- THEO DỰ ÁN (TẠM THỜI TRẢ RỖNG) -------- */

router.get("/project-summary", authMiddleware, async (req, res) => {
  // Chưa chắc chắn schema bảng projects + channels.project_id,
  // nên tạm thời trả [] để frontend không bị lỗi.
  res.json([]);
});

export default router;
