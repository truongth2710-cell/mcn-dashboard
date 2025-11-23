import express from "express";
import pool from "./db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { channelId, status } = req.query;
    const where = [];
    const values = [];

    if (channelId) {
      values.push(channelId);
      where.push(`channel_id = $${values.length}`);
    }
    if (status) {
      values.push(status);
      where.push(`status = $${values.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `
      SELECT * FROM projects
      ${whereSql}
      ORDER BY created_at DESC
      `,
      values
    );

    res.json({ data: rows });
  } catch (err) {
    console.error("GET /api/projects error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, description, channelId, status = "active", startDate, endDate, tags = [] } =
      req.body || {};
    if (!name) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "name is required" } });
    }
    const { rows } = await pool.query(
      `
      INSERT INTO projects (name, description, channel_id, status, start_date, end_date, tags)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [name, description || null, channelId || null, status, startDate || null, endDate || null, tags]
    );
    res.status(201).json({ project: rows[0] });
  } catch (err) {
    console.error("POST /api/projects error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
  }
});

export default router;
