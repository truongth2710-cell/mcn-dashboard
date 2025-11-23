import pool from "./db.js";

export async function attachStaffUser(req, res, next) {
  try {
    // FIX: express-jwt v8 gán payload trực tiếp vào req.auth
    const payload = req.auth;
    if (!payload) {
      return res
        .status(401)
        .json({ error: { code: "UNAUTHENTICATED", message: "No auth payload" } });
    }

    const sub = payload.sub;
    const email = payload.email;
    const name = payload.name || email;

    if (!email) {
      return res
        .status(400)
        .json({ error: { code: "NO_EMAIL", message: "Token has no email" } });
    }

    let user;
    {
      const { rows } = await pool.query(
        "SELECT * FROM staff_users WHERE auth0_sub = $1 OR email = $2 LIMIT 1",
        [sub, email]
      );
      user = rows[0];
    }

    if (!user) {
      const { rows } = await pool.query(
        "INSERT INTO staff_users (name, email, role, auth0_sub, active) VALUES ($1,$2,'viewer',$3,true) RETURNING *",
        [name, email, sub]
      );
      user = rows[0];
    } else if (!user.auth0_sub) {
      await pool.query("UPDATE staff_users SET auth0_sub = $1 WHERE id = $2", [sub, user.id]);
    }

    req.staffUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
    };

    next();
  } catch (err) {
    console.error("attachStaffUser error", err);
    res
      .status(500)
      .json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
  }
}

const ROLE_ORDER = ["viewer", "editor", "channel_manager", "team_lead", "director", "admin"];

export function requireAnyRole(roles = []) {
  return (req, res, next) => {
    if (!req.staffUser) {
      return res
        .status(401)
        .json({ error: { code: "UNAUTHENTICATED", message: "No staff user" } });
    }
    if (!roles.length || roles.includes(req.staffUser.role)) return next();
    return res
      .status(403)
      .json({ error: { code: "FORBIDDEN", message: "Insufficient role" } });
  };
}

export function requireRoleAtLeast(minRole) {
  return (req, res, next) => {
    if (!req.staffUser) {
      return res
        .status(401)
        .json({ error: { code: "UNAUTHENTICATED", message: "No staff user" } });
    }
    const u = ROLE_ORDER.indexOf(req.staffUser.role);
    const m = ROLE_ORDER.indexOf(minRole);
    if (u >= 0 && m >= 0 && u >= m) return next();
    return res
      .status(403)
      .json({ error: { code: "FORBIDDEN", message: "Insufficient role" } });
  };
}

export async function loadTeamContext(req, res, next) {
  try {
    if (!req.staffUser) {
      return res
        .status(401)
        .json({ error: { code: "UNAUTHENTICATED", message: "No staff user" } });
    }
    const userId = req.staffUser.id;

    const { rows: teamRows } = await pool.query(
      "SELECT team_id FROM team_members WHERE user_id = $1",
      [userId]
    );
    const teamIds = teamRows.map((r) => r.team_id);

    let channelIds = [];
    if (teamIds.length) {
      const { rows: chRows } = await pool.query(
        "SELECT DISTINCT channel_id FROM team_channels WHERE team_id = ANY($1::int[])",
        [teamIds]
      );
      channelIds = chRows.map((r) => r.channel_id);
    }

    req.teamContext = { teamIds, channelIds };
    next();
  } catch (err) {
    console.error("loadTeamContext error", err);
    res
      .status(500)
      .json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
  }
}

export function isAdminOrDirector(req) {
  const r = req.staffUser?.role;
  return r === "admin" || r === "director";
}
