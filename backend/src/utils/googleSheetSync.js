const AuditLog = require("../models/AuditLog");
const Sale = require("../models/Sale");

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

function toSaleSheetPayload(sale) {
  const saleDate = sale.saleDate || sale.createdAt || new Date();
  const date = new Date(saleDate);
  const lines = Array.isArray(sale.lines) ? sale.lines : [];
  const customer = sale.customer || {};

  return {
    date: date.toLocaleDateString("en-CA"),
    time: date.toLocaleTimeString("en-IN", { hour12: true }),
    receiptNo: sale.receiptNo || "",
    customerName: customer.name || "",
    phone: customer.phone || "",
    email: customer.email || "",
    address: [customer.address, customer.pincode].filter(Boolean).join(" - "),
    books: lines.map((line, index) => `${index + 1}. ${line.title}`).join("\n"),
    quantities: lines.map((line, index) => `${index + 1}. Qty: ${line.qty}`).join("\n"),
    itemCount: Number(sale.itemCount) || lines.reduce((sum, line) => sum + (Number(line.qty) || 0), 0),
    subtotal: Number(sale.subtotal) || 0,
    discountPercent: Number(sale.discountPercent) || 0,
    discountAmount: Number(sale.discountAmount) || 0,
    total: Number(sale.total) || 0,
    warehouse: "Lucknow",
    note: "Payment Completed only invoice required"
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

async function syncAuditLogsToGoogleSheet(logs = [], options = {}) {
  const normalized = logs.filter(Boolean);
  const sales = Array.isArray(options.sales) ? options.sales.filter(Boolean) : [];
  if (!normalized.length && !sales.length) return { synced: 0, skipped: 0 };

  const ids = normalized.map((log) => log._id).filter(Boolean);
  if (!isGoogleSheetSyncEnabled()) {
    await markLogs(ids, "skipped", { error: "GOOGLE_SHEET_WEBHOOK_URL not configured" });
    return { synced: 0, skipped: normalized.length + sales.length };
  }

  try {
    const response = await fetch(GOOGLE_SHEET_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: options.mode === "replace" ? "replace" : "append",
        rows: normalized.map(toSheetPayload),
        saleRows: sales.map(toSaleSheetPayload)
      })
    });

    if (!response.ok) {
      throw new Error(`Google Sheet webhook returned ${response.status}`);
    }

    const result = await response.json().catch(() => null);
    if (!result || result.ok !== true) {
      throw new Error(result?.error || "Google Sheet webhook did not confirm success");
    }

    await markLogs(ids, "synced");
    return { synced: normalized.length + sales.length, skipped: 0 };
  } catch (error) {
    await markLogs(ids, "failed", { error: error.message || "Sheet sync failed" });
    throw error;
  }
}

async function syncSalesToGoogleSheet(sales = []) {
  const normalized = sales.filter(Boolean);
  if (!normalized.length) return { synced: 0, skipped: 0 };
  if (!isGoogleSheetSyncEnabled()) {
    return { synced: 0, skipped: normalized.length };
  }

  const response = await fetch(GOOGLE_SHEET_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "append",
      saleRows: normalized.map(toSaleSheetPayload)
    })
  });

  if (!response.ok) {
    throw new Error(`Google Sheet webhook returned ${response.status}`);
  }

  const result = await response.json().catch(() => null);
  if (!result || result.ok !== true) {
    throw new Error(result?.error || "Google Sheet webhook did not confirm success");
  }

  return { synced: normalized.length, skipped: 0 };
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

async function rebuildGoogleSheetFromAuditLogs(options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 5000, 1), 20000);
  const [logs, sales] = await Promise.all([
    AuditLog.find().sort({ createdAt: 1 }).limit(limit),
    Sale.find().sort({ saleDate: 1, createdAt: 1 }).limit(limit)
  ]);

  if (!logs.length && !sales.length) {
    return { resynced: 0, synced: 0, skipped: 0 };
  }

  const result = await syncAuditLogsToGoogleSheet(logs, { mode: "replace", sales });
  return {
    resynced: logs.length + sales.length,
    synced: result.synced || 0,
    skipped: result.skipped || 0
  };
}

module.exports = {
  isGoogleSheetSyncEnabled,
  syncAuditLogsToGoogleSheet,
  syncSalesToGoogleSheet,
  retryUnsyncedAuditLogs,
  rebuildGoogleSheetFromAuditLogs
};
