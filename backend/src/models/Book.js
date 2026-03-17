const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0 },
    totalStock: { type: Number, required: true, min: 0, default: 0 },
    category: { type: String, default: "", trim: true },
    serialNo: { type: Number, default: 0 },
    status: { type: String, default: "", trim: true },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Book", bookSchema);
