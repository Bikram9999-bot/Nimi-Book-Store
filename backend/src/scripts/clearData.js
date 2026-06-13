#!/usr/bin/env node
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const Book = require("../models/Book");
const Sale = require("../models/Sale");
const AuditLog = require("../models/AuditLog");

const MONGO_URI = process.env.MONGO_URI;

async function clearAllData() {
  try {
    if (!MONGO_URI) {
      throw new Error("MONGO_URI is not set in .env");
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log("Connected to MongoDB.");

    console.log("\n=== PHASE 2: DATA RESET ===\n");

    console.log("[1/3] Resetting Book stock to 0...");
    const bookResult = await Book.updateMany({}, { $set: { stock: 0 } });
    console.log(`✓ Reset ${bookResult.modifiedCount} books. Total books in system: ${await Book.countDocuments()}`);

    console.log("\n[2/3] Deleting all AuditLog entries...");
    const auditResult = await AuditLog.deleteMany({});
    console.log(`✓ Deleted ${auditResult.deletedCount} audit log entries.`);

    console.log("\n[3/3] Deleting all Sale entries...");
    const saleResult = await Sale.deleteMany({});
    console.log(`✓ Deleted ${saleResult.deletedCount} sale records.`);

    console.log("\n=== DATA RESET COMPLETE ===\n");
    console.log("Summary:");
    console.log(`  • Books reset: ${bookResult.modifiedCount}`);
    console.log(`  • Audit logs deleted: ${auditResult.deletedCount}`);
    console.log(`  • Sales deleted: ${saleResult.deletedCount}`);
    console.log("\n✓ All data cleared successfully.");
    console.log("✓ Frontend localStorage will be cleared on next app load.");

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

clearAllData();
