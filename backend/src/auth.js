import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { pool } from "./db.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

const ROLE_ORDER = ["viewer", "manager", "admin"];

function roleRank(role) {
  const idx = ROLE_ORDER.indexOf(role);
  return idx === -1 ? -1 : idx;
}

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }
  const token = authHeader.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (roleRank(req.user.role) < roleRank(minRole)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

export async function findStaffByEmail(email) {
  const result = await pool.query("SELECT * FROM staff_users WHERE email = $1", [email]);
  return result.rows[0] || null;
}

export async function createStaff({ email, name, password, role = "viewer" }) {
  const password_hash = bcrypt.hashSync(password, 10);
  const result = await pool.query(
    `
    INSERT INTO staff_users (email, name, password_hash, role)
    VALUES ($1, $2, $3, $4)
    RETURNING id, email, name, role, created_at;
    `,
    [email, name, password_hash, role]
  );
  return result.rows[0];
}
