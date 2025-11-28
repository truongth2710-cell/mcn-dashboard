import express from "express";
import { pool } from "../db.js";
import { authMiddleware } from "../auth.js";
import { generateAuthUrl, handleOAuthCallback } from "../youtubeOauthService.js";

const router = express.Router();

// Lấy URL để user bấm kết nối kênh
router.get("/connect-url", authMiddleware, (req, res) => {
  try {
    const staffId = req.user.id;
    const url = generateAuthUrl(String(staffId));
    res.json({ url });
  } catch (err) {
    console.error("connect-url error:", err);
    res.status(500).json({ error: "Failed to generate auth URL" });
  }
});

// Callback từ Google sau khi user chấp nhận
// path này phải trùng với GOOGLE_REDIRECT_URI (/oauth2/callback)
router.get("/oauth2/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.status(400).send("Missing code or state");
    }

    await handleOAuthCallback(code, state);

    const redirectFrontend = process.env.OAUTH_FRONTEND_URL || "http://localhost:5173";
    res.redirect(redirectFrontend + "/youtube-connected");
  } catch (err) {
    console.error("OAuth callback error:", err);
    res.status(500).send("Failed to connect YouTube channel");
  }
});

// Danh sách kênh mà user đang quản lý
router.get("/my-channels", authMiddleware, async (req, res) => {
  try {
    const staffId = req.user.id;
    const result = await pool.query(
      `
      SELECT c.id, c.name, c.youtube_channel_id, n.name AS network_name, t.name AS team_name
      FROM channels c
      LEFT JOIN staff_channels sc ON sc.channel_id = c.id
      LEFT JOIN networks n ON c.network_id = n.id
      LEFT JOIN teams t ON c.team_id = t.id
      WHERE sc.staff_id = $1;
      `,
      [staffId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("my-channels error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
