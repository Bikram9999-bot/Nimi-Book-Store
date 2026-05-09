const express = require("express");
const { getAuditReport, getAuditLogs, retryAuditSheetSync } = require("../controllers/auditController");

const router = express.Router();

router.get("/report", getAuditReport);
router.get("/logs", getAuditLogs);
router.post("/retry-sheet-sync", retryAuditSheetSync);

module.exports = router;
