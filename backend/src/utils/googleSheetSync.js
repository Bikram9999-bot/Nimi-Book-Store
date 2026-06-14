const AuditLog = require("../models/AuditLog");
const Sale = require("../models/Sale");

const GOOGLE_SHEET_WEBHOOK_URL = String(process.env.GOOGLE_SHEET_WEBHOOK_URL || "").trim();

function isGoogleSheetSyncEnabled() {
  return Boolean(GOOGLE_SHEET_WEBHOOK_URL);
}

function formatSheetDate(dateObj) {
  return new Date(dateObj).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).replaceAll("-", "/");
}

function formatSheetTime(dateObj) {
  return new Date(dateObj).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
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
    SALE: "SALE",
    inventory_sale_adjustment: "Sale Deduction",
    inventory_manual_update: "Manual Stock Edit",
    book_created: "Book Created",
    book_deleted: "Book Deleted"
  };

  const isSale = eventType === "SALE" || eventType === "inventory_sale_adjustment";
  const stockMovement = isSale ? `${deltaStock} (Sale)` : `${beforeStock} -> ${afterStock} (${deltaStock >= 0 ? "+" : ""}${deltaStock})`;

  return {
    timestamp,
    date: formatSheetDate(timestamp),
    time: formatSheetTime(timestamp),
    eventType,
    eventLabel: eventLabelMap[eventType] || eventType.replaceAll("_", " "),
    source: log.source || "",
    reference: log.reference || "",
    serialNo: Number(log.serialNo) || 0,
    title: log.title || "",
    bookDisplay: log.title || "",
    beforeStock,
    afterStock,
    deltaStock,
    stockMovement,
    previousStock,
    price,
    status,
    message: log.message || "",
    syncId: String(log._id || "")
  };
}

function toSaleSheetPayload(sale) {
  const saleDate = sale.saleDate || sale.createdAt || new Date();
  const lines = Array.isArray(sale.lines) ? sale.lines : [];

  const booksStr = lines.map(line => line.title || "").join(" | ");
  const quantitiesStr = lines.map(line => line.qty || 0).join(" | ");

  return {
    date: formatSheetDate(saleDate),
    time: formatSheetTime(saleDate),
    receiptNo: sale.receiptNo || "",
    customerName: sale.customer?.name || "",
    phone: sale.customer?.phone || "",
    email: sale.customer?.email || "",
    address: [sale.customer?.address, sale.customer?.pincode].filter(Boolean).join(", "),
    books: booksStr,
    quantities: quantitiesStr,
    itemCount: Number(sale.itemCount) || 0,
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

async function syncSalesToGoogleSheet(sales = [], auditLogs = []) {
  const normalized = sales.filter(Boolean);
  if (!normalized.length) return { synced: 0, skipped: 0 };
  if (!isGoogleSheetSyncEnabled()) {
    return { synced: 0, skipped: normalized.length };
  }

  const logs = Array.isArray(auditLogs) && auditLogs.length
    ? auditLogs
    : await AuditLog.find({ source: "pos", reference: { $in: normalized.map(s => s.receiptNo) } }).lean();

  const logsByRef = new Map();
  logs.forEach(log => {
    const ref = log.reference;
    if (!logsByRef.has(ref)) logsByRef.set(ref, []);
    logsByRef.get(ref).push(log);
  });

  const saleRows = normalized.flatMap(sale => {
    const lineLogs = logsByRef.get(sale.receiptNo) || [];
    const logsByTitle = new Map();
    lineLogs.forEach(log => {
      if (!logsByTitle.has(log.title)) logsByTitle.set(log.title, log);
    });

    return (sale.lines || []).map((line, idx) => ({
      timestamp: new Date(sale.saleDate || sale.createdAt).toISOString(),
      date: new Date(sale.saleDate || sale.createdAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
      time: new Date(sale.saleDate || sale.createdAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: true }),
      bookTitle: line.title || "",
      copiesSold: Number(line.qty) || 0,
      remainingStock: logsByTitle.get(line.title)?.after?.stock ?? 0,
      receiptNo: sale.receiptNo || "",
      saleTotal: Number(sale.total) || 0,
      warehouse: "Lucknow"
    }));
  });

  if (!saleRows.length) return { synced: 0, skipped: 0 };

  const response = await fetch(GOOGLE_SHEET_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "append",
      saleRows
    })
  });

  if (!response.ok) {
    throw new Error(`Google Sheet webhook returned ${response.status}`);
  }

  const result = await response.json().catch(() => null);
  if (!result || result.ok !== true) {
    throw new Error(result?.error || "Google Sheet webhook did not confirm success");
  }

  return { synced: saleRows.length, skipped: 0 };
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

  const receiptNos = [...new Set(logs.map(log => log.reference).filter(Boolean))];
  const sales = receiptNos.length
    ? await Sale.find({ receiptNo: { $in: receiptNos } })
    : [];

  const result = await syncAuditLogsToGoogleSheet(logs, { sales });
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
  rebuildGoogleSheetFromAuditLogs,
  toSheetPayload,
  toSaleSheetPayload
};
