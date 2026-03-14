const mongoose = require("mongoose");

async function connectDb() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error("MONGO_URI is missing in .env");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("MongoDB Connected");
}

module.exports = { connectDb };
