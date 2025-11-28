import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { runMigrations, pool } from "./db.js";
import authRoutes from "./routes/authRoutes.js";
import staffRoutes from "./routes/staffRoutes.js";
import teamRoutes from "./routes/teamRoutes.js";
import networkRoutes from "./routes/networkRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import channelRoutes from "./routes/channelRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import youtubeConnectRoutes from "./routes/youtubeConnectRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.locals.pool = pool;

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/networks", networkRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/youtube", youtubeConnectRoutes);

runMigrations()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to run migrations:", err);
    process.exit(1);
  });
