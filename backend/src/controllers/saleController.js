const mongoose = require("mongoose");
const Book = require("../models/Book");
const Sale = require("../models/Sale");
const { writeAuditLog } = require("../utils/auditLogger");

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
      amount: parseNumber(line.amount)
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
      amount: line.amount
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
      amount: line.amount
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
  const session = await mongoose.startSession();

  try {
    const sale = normalizeSalePayload(req.body);
    const validationError = validateSalePayload(sale);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }
    sale.lines = await resolveSaleLines(sale.lines);

    const existing = await Sale.findOne({ receiptNo: sale.receiptNo });
    if (existing) {
      return res.status(200).json({ sale: mapSale(existing), duplicate: true });
    }

    let savedSale = null;
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
        await writeAuditLog({
          eventType: "inventory_sale_adjustment",
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
              amount: line.amount
            })),
            source: sale.source || "pos"
          }
        ],
        { session }
      );
      savedSale = created[0];
    });

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
