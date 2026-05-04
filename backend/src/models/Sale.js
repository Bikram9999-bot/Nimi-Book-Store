const mongoose = require("mongoose");

const saleLineSchema = new mongoose.Schema(
  {
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true },
    title: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    receiptNo: { type: String, required: true, unique: true, trim: true, index: true },
    saleDate: { type: Date, required: true, default: Date.now },
    customer: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, default: "", trim: true },
      email: { type: String, default: "", trim: true },
      address: { type: String, default: "", trim: true },
      pincode: { type: String, default: "", trim: true }
    },
    itemCount: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    lines: { type: [saleLineSchema], default: [] },
    source: { type: String, default: "pos", trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Sale", saleSchema);
