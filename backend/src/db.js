const mongoose = require("mongoose");

let cachedPromise = null;

async function connectDb() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is missing in .env");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!cachedPromise) {
    cachedPromise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000
    });
  }

  await cachedPromise;
  console.log("MongoDB Connected");
  return mongoose.connection;
}

module.exports = { connectDb };
