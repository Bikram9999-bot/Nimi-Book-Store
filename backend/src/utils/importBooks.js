const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { connectDb } = require("../db");
const Book = require("../models/Book");

dotenv.config();

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(",")
    .map((h) => normalizeHeader(h.replace(/"/g, "")));

  const idx = (name) => headers.indexOf(name);

  const titleIdx = idx("title");
  const priceIdx = headers.includes("price") ? idx("price") : idx("unit price");
  const stockIdx = headers.includes("stock") ? idx("stock") : idx("remaining stock");
  const categoryIdx = idx("category");
  const statusIdx = idx("status");

  return lines.slice(1).map((line) => {
    const parts = line.split(",").map((v) => v.replace(/"/g, "").trim());
    const title = parts[titleIdx] || "";
    const price = Number(parts[priceIdx]);
    const stock = Number(parts[stockIdx]);
    const category = categoryIdx >= 0 ? parts[categoryIdx] : "";
    const status = statusIdx >= 0 ? parts[statusIdx] : "";
    return {
      title: String(title).trim(),
      price: Number.isFinite(price) ? price : 0,
      stock: Number.isFinite(stock) ? stock : 0,
      category: String(category || "").trim(),
      status: String(status || "").trim()
    };
  }).filter((row) => row.title);
}

async function run() {
  const filePath = path.join(__dirname, "..", "..", "Stock for COde.csv");
  if (!fs.existsSync(filePath)) {
    console.error("CSV file not found:", filePath);
    process.exit(1);
  }

  await connectDb();

  const csv = fs.readFileSync(filePath, "utf8");
  const rows = parseCsv(csv);

  if (!rows.length) {
    console.log("No rows found in CSV.");
    process.exit(0);
  }

  const existing = await Book.find({}, "title").lean();
  const existingSet = new Set(existing.map((b) => b.title.toLowerCase()));

  const toInsert = rows.filter((r) => !existingSet.has(r.title.toLowerCase()));
  if (!toInsert.length) {
    console.log("No new books to insert (duplicates skipped).");
    process.exit(0);
  }

  await Book.insertMany(toInsert);
  console.log(`Imported ${toInsert.length} books.`);
  process.exit(0);
}

run().catch((err) => {
  console.error("Import failed:", err.message);
  process.exit(1);
});
