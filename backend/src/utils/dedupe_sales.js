#!/usr/bin/env node
require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { connectDb } = require("../db");
const Sale = require("../models/Sale");
const Book = require("../models/Book");
const { writeAuditLog } = require("./auditLogger");

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { name: "", window: 120, dry: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--name" && args[i + 1]) { out.name = args[++i]; }
    else if (a === "--window" && args[i + 1]) { out.window = Number(args[++i]) || out.window; }
    else if (a === "--dry-run") { out.dry = true; }
  }
  return out;
}

function sameLines(aLines, bLines) {
  if (!Array.isArray(aLines) || !Array.isArray(bLines)) return false;
  if (aLines.length !== bLines.length) return false;
  const mapA = new Map(aLines.map(l => [String(l.bookId), Number(l.qty)]));
  for (const bl of bLines) {
    const want = mapA.get(String(bl.bookId));
    if (typeof want === "undefined" || Number(bl.qty) !== want) return false;
  }
  return true;
}

async function run() {
  const opts = parseArgs();
  if (!opts.name) {
    console.error("Usage: node dedupe_sales.js --name " + '"Customer Name"' + " [--window seconds] [--dry-run]");
    process.exit(1);
  }

  await connectDb();
  const nameRegex = new RegExp(`^${opts.name.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&").trim()}$`, "i");
  const sales = await Sale.find({ "customer.name": { $regex: nameRegex } }).sort({ createdAt: 1 }).lean();
  if (!sales.length) {
    console.log("No sales found for that customer.");
    process.exit(0);
  }

  const windowMs = (Number(opts.window) || 120) * 1000;
  const toDelete = [];

  for (let i = 0; i < sales.length; i++) {
    const base = sales[i];
    if (toDelete.some(d => String(d._id) === String(base._id))) continue;
    for (let j = i + 1; j < sales.length; j++) {
      const cand = sales[j];
      if (toDelete.some(d => String(d._id) === String(cand._id))) continue;
      const dt = new Date(cand.createdAt).getTime() - new Date(base.createdAt).getTime();
      if (dt <= windowMs && sameLines(base.lines, cand.lines)) {
        toDelete.push(cand);
      }
    }
  }

  if (!toDelete.length) {
    console.log("No duplicate sales detected within the window.");
    process.exit(0);
  }

  console.log(`Detected ${toDelete.length} duplicate sale(s) for customer '${opts.name}'.`);
  if (opts.dry) {
    toDelete.forEach(s => console.log(`DRY: would remove receipt ${s.receiptNo} createdAt=${s.createdAt}`));
    process.exit(0);
  }

  const mongoose = require("mongoose");
  for (const dup of toDelete) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const line of dup.lines) {
          const before = await Book.findById(line.bookId).session(session);
          if (!before) throw new Error(`Book not found: ${line.bookId}`);
          const after = await Book.findOneAndUpdate({ _id: line.bookId }, { $inc: { stock: line.qty } }, { new: true, session });
          await writeAuditLog({
            eventType: "inventory_sale_reversal",
            source: "dedupe-script",
            reference: dup.receiptNo,
            message: `Reverted sale line qty ${line.qty} for ${dup.receiptNo}`,
            before,
            after,
            meta: { receiptNo: dup.receiptNo, quantity: line.qty },
            session
          });
        }
        await Sale.deleteOne({ _id: dup._id }).session(session);
      });
      console.log(`Removed duplicate receipt ${dup.receiptNo} and restored stock.`);
    } catch (err) {
      console.error(`Failed to remove duplicate ${dup.receiptNo}:`, err.message);
    } finally {
      await session.endSession();
    }
  }
  console.log("Done.");
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
