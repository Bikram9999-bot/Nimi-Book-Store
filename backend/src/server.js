const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const express = require("express");
const cors = require("cors");
const { connectDb } = require("./db");
const bookRoutes = require("./routes/bookRoutes");
const saleRoutes = require("./routes/saleRoutes");
const auditRoutes = require("./routes/auditRoutes");

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(cors());
app.use(express.json());

console.log("MONGO_URI:", process.env.MONGO_URI);

app.get("/", (req, res) => {
  res.status(200).send("POS Backend Running");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "POS API running"
  });
});

app.use("/api/books", bookRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/audit", auditRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error" });
});

connectDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
