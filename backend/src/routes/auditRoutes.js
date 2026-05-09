const express = require("express");
const { getAuditReport, getAuditLogs, retryAuditSheetSync, resyncAllAuditSheet } = require("../controllers/auditController");

const router = express.Router();

router.get("/report", getAuditReport);
router.get("/logs", getAuditLogs);
router.post("/retry-sheet-sync", retryAuditSheetSync);
router.post("/resync-all-sheet", resyncAllAuditSheet);

module.exports = router;
