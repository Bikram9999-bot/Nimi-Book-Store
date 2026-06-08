#!/usr/bin/env node
require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { connectDb } = require("../db");
const Sale = require("../models/Sale");

async function run() {
  const args = process.argv.slice(2);
  const prefixArgIndex = args.findIndex(a => a === "--prefix");
  const prefix = prefixArgIndex >= 0 && args[prefixArgIndex + 1] ? args[prefixArgIndex + 1] : args[0];
  if (!prefix) {
    console.error("Usage: node find_sales_by_prefix.js --prefix <RECEIPT_PREFIX>");
    process.exit(1);
  }

  await connectDb();
  const regex = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"));
  const sales = await Sale.find({ receiptNo: { $regex: regex } }).sort({ createdAt: 1 }).lean();
  if (!sales.length) {
    console.log(`No sales found with prefix: ${prefix}`);
    process.exit(0);
  }
  console.log(`Found ${sales.length} sale(s) with prefix '${prefix}':`);
  sales.forEach(s => {
    console.log(`- _id: ${s._id} | receiptNo: ${s.receiptNo} | createdAt: ${s.createdAt} | total: ${s.total} | lines: ${s.lines.length}`);
  });
  process.exit(0);
}

run().catch(err=>{ console.error(err); process.exit(2); });
