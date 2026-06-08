#!/usr/bin/env node
require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { connectDb } = require("../db");
const Sale = require("../models/Sale");

async function run() {
  const args = process.argv.slice(2);
  const receiptArgIndex = args.findIndex(a => a === "--receipt");
  const receipt = receiptArgIndex >= 0 && args[receiptArgIndex + 1] ? args[receiptArgIndex + 1] : args[0];
  if (!receipt) {
    console.error("Usage: node check_sale.js --receipt <RECEIPT_NO>");
    process.exit(1);
  }

  await connectDb();
  const sale = await Sale.findOne({ receiptNo: String(receipt).trim() }).lean();
  if (!sale) {
    console.log(`NOT FOUND: ${receipt}`);
    process.exit(0);
  }
  console.log(`FOUND: ${receipt}`);
  console.log({ receiptNo: sale.receiptNo, saleDate: sale.saleDate, total: sale.total, itemCount: sale.itemCount, createdAt: sale.createdAt });
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(2); });
