var SHEET_ID = "1d12LSaoSjsM0I54RLjKgktHcZ9jpIcz_O51Y6m6B5Y0";

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
  }
  styleSheet(sheet, AUDIT_HEADERS, { background: "#dbeafe", text: "#1e3a8a" }, "A:O");
  sheet.setColumnWidth(5, 320);
  sheet.setColumnWidth(6, 170);
  sheet.setColumnWidth(14, 320);
  sheet.setColumnWidth(15, 220);
  return sheet;
}

function ensureReceiptSheet(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(RECEIPT_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(RECEIPT_SHEET_NAME);
  }
  styleSheet(sheet, RECEIPT_HEADERS, { background: "#dcfce7", text: "#14532d" }, "A:P");
  sheet.setColumnWidth(7, 300);
  sheet.setColumnWidth(8, 380);
  sheet.setColumnWidth(9, 160);
  sheet.setColumnWidth(16, 280);
  return sheet;
}

function resetAuditSheet(sheet) {
  sheet.clear();
  ensureAuditSheet(SpreadsheetApp.openById(SHEET_ID));
}

function appendAuditRows(sheet, rows) {
  rows.forEach(function (row) {
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

  if (rows.length) {
    var startRow = sheet.getLastRow() - rows.length + 1;
    sheet.getRange(startRow, 7, rows.length, 4).setNumberFormat("0");
    sheet.getRange(startRow, 10, rows.length, 1).setNumberFormat("Rs #,##0.00");
  }
}

function appendReceiptRows(sheet, saleRows) {
  saleRows.forEach(function (row) {
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

  if (saleRows.length) {
    var startRow = sheet.getLastRow() - saleRows.length + 1;
    sheet.getRange(startRow, 10, saleRows.length, 1).setNumberFormat("0");
    sheet.getRange(startRow, 11, saleRows.length, 1).setNumberFormat("Rs #,##0.00");
    sheet.getRange(startRow, 12, saleRows.length, 1).setNumberFormat("0");
    sheet.getRange(startRow, 13, saleRows.length, 2).setNumberFormat("Rs #,##0.00");
  }
}

function refreshFilters(sheet, headers) {
  if (sheet.getFilter()) {
    sheet.getFilter().remove();
  }
  var lastRow = Math.max(sheet.getLastRow(), 1);
  sheet.getRange(1, 1, lastRow, headers.length).createFilter();
}

function doPost(e) {
  try {
    var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    var payload = JSON.parse(e.postData.contents || "{}");
    var mode = payload.mode || "append";
    var rows = Array.isArray(payload.rows) ? payload.rows : [];
    var saleRows = Array.isArray(payload.saleRows) ? payload.saleRows : [];

    var auditSheet = ensureAuditSheet(spreadsheet);
    if (mode === "replace") {
      auditSheet.clear();
      auditSheet = ensureAuditSheet(spreadsheet);
      var oldReceiptSheet = spreadsheet.getSheetByName(RECEIPT_SHEET_NAME);
      if (oldReceiptSheet) {
        oldReceiptSheet.clear();
        ensureReceiptSheet(spreadsheet);
      }
    }
    appendAuditRows(auditSheet, rows);
    refreshFilters(auditSheet, AUDIT_HEADERS);

    if (saleRows.length) {
      var receiptSheet = ensureReceiptSheet(spreadsheet);
      appendReceiptRows(receiptSheet, saleRows);
      refreshFilters(receiptSheet, RECEIPT_HEADERS);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, rows: rows.length, saleRows: saleRows.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
