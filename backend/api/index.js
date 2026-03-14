const express = require("express");
const cors = require("cors");
const { connectDb } = require("../src/db");
const bookRoutes = require("../src/routes/bookRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).send("POS Backend Running");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "POS API running" });
});

app.use("/api/books", bookRoutes);

connectDb().catch((err) => {
  console.error("Failed to connect to MongoDB:", err.message);
});

module.exports = app;
