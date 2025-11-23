import dotenv from "dotenv";
dotenv.config();
import pool from "./db.js";

async function migrate() {
  console.log("Running migrations...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff_users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      avatar_url TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      auth0_sub TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_members (
      team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
      PRIMARY KEY (team_id, user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_channels (
      team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      channel_id TEXT NOT NULL,
      PRIMARY KEY (team_id, channel_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS talents (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      contact TEXT,
      rev_share_percent NUMERIC(5,2) NOT NULL DEFAULT 50.0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS talent_channels (
      talent_id INTEGER NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
      channel_id TEXT NOT NULL,
      PRIMARY KEY (talent_id, channel_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      channel_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      start_date DATE,
      end_date DATE,
      tags TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      channel_id TEXT,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      youtube_video_id TEXT,
      status TEXT NOT NULL DEFAULT 'idea',
      pipeline_stage TEXT NOT NULL DEFAULT 'Idea',
      assignee_id INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
      due_date DATE,
      checklist JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS tasks_channel_id_idx ON tasks(channel_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS yt_daily_revenue (
      channel_id TEXT NOT NULL,
      date DATE NOT NULL,
      views BIGINT NOT NULL DEFAULT 0,
      estimated_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
      PRIMARY KEY (channel_id, date)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      actor_user_id INTEGER REFERENCES staff_users(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);
  `);

  console.log("Migrations done.");
  await pool.end();
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
