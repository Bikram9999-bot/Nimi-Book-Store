const express = require("express");
const {
  getSales,
  getSaleByReceipt,
  importSales,
  completeSale
} = require("../controllers/saleController");

const router = express.Router();

router.get("/", getSales);
router.get("/:receiptNo", getSaleByReceipt);
router.post("/import", importSales);
router.post("/complete", completeSale);

module.exports = router;
