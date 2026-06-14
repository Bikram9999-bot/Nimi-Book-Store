var SHEET_ID = "1QUFXuGmrH0hMkz9ujY1NGyFyrtzdNMJkKzhIp9HDh3c";

var AUDIT_SHEET_NAME = "Inventory Audit";
var RECEIPT_SHEET_NAME = "Receipt Ledger";

var AUDIT_HEADERS = [
  "Date",
  "Time",
  "Event",
  "SL No",
  "Book",
  "Stock Movement",
  "Previous Stock",
  "Current Stock",
  "Protected Previous Stock",
  "Price",
  "Status",
  "Reference",
  "Source",
  "Note",
  "Sync ID"
];

var RECEIPT_HEADERS = [
  "Date",
  "Time",
  "Receipt ID",
  "Customer Name",
  "Mobile No",
  "Email",
  "Address",
  "Books",
  "Quantity",
  "Total Books",
  "Subtotal",
  "Discount %",
  "Discount Amount",
  "Final Amount",
  "Warehouse",
  "Note"
];

function getTargetSpreadsheet() {
  var activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (activeSpreadsheet) {
    return activeSpreadsheet;
  }
  return SpreadsheetApp.openById(SHEET_ID);
}

function styleSheet(sheet, headers, color, rangeA1) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight("bold")
    .setBackground(color.background)
    .setFontColor(color.text);
  sheet.setColumnWidths(1, headers.length, 130);
  sheet.getRange(rangeA1).setVerticalAlignment("middle");
  sheet.getRange(rangeA1).setWrap(true);

  if (sheet.getFilter()) {
    sheet.getFilter().remove();
  }
  var lastRow = Math.max(sheet.getLastRow(), 1);
  sheet.getRange(1, 1, lastRow, headers.length).createFilter();
}

function ensureAuditSheet(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(AUDIT_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(AUDIT_SHEET_NAME);
    styleSheet(sheet, AUDIT_HEADERS, { background: "#dbeafe", text: "#1e3a8a" }, "A:O");
    sheet.setColumnWidth(5, 320);
    sheet.setColumnWidth(6, 170);
    sheet.setColumnWidth(14, 320);
    sheet.setColumnWidth(15, 220);
  }
  return sheet;
}

function ensureReceiptSheet(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(RECEIPT_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(RECEIPT_SHEET_NAME);
    styleSheet(sheet, RECEIPT_HEADERS, { background: "#dcfce7", text: "#14532d" }, "A:P");
    sheet.setColumnWidth(7, 300);
    sheet.setColumnWidth(8, 380);
    sheet.setColumnWidth(9, 160);
    sheet.setColumnWidth(16, 280);
  }
  return sheet;
}

function appendAuditRows(sheet, rows) {
  var lastRow = sheet.getLastRow();
  var existingSyncIds = [];
  if (lastRow > 1) {
    var values = sheet.getRange(2, 15, lastRow - 1, 1).getValues();
    existingSyncIds = values.map(function (r) {
      return String(r[0]);
    });
  }

  rows.forEach(function (row) {
    var syncId = String(row.syncId || "");
    if (syncId && existingSyncIds.indexOf(syncId) !== -1) {
      return; // Skip duplicate Sync ID
    }
    sheet.appendRow([
      row.date || "",
      row.time || "",
      row.eventLabel || row.eventType || "",
      row.serialNo || "",
      row.bookDisplay || row.title || "",
      row.stockMovement || "",
      row.beforeStock || 0,
      row.afterStock || 0,
      row.previousStock || 0,
      row.price || 0,
      row.status || "",
      row.reference || "",
      row.source || "",
      row.message || "",
      row.syncId || ""
    ]);
  });
}

function appendReceiptRows(sheet, saleRows) {
  var lastRow = sheet.getLastRow();
  var existingReceiptNos = [];
  if (lastRow > 1) {
    var values = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
    existingReceiptNos = values.map(function (r) {
      return String(r[0]);
    });
  }

  saleRows.forEach(function (row) {
    var receiptNo = String(row.receiptNo || "");
    if (receiptNo && existingReceiptNos.indexOf(receiptNo) !== -1) {
      return; // Skip duplicate Receipt ID
    }
    sheet.appendRow([
      row.date || "",
      row.time || "",
      row.receiptNo || "",
      row.customerName || "",
      row.phone || "",
      row.email || "",
      row.address || "",
      row.books || "",
      row.quantities || "",
      row.itemCount || 0,
      row.subtotal || 0,
      row.discountPercent || 0,
      row.discountAmount || 0,
      row.total || 0,
      row.warehouse || "Lucknow",
      row.note || "Payment Completed only invoice required"
    ]);
  });
}

function setupSheets() {
  var spreadsheet = getTargetSpreadsheet();
  
  // Create a temporary sheet so the spreadsheet is never empty
  var tempSheet = spreadsheet.insertSheet("TempSheet_Reset");
  
  // Recreate the sheets to apply fresh style and filters
  var oldAudit = spreadsheet.getSheetByName(AUDIT_SHEET_NAME);
  if (oldAudit) spreadsheet.deleteSheet(oldAudit);
  var oldReceipt = spreadsheet.getSheetByName(RECEIPT_SHEET_NAME);
  if (oldReceipt) spreadsheet.deleteSheet(oldReceipt);
  
  ensureAuditSheet(spreadsheet);
  ensureReceiptSheet(spreadsheet);
  
  // Delete the temp sheet
  spreadsheet.deleteSheet(tempSheet);
}

function doPost(e) {
  try {
    var spreadsheet = getTargetSpreadsheet();
    var payload = JSON.parse(e.postData.contents || "{}");
    var mode = payload.mode || "append";
    var rows = Array.isArray(payload.rows) ? payload.rows : [];
    var saleRows = Array.isArray(payload.saleRows) ? payload.saleRows : [];

    if (mode === "replace") {
      // Create a temporary sheet so the spreadsheet is never empty during reset
      spreadsheet.insertSheet("TempSheet_Reset");
      
      var oldAudit = spreadsheet.getSheetByName(AUDIT_SHEET_NAME);
      if (oldAudit) spreadsheet.deleteSheet(oldAudit);
      var oldReceipt = spreadsheet.getSheetByName(RECEIPT_SHEET_NAME);
      if (oldReceipt) spreadsheet.deleteSheet(oldReceipt);
    }

    var auditSheet = ensureAuditSheet(spreadsheet);
    appendAuditRows(auditSheet, rows);

    if (saleRows.length) {
      var receiptSheet = ensureReceiptSheet(spreadsheet);
      appendReceiptRows(receiptSheet, saleRows);
    }

    // Clean up temporary sheet if it exists
    var tempSheet = spreadsheet.getSheetByName("TempSheet_Reset");
    if (tempSheet) {
      spreadsheet.deleteSheet(tempSheet);
    }

    // Force flush to execute all writes synchronously inside the try-catch block!
    SpreadsheetApp.flush();

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, rows: rows.length, saleRows: saleRows.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    // Make sure we clean up the temp sheet even if an error occurs
    try {
      var tempSheet = getTargetSpreadsheet().getSheetByName("TempSheet_Reset");
      if (tempSheet) {
        getTargetSpreadsheet().deleteSheet(tempSheet);
      }
    } catch(e) {}
    
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
