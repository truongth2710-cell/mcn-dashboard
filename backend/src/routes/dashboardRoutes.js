import express from "express";
import { pool } from "../db.js";
import { authMiddleware } from "../auth.js";

const router = express.Router();

/**
 * Helper build WHERE clause for filters.
 * Chỉ dùng các bảng chắc chắn có:
 *  - yt_daily_revenue d (date, views, estimated_revenue, channel_id)
 *  - channels c (youtube_channel_id, team_id, network_id)
 *  - teams t
 *  - networks n
 *  - projects p (channel_id TEXT)
 */
function buildFilter({ from, to, teamId, networkId }) {
  const params = [];
  const wh = [];

  if (from) {
    params.push(from);
    wh.push(`d.date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    wh.push(`d.date <= $${params.length}`);
  }
  if (teamId) {
    params.push(teamId);
    wh.push(`c.team_id = $${params.length}`);
  }
  if (networkId) {
    params.push(networkId);
    wh.push(`c.network_id = $${params.length}`);
  }

  const where = wh.length ? "WHERE " + wh.join(" AND ") : "";
  return { where, params };
}

/**
 * Summary tổng quan: views, revenue, rpm.
 */
router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const { from, to, teamId, networkId } = req.query;
    const { where, params } = buildFilter({ from, to, teamId, networkId });

    const sql = `
      SELECT
        COALESCE(SUM(d.views), 0)                AS "totalViews",
        COALESCE(SUM(d.estimated_revenue), 0)    AS "totalRevenue",
        0::numeric                               AS "totalUsRevenue",
        CASE
          WHEN COALESCE(SUM(d.views), 0) > 0
          THEN SUM(d.estimated_revenue) / (SUM(d.views) / 1000.0)
          ELSE 0
        END                                      AS "avgRPM"
      FROM yt_daily_revenue d
      LEFT JOIN channels c
        ON c.youtube_channel_id = d.channel_id
      ${where};
    `;
    const result = await pool.query(sql, params);
    res.json(
      result.rows[0] || {
        totalViews: 0,
        totalRevenue: 0,
        totalUsRevenue: 0,
        avgRPM: 0,
      }
    );
  } catch (err) {
    console.error("Dashboard summary error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

/**
 * Danh sách kênh + metrics tổng.
 */
router.get("/channels", authMiddleware, async (req, res) => {
  try {
    const { from, to, teamId, networkId } = req.query;
    const { where, params } = buildFilter({ from, to, teamId, networkId });

    const sql = `
      SELECT
        COALESCE(c.id, 0)                       AS id,
        COALESCE(c.name, d.channel_id)          AS name,
        COALESCE(c.youtube_channel_id, d.channel_id) AS youtube_channel_id,
        c.network_id,
        c.team_id,
        n.name                                  AS network_name,
        t.name                                  AS team_name,
        COALESCE(SUM(d.views), 0)              AS views,
        COALESCE(SUM(d.estimated_revenue), 0)  AS revenue,
        0::numeric                              AS us_revenue,
        CASE
          WHEN COALESCE(SUM(d.views), 0) > 0
          THEN SUM(d.estimated_revenue) / (SUM(d.views) / 1000.0)
          ELSE 0
        END                                    AS rpm,
        NULL                                    AS subscribers,
        COALESCE(c.avatar_url, NULL)           AS avatar_url
      FROM yt_daily_revenue d
      LEFT JOIN channels c
        ON c.youtube_channel_id = d.channel_id
      LEFT JOIN networks n ON n.id = c.network_id
      LEFT JOIN teams t    ON t.id = c.team_id
      ${where}
      GROUP BY
        COALESCE(c.id, 0),
        COALESCE(c.name, d.channel_id),
        COALESCE(c.youtube_channel_id, d.channel_id),
        c.network_id,
        c.team_id,
        n.name,
        t.name,
        c.avatar_url
      ORDER BY revenue DESC NULLS LAST;
    `;
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Dashboard channels error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

/**
 * Tổng hợp theo team.
 */
router.get("/team-summary", authMiddleware, async (req, res) => {
  try {
    const { from, to, networkId } = req.query;
    const { where, params } = buildFilter({ from, to, teamId: null, networkId });

    const sql = `
      SELECT
        t.id,
        t.name AS team_name,
        COALESCE(SUM(d.views), 0)             AS views,
        COALESCE(SUM(d.estimated_revenue), 0) AS revenue
      FROM teams t
      JOIN channels c ON c.team_id = t.id
      LEFT JOIN yt_daily_revenue d
        ON d.channel_id = c.youtube_channel_id
      ${where}
      GROUP BY t.id, t.name
      ORDER BY revenue DESC NULLS LAST;
    `;
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Dashboard team-summary error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

/**
 * Tổng hợp theo network.
 */
router.get("/network-summary", authMiddleware, async (req, res) => {
  try {
    const { from, to, teamId } = req.query;
    const { where, params } = buildFilter({ from, to, teamId, networkId: null });

    const sql = `
      SELECT
        n.id,
        n.name AS network_name,
        COALESCE(SUM(d.views), 0)             AS views,
        COALESCE(SUM(d.estimated_revenue), 0) AS revenue
      FROM networks n
      JOIN channels c ON c.network_id = n.id
      LEFT JOIN yt_daily_revenue d
        ON d.channel_id = c.youtube_channel_id
      ${where}
      GROUP BY n.id, n.name
      ORDER BY revenue DESC NULLS LAST;
    `;
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Dashboard network-summary error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

/**
 * Tổng hợp theo project.
 * Dùng bảng projects(channel_id TEXT, ...) + yt_daily_revenue.
 */
router.get("/project-summary", authMiddleware, async (req, res) => {
  try {
    const { from, to } = req.query;
    const params = [];
    const wh = [];

    if (from) {
      params.push(from);
      wh.push(`d.date >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      wh.push(`d.date <= $${params.length}`);
    }

    const where = wh.length ? "WHERE " + wh.join(" AND ") : "";

    const sql = `
      SELECT
        p.id,
        p.name AS project_name,
        COALESCE(SUM(d.views), 0)             AS views,
        COALESCE(SUM(d.estimated_revenue), 0) AS revenue
      FROM projects p
      LEFT JOIN yt_daily_revenue d
        ON d.channel_id = p.channel_id
      ${where}
      GROUP BY p.id, p.name
      ORDER BY revenue DESC NULLS LAST;
    `;
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Dashboard project-summary error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

/**
 * Timeseries doanh thu kênh – cho biểu đồ.
 */
router.get("/channel-timeseries", authMiddleware, async (req, res) => {
  try {
    const { from, to, teamId, networkId } = req.query;
    const { where, params } = buildFilter({ from, to, teamId, networkId });

    const sql = `
      SELECT
        d.date,
        COALESCE(c.id, 0)                      AS channel_id,
        COALESCE(c.name, d.channel_id)         AS channel_name,
        COALESCE(SUM(d.estimated_revenue), 0)  AS revenue
      FROM yt_daily_revenue d
      LEFT JOIN channels c
        ON c.youtube_channel_id = d.channel_id
      ${where}
      GROUP BY d.date, COALESCE(c.id, 0), COALESCE(c.name, d.channel_id)
      ORDER BY d.date ASC, revenue DESC;
    `;
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Dashboard channel-timeseries error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

export default router;