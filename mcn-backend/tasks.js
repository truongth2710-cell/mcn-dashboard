import express from "express";
import pool from "./db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const isAdminLike = req.staffUser && ["admin", "director"].includes(req.staffUser.role);
    const { channelIds = [] } = req.teamContext || { channelIds: [] };

    const { status, channelId, projectId, assigneeId } = req.query;
    const where = [];
    const values = [];

    if (status) {
      values.push(status);
      where.push(`status = $${values.length}`);
    }
    if (channelId) {
      values.push(channelId);
      where.push(`channel_id = $${values.length}`);
    }
    if (projectId) {
      values.push(Number(projectId));
      where.push(`project_id = $${values.length}`);
    }
    if (assigneeId) {
      values.push(Number(assigneeId));
      where.push(`assignee_id = $${values.length}`);
    }

    if (!isAdminLike) {
      const userId = req.staffUser.id;
      if (channelIds.length) {
        values.push(channelIds);
        where.push(`(channel_id = ANY($${values.length}::text[]) OR assignee_id = ${userId})`);
      } else {
        where.push(`assignee_id = ${userId}`);
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `
      SELECT * FROM tasks
      ${whereSql}
      ORDER BY due_date NULLS LAST, created_at DESC
      `,
      values
    );

    res.json({ data: rows });
  } catch (err) {
    console.error("GET /api/tasks error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
  }
});

router.get("/board", async (req, res) => {
  try {
    const isAdminLike = req.staffUser && ["admin", "director"].includes(req.staffUser.role);
    const { channelIds = [] } = req.teamContext || { channelIds: [] };

    const { channelId, projectId } = req.query;
    const where = [];
    const values = [];

    if (channelId) {
      values.push(channelId);
      where.push(`channel_id = $${values.length}`);
    }
    if (projectId) {
      values.push(Number(projectId));
      where.push(`project_id = $${values.length}`);
    }

    if (!isAdminLike) {
      const userId = req.staffUser.id;
      if (channelIds.length) {
        values.push(channelIds);
        where.push(`(channel_id = ANY($${values.length}::text[]) OR assignee_id = ${userId})`);
      } else {
        where.push(`assignee_id = ${userId}`);
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `
      SELECT * FROM tasks
      ${whereSql}
      ORDER BY created_at DESC
      `,
      values
    );

    const columns = {};
    rows.forEach((t) => {
      const col = t.pipeline_stage || "Other";
      if (!columns[col]) columns[col] = [];
      columns[col].push(t);
    });

    res.json({ columns });
  } catch (err) {
    console.error("GET /api/tasks/board error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
  }
});

router.post("/", async (req, res) => {
  try {
    const isAdminLike = req.staffUser && ["admin", "director"].includes(req.staffUser.role);
    const { channelIds = [] } = req.teamContext || { channelIds: [] };

    const {
      title,
      channelId,
      projectId,
      youtubeVideoId,
      status = "idea",
      pipelineStage = "Idea",
      assigneeId,
      dueDate,
      checklist = [],
    } = req.body || {};

    if (!title) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "title is required" } });
    }

    if (!isAdminLike && channelId && !channelIds.includes(channelId)) {
      return res
        .status(403)
        .json({ error: { code: "FORBIDDEN", message: "Cannot create task for this channel" } });
    }

    const { rows } = await pool.query(
      `
      INSERT INTO tasks (title, channel_id, project_id, youtube_video_id, status, pipeline_stage, assignee_id, due_date, checklist)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
      `,
      [
        title,
        channelId || null,
        projectId || null,
        youtubeVideoId || null,
        status,
        pipelineStage,
        assigneeId || null,
        dueDate || null,
        checklist,
      ]
    );

    res.status(201).json({ task: rows[0] });
  } catch (err) {
    console.error("POST /api/tasks error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    if (!id) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "Invalid id" } });
    }

    const {
      title,
      channelId,
      projectId,
      youtubeVideoId,
      status,
      pipelineStage,
      assigneeId,
      dueDate,
      checklist,
    } = req.body || {};

    const { rows } = await pool.query(
      `
      UPDATE tasks
      SET title = COALESCE($1, title),
          channel_id = COALESCE($2, channel_id),
          project_id = COALESCE($3, project_id),
          youtube_video_id = COALESCE($4, youtube_video_id),
          status = COALESCE($5, status),
          pipeline_stage = COALESCE($6, pipeline_stage),
          assignee_id = COALESCE($7, assignee_id),
          due_date = COALESCE($8, due_date),
          checklist = COALESCE($9, checklist),
          updated_at = NOW()
      WHERE id = $10
      RETURNING *
      `,
      [
        title ?? null,
        channelId ?? null,
        projectId ?? null,
        youtubeVideoId ?? null,
        status ?? null,
        pipelineStage ?? null,
        assigneeId ?? null,
        dueDate ?? null,
        checklist ?? null,
        id,
      ]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Task not found" } });
    }

    res.json({ task: rows[0] });
  } catch (err) {
    console.error("PATCH /api/tasks/:id error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Server error" } });
  }
});

export default router;
