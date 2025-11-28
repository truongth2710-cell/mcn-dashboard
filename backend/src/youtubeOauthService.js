import dotenv from "dotenv";
import { google } from "googleapis";
import { pool } from "./db.js";

dotenv.config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

const SCOPES = [
  // YouTube
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",

  // Thêm quyền lấy email / profile để gọi oauth2.userinfo.get
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile"
];

function getOAuth2Client() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error("Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI");
  }
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

export function generateAuthUrl(state) {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    state
  });
}

export async function handleOAuthCallback(code, state) {
  const staffId = Number(state);
  if (!staffId) throw new Error("Invalid state/staffId");

  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Get Google user info
  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const userInfoRes = await oauth2.userinfo.get();
  const googleEmail = userInfoRes.data.email || null;
  const ownerName = userInfoRes.data.name || null;

  // Get YouTube channels owned by this account
  const youtube = google.youtube({ version: "v3", auth: oauth2Client });
  const channelsRes = await youtube.channels.list({
    mine: true,
    part: ["snippet"]
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const connRes = await client.query(
      `
      INSERT INTO youtube_connections
        (staff_id, google_email, channel_owner_name, access_token, refresh_token, token_expiry)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id;
      `,
      [
        staffId,
        googleEmail,
        ownerName,
        tokens.access_token || null,
        tokens.refresh_token || null,
        tokens.expiry_date ? new Date(tokens.expiry_date) : null
      ]
    );
    const connectionId = connRes.rows[0].id;

    const items = channelsRes.data.items || [];
    for (const ch of items) {
      const ytId = ch.id;
      const name = ch.snippet?.title || "Unknown Channel";

      // upsert channel
      await client.query(
        `
        INSERT INTO channels (name, youtube_channel_id, owner_connection_id, status)
        VALUES ($1, $2, $3, 'active')
        ON CONFLICT (youtube_channel_id) DO UPDATE SET
          owner_connection_id = EXCLUDED.owner_connection_id,
          status = 'active';
        `,
        [name, ytId, connectionId]
      );

      const cRes = await client.query(
        "SELECT id FROM channels WHERE youtube_channel_id = $1",
        [ytId]
      );
      const channelId = cRes.rows[0].id;

      // map staff ↔ channel
      await client.query(
        `
        INSERT INTO staff_channels (staff_id, channel_id, role)
        VALUES ($1, $2, 'manager')
        ON CONFLICT (staff_id, channel_id) DO UPDATE SET role = 'manager';
        `,
        [staffId, channelId]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
