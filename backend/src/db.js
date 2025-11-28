import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Staff users
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Teams
    await client.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT
      );
    `);

    // Networks
    await client.query(`
      CREATE TABLE IF NOT EXISTS networks (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT
      );
    `);

    // Projects
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        start_date DATE,
        end_date DATE
      );
    `);

    // YouTube connections (per staff)
    await client.query(`
      CREATE TABLE IF NOT EXISTS youtube_connections (
        id SERIAL PRIMARY KEY,
        staff_id INTEGER NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
        google_email TEXT,
        channel_owner_name TEXT,
        access_token TEXT,
        refresh_token TEXT,
        token_expiry TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Channels
    await client.query(`
      CREATE TABLE IF NOT EXISTS channels (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        youtube_channel_id TEXT UNIQUE NOT NULL,
        network_id INTEGER REFERENCES networks(id),
        team_id INTEGER REFERENCES teams(id),
        manager_id INTEGER REFERENCES staff_users(id),
        owner_connection_id INTEGER REFERENCES youtube_connections(id),
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Staff ↔ Channels
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_channels (
        id SERIAL PRIMARY KEY,
        staff_id INTEGER NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
        channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'manager',
        UNIQUE (staff_id, channel_id)
      );
    `);

    // Project ↔ Channels
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_channels (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        UNIQUE (project_id, channel_id)
      );
    `);

    // Daily metrics
    await client.query(`
      CREATE TABLE IF NOT EXISTS channel_metrics_daily (
        id SERIAL PRIMARY KEY,
        channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        views INTEGER NOT NULL DEFAULT 0,
        watch_time_minutes INTEGER NOT NULL DEFAULT 0,
        revenue NUMERIC(18,4) NOT NULL DEFAULT 0,
        subs_gained INTEGER NOT NULL DEFAULT 0,
        subs_lost INTEGER NOT NULL DEFAULT 0,
        CONSTRAINT channel_metrics_daily_unique UNIQUE (channel_id, date)
      );
    `);

    await client.query("COMMIT");
    console.log("Migrations completed");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration error:", err);
    throw err;
  } finally {
    client.release();
  }
}
