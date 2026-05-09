function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inventory Audit");
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("Inventory Audit");
      sheet.appendRow([
        "Timestamp",
        "Event Type",
        "Source",
        "Reference",
        "SL No",
        "Title",
        "Before Stock",
        "After Stock",
        "Delta Stock",
        "Previous Stock",
        "Price",
        "Status",
        "Message",
        "Sync ID"
      ]);
    }

    var payload = JSON.parse(e.postData.contents || "{}");
    var rows = Array.isArray(payload.rows) ? payload.rows : [];

    rows.forEach(function (row) {
      sheet.appendRow([
        row.timestamp || "",
        row.eventType || "",
        row.source || "",
        row.reference || "",
        row.serialNo || "",
        row.title || "",
        row.beforeStock || 0,
        row.afterStock || 0,
        row.deltaStock || 0,
        row.previousStock || 0,
        row.price || 0,
        row.status || "",
        row.message || "",
        row.syncId || ""
      ]);
    });

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, rows: rows.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
