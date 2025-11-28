import express from "express";
import { authMiddleware, requireRole } from "../auth.js";
import { syncDailyMetrics } from "../youtubeAnalyticsService.js";

const router = express.Router();

// Chạy sync cho 1 ngày (admin)
router.post("/sync-daily", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { date } = req.body || {};
    const result = await syncDailyMetrics(date);
    res.json(result);
  } catch (err) {
    console.error("sync-daily error:", err.response?.data || err);
    res
      .status(500)
      .json({ error: "Failed to sync daily metrics", detail: err.message });
  }
});

export default router;
