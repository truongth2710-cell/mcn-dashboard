// backend/src/scripts/backfillRange.js
// Backfill dữ liệu YouTube Analytics cho TẤT CẢ kênh đã kết nối
// trong bảng youtube_connections + channels.
//
// Cách dùng:
//   node src/scripts/backfillRange.js
//     -> tự tính 1 năm gần nhất (tới hôm qua)
//
//   BACKFILL_START_DATE=2024-01-01 BACKFILL_END_DATE=2024-12-31 node src/scripts/backfillRange.js
//     -> backfill đúng khoảng này (YYYY-MM-DD)

import dotenv from "dotenv";
import { google } from "googleapis";
import { pool, runMigrations } from "../db.js";

dotenv.config();

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
  process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
  console.error(
    "Thiếu GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI trong .env"
  );
  process.exit(1);
}

// Tạo OAuth client từ refresh_token
function getOAuthClientWithRefreshToken(refreshToken) {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

/** Nếu không truyền BACKFILL_START_DATE/BACKFILL_END_DATE → lấy 1 năm gần nhất */
function getDateRangeFromEnv() {
  const envStart = process.env.BACKFILL_START_DATE;
  const envEnd = process.env.BACKFILL_END_DATE;

  if (envStart && envEnd) {
    return { startDate: envStart, endDate: envEnd };
  }

  const today = new Date();
  const end = new Date(today.getTime() - 24 * 60 * 60 * 1000); // hôm qua
  const start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
  const toStr = (d) => d.toISOString().slice(0, 10);

  return { startDate: toStr(start), endDate: toStr(end) };
}

/**
 * Gọi YouTube Analytics cho 1 kênh trong 1 khoảng ngày:
 * metrics: views, estimatedMinutesWatched, estimatedRevenue,
 *          subscribersGained, subscribersLost
 * dimensions: day
 * -> trả về mảng rows: [day, views, watchTimeMinutes, revenue, subsGained, subsLost]
 * Nếu lỗi permission revenue -> fallback chỉ views + watchTime.
 */
async function fetchRangeForChannel(channelId, startDate, endDate, client) {
  const ytAnalytics = google.youtubeAnalytics("v2");

  async function query(metrics) {
    const { data } = await ytAnalytics.reports.query({
      auth: client,
      ids: `channel==${channelId}`,
      startDate,
      endDate,
      metrics,
      dimensions: "day",
      sort: "day"
    });
    return data;
  }

  try {
    // thử lấy đầy đủ metrics
    const data = await query(
      "views,estimatedMinutesWatched,estimatedRevenue,subscribersGained,subscribersLost"
    );

    const headers = data.columnHeaders || [];
    const dayIdx = headers.findIndex((h) => h.name === "day");
    const viewsIdx = headers.findIndex((h) => h.name === "views");
    const wtIdx = headers.findIndex(
      (h) => h.name === "estimatedMinutesWatched"
    );
    const revIdx = headers.findIndex((h) => h.name === "estimatedRevenue");
    const sgIdx = headers.findIndex((h) => h.name === "subscribersGained");
    const slIdx = headers.findIndex((h) => h.name === "subscribersLost");

    const rows = (data.rows || []).map((r) => [
      r[dayIdx],
      Number(r[viewsIdx] || 0),
      Number(r[wtIdx] || 0),
      Number(r[revIdx] || 0),
      Number(r[sgIdx] || 0),
      Number(r[slIdx] || 0)
    ]);

    return rows;
  } catch (e1) {
    const msg = String(
      e1?.response?.data?.error?.message || e1.message || e1
    ).toLowerCase();

    // Nếu lỗi permission (không xem được revenue) -> fallback lấy subset
    const permErr = /monetary|insufficient|forbidden|permission/.test(msg);
    if (!permErr) {
      // quota / network / lỗi khác -> ném ra ngoài
      throw e1;
    }

    console.log(
      "Permission revenue error, fallback views + watchTime:",
      channelId,
      msg
    );

    const data = await query("views,estimatedMinutesWatched");
    const headers = data.columnHeaders || [];
    const dayIdx = headers.findIndex((h) => h.name === "day");
    const viewsIdx = headers.findIndex((h) => h.name === "views");
    const wtIdx = headers.findIndex(
      (h) => h.name === "estimatedMinutesWatched"
    );

    const rows = (data.rows || []).map((r) => [
      r[dayIdx],
      Number(r[viewsIdx] || 0),
      Number(r[wtIdx] || 0),
      0, // revenue = 0 vì không có quyền
      0,
      0
    ]);

    return rows;
  }
}

/** Lưu nhiều ngày vào bảng channel_metrics_daily (upsert) */
async function saveRangeToDB(channelTableId, rows) {
  for (const r of rows) {
    const date = r[0]; // "YYYY-MM-DD"
    const views = Number(r[1] || 0);
    const watch = Number(r[2] || 0);
    const revenue = Number(r[3] || 0);
    const subsGained = Number(r[4] || 0);
    const subsLost = Number(r[5] || 0);

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
      [channelTableId, date, views, watch, revenue, subsGained, subsLost]
    );
  }
}

/** Main backfill */
async function main() {
  await runMigrations();

  const { startDate, endDate } = getDateRangeFromEnv();
  console.log("=== BACKFILL RANGE:", startDate, "→", endDate, "===");

  // Lấy tất cả refresh_token + kênh tương ứng từ DB
  const res = await pool.query(
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
  const rows = res.rows;
  if (!rows.length) {
    console.log("Không tìm thấy kênh nào để backfill (chưa connect kênh?).");
    return;
  }

  // Gom theo connection để tái sử dụng OAuth client
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

  let successChannels = 0;
  let errorChannels = 0;

  for (const [connId, info] of Object.entries(byConnection)) {
    const refreshToken = info.refresh_token;
    if (!refreshToken) continue;

    console.log(">> Connection", connId, "– số kênh:", info.channels.length);

    const oauth2Client = getOAuthClientWithRefreshToken(refreshToken);

    for (const ch of info.channels) {
      try {
        console.log(
          `   - Fetch range cho kênh ${ch.youtube_channel_id} (id=${ch.channel_id})...`
        );

        const rows = await fetchRangeForChannel(
          ch.youtube_channel_id,
          startDate,
          endDate,
          oauth2Client
        );

        if (!rows || !rows.length) {
          console.log("     Không có data trong khoảng này");
          continue;
        }

        await saveRangeToDB(ch.channel_id, rows);
        console.log("     OK, số ngày:", rows.length);
        successChannels++;

        // Nghỉ 300ms giữa các kênh giảm rủi ro quota
        await new Promise((r) => setTimeout(r, 300));
      } catch (e) {
        errorChannels++;
        console.error(
          `     LỖI backfill kênh ${ch.youtube_channel_id}:`,
          e?.response?.data || e.message || e
        );
      }
    }
  }

  console.log("=== DONE BACKFILL ===");
  console.log("Kênh OK:", successChannels, "| Kênh lỗi:", errorChannels);
}

main()
  .then(() => {
    return pool.end();
  })
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    console.error("Lỗi backfillRange:", e);
    process.exit(1);
  });
