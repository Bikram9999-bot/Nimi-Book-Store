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
  const serialIdx = idx("sr.no.");
  const priceIdx = headers.includes("price") ? idx("price") : idx("unit price");
  const totalIdx = idx("total stock");
  const stockIdx = headers.includes("stock") ? idx("stock") : idx("remaining stock");
  const categoryIdx = idx("category");
  const statusIdx = idx("status");

  return lines.slice(1).map((line) => {
    const parts = line.split(",").map((v) => v.replace(/"/g, "").trim());
    const title = parts[titleIdx] || "";
    const serialNo = Number(serialIdx >= 0 ? parts[serialIdx] : "");
    const price = Number(parts[priceIdx]);
    const totalStock = Number(totalIdx >= 0 ? parts[totalIdx] : "");
    const stock = Number(parts[stockIdx]);
    const category = categoryIdx >= 0 ? parts[categoryIdx] : "";
    const status = statusIdx >= 0 ? parts[statusIdx] : "";
    return {
      serialNo: Number.isFinite(serialNo) ? serialNo : 0,
      title: String(title).trim(),
      price: Number.isFinite(price) ? price : 0,
      stock: Number.isFinite(stock) ? stock : 0,
      totalStock: Number.isFinite(totalStock) ? totalStock : (Number.isFinite(stock) ? stock : 0),
      category: String(category || "").trim(),
      status: String(status || "").trim()
    };
  }).filter((row) => row.title);
}

async function run() {
  const inputPath = process.argv[2];
  let filePath = inputPath
    ? path.resolve(inputPath)
    : path.join(__dirname, "..", "..", "Final book list and count.csv");
  if (!fs.existsSync(filePath)) {
    const fallback = path.join(__dirname, "..", "..", "Stock for COde.csv");
    if (!fs.existsSync(fallback)) {
      console.error("CSV file not found:", filePath);
      process.exit(1);
    }
    console.log("Primary CSV not found, using fallback:", fallback);
    filePath = fallback;
  }

  await connectDb();

  const csv = fs.readFileSync(filePath, "utf8");
  const rows = parseCsv(csv);

  if (!rows.length) {
    console.log("No rows found in CSV.");
    process.exit(0);
  }

  const ops = rows.map((r) => ({
    updateOne: {
      filter: { title: r.title },
      update: {
        $set: {
          serialNo: r.serialNo,
          price: r.price,
          stock: r.stock,
          totalStock: r.totalStock,
          category: r.category,
          status: r.status
        }
      },
      upsert: true
    }
  }));

  const result = await Book.bulkWrite(ops);
  console.log(`Sync complete. Upserts: ${result.upsertedCount}, Modified: ${result.modifiedCount}`);
  process.exit(0);
}

run().catch((err) => {
  console.error("Import failed:", err.message);
  process.exit(1);
});
