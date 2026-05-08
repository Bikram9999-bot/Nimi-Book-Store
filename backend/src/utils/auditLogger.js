const AuditLog = require("../models/AuditLog");

function snapshotFromBook(book = {}) {
  return {
    stock: Number(book.stock) || 0,
    totalStock: Number(book.totalStock) || 0,
    price: Number(book.price) || 0,
    status: String(book.status || "").trim()
  };
}

async function writeAuditLog({
  eventType,
  source = "system",
  reference = "",
  message = "",
  book = null,
  before = null,
  after = null,
  meta = {},
  session
}) {
  if (!eventType) return null;

  const bookDoc = after || book || before || null;
  const payload = {
    eventType: String(eventType).trim(),
    source: String(source || "system").trim(),
    reference: String(reference || "").trim(),
    message: String(message || "").trim(),
    bookId: bookDoc && bookDoc._id ? bookDoc._id : null,
    title: String((bookDoc && bookDoc.title) || "").trim(),
    serialNo: Number((bookDoc && bookDoc.serialNo) || 0),
    before: snapshotFromBook(before),
    after: snapshotFromBook(after || bookDoc),
    deltaStock: (Number((after || bookDoc)?.stock) || 0) - (Number(before?.stock) || 0),
    meta: meta && typeof meta === "object" ? meta : {}
  };

  return AuditLog.create([payload], session ? { session } : undefined);
}

module.exports = { writeAuditLog, snapshotFromBook };
