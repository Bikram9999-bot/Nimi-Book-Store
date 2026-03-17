const mongoose = require("mongoose");
const Book = require("../models/Book");

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

async function getBooks(req, res, next) {
  try {
    const books = await Book.find().sort({ serialNo: 1, title: 1 });
    return res.status(200).json({ books });
  } catch (err) {
    return next(err);
  }
}

async function getBookById(req, res, next) {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: "invalid id" });
    const book = await Book.findById(id);
    if (!book) return res.status(404).json({ error: "book not found" });
    return res.status(200).json({ book });
  } catch (err) {
    return next(err);
  }
}

async function createBook(req, res, next) {
  try {
    const { title, price, stock, totalStock, category, status } = req.body;
    if (!title || price === undefined || stock === undefined) {
      return res.status(400).json({ error: "title, price and stock are required" });
    }
    const priceNum = Number(price);
    const stockNum = Number(stock);
    const totalStockNum = totalStock === undefined ? stockNum : Number(totalStock);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      return res.status(400).json({ error: "price must be a non-negative number" });
    }
    if (!Number.isFinite(stockNum) || stockNum < 0) {
      return res.status(400).json({ error: "stock must be a non-negative number" });
    }
    if (!Number.isFinite(totalStockNum) || totalStockNum < 0) {
      return res.status(400).json({ error: "totalStock must be a non-negative number" });
    }

    const book = await Book.create({
      title: String(title).trim(),
      price: priceNum,
      stock: stockNum,
      totalStock: totalStockNum,
      category: String(category || "").trim(),
      status: String(status || "").trim()
    });
    return res.status(201).json({ book });
  } catch (err) {
    return next(err);
  }
}

async function updateBook(req, res, next) {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: "invalid id" });

    const update = {};
    if (req.body.title !== undefined) update.title = String(req.body.title).trim();
    if (req.body.price !== undefined) update.price = Number(req.body.price);
    if (req.body.stock !== undefined) update.stock = Number(req.body.stock);
    if (req.body.category !== undefined) update.category = String(req.body.category).trim();
    if (req.body.status !== undefined) update.status = String(req.body.status).trim();
    if (req.body.totalStock !== undefined) update.totalStock = Number(req.body.totalStock);

    if (update.price !== undefined && (!Number.isFinite(update.price) || update.price < 0)) {
      return res.status(400).json({ error: "price must be a non-negative number" });
    }
    if (update.stock !== undefined && (!Number.isFinite(update.stock) || update.stock < 0)) {
      return res.status(400).json({ error: "stock must be a non-negative number" });
    }
    if (update.totalStock !== undefined && (!Number.isFinite(update.totalStock) || update.totalStock < 0)) {
      return res.status(400).json({ error: "totalStock must be a non-negative number" });
    }

    const book = await Book.findByIdAndUpdate(id, update, { new: true });
    if (!book) return res.status(404).json({ error: "book not found" });
    return res.status(200).json({ book });
  } catch (err) {
    return next(err);
  }
}

async function deleteBook(req, res, next) {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: "invalid id" });
    const book = await Book.findByIdAndDelete(id);
    if (!book) return res.status(404).json({ error: "book not found" });
    return res.status(200).json({ message: "book removed" });
  } catch (err) {
    return next(err);
  }
}

async function updateStock(req, res, next) {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: "invalid id" });

    const qty = Number(req.body.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: "quantity must be a positive number" });
    }

    const book = await Book.findOneAndUpdate(
      { _id: id, stock: { $gte: qty } },
      { $inc: { stock: -qty } },
      { new: true }
    );

    if (!book) {
      const exists = await Book.findById(id);
      if (!exists) return res.status(404).json({ error: "book not found" });
      return res.status(400).json({ error: "insufficient stock" });
    }

    return res.status(200).json({ book });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  updateStock
};
