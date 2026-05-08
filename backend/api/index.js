const express = require("express");
const cors = require("cors");
const { connectDb } = require("../src/db");
const bookRoutes = require("../src/routes/bookRoutes");
const saleRoutes = require("../src/routes/saleRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use(async (req, res, next) => {
  try {
    await connectDb();
    return next();
  } catch (err) {
    return next(err);
  }
});

app.get("/", (req, res) => {
  res.status(200).send("POS Backend Running");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "POS API running" });
});

app.use("/api/books", bookRoutes);
app.use("/api/sales", saleRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error" });
});

module.exports = app;
