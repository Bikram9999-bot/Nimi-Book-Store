const Book = require("../models/Book");
const Sale = require("../models/Sale");
const AuditLog = require("../models/AuditLog");
const { isGoogleSheetSyncEnabled, retryUnsyncedAuditLogs, rebuildGoogleSheetFromAuditLogs } = require("../utils/googleSheetSync");

function buildCheck(code, status, message, details = {}) {
  return { code, status, message, details };
}

function normalizeLimit(value, fallback = 50, max = 200) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(Math.floor(num), max);
}

async function getAuditReport(req, res, next) {
  try {
    const [books, recentSalesCount, recentAuditLogs, duplicateSerials, missingBookRefs, syncCounts] = await Promise.all([
      Book.find().select("title stock totalStock price status serialNo").lean(),
      Sale.countDocuments(),
      AuditLog.find().sort({ createdAt: -1 }).limit(10).lean(),
      Book.aggregate([
        { $match: { serialNo: { $gt: 0 } } },
        { $group: { _id: "$serialNo", count: { $sum: 1 }, titles: { $push: "$title" } } },
        { $match: { count: { $gt: 1 } } }
      ]),
      Sale.aggregate([
        { $unwind: "$lines" },
        {
          $lookup: {
            from: "books",
            localField: "lines.bookId",
            foreignField: "_id",
            as: "bookMatch"
          }
        },
        { $match: { bookMatch: { $size: 0 } } },
        { $limit: 25 }
      ]),
      AuditLog.aggregate([
        { $group: { _id: "$sheetSyncStatus", count: { $sum: 1 } } }
      ])
    ]);

    const totalBooks = books.length;
    const negativeStock = books.filter((book) => Number(book.stock) < 0);
    const stockAboveTotal = books.filter((book) => Number(book.stock) > Number(book.totalStock));
    const missingTitles = books.filter((book) => !String(book.title || "").trim());
    const lowStock = books.filter((book) => Number(book.stock) > 0 && Number(book.stock) <= 5);
    const outOfStock = books.filter((book) => Number(book.stock) <= 0);
    const totalStockUnits = books.reduce((sum, book) => sum + (Number(book.totalStock) || 0), 0);
    const currentUnits = books.reduce((sum, book) => sum + (Number(book.stock) || 0), 0);
    const protectedInventory = books.filter((book) => Number(book.totalStock) >= Number(book.stock)).length;

    const syncSummary = syncCounts.reduce(
      (acc, item) => {
        acc[item._id || "pending"] = item.count;
        return acc;
      },
      { pending: 0, synced: 0, failed: 0, skipped: 0 }
    );

    const checks = [
      buildCheck("database_connection", "pass", "MongoDB connection is active."),
      buildCheck(
        "google_sheet_sync",
        isGoogleSheetSyncEnabled() ? "pass" : "fail",
        isGoogleSheetSyncEnabled()
          ? "Google Sheet webhook is configured for inventory documentation."
          : "Google Sheet webhook is not configured yet."
      ),
      buildCheck(
        "inventory_numbers_protected",
        stockAboveTotal.length ? "fail" : "pass",
        stockAboveTotal.length
          ? `${stockAboveTotal.length} inventory rows have current stock greater than previous stock.`
          : "All inventory rows respect Previous Stock as the upper limit.",
        {
          affectedBooks: stockAboveTotal.slice(0, 10).map((book) => ({
            serialNo: book.serialNo,
            title: book.title,
            stock: book.stock,
            totalStock: book.totalStock
          }))
        }
      ),
      buildCheck(
        "negative_stock",
        negativeStock.length ? "fail" : "pass",
        negativeStock.length
          ? `${negativeStock.length} books have negative stock.`
          : "No books have negative stock."
      ),
      buildCheck(
        "missing_titles",
        missingTitles.length ? "fail" : "pass",
        missingTitles.length
          ? `${missingTitles.length} books are missing titles.`
          : "All books have titles."
      ),
      buildCheck(
        "duplicate_serial_numbers",
        duplicateSerials.length ? "fail" : "pass",
        duplicateSerials.length
          ? `${duplicateSerials.length} duplicate serial numbers detected.`
          : "No duplicate serial numbers detected.",
        {
          duplicates: duplicateSerials.slice(0, 10).map((item) => ({
            serialNo: item._id,
            count: item.count,
            titles: item.titles
          }))
        }
      ),
      buildCheck(
        "sale_line_references",
        missingBookRefs.length ? "fail" : "pass",
        missingBookRefs.length
          ? `${missingBookRefs.length} sale lines reference missing books.`
          : "All sale lines reference valid books."
      ),
      buildCheck(
        "google_sheet_delivery",
        syncSummary.failed > 0 ? "fail" : "pass",
        syncSummary.failed > 0
          ? `${syncSummary.failed} audit events failed to sync to Google Sheet.`
          : "No Google Sheet sync failures detected.",
        { syncSummary }
      )
    ];

    const failedChecks = checks.filter((check) => check.status === "fail").length;
    const overallStatus = failedChecks ? "warning" : "ok";

    return res.status(200).json({
      status: overallStatus,
      checkedAt: new Date().toISOString(),
      summary: {
        totalBooks,
        protectedInventory,
        totalStockUnits,
        currentUnits,
        lowStockCount: lowStock.length,
        outOfStockCount: outOfStock.length,
        salesCount: recentSalesCount,
        recentAuditEventCount: recentAuditLogs.length,
        sheetSyncEnabled: isGoogleSheetSyncEnabled(),
        sheetSyncSummary: syncSummary
      },
      checks,
      recentAuditLogs: recentAuditLogs.map((log) => ({
        id: log._id,
        eventType: log.eventType,
        source: log.source,
        reference: log.reference,
        title: log.title,
        serialNo: log.serialNo,
        before: log.before,
        after: log.after,
        deltaStock: log.deltaStock,
        createdAt: log.createdAt,
        message: log.message,
        sheetSyncStatus: log.sheetSyncStatus,
        sheetSyncedAt: log.sheetSyncedAt,
        sheetSyncError: log.sheetSyncError
      }))
    });
  } catch (err) {
    return next(err);
  }
}

async function getAuditLogs(req, res, next) {
  try {
    const limit = normalizeLimit(req.query.limit, 50, 200);
    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      logs: logs.map((log) => ({
        id: log._id,
        eventType: log.eventType,
        source: log.source,
        reference: log.reference,
        title: log.title,
        serialNo: log.serialNo,
        before: log.before,
        after: log.after,
        deltaStock: log.deltaStock,
        createdAt: log.createdAt,
        message: log.message,
        meta: log.meta || {},
        sheetSyncStatus: log.sheetSyncStatus,
        sheetSyncedAt: log.sheetSyncedAt,
        sheetSyncError: log.sheetSyncError
      }))
    });
  } catch (err) {
    return next(err);
  }
}

async function retryAuditSheetSync(req, res, next) {
  try {
    if (!isGoogleSheetSyncEnabled()) {
      return res.status(400).json({ error: "Google Sheet webhook is not configured." });
    }

    const result = await retryUnsyncedAuditLogs({
      limit: req.body.limit,
      statuses: Array.isArray(req.body.statuses) ? req.body.statuses : undefined
    });

    return res.status(200).json({
      message: result.retried
        ? `Retried ${result.retried} unsynced audit event(s).`
        : "No unsynced audit events found.",
      ...result
    });
  } catch (err) {
    return next(err);
  }
}

async function resyncAllAuditSheet(req, res, next) {
  try {
    if (!isGoogleSheetSyncEnabled()) {
      return res.status(400).json({ error: "Google Sheet webhook is not configured." });
    }

    const result = await rebuildGoogleSheetFromAuditLogs({
      limit: req.body.limit
    });

    return res.status(200).json({
      message: result.resynced
        ? `Rebuilt Google Sheet from ${result.resynced} audit event(s).`
        : "No audit events found to resync.",
      ...result
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getAuditReport, getAuditLogs, retryAuditSheetSync, resyncAllAuditSheet };
