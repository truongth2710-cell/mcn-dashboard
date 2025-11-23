import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import { expressjwt } from "express-jwt";
import jwksRsa from "jwks-rsa";

import staffRouter from "./staff.js";
import teamsRouter from "./teams.js";
import projectsRouter from "./projects.js";
import tasksRouter from "./tasks.js";
import reportsRouter from "./reports.js";
import talentsRouter from "./talents.js";
import pool from "./db.js";
import {
  attachStaffUser,
  requireAnyRole,
  requireRoleAtLeast,
  loadTeamContext,
} from "./auth.js";

// 👇 NEW: YouTube helpers
import {
  getAuthUrl,
  handleOAuthCallback,
  syncChannelDailyStats,
} from "./youtube.js";

const app = express();
app.use(cors());
app.use(express.json());

const requireAuth = expressjwt({
  secret: jwksRsa.expressJwtSecret({
    jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
    cache: true,
    rateLimit: true,
  }),
  algorithms: ["RS256"],
  audience: process.env.AUTH0_AUDIENCE,
  issuer: `https://${process.env.AUTH0_DOMAIN}/`,
});

app.get("/", (req, res) => {
  res.send("MCN backend OK");
});

app.get("/api/me", requireAuth, attachStaffUser, (req, res) => {
  res.json({ user: req.staffUser });
});

app.use(
  "/api/staff",
  requireAuth,
  attachStaffUser,
  requireAnyRole(["admin", "director"]),
  staffRouter
);

app.use(
  "/api/teams",
  requireAuth,
  attachStaffUser,
  requireAnyRole(["admin", "director", "team_lead"]),
  loadTeamContext,
  teamsRouter
);

app.use(
  "/api/projects",
  requireAuth,
  attachStaffUser,
  requireRoleAtLeast("editor"),
  loadTeamContext,
  projectsRouter
);

app.use(
  "/api/tasks",
  requireAuth,
  attachStaffUser,
  requireRoleAtLeast("editor"),
  loadTeamContext,
  tasksRouter
);

app.use(
  "/api/talents",
  requireAuth,
  attachStaffUser,
  requireAnyRole(["admin", "director"]),
  talentsRouter
);

app.use(
  "/api/reports",
  requireAuth,
  attachStaffUser,
  requireRoleAtLeast("viewer"),
  loadTeamContext,
  reportsRouter
);

// 🔎 Audit logs API giữ nguyên
app.get(
  "/api/audit-logs",
  requireAuth,
  attachStaffUser,
  requireAnyRole(["admin"]),
  async (req, res) => {
    try {
      const { entityType, entityId, limit = 50 } = req.query;
      const values = [];
      const where = [];
      if (entityType) {
        values.push(entityType);
        where.push(`entity_type = $${values.length}`);
      }
      if (entityId) {
        values.push(Number(entityId));
        where.push(`entity_id = $${values.length}`);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const { rows } = await pool.query(
        `
        SELECT a.*, s.name AS actor_name, s.email AS actor_email
        FROM audit_logs a
        LEFT JOIN staff_users s ON s.id = a.actor_user_id
        ${whereSql}
        ORDER BY a.created_at DESC
        LIMIT $${values.length + 1}
        `,
        [...values, Number(limit)]
      );
      res.json({ data: rows });
    } catch (err) {
      console.error("GET /api/audit-logs error", err);
      res
        .status(500)
        .json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
    }
  }
);

// ===============================
//  YOUTUBE AUTH & SYNC ENDPOINTS
// ===============================

// Lấy URL để admin bấm "Kết nối YouTube"
app.get(
  "/api/youtube/auth-url",
  requireAuth,
  attachStaffUser,
  requireRoleAtLeast("admin"),
  (req, res) => {
    try {
      const url = getAuthUrl(req.staffUser.id);
      res.json({ url });
    } catch (err) {
      console.error("GET /api/youtube/auth-url error", err);
      res
        .status(500)
        .json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
    }
  }
);

// Callback từ Google OAuth2 (không cần Auth0 middleware)
app.get("/api/youtube/oauth2/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) {
      return res
        .status(400)
        .send("Missing code from Google OAuth2 callback.");
    }

    // state chứa userId đã gắn khi tạo auth-url (fallback = 1)
    const userId = state ? Number(state) : 1;

    await handleOAuthCallback(code.toString(), userId);
    res.send(
      "YouTube connected successfully. You can close this window and return to the dashboard."
    );
  } catch (err) {
    console.error("GET /api/youtube/oauth2/callback error", err);
    res.status(500).send("Error connecting YouTube.");
  }
});

// API để sync 1 channel trong khoảng ngày
app.post(
  "/api/youtube/sync-channel",
  requireAuth,
  attachStaffUser,
  requireRoleAtLeast("admin"),
  async (req, res) => {
    try {
      const { channelId, startDate, endDate } = req.body;
      if (!channelId || !startDate || !endDate) {
        return res.status(400).json({
          error: {
            code: "BAD_REQUEST",
            message: "channelId, startDate, endDate are required",
          },
        });
      }

      const rows = await syncChannelDailyStats(
        req.staffUser.id,
        channelId,
        startDate,
        endDate
      );

      res.json({ ok: true, rows });
    } catch (err) {
      console.error("POST /api/youtube/sync-channel error", err);
      res
        .status(500)
        .json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
    }
  }
);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log("Server running on port", port);
});
