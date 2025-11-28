import express from "express";
import { pool } from "../db.js";
import { authMiddleware } from "../auth.js";

const router = express.Router();

/**
 * Build common WHERE clause for dashboard queries.
 * Filters by:
 * - date range (from/to)
 * - team / network
 * - manager (via staff_channels role='manager')
 * - user visibility (non-admin only sees channels they are assigned to)
 */
function buildFilterClause(query, user) {
  const { from, to, teamId, networkId, managerId } = query;

  const values = [];
  const whereParts = ["c.status = 'active'"];

  if (from) {
    values.push(from);
    whereParts.push(`d.date >= $${values.length}`);
  }
  if (to) {
    values.push(to);
    whereParts.push(`d.date <= $${values.length}`);
  }
  if (teamId) {
    values.push(Number(teamId));
    whereParts.push(`c.team_id = $${values.length}`);
  }
  if (networkId) {
    values.push(Number(networkId));
    whereParts.push(`c.network_id = $${values.length}`);
  }

  // filter by manager using staff_channels table
  if (managerId) {
    values.push(Number(managerId));
    whereParts.push(
      `EXISTS (
        SELECT 1 FROM staff_channels scm
        WHERE scm.channel_id = c.id
          AND scm.staff_id = $${values.length}
          AND scm.role = 'manager'
      )`
    );
  }

  if (user.role !== "admin") {
    values.push(user.id);
    whereParts.push(
      `EXISTS (
        SELECT 1 FROM staff_channels sc2
        WHERE sc2.channel_id = c.id
          AND sc2.staff_id = $${values.length}
      )`
    );
  }

  const whereSql = "WHERE " + whereParts.join(" AND ");
  return { whereSql, values };
}

/** SUMMARY */
router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const { whereSql, values } = buildFilterClause(req.query, user);

    const sql = `
      SELECT
        COALESCE(SUM(d.views), 0)               AS total_views,
        COALESCE(SUM(d.revenue), 0)             AS total_revenue,
        -- hiện tại chưa có cột doanh thu Hoa Kỳ riêng, tạm dùng cùng giá trị
        COALESCE(SUM(d.revenue), 0)             AS total_us_revenue,
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
      totalUsRevenue: Number(row.total_us_revenue || 0),
      totalWatchTime: Number(row.total_watch_time || 0),
      avgRPM: Number(row.avg_rpm || 0)
    });
  } catch (err) {
    console.error("Dashboard summary error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

/** CHANNELS TABLE (with metrics + manager) */
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
        n.name  AS network_name,
        t.name  AS team_name,
        m.id    AS manager_id,
        m.name  AS manager_name,
        -- avatar & subs hiện tại chưa lưu trong DB, để NULL/0 để frontend hiển thị placeholder
        NULL::text  AS avatar_url,
        0::bigint   AS subscribers,
        COALESCE(SUM(d.views), 0)    AS views,
        COALESCE(SUM(d.revenue), 0)  AS revenue,
        COALESCE(SUM(d.revenue), 0)  AS us_revenue,
        CASE
          WHEN SUM(d.views) > 0
            THEN SUM(d.revenue) * 1000.0 / SUM(d.views)
          ELSE 0
        END AS rpm
      FROM channels c
      LEFT JOIN channel_metrics_daily d ON d.channel_id = c.id
      LEFT JOIN networks n ON c.network_id = n.id
      LEFT JOIN teams    t ON c.team_id    = t.id
      LEFT JOIN staff_channels scm
        ON scm.channel_id = c.id AND scm.role = 'manager'
      LEFT JOIN staff_users m
        ON m.id = scm.staff_id
      ${whereSql}
      GROUP BY
        c.id,
        c.name,
        c.youtube_channel_id,
        c.network_id,
        c.team_id,
        n.name,
        t.name,
        m.id,
        m.name
      ORDER BY views DESC;
    `;

    const result = await pool.query(sql, values);
    res.json(result.rows);
  } catch (err) {
    console.error("Dashboard channels error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

/** TEAM SUMMARY */
router.get("/team-summary", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const { whereSql, values } = buildFilterClause(req.query, user);

    const sql = `
      SELECT
        t.id,
        t.name AS team_name,
        COALESCE(SUM(d.views), 0)   AS views,
        COALESCE(SUM(d.revenue), 0) AS revenue,
        COALESCE(SUM(d.revenue), 0) AS us_revenue
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

/** NETWORK SUMMARY */
router.get("/network-summary", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const { whereSql, values } = buildFilterClause(req.query, user);

    const sql = `
      SELECT
        n.id,
        n.name AS network_name,
        COALESCE(SUM(d.views), 0)   AS views,
        COALESCE(SUM(d.revenue), 0) AS revenue,
        COALESCE(SUM(d.revenue), 0) AS us_revenue
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

/** PROJECT SUMMARY – tạm thời chưa dùng, trả rỗng để tránh lỗi schema */
router.get("/project-summary", authMiddleware, async (req, res) => {
  res.json([]);
});

/**
 * Timeseries doanh thu theo kênh để vẽ biểu đồ.
 * Trả về dạng:
 * [
 *   { date: '2025-10-01', channel_id: 1, name: 'Channel A', revenue: 12.3, views: 1000 },
 *   ...
 * ]
 */
router.get("/channel-timeseries", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const { whereSql, values } = buildFilterClause(req.query, user);

    const sql = `
      SELECT
        d.date,
        c.id   AS channel_id,
        c.name AS channel_name,
        COALESCE(SUM(d.revenue), 0) AS revenue,
        COALESCE(SUM(d.views), 0)   AS views
      FROM channel_metrics_daily d
      JOIN channels c ON c.id = d.channel_id
      ${whereSql}
      GROUP BY d.date, c.id, c.name
      ORDER BY d.date ASC, c.id ASC;
    `;

    const result = await pool.query(sql, values);
    res.json(result.rows);
  } catch (err) {
    console.error("Channel timeseries error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

export default router;