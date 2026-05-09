const AuditLog = require("../models/AuditLog");

const GOOGLE_SHEET_WEBHOOK_URL = String(process.env.GOOGLE_SHEET_WEBHOOK_URL || "").trim();

function isGoogleSheetSyncEnabled() {
  return Boolean(GOOGLE_SHEET_WEBHOOK_URL);
}

function toSheetPayload(log) {
  return {
    timestamp: log.createdAt || new Date().toISOString(),
    eventType: log.eventType || "",
    source: log.source || "",
    reference: log.reference || "",
    serialNo: Number(log.serialNo) || 0,
    title: log.title || "",
    beforeStock: Number(log.before?.stock) || 0,
    afterStock: Number(log.after?.stock) || 0,
    deltaStock: Number(log.deltaStock) || 0,
    previousStock: Number(log.after?.totalStock ?? log.before?.totalStock) || 0,
    price: Number(log.after?.price ?? log.before?.price) || 0,
    status: String(log.after?.status || log.before?.status || "").trim(),
    message: log.message || "",
    syncId: String(log._id || "")
  };
}

async function markLogs(ids, status, extra = {}) {
  if (!Array.isArray(ids) || !ids.length) return;
  await AuditLog.updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        sheetSyncStatus: status,
        sheetSyncedAt: status === "synced" ? new Date() : null,
        sheetSyncError: extra.error ? String(extra.error).slice(0, 500) : ""
      }
    }
  );
}

async function syncAuditLogsToGoogleSheet(logs = []) {
  const normalized = logs.filter(Boolean);
  if (!normalized.length) return { synced: 0, skipped: 0 };

  const ids = normalized.map((log) => log._id).filter(Boolean);
  if (!isGoogleSheetSyncEnabled()) {
    await markLogs(ids, "skipped", { error: "GOOGLE_SHEET_WEBHOOK_URL not configured" });
    return { synced: 0, skipped: normalized.length };
  }

  try {
    const response = await fetch(GOOGLE_SHEET_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: normalized.map(toSheetPayload) })
    });

    if (!response.ok) {
      throw new Error(`Google Sheet webhook returned ${response.status}`);
    }

    const result = await response.json().catch(() => null);
    if (!result || result.ok !== true) {
      throw new Error(result?.error || "Google Sheet webhook did not confirm success");
    }

    await markLogs(ids, "synced");
    return { synced: normalized.length, skipped: 0 };
  } catch (error) {
    await markLogs(ids, "failed", { error: error.message || "Sheet sync failed" });
    throw error;
  }
}

module.exports = {
  isGoogleSheetSyncEnabled,
  syncAuditLogsToGoogleSheet
};
