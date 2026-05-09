var SHEET_ID = "1d12LSaoSjsM0I54RLjKgktHcZ9jpIcz_O51Y6m6B5Y0";
var SHEET_NAME = "Inventory Audit";
var HEADERS = [
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

function ensureAuditSheet(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setFontWeight("bold")
    .setBackground("#dbeafe")
    .setFontColor("#1e3a8a");

  sheet.setColumnWidths(1, HEADERS.length, 130);
  sheet.setColumnWidth(5, 320);
  sheet.setColumnWidth(6, 170);
  sheet.setColumnWidth(14, 320);
  sheet.setColumnWidth(15, 220);
  sheet.getRange("A:O").setVerticalAlignment("middle");
  sheet.getRange("A:O").setWrap(true);

  if (sheet.getFilter()) {
    sheet.getFilter().remove();
  }
  var lastRow = Math.max(sheet.getLastRow(), 1);
  sheet.getRange(1, 1, lastRow, HEADERS.length).createFilter();

  return sheet;
}

function doPost(e) {
  try {
    var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ensureAuditSheet(spreadsheet);

    var payload = JSON.parse(e.postData.contents || "{}");
    var rows = Array.isArray(payload.rows) ? payload.rows : [];

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
      sheet.getRange(startRow, 10, rows.length, 1).setNumberFormat("₹#,##0.00");
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, rows: rows.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
