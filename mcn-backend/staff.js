import express from "express";
import pool from "./db.js";
import { logAudit } from "./audit.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, email, role, avatar_url, active, created_at
      FROM staff_users
      ORDER BY name ASC
    `);

    const { rows: kpiRows } = await pool.query(`
      SELECT
        assignee_id AS user_id,
        COUNT(*) FILTER (WHERE status NOT IN ('published','cancelled')) AS open_tasks,
        COUNT(*) FILTER (
          WHERE status = 'published' AND updated_at >= (NOW() - INTERVAL '28 days')
        ) AS published_28d
      FROM tasks
      WHERE assignee_id IS NOT NULL
      GROUP BY assignee_id
    `);

    const map = new Map();
    kpiRows.forEach((r) =>
      map.set(r.user_id, {
        openTasks: Number(r.open_tasks || 0),
        published28d: Number(r.published_28d || 0),
      })
    );

    res.json({
      data: rows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        avatarUrl: u.avatar_url,
        active: u.active,
        createdAt: u.created_at,
        openTasks: map.get(u.id)?.openTasks || 0,
        published28d: map.get(u.id)?.published28d || 0,
      })),
    });
  } catch (err) {
    console.error("GET /api/staff error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    if (!req.staffUser || req.staffUser.role !== "admin") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only admin" } });
    }
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ error: { code: "VALIDATION", message: "Invalid id" } });

    const { name, role, active } = req.body || {};

    const { rows: oldRows } = await pool.query(
      "SELECT id, name, email, role, active FROM staff_users WHERE id=$1",
      [id]
    );
    const oldUser = oldRows[0];
    if (!oldUser) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
    }

    const { rows } = await pool.query(
      `
      UPDATE staff_users
      SET name = COALESCE($1, name),
          role = COALESCE($2, role),
          active = COALESCE($3, active)
      WHERE id = $4
      RETURNING id, name, email, role, avatar_url, active, created_at
      `,
      [name ?? null, role ?? null, active ?? null, id]
    );
    const newUser = rows[0];

    const changes = {};
    ["name", "role", "active"].forEach((f) => {
      if (oldUser[f] !== newUser[f]) {
        changes[f] = { before: oldUser[f], after: newUser[f] };
      }
    });

    if (Object.keys(changes).length) {
      logAudit({
        actorUserId: req.staffUser.id,
        action: "staff.update",
        entityType: "staff_user",
        entityId: id,
        metadata: { email: newUser.email, changes },
      });
    }

    res.json({ user: newUser });
  } catch (err) {
    console.error("PATCH /api/staff/:id error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ error: { code: "VALIDATION", message: "Invalid id" } });

    const { rows } = await pool.query(
      "SELECT id, name, email, role, avatar_url, active, created_at FROM staff_users WHERE id=$1",
      [id]
    );
    const u = rows[0];
    if (!u) return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });

    const [teamsRes, kpiRes] = await Promise.all([
      pool.query(
        `
        SELECT t.id, t.name
        FROM team_members tm
        JOIN teams t ON t.id = tm.team_id
        WHERE tm.user_id = $1
        `,
        [id]
      ),
      pool.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE status NOT IN ('published','cancelled')) AS open_tasks,
          COUNT(*) FILTER (
            WHERE status = 'published' AND updated_at >= (NOW() - INTERVAL '28 days')
          ) AS published_28d
        FROM tasks
        WHERE assignee_id = $1
        `,
        [id]
      ),
    ]);

    const k = kpiRes.rows[0] || {};

    res.json({
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        avatarUrl: u.avatar_url,
        active: u.active,
        createdAt: u.created_at,
        teams: teamsRes.rows,
        openTasks: Number(k.open_tasks || 0),
        published28d: Number(k.published_28d || 0),
      },
    });
  } catch (err) {
    console.error("GET /api/staff/:id error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
  }
});

export default router;
