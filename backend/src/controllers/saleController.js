const mongoose = require("mongoose");
const Book = require("../models/Book");
const Sale = require("../models/Sale");
const { writeAuditLog } = require("../utils/auditLogger");
const { syncAuditLogsToGoogleSheet, syncSalesToGoogleSheet } = require("../utils/googleSheetSync");

function escapeRegExp(string) {
  return String(string).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
}

function parseNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeCustomer(customer = {}) {
  return {
    name: String(customer.name || "").trim(),
    phone: String(customer.phone || "").trim(),
    email: String(customer.email || "").trim(),
    address: String(customer.address || "").trim(),
    pincode: String(customer.pincode || "").trim()
  };
}

function normalizeLines(lines = []) {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((line) => ({
      bookId: String(line.id || line.bookId || "").trim(),
      title: String(line.title || "").trim(),
      price: parseNumber(line.price),
      qty: parseNumber(line.qty),
      amount: parseNumber(line.amount),
      stockBefore: line.stockBefore !== undefined ? parseNumber(line.stockBefore) : null,
      stockAfter: line.stockAfter !== undefined ? parseNumber(line.stockAfter) : null
    }))
    .filter((line) => line.bookId && line.title && line.qty > 0);
}

function normalizeSalePayload(payload = {}) {
  const customer = normalizeCustomer(payload.customer);
  const lines = normalizeLines(payload.lines);
  const saleDate = payload.saleDate || payload.date || new Date().toISOString();

  return {
    receiptNo: String(payload.receiptNo || payload.no || "").trim(),
    saleDate,
    customer,
    lines,
    itemCount: parseNumber(payload.itemCount ?? payload.items),
    discountPercent: parseNumber(payload.discountPercent ?? payload.dp),
    subtotal: parseNumber(payload.subtotal ?? payload.sub),
    discountAmount: parseNumber(payload.discountAmount ?? payload.disc),
    total: parseNumber(payload.total),
    source: String(payload.source || "pos").trim() || "pos"
  };
}

function validateSalePayload(sale) {
  if (!sale.receiptNo) return "receipt number is required";
  if (!sale.customer.name) return "customer name is required";
  if (!sale.lines.length) return "at least one sale line is required";
  if (sale.itemCount <= 0) return "item count must be greater than 0";
  if (sale.subtotal < 0 || sale.discountAmount < 0 || sale.total < 0) return "amount values must be non-negative";
  if (sale.lines.some((line) => line.price < 0 || line.qty <= 0 || line.amount < 0)) return "invalid line values";
  return "";
}

async function resolveBookId(line) {
  if (mongoose.Types.ObjectId.isValid(line.bookId)) {
    return line.bookId;
  }

  const serialNo = parseNumber(line.bookId, 0);
  if (serialNo > 0) {
    const bookBySerial = await Book.findOne({ serialNo }).select("_id");
    if (bookBySerial) return String(bookBySerial._id);
  }

  if (line.title) {
    const bookByTitle = await Book.findOne({ title: line.title }).select("_id");
    if (bookByTitle) return String(bookByTitle._id);
  }

  return "";
}

async function resolveSaleLines(lines = []) {
  const resolved = [];
  for (const line of lines) {
    const resolvedBookId = await resolveBookId(line);
    if (!resolvedBookId) {
      throw new Error(`Could not match book for line: ${line.title || line.bookId}`);
    }
    resolved.push({
      bookId: resolvedBookId,
      title: line.title,
      price: line.price,
      qty: line.qty,
      amount: line.amount,
      stockBefore: line.stockBefore,
      stockAfter: line.stockAfter
    });
  }
  return resolved;
}

function mapSale(sale) {
  return {
    id: sale._id,
    receiptNo: sale.receiptNo,
    saleDate: sale.saleDate,
    customer: sale.customer,
    itemCount: sale.itemCount,
    discountPercent: sale.discountPercent,
    subtotal: sale.subtotal,
    discountAmount: sale.discountAmount,
    total: sale.total,
    lines: sale.lines.map((line) => ({
      bookId: line.bookId,
      title: line.title,
      price: line.price,
      qty: line.qty,
      amount: line.amount,
      stockBefore: line.stockBefore,
      stockAfter: line.stockAfter
    })),
    source: sale.source,
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt
  };
}

async function getSales(req, res, next) {
  try {
    const limit = Math.min(Math.max(parseNumber(req.query.limit, 100), 1), 500);
    const sales = await Sale.find().sort({ saleDate: -1, createdAt: -1 }).limit(limit);
    return res.status(200).json({ sales: sales.map(mapSale) });
  } catch (err) {
    return next(err);
  }
}

async function getSaleByReceipt(req, res, next) {
  try {
    const { receiptNo } = req.params;
    const sale = await Sale.findOne({ receiptNo: String(receiptNo || "").trim() });
    if (!sale) return res.status(404).json({ error: "sale not found" });
    return res.status(200).json({ sale: mapSale(sale) });
  } catch (err) {
    return next(err);
  }
}

async function importSales(req, res, next) {
  try {
    const items = Array.isArray(req.body.sales) ? req.body.sales : [];
    if (!items.length) return res.status(400).json({ error: "sales array is required" });

    let imported = 0;
    let skipped = 0;

    for (const rawSale of items) {
      const sale = normalizeSalePayload(rawSale);
      const validationError = validateSalePayload(sale);
      if (validationError) {
        skipped += 1;
        continue;
      }

      const exists = await Sale.exists({ receiptNo: sale.receiptNo });
      if (exists) {
        skipped += 1;
        continue;
      }

      let resolvedLines = [];
      try {
        resolvedLines = await resolveSaleLines(sale.lines);
      } catch (_) {
        skipped += 1;
        continue;
      }

      await Sale.create({
        receiptNo: sale.receiptNo,
        saleDate: new Date(sale.saleDate),
        customer: sale.customer,
        itemCount: sale.itemCount,
        discountPercent: sale.discountPercent,
        subtotal: sale.subtotal,
        discountAmount: sale.discountAmount,
        total: sale.total,
        lines: resolvedLines.map((line) => ({
          bookId: line.bookId,
          title: line.title,
          price: line.price,
          qty: line.qty,
          amount: line.amount
        })),
        source: "import"
      });
      imported += 1;
    }

    return res.status(200).json({ imported, skipped });
  } catch (err) {
    return next(err);
  }
}

async function completeSale(req, res, next) {
  try {
    const receiptNo = String(req.body.receiptNo || req.body.no || "").trim();
    if (receiptNo) {
      const existing = await Sale.findOne({ receiptNo });
      if (existing) {
        return res.status(200).json({ sale: mapSale(existing), duplicate: true });
      }
    }
  } catch (dupCheckErr) {
    console.warn("Idempotency check failed:", dupCheckErr.message);
  }

  const session = await mongoose.startSession();

  try {
    const sale = normalizeSalePayload(req.body);
    const validationError = validateSalePayload(sale);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }
    sale.lines = await resolveSaleLines(sale.lines);

    // Quick duplicate detection: if a very recent sale (by same customer name,
    // same itemCount & total and identical lines) exists within a short time
    // window, treat this request as a duplicate and return the existing sale.
    try {
      const WINDOW_MS = 60 * 1000; // 1 minute
      const since = new Date(Date.now() - WINDOW_MS);
      const nameRegex = sale.customer.name ? new RegExp(`^${escapeRegExp(String(sale.customer.name).trim())}$`, "i") : null;
      if (nameRegex) {
        const candidates = await Sale.find({
          "customer.name": { $regex: nameRegex },
          itemCount: sale.itemCount,
          total: sale.total,
          createdAt: { $gte: since }
        }).sort({ createdAt: -1 }).limit(10);

        const sameLines = (aLines, bLines) => {
          if (!Array.isArray(aLines) || !Array.isArray(bLines)) return false;
          if (aLines.length !== bLines.length) return false;
          const mapA = new Map(aLines.map(l => [String(l.bookId), Number(l.qty)]));
          for (const bl of bLines) {
            const want = mapA.get(String(bl.bookId));
            if (typeof want === "undefined" || Number(bl.qty) !== want) return false;
          }
          return true;
        };

        for (const cand of candidates) {
          if (sameLines(cand.lines, sale.lines) && String((cand.customer && cand.customer.name) || "").trim().toLowerCase() === String((sale.customer && sale.customer.name) || "").trim().toLowerCase()) {
            return res.status(200).json({ sale: mapSale(cand), duplicate: true });
          }
        }
      }
    } catch (dupErr) {
      // If duplicate-check fails for any reason, continue with normal flow.
      console.warn("Duplicate detection failed:", dupErr && dupErr.message);
    }

    const existing = await Sale.findOne({ receiptNo: sale.receiptNo });
    if (existing) {
      return res.status(200).json({ sale: mapSale(existing), duplicate: true });
    }

    let savedSale = null;
    const auditLogsToSync = [];
    await session.withTransaction(async () => {
      for (const line of sale.lines) {
        const beforeBook = await Book.findById(line.bookId).session(session);
        const updatedBook = await Book.findOneAndUpdate(
          { _id: line.bookId, stock: { $gte: line.qty } },
          { $inc: { stock: -line.qty } },
          { new: true, session }
        );

        if (!updatedBook) {
          const exists = await Book.findById(line.bookId).session(session);
          if (!exists) {
            throw new Error(`Book not found for line: ${line.title}`);
          }
          const stockError = new Error(`Insufficient stock for ${line.title}`);
          stockError.statusCode = 400;
          throw stockError;
        }
        const auditLog = await writeAuditLog({
          eventType: "SALE",
          source: sale.source || "pos",
          reference: sale.receiptNo,
          message: `Sale completed for ${line.qty} unit(s).`,
          before: beforeBook,
          after: updatedBook,
          meta: {
            receiptNo: sale.receiptNo,
            quantity: line.qty
          },
          session
        });
        if (auditLog) {
          auditLogsToSync.push(auditLog);
        }
      }

      const created = await Sale.create(
        [
          {
            receiptNo: sale.receiptNo,
            saleDate: new Date(sale.saleDate),
            customer: sale.customer,
            itemCount: sale.itemCount,
            discountPercent: sale.discountPercent,
            subtotal: sale.subtotal,
            discountAmount: sale.discountAmount,
            total: sale.total,
            lines: sale.lines.map((line) => ({
              bookId: line.bookId,
              title: line.title,
              price: line.price,
              qty: line.qty,
              amount: line.amount,
              stockBefore: line.stockBefore,
              stockAfter: line.stockAfter
            })),
            source: sale.source || "pos"
          }
        ],
        { session }
      );
      savedSale = created[0];
    });

    // Fire-and-forget Google Sheet webhook payload sync
    const { toSheetPayload, toSaleSheetPayload } = require("../utils/googleSheetSync");
    const sheetPayload = {
      mode: "append",
      rows: auditLogsToSync.map(toSheetPayload),
      saleRows: [toSaleSheetPayload(savedSale)]
    };

    (async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout
        const response = await fetch(process.env.GOOGLE_SHEET_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sheetPayload),
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`Sheet webhook returned ${response.status}`);
        }
        const result = await response.json().catch(() => null);
        if (!result || result.ok !== true) {
          throw new Error(result?.error || "Webhook did not confirm success");
        }

        // Update audit log sheetSyncStatus to "synced"
        const ids = auditLogsToSync.map(log => log._id).filter(Boolean);
        if (ids.length) {
          const AuditLog = require("../models/AuditLog");
          await AuditLog.updateMany(
            { _id: { $in: ids } },
            {
              $set: {
                sheetSyncStatus: "synced",
                sheetSyncedAt: new Date()
              }
            }
          );
        }
      } catch (err) {
        console.error("Google Sheet webhook async sync failed:", err.message);
        // Update audit log sheetSyncStatus to "failed", store err.message in sheetSyncError
        const ids = auditLogsToSync.map(log => log._id).filter(Boolean);
        if (ids.length) {
          const AuditLog = require("../models/AuditLog");
          await AuditLog.updateMany(
            { _id: { $in: ids } },
            {
              $set: {
                sheetSyncStatus: "failed",
                sheetSyncError: String(err.message || "Webhook sync failed").slice(0, 500)
              }
            }
          );
        }
      }
    })();

    return res.status(201).json({ sale: mapSale(savedSale) });
  } catch (err) {
    if (err && err.code === 11000) {
      const existing = await Sale.findOne({ receiptNo: String(req.body.receiptNo || req.body.no || "").trim() });
      return res.status(200).json({ sale: existing ? mapSale(existing) : null, duplicate: true });
    }
    if (err && err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  } finally {
    await session.endSession();
  }
}

module.exports = {
  getSales,
  getSaleByReceipt,
  importSales,
  completeSale
};
