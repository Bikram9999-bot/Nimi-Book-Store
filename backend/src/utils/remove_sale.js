#!/usr/bin/env node
require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { connectDb } = require("../db");
const Sale = require("../models/Sale");
const Book = require("../models/Book");
const { writeAuditLog } = require("./auditLogger");

async function run() {
  const args = process.argv.slice(2);
  const receiptArgIndex = args.findIndex(a => a === "--receipt");
  const receipt = receiptArgIndex >= 0 && args[receiptArgIndex + 1] ? args[receiptArgIndex + 1] : args[0];
  if (!receipt) {
    console.error("Usage: node remove_sale.js --receipt <RECEIPT_NO>");
    process.exit(1);
  }

  await connectDb();
  const mongoose = require("mongoose");
  const sale = await Sale.findOne({ receiptNo: String(receipt).trim() });
  if (!sale) {
    console.log(`Sale not found: ${receipt}`);
    process.exit(0);
  }

  console.log(`Found sale ${receipt}, proceeding to remove and restore stock...`);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const line of sale.lines) {
        const before = await Book.findById(line.bookId).session(session);
        if (!before) throw new Error(`Book not found: ${line.bookId}`);
        const after = await Book.findOneAndUpdate({ _id: line.bookId }, { $inc: { stock: line.qty } }, { new: true, session });
        await writeAuditLog({
          eventType: "inventory_sale_reversal",
          source: "remove-sale-script",
          reference: sale.receiptNo,
          message: `Reverted sale line qty ${line.qty} for ${sale.receiptNo}`,
          before,
          after,
          meta: { receiptNo: sale.receiptNo, quantity: line.qty },
          session
        });
      }
      await Sale.deleteOne({ _id: sale._id }).session(session);
    });
    console.log(`Removed sale ${receipt} and restored stock.`);
  } catch (err) {
    console.error(`Failed to remove ${receipt}:`, err.message || err);
  } finally {
    await session.endSession();
    process.exit(0);
  }
}

run().catch(err => { console.error(err); process.exit(2); });
