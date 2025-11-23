import express from "express";
import pool from "./db.js";

const router = express.Router();

function parseRange(query) {
  let { startDate, endDate } = query;
  if (!startDate || !endDate) {
    const now = new Date();
    const end = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - 28);
    startDate = start.toISOString().slice(0, 10);
    endDate = end.toISOString().slice(0, 10);
  }
  return { startDate, endDate };
}

router.get("/company", async (req, res) => {
  try {
    const { startDate, endDate } = parseRange(req.query);
    const isAdminLike = req.staffUser && ["admin", "director"].includes(req.staffUser.role);
    const teamChannels = req.teamContext?.channelIds || [];

    let whereChannel = "";
    const values = [startDate, endDate];
    if (!isAdminLike) {
      if (!teamChannels.length) {
        return res.json({
          range: { startDate, endDate },
          summary: { totalViews: 0, totalRevenue: 0, totalChannels: 0 },
          daily: [],
          topChannels: [],
        });
      }
      values.push(teamChannels);
      whereChannel = " AND channel_id = ANY($3::text[])";
    }

    const { rows: summaryRows } = await pool.query(
      `
      SELECT
        SUM(views) AS total_views,
        SUM(estimated_revenue) AS total_revenue,
        COUNT(DISTINCT channel_id) AS total_channels
      FROM yt_daily_revenue
      WHERE date >= $1::date AND date < $2::date
      ${whereChannel}
      `,
      values
    );
    const summary = summaryRows[0] || {};

    const { rows: dailyRows } = await pool.query(
      `
      SELECT date, SUM(views) AS views, SUM(estimated_revenue) AS revenue
      FROM yt_daily_revenue
      WHERE date >= $1::date AND date < $2::date
      ${whereChannel}
      GROUP BY date
      ORDER BY date
      `,
      values
    );

    const { rows: topRows } = await pool.query(
      `
      SELECT channel_id, SUM(estimated_revenue) AS revenue
      FROM yt_daily_revenue
      WHERE date >= $1::date AND date < $2::date
      ${whereChannel}
      GROUP BY channel_id
      ORDER BY revenue DESC
      LIMIT 10
      `,
      values
    );

    res.json({
      range: { startDate, endDate },
      summary: {
        totalViews: Number(summary.total_views || 0),
        totalRevenue: Number(summary.total_revenue || 0),
        totalChannels: Number(summary.total_channels || 0),
      },
      daily: dailyRows.map((r) => ({
        date: r.date,
        views: Number(r.views || 0),
        revenue: Number(r.revenue || 0),
      })),
      topChannels: topRows.map((r) => ({
        channelId: r.channel_id,
        revenue: Number(r.revenue || 0),
      })),
    });
  } catch (err) {
    console.error("GET /api/reports/company error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
  }
});

router.get("/teams", async (req, res) => {
  try {
    const { startDate, endDate } = parseRange(req.query);
    const isAdminLike = req.staffUser && ["admin", "director"].includes(req.staffUser.role);
    const { teamIds } = req.teamContext || { teamIds: [] };
    const values = [startDate, endDate];

    let whereTeam = "";
    if (!isAdminLike && teamIds.length) {
      values.push(teamIds);
      whereTeam = " WHERE t.id = ANY($3::int[])";
    } else if (!isAdminLike && !teamIds.length) {
      return res.json({ range: { startDate, endDate }, teams: [] });
    }

    const { rows } = await pool.query(
      `
      SELECT
        t.id AS team_id,
        t.name,
        COUNT(DISTINCT tc.channel_id) AS channels_count,
        SUM(r.views) AS total_views,
        SUM(r.estimated_revenue) AS total_revenue
      FROM teams t
      LEFT JOIN team_channels tc ON tc.team_id = t.id
      LEFT JOIN yt_daily_revenue r
        ON r.channel_id = tc.channel_id
       AND r.date >= $1::date
       AND r.date < $2::date
      ${whereTeam}
      GROUP BY t.id, t.name
      ORDER BY total_revenue DESC NULLS LAST
      `,
      values
    );

    res.json({
      range: { startDate, endDate },
      teams: rows.map((r) => ({
        teamId: r.team_id,
        name: r.name,
        channelsCount: Number(r.channels_count || 0),
        totalViews: Number(r.total_views || 0),
        totalRevenue: Number(r.total_revenue || 0),
      })),
    });
  } catch (err) {
    console.error("GET /api/reports/teams error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
  }
});

router.get("/talents", async (req, res) => {
  try {
    const { startDate, endDate } = parseRange(req.query);
    const isAdminLike = req.staffUser && ["admin", "director"].includes(req.staffUser.role);
    const teamChannels = req.teamContext?.channelIds || [];

    const values = [startDate, endDate];
    let whereChannel = "";
    if (!isAdminLike) {
      if (!teamChannels.length) {
        return res.json({ range: { startDate, endDate }, talents: [] });
      }
      values.push(teamChannels);
      whereChannel = " AND r.channel_id = ANY($3::text[])";
    }

    const { rows } = await pool.query(
      `
      SELECT
        t.id AS talent_id,
        t.name,
        t.rev_share_percent,
        COUNT(DISTINCT tc.channel_id) AS channels_count,
        SUM(r.views) AS total_views,
        SUM(r.estimated_revenue) AS total_revenue
      FROM talents t
      LEFT JOIN talent_channels tc ON tc.talent_id = t.id
      LEFT JOIN yt_daily_revenue r
        ON r.channel_id = tc.channel_id
       AND r.date >= $1::date
       AND r.date < $2::date
       ${whereChannel}
      GROUP BY t.id, t.name, t.rev_share_percent
      ORDER BY total_revenue DESC NULLS LAST
      `,
      values
    );

    res.json({
      range: { startDate, endDate },
      talents: rows.map((r) => ({
        talentId: r.talent_id,
        name: r.name,
        revSharePercent: Number(r.rev_share_percent || 0),
        channelsCount: Number(r.channels_count || 0),
        totalViews: Number(r.total_views || 0),
        totalRevenue: Number(r.total_revenue || 0),
      })),
    });
  } catch (err) {
    console.error("GET /api/reports/talents error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
  }
});

export default router;
