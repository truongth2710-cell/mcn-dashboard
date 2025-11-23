import express from "express";
import pool from "./db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        t.id,
        t.name,
        t.contact,
        t.rev_share_percent,
        t.status,
        t.created_at,
        COUNT(DISTINCT tc.channel_id) AS channels_count
      FROM talents t
      LEFT JOIN talent_channels tc ON tc.talent_id = t.id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `);

    const { rows: kpiRows } = await pool.query(`
      SELECT
        tc.talent_id,
        SUM(r.views) AS total_views_28d,
        SUM(r.estimated_revenue) AS total_revenue_28d
      FROM talent_channels tc
      JOIN yt_daily_revenue r ON r.channel_id = tc.channel_id
      WHERE r.date >= (CURRENT_DATE - 28)
      GROUP BY tc.talent_id
    `);

    const map = new Map();
    kpiRows.forEach((r) =>
      map.set(r.talent_id, {
        totalViews28d: Number(r.total_views_28d || 0),
        totalRevenue28d: Number(r.total_revenue_28d || 0),
      })
    );

    res.json({
      data: rows.map((t) => ({
        id: t.id,
        name: t.name,
        contact: t.contact,
        revSharePercent: Number(t.rev_share_percent || 0),
        status: t.status,
        createdAt: t.created_at,
        channelsCount: Number(t.channels_count || 0),
        totalViews28d: map.get(t.id)?.totalViews28d || 0,
        totalRevenue28d: map.get(t.id)?.totalRevenue28d || 0,
      })),
    });
  } catch (err) {
    console.error("GET /api/talents error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, contact, revSharePercent = 50, status = "active" } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "name is required" } });
    }
    const { rows } = await pool.query(
      `
      INSERT INTO talents (name, contact, rev_share_percent, status)
      VALUES ($1,$2,$3,$4)
      RETURNING *
      `,
      [name, contact || null, revSharePercent, status]
    );
    res.status(201).json({ talent: rows[0] });
  } catch (err) {
    console.error("POST /api/talents error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
  }
});

router.post("/:id/channels", async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const { channelId } = req.body || {};
    if (!id || !channelId) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "Missing id/channelId" } });
    }
    await pool.query(
      `
      INSERT INTO talent_channels (talent_id, channel_id)
      VALUES ($1,$2)
      ON CONFLICT (talent_id,channel_id) DO NOTHING
      `,
      [id, channelId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/talents/:id/channels error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
  }
});

export default router;
