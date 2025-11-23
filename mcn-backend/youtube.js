import { google } from "googleapis";
import pool from "./db.js";

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
} = process.env;

function createOAuthClient() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

// Lấy URL để admin bấm login Google
export function getAuthUrl() {
  const oauth2Client = createOAuthClient();

  const scopes = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
  });

  return url;
}

// Xử lý callback, lưu token vào bảng google_tokens
export async function handleOAuthCallback(code, userId) {
  const oauth2Client = createOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);

  // Lưu / upsert vào google_tokens
  await pool.query(
    `
    INSERT INTO google_tokens (user_id, access_token, refresh_token, scope, token_type, expiry_date)
    VALUES ($1,$2,$3,$4,$5,to_timestamp($6))
    ON CONFLICT (user_id) DO UPDATE
    SET access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        scope = EXCLUDED.scope,
        token_type = EXCLUDED.token_type,
        expiry_date = EXCLUDED.expiry_date
  `,
    [
      userId,
      tokens.access_token,
      tokens.refresh_token,
      tokens.scope || "",
      tokens.token_type || "Bearer",
      tokens.expiry_date ? tokens.expiry_date / 1000 : null,
    ]
  );
}

// Lấy OAuth client đã gắn token của 1 user
export async function getAuthorizedClientForUser(userId) {
  const oauth2Client = createOAuthClient();

  const { rows } = await pool.query(
    "SELECT * FROM google_tokens WHERE user_id = $1 LIMIT 1",
    [userId]
  );
  const row = rows[0];
  if (!row) throw new Error("No google token for this user");

  oauth2Client.setCredentials({
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    scope: row.scope,
    token_type: row.token_type,
    expiry_date: row.expiry_date
      ? row.expiry_date.getTime()
      : undefined,
  });

  return oauth2Client;
}

// Gọi YouTube Analytics, ghi vào yt_daily_revenue
export async function syncChannelDailyStats(userId, channelId, startDate, endDate) {
  const auth = await getAuthorizedClientForUser(userId);

  const youtubeAnalytics = google.youtubeAnalytics({ version: "v2", auth });

  const res = await youtubeAnalytics.reports.query({
    ids: "channel=="+channelId,
    startDate, // "2025-10-01"
    endDate,   // "2025-10-31"
    metrics: "views,estimatedRevenue",
    dimensions: "day",
  });

  const rows = res.data.rows || [];

  for (const row of rows) {
    const [dateStr, views, revenue] = row; // date, views, estimatedRevenue

    await pool.query(
      `
      INSERT INTO yt_daily_revenue (channel_id, date, views, estimated_revenue)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (channel_id, date) DO UPDATE
      SET views = EXCLUDED.views,
          estimated_revenue = EXCLUDED.estimated_revenue
    `,
      [channelId, dateStr, views, revenue]
    );
  }

  return rows.length;
}
