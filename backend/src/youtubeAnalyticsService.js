// backend/src/youtubeAnalyticsService.js
import dotenv from "dotenv";
import { google } from "googleapis";
import { pool } from "./db.js";

dotenv.config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

function getOAuthClientWithRefreshToken(refreshToken) {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error("Missing Google OAuth env vars");
  }
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

// dateStr dạng "YYYY-MM-DD" – nếu không truyền => tự lấy ngày hôm qua
export async function syncDailyMetrics(dateStr) {
  // Tính ngày
  let targetDate;
  if (dateStr) {
    targetDate = dateStr;
  } else {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    targetDate = d.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  console.log("Sync YouTube metrics for date", targetDate);

  // Lấy danh sách connection + kênh tương ứng
  const rowsRes = await pool.query(
    `
    SELECT
      yc.id           AS connection_id,
      yc.refresh_token,
      c.id            AS channel_id,
      c.youtube_channel_id
    FROM youtube_connections yc
    JOIN channels c
      ON c.owner_connection_id = yc.id
    WHERE c.status = 'active'
      AND yc.refresh_token IS NOT NULL
    ORDER BY yc.id;
    `
  );
  const rows = rowsRes.rows;
  if (!rows.length) {
    console.log("No channels to sync");
    return { date: targetDate, syncedChannels: 0 };
  }

  // Gom theo connection_id
  const byConnection = {};
  for (const r of rows) {
    if (!byConnection[r.connection_id]) {
      byConnection[r.connection_id] = {
        refresh_token: r.refresh_token,
        channels: []
      };
    }
    byConnection[r.connection_id].channels.push({
      channel_id: r.channel_id,
      youtube_channel_id: r.youtube_channel_id
    });
  }

  let successCount = 0;
  let errorCount = 0;

  for (const [connId, info] of Object.entries(byConnection)) {
    const refreshToken = info.refresh_token;
    if (!refreshToken) continue;

    const oauth2Client = getOAuthClientWithRefreshToken(refreshToken);
    const ytAnalytics = google.youtubeAnalytics({ version: "v2", auth: oauth2Client });

    for (const ch of info.channels) {
      try {
        const resp = await ytAnalytics.reports.query({
          ids: "channel==" + ch.youtube_channel_id,
          startDate: targetDate,
          endDate: targetDate,
          metrics:
            "views,estimatedMinutesWatched,estimatedRevenue,subscribersGained,subscribersLost",
          dimensions: "day"
        });

        const rows = resp.data.rows || [];
        if (!rows.length) {
          console.log(
            `No analytics rows for channel ${ch.youtube_channel_id} on ${targetDate}`
          );
          continue;
        }

        const [
          _day,
          views,
          watchTimeMinutes,
          revenue,
          subsGained,
          subsLost
        ] = rows[0];

        await pool.query(
          `
          INSERT INTO channel_metrics_daily
            (channel_id, date, views, watch_time_minutes, revenue, subs_gained, subs_lost)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (channel_id, date) DO UPDATE SET
            views = EXCLUDED.views,
            watch_time_minutes = EXCLUDED.watch_time_minutes,
            revenue = EXCLUDED.revenue,
            subs_gained = EXCLUDED.subs_gained,
            subs_lost = EXCLUDED.subs_lost;
          `,
          [
            ch.channel_id,
            targetDate,
            Math.round(views || 0),
            Math.round(watchTimeMinutes || 0),
            Number(revenue || 0),
            Math.round(subsGained || 0),
            Math.round(subsLost || 0)
          ]
        );

        successCount++;
      } catch (err) {
        errorCount++;
        console.error(
          `Sync error for channel ${ch.youtube_channel_id} on ${targetDate}:`,
          err.response?.data || err.message || err
        );
      }
    }
  }

  console.log("Sync finished:", { date: targetDate, successCount, errorCount });
  return { date: targetDate, successCount, errorCount };
}
