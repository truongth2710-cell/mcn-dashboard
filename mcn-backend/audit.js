import pool from "./db.js";

export async function logAudit({ actorUserId, action, entityType, entityId, metadata }) {
  try {
    await pool.query(
      "INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata) VALUES ($1,$2,$3,$4,$5)",
      [actorUserId || null, action, entityType, entityId || null, metadata || {}]
    );
  } catch (err) {
    console.error("logAudit error", err);
  }
}
