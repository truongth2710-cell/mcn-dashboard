import express from "express";
import { pool } from "../db.js";
import { authMiddleware } from "../auth.js";

const router = express.Router();

async function getVisibleChannelIds(user) {
  if (user.role === "admin") {
    const result = await pool.query("SELECT id FROM channels WHERE status = 'active'");
    return result.rows.map((r) => r.id);
  }
  const result = await pool.query(
    `
    SELECT c.id
    FROM channels c
    INNER JOIN staff_channels sc ON sc.channel_id = c.id
    WHERE sc.staff_id = $1
      AND c.status = 'active';
    `,
    [user.id]
  );
  return result.rows.map((r) => r.id);
}

// Overall summary
router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const from = req.query.from || "2000-01-01";
    const to = req.query.to || "2100-01-01";

    const channelIds = await getVisibleChannelIds(user);
    if (channelIds.length === 0) {
      return res.json({
        totalViews: 0,
        totalRevenue: 0,
        totalWatchTime: 0,
        avgRPM: 0,
        daily: []
      });
    }

    const sumResult = await pool.query(
      `
      SELECT
        COALESCE(SUM(views), 0) AS total_views,
        COALESCE(SUM(watch_time_minutes), 0) AS total_watch_time,
        COALESCE(SUM(revenue), 0) AS total_revenue
      FROM channel_metrics_daily
      WHERE channel_id = ANY($1::int[])
        AND date BETWEEN $2 AND $3;
      `,
      [channelIds, from, to]
    );

    const dailyResult = await pool.query(
      `
      SELECT date,
             SUM(views) AS views,
             SUM(revenue) AS revenue
      FROM channel_metrics_daily
      WHERE channel_id = ANY($1::int[])
        AND date BETWEEN $2 AND $3
      GROUP BY date
      ORDER BY date ASC;
      `,
      [channelIds, from, to]
    );

    const row = sumResult.rows[0];
    const totalViews = Number(row.total_views) || 0;
    const totalRevenue = Number(row.total_revenue) || 0;
    const totalWatchTime = Number(row.total_watch_time) || 0;
    const avgRPM = totalViews > 0 ? (totalRevenue / totalViews) * 1000 : 0;

    res.json({
      totalViews,
      totalRevenue,
      totalWatchTime,
      avgRPM,
      daily: dailyResult.rows
    });
  } catch (err) {
    console.error("Dashboard summary error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Per-channel summary
router.get("/channels", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const from = req.query.from || "2000-01-01";
    const to = req.query.to || "2100-01-01";

    const channelIds = await getVisibleChannelIds(user);
    if (channelIds.length === 0) {
      return res.json([]);
    }

    const result = await pool.query(
      `
      SELECT
        c.id AS channel_id,
        c.name,
        c.youtube_channel_id,
        COALESCE(SUM(m.views), 0) AS views,
        COALESCE(SUM(m.revenue), 0) AS revenue,
        COALESCE(SUM(m.watch_time_minutes), 0) AS watch_time_minutes,
        COALESCE(SUM(m.subs_gained), 0) AS subs_gained,
        COALESCE(SUM(m.subs_lost), 0) AS subs_lost
      FROM channels c
      LEFT JOIN channel_metrics_daily m
        ON m.channel_id = c.id
       AND m.date BETWEEN $1 AND $2
      WHERE c.id = ANY($3::int[])
      GROUP BY c.id, c.name, c.youtube_channel_id
      ORDER BY revenue DESC;
      `,
      [from, to, channelIds]
    );

    const rows = result.rows.map((r) => {
      const views = Number(r.views) || 0;
      const revenue = Number(r.revenue) || 0;
      const rpm = views > 0 ? (revenue / views) * 1000 : 0;
      return {
        channel_id: r.channel_id,
        name: r.name,
        youtube_channel_id: r.youtube_channel_id,
        views,
        revenue,
        watch_time_minutes: Number(r.watch_time_minutes) || 0,
        subs_gained: Number(r.subs_gained) || 0,
        subs_lost: Number(r.subs_lost) || 0,
        rpm
      };
    });

    res.json(rows);
  } catch (err) {
    console.error("Dashboard channels error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Team summary
router.get("/team-summary", authMiddleware, async (req, res) => {
  try {
    const from = req.query.from || "2000-01-01";
    const to = req.query.to || "2100-01-01";

    const result = await pool.query(
      `
      SELECT
        t.id AS team_id,
        t.name AS team_name,
        COALESCE(SUM(m.views), 0) AS views,
        COALESCE(SUM(m.revenue), 0) AS revenue
      FROM teams t
      LEFT JOIN channels c ON c.team_id = t.id
      LEFT JOIN channel_metrics_daily m
        ON m.channel_id = c.id
       AND m.date BETWEEN $1 AND $2
      GROUP BY t.id, t.name
      ORDER BY revenue DESC;
      `,
      [from, to]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Team summary error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Network summary
router.get("/network-summary", authMiddleware, async (req, res) => {
  try {
    const from = req.query.from || "2000-01-01";
    const to = req.query.to || "2100-01-01";

    const result = await pool.query(
      `
      SELECT
        n.id AS network_id,
        n.name AS network_name,
        COALESCE(SUM(m.views), 0) AS views,
        COALESCE(SUM(m.revenue), 0) AS revenue
      FROM networks n
      LEFT JOIN channels c ON c.network_id = n.id
      LEFT JOIN channel_metrics_daily m
        ON m.channel_id = c.id
       AND m.date BETWEEN $1 AND $2
      GROUP BY n.id, n.name
      ORDER BY revenue DESC;
      `,
      [from, to]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Network summary error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Project summary
router.get("/project-summary", authMiddleware, async (req, res) => {
  try {
    const from = req.query.from || "2000-01-01";
    const to = req.query.to || "2100-01-01";

    const result = await pool.query(
      `
      SELECT
        p.id AS project_id,
        p.name AS project_name,
        COALESCE(SUM(m.views), 0) AS views,
        COALESCE(SUM(m.revenue), 0) AS revenue
      FROM projects p
      LEFT JOIN project_channels pc ON pc.project_id = p.id
      LEFT JOIN channels c ON pc.channel_id = c.id
      LEFT JOIN channel_metrics_daily m
        ON m.channel_id = c.id
       AND m.date BETWEEN $1 AND $2
      GROUP BY p.id, p.name
      ORDER BY revenue DESC;
      `,
      [from, to]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Project summary error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
