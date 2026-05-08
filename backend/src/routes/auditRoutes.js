const express = require("express");
const { getAuditReport, getAuditLogs } = require("../controllers/auditController");

const router = express.Router();

router.get("/report", getAuditReport);
router.get("/logs", getAuditLogs);

module.exports = router;
