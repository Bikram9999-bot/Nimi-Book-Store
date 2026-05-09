const AuditLog = require("../models/AuditLog");

const GOOGLE_SHEET_WEBHOOK_URL = String(process.env.GOOGLE_SHEET_WEBHOOK_URL || "").trim();

function isGoogleSheetSyncEnabled() {
  return Boolean(GOOGLE_SHEET_WEBHOOK_URL);
}

function toSheetPayload(log) {
  const beforeStock = Number(log.before?.stock) || 0;
  const afterStock = Number(log.after?.stock) || 0;
  const deltaStock = Number(log.deltaStock) || 0;
  const previousStock = Number(log.after?.totalStock ?? log.before?.totalStock) || 0;
  const price = Number(log.after?.price ?? log.before?.price) || 0;
  const status = String(log.after?.status || log.before?.status || "").trim();
  const timestamp = log.createdAt || new Date().toISOString();
  const eventType = String(log.eventType || "");
  const eventLabelMap = {
    inventory_sale_adjustment: "Sale Deduction",
    inventory_manual_update: "Manual Stock Edit",
    book_created: "Book Created",
    book_deleted: "Book Deleted"
  };

  return {
    timestamp,
    date: new Date(timestamp).toLocaleDateString("en-CA"),
    time: new Date(timestamp).toLocaleTimeString("en-IN", { hour12: true }),
    eventType,
    eventLabel: eventLabelMap[eventType] || eventType.replaceAll("_", " "),
    source: log.source || "",
    reference: log.reference || "",
    serialNo: Number(log.serialNo) || 0,
    title: log.title || "",
    bookDisplay: `${Number(log.serialNo) || 0} - ${log.title || ""}`.trim(),
    beforeStock,
    afterStock,
    deltaStock,
    stockMovement: `${beforeStock} -> ${afterStock} (${deltaStock >= 0 ? "+" : ""}${deltaStock})`,
    previousStock,
    price,
    status,
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

async function retryUnsyncedAuditLogs(options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 100, 1), 500);
  const statuses = Array.isArray(options.statuses) && options.statuses.length
    ? options.statuses
    : ["failed", "pending", "skipped"];

  const logs = await AuditLog.find({ sheetSyncStatus: { $in: statuses } })
    .sort({ createdAt: 1 })
    .limit(limit);

  if (!logs.length) {
    return { retried: 0, synced: 0, skipped: 0 };
  }

  const result = await syncAuditLogsToGoogleSheet(logs);
  return {
    retried: logs.length,
    synced: result.synced || 0,
    skipped: result.skipped || 0
  };
}

module.exports = {
  isGoogleSheetSyncEnabled,
  syncAuditLogsToGoogleSheet,
  retryUnsyncedAuditLogs
};
