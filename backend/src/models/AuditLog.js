const mongoose = require("mongoose");

const snapshotSchema = new mongoose.Schema(
  {
    stock: { type: Number, default: 0 },
    totalStock: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    status: { type: String, default: "", trim: true }
  },
  { _id: false }
);

const auditLogSchema = new mongoose.Schema(
  {
    eventType: { type: String, required: true, trim: true, index: true },
    source: { type: String, default: "system", trim: true },
    reference: { type: String, default: "", trim: true },
    message: { type: String, default: "", trim: true },
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book", default: null, index: true },
    title: { type: String, default: "", trim: true },
    serialNo: { type: Number, default: 0 },
    before: { type: snapshotSchema, default: () => ({}) },
    after: { type: snapshotSchema, default: () => ({}) },
    deltaStock: { type: Number, default: 0 },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    sheetSyncStatus: {
      type: String,
      enum: ["pending", "synced", "failed", "skipped"],
      default: "pending",
      index: true
    },
    sheetSyncedAt: { type: Date, default: null },
    sheetSyncError: { type: String, default: "", trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);
