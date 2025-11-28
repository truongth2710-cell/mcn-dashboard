import express from "express";
import { pool } from "../db.js";
import { authMiddleware } from "../auth.js";

const router = express.Router();

/**
 * Summary tổng quan: views, revenue, us_revenue, rpm trung bình.
 * Filter theo from/to + teamId + networkId + managerId.
 */
router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const { from, to, teamId, networkId, managerId } = req.query;
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
    if (managerId) {
      params.push(managerId);
      wh.push(`
        EXISTS (
          SELECT 1 FROM staff_channels scm
          WHERE scm.channel_id = c.id
          AND scm.role = 'manager'
          AND scm.staff_id = $${params.length}
        )
      `);
    }

    const where = wh.length ? "WHERE " + wh.join(" AND ") : "";

    const sql = `
      SELECT
        COALESCE(SUM(d.views), 0)               AS "totalViews",
        COALESCE(SUM(d.revenue), 0)             AS "totalRevenue",
        COALESCE(SUM(d.us_revenue), 0)          AS "totalUsRevenue",
        CASE
          WHEN COALESCE(SUM(d.views), 0) > 0
          THEN SUM(d.revenue) / (SUM(d.views) / 1000.0)
          ELSE 0
        END                                     AS "avgRPM"
      FROM channel_metrics_daily d
      JOIN channels c ON c.id = d.channel_id
      ${where};
    `;

    const result = await pool.query(sql, params);
    res.json(result.rows[0] || {
      totalViews: 0,
      totalRevenue: 0,
      totalUsRevenue: 0,
      avgRPM: 0
    });
  } catch (err) {
    console.error("Dashboard summary error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

/**
 * Danh sách kênh + metrics tổng theo filter.
 * Dùng cho Dashboard + tab Kênh.
 */
router.get("/channels", authMiddleware, async (req, res) => {
  try {
    const { from, to, teamId, networkId, managerId } = req.query;
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
    if (managerId) {
      params.push(managerId);
      wh.push(`
        EXISTS (
          SELECT 1 FROM staff_channels scm
          WHERE scm.channel_id = c.id
          AND scm.role = 'manager'
          AND scm.staff_id = $${params.length}
        )
      `);
    }

    const where = wh.length ? "WHERE " + wh.join(" AND ") : "";

    const sql = `
      SELECT
        c.id,
        c.name,
        c.youtube_channel_id,
        c.network_id,
        c.team_id,
        n.name AS network_name,
        t.name AS team_name,
        m.id   AS manager_id,
        m.name AS manager_name,
        COALESCE(SUM(d.views), 0)        AS views,
        COALESCE(SUM(d.revenue), 0)      AS revenue,
        COALESCE(SUM(d.us_revenue), 0)   AS us_revenue,
        CASE
          WHEN COALESCE(SUM(d.views), 0) > 0
          THEN SUM(d.revenue) / (SUM(d.views) / 1000.0)
          ELSE 0
        END                              AS rpm,
        COALESCE(MAX(d.subscribers), 0)  AS subscribers,
        MAX(d.avatar_url)                AS avatar_url
      FROM channels c
      LEFT JOIN channel_metrics_daily d ON d.channel_id = c.id
      LEFT JOIN networks n ON n.id = c.network_id
      LEFT JOIN teams t    ON t.id = c.team_id
      LEFT JOIN staff_channels scm
        ON scm.channel_id = c.id AND scm.role = 'manager'
      LEFT JOIN staff_users m
        ON m.id = scm.staff_id
      ${where}
      GROUP BY
        c.id, c.name, c.youtube_channel_id,
        c.network_id, c.team_id,
        n.name, t.name,
        m.id, m.name
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
    const { from, to, networkId, managerId } = req.query;
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
    if (networkId) {
      params.push(networkId);
      wh.push(`c.network_id = $${params.length}`);
    }
    if (managerId) {
      params.push(managerId);
      wh.push(`
        EXISTS (
          SELECT 1 FROM staff_channels scm
          WHERE scm.channel_id = c.id
          AND scm.role = 'manager'
          AND scm.staff_id = $${params.length}
        )
      `);
    }

    const where = wh.length ? "WHERE " + wh.join(" AND ") : "";

    const sql = `
      SELECT
        t.id,
        t.name AS team_name,
        COALESCE(SUM(d.views), 0)      AS views,
        COALESCE(SUM(d.revenue), 0)    AS revenue
      FROM teams t
      JOIN channels c ON c.team_id = t.id
      LEFT JOIN channel_metrics_daily d ON d.channel_id = c.id
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
    const { from, to, teamId, managerId } = req.query;
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
    if (managerId) {
      params.push(managerId);
      wh.push(`
        EXISTS (
          SELECT 1 FROM staff_channels scm
          WHERE scm.channel_id = c.id
          AND scm.role = 'manager'
          AND scm.staff_id = $${params.length}
        )
      `);
    }

    const where = wh.length ? "WHERE " + wh.join(" AND ") : "";

    const sql = `
      SELECT
        n.id,
        n.name AS network_name,
        COALESCE(SUM(d.views), 0)      AS views,
        COALESCE(SUM(d.revenue), 0)    AS revenue
      FROM networks n
      JOIN channels c ON c.network_id = n.id
      LEFT JOIN channel_metrics_daily d ON d.channel_id = c.id
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
 * Tổng hợp theo project (nếu bạn có mapping project‑channel).
 * Ở đây giả sử bảng channel_projects (project_id, channel_id).
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
        COALESCE(SUM(d.views), 0)      AS views,
        COALESCE(SUM(d.revenue), 0)    AS revenue
      FROM projects p
      JOIN channel_projects cp ON cp.project_id = p.id
      JOIN channels c ON c.id = cp.channel_id
      LEFT JOIN channel_metrics_daily d ON d.channel_id = c.id
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
 * Timeseries doanh thu kênh – phục vụ biểu đồ.
 */
router.get("/channel-timeseries", authMiddleware, async (req, res) => {
  try {
    const { from, to, teamId, networkId, managerId } = req.query;
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
    if (managerId) {
      params.push(managerId);
      wh.push(`
        EXISTS (
          SELECT 1 FROM staff_channels scm
          WHERE scm.channel_id = c.id
          AND scm.role = 'manager'
          AND scm.staff_id = $${params.length}
        )
      `);
    }

    const where = wh.length ? "WHERE " + wh.join(" AND ") : "";

    const sql = `
      SELECT
        d.date,
        c.id          AS channel_id,
        c.name        AS channel_name,
        COALESCE(SUM(d.revenue), 0) AS revenue
      FROM channel_metrics_daily d
      JOIN channels c ON c.id = d.channel_id
      ${where}
      GROUP BY d.date, c.id, c.name
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