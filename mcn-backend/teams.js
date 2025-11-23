import express from "express";
import pool from "./db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const isAdminLike = req.staffUser && ["admin", "director"].includes(req.staffUser.role);
    const { teamIds } = req.teamContext || { teamIds: [] };

    let sql = `
      SELECT
        t.id,
        t.name,
        t.description,
        t.created_at,
        COUNT(DISTINCT tm.user_id) AS members_count,
        COUNT(DISTINCT tc.channel_id) AS channels_count
      FROM teams t
      LEFT JOIN team_members tm ON tm.team_id = t.id
      LEFT JOIN team_channels tc ON tc.team_id = t.id
    `;
    const values = [];
    if (!isAdminLike && teamIds.length) {
      sql += " WHERE t.id = ANY($1::int[])";
      values.push(teamIds);
    } else if (!isAdminLike && !teamIds.length) {
      return res.json({ data: [] });
    }
    sql += `
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `;

    const { rows } = await pool.query(sql, values);

    const { rows: kpiRows } = await pool.query(`
      SELECT
        tc.team_id,
        SUM(r.views) AS total_views_28d,
        SUM(r.estimated_revenue) AS total_revenue_28d
      FROM team_channels tc
      JOIN yt_daily_revenue r ON r.channel_id = tc.channel_id
      WHERE r.date >= (CURRENT_DATE - 28)
      GROUP BY tc.team_id
    `);

    const kMap = new Map();
    kpiRows.forEach((r) =>
      kMap.set(r.team_id, {
        totalViews28d: Number(r.total_views_28d || 0),
        totalRevenue28d: Number(r.total_revenue_28d || 0),
      })
    );

    res.json({
      data: rows.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        createdAt: t.created_at,
        membersCount: Number(t.members_count || 0),
        channelsCount: Number(t.channels_count || 0),
        totalViews28d: kMap.get(t.id)?.totalViews28d || 0,
        totalRevenue28d: kMap.get(t.id)?.totalRevenue28d || 0,
      })),
    });
  } catch (err) {
    console.error("GET /api/teams error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, description } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "name is required" } });
    }
    const { rows } = await pool.query(
      "INSERT INTO teams (name, description) VALUES ($1,$2) RETURNING *",
      [name, description || null]
    );
    res.status(201).json({ team: rows[0] });
  } catch (err) {
    console.error("POST /api/teams error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ error: { code: "VALIDATION", message: "Invalid id" } });

    const isAdminLike = req.staffUser && ["admin", "director"].includes(req.staffUser.role);
    const { teamIds } = req.teamContext || { teamIds: [] };
    if (!isAdminLike && !teamIds.includes(id)) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "No access to team" } });
    }

    const { rows } = await pool.query(
      "SELECT id, name, description, created_at FROM teams WHERE id=$1",
      [id]
    );
    const t = rows[0];
    if (!t) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Team not found" } });

    const [memRes, chRes, kpiRes] = await Promise.all([
      pool.query(
        `
        SELECT s.id, s.name, s.email, s.role, s.active
        FROM team_members tm
        JOIN staff_users s ON s.id = tm.user_id
        WHERE tm.team_id = $1
        `,
        [id]
      ),
      pool.query("SELECT channel_id FROM team_channels WHERE team_id = $1 ORDER BY channel_id", [
        id,
      ]),
      pool.query(
        `
        SELECT
          SUM(r.views) AS total_views_28d,
          SUM(r.estimated_revenue) AS total_revenue_28d
        FROM team_channels tc
        JOIN yt_daily_revenue r ON r.channel_id = tc.channel_id
        WHERE tc.team_id = $1 AND r.date >= (CURRENT_DATE - 28)
        `,
        [id]
      ),
    ]);

    const k = kpiRes.rows[0] || {};

    res.json({
      team: {
        id: t.id,
        name: t.name,
        description: t.description,
        createdAt: t.created_at,
      },
      members: memRes.rows,
      channels: chRes.rows.map((c) => c.channel_id),
      kpi28d: {
        totalViews28d: Number(k.total_views_28d || 0),
        totalRevenue28d: Number(k.total_revenue_28d || 0),
      },
    });
  } catch (err) {
    console.error("GET /api/teams/:id error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
  }
});

router.post("/:id/members", async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const { userId } = req.body || {};
    if (!id || !userId) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "Missing id/userId" } });
    }
    await pool.query(
      `
      INSERT INTO team_members (team_id, user_id)
      VALUES ($1,$2)
      ON CONFLICT (team_id,user_id) DO NOTHING
      `,
      [id, userId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/teams/:id/members error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
  }
});

router.delete("/:id/members/:userId", async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const userId = Number(req.params.userId || 0);
    await pool.query("DELETE FROM team_members WHERE team_id=$1 AND user_id=$2", [id, userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/teams/:id/members/:userId error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
  }
});

router.post("/:id/channels", async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const { channelId } = req.body || {};
    if (!id || !channelId) {
      return res
        .status(400)
        .json({ error: { code: "VALIDATION", message: "Missing id/channelId" } });
    }
    await pool.query(
      `
      INSERT INTO team_channels (team_id, channel_id)
      VALUES ($1,$2)
      ON CONFLICT (team_id,channel_id) DO NOTHING
      `,
      [id, channelId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/teams/:id/channels error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
  }
});

router.delete("/:id/channels/:channelId", async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const { channelId } = req.params;
    await pool.query("DELETE FROM team_channels WHERE team_id=$1 AND channel_id=$2", [
      id,
      channelId,
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/teams/:id/channels/:channelId error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
  }
});

export default router;
