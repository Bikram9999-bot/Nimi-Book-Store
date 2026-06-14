const nodemailer = require("nodemailer");

const SMTP_HOST = process.env.SMTP_HOST || "smtp.office365.com";
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const OWNER_EMAIL = process.env.SMTP_USER || ""; // CC or receive emails here

function isEmailConfigured() {
  return Boolean(SMTP_USER && SMTP_PASS);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR"
  }).format(value).replace("INR", "Rs");
}

function buildHtmlReceipt(sale) {
  const customer = sale.customer || {};
  const lines = Array.isArray(sale.lines) ? sale.lines : [];

  const lineRowsHtml = lines
    .map(
      (line) => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-size: 14px;">
          <strong>${line.title}</strong>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px; text-align: center;">
          ${line.qty}
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px; text-align: right;">
          ${formatCurrency(line.price)}
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 14px; font-weight: 600; text-align: right;">
          ${formatCurrency(line.amount)}
        </td>
      </tr>
    `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Purchase Receipt - ${sale.receiptNo}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 20px 0;">
        <tr>
          <td align="center">
            <!-- Container -->
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #1e3a8a, #3b82f6); padding: 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">NIMI BOOKSTORE</h1>
                  <p style="color: #bfdbfe; margin: 5px 0 0 0; font-size: 14px;">Lucknow Warehouse Outlet</p>
                </td>
              </tr>

              <!-- Content Body -->
              <tr>
                <td style="padding: 30px;">
                  
                  <!-- Intro -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 25px;">
                    <tr>
                      <td>
                        <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 18px; font-weight: 600;">Thank you for your purchase!</h2>
                        <p style="color: #475569; margin: 0; font-size: 14px; line-height: 1.5;">Here is your invoice summary for the transaction. A digital copy of your order is details below.</p>
                      </td>
                    </tr>
                  </table>

                  <!-- Details Grid -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 25px; border-collapse: collapse;">
                    <tr>
                      <td width="50%" valign="top" style="padding: 15px; background-color: #f1f5f9; border-radius: 8px 0 0 8px; border: 1px solid #e2e8f0;">
                        <span style="color: #64748b; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Billed To:</span>
                        <div style="color: #1e293b; font-size: 14px; font-weight: 600; margin-top: 5px;">${customer.name || "N/A"}</div>
                        <div style="color: #475569; font-size: 13px; margin-top: 3px;">Phone: ${customer.phone || "-"}</div>
                        <div style="color: #475569; font-size: 13px;">Email: ${customer.email || "-"}</div>
                        <div style="color: #475569; font-size: 13px;">Address: ${customer.address || ""}${customer.pincode ? ", " + customer.pincode : ""}</div>
                      </td>
                      <td width="50%" valign="top" style="padding: 15px; background-color: #f1f5f9; border-radius: 0 8px 8px 0; border: 1px solid #e2e8f0; border-left: none;">
                        <span style="color: #64748b; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Invoice Details:</span>
                        <div style="color: #1e293b; font-size: 14px; font-weight: 600; margin-top: 5px;">Receipt No: <span style="font-family: monospace;">${sale.receiptNo}</span></div>
                        <div style="color: #475569; font-size: 13px; margin-top: 3px;">Date: ${new Date(sale.saleDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "long", year: "numeric" })}</div>
                        <div style="color: #475569; font-size: 13px;">Time: ${new Date(sale.saleDate).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
                        <div style="color: #475569; font-size: 13px;">Warehouse: Lucknow</div>
                      </td>
                    </tr>
                  </table>

                  <!-- Items Table -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 25px; border-collapse: collapse;">
                    <thead>
                      <tr>
                        <th style="padding: 8px 0; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 12px; font-weight: bold; text-align: left; text-transform: uppercase;">Book Title</th>
                        <th style="padding: 8px 0; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 12px; font-weight: bold; text-align: center; text-transform: uppercase; width: 60px;">Qty</th>
                        <th style="padding: 8px 0; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 12px; font-weight: bold; text-align: right; text-transform: uppercase; width: 100px;">Price</th>
                        <th style="padding: 8px 0; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 12px; font-weight: bold; text-align: right; text-transform: uppercase; width: 100px;">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${lineRowsHtml}
                    </tbody>
                  </table>

                  <!-- Calculations Grid -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 15px;">
                    <tr>
                      <td width="55%"></td>
                      <td width="45%">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px;">
                          <tr>
                            <td style="padding: 5px 0; color: #64748b;">Subtotal</td>
                            <td style="padding: 5px 0; text-align: right; color: #0f172a; font-weight: 500;">${formatCurrency(sale.subtotal)}</td>
                          </tr>
                          ${
                            sale.discountPercent > 0
                              ? `
                          <tr>
                            <td style="padding: 5px 0; color: #16a34a;">Discount (${sale.discountPercent}%)</td>
                            <td style="padding: 5px 0; text-align: right; color: #16a34a; font-weight: 500;">-${formatCurrency(sale.discountAmount)}</td>
                          </tr>
                          `
                              : ""
                          }
                          <tr style="border-top: 1px solid #e2e8f0;">
                            <td style="padding: 10px 0 0 0; color: #0f172a; font-size: 16px; font-weight: bold;">Net Total</td>
                            <td style="padding: 10px 0 0 0; text-align: right; color: #1e3a8a; font-size: 18px; font-weight: bold;">${formatCurrency(sale.total)}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f1f5f9; padding: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
                  <p style="color: #64748b; font-size: 12px; margin: 0; line-height: 1.5;">
                    If you have any questions or require support, please contact us at <a href="mailto:${OWNER_EMAIL}" style="color: #3b82f6; text-decoration: none;">${OWNER_EMAIL}</a>.
                  </p>
                  <p style="color: #94a3b8; font-size: 11px; margin: 5px 0 0 0;">
                    Nimi Bookstore &copy; 2026. All rights reserved.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

async function sendSaleEmail(sale) {
  if (!isEmailConfigured()) {
    console.warn("SMTP credentials not configured. Skipping sale email notification.");
    return null;
  }

  try {
    const customer = sale.customer || {};
    const customerEmail = String(customer.email || "").trim();
    
    // Determine target recipient
    const recipient = customerEmail && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail) 
      ? customerEmail 
      : OWNER_EMAIL;
      
    // Set CC to Owner if recipient is customer
    const ccRecipient = recipient !== OWNER_EMAIL ? OWNER_EMAIL : undefined;

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false, // true for 465, false for other ports (587)
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      },
      tls: {
        // Outlook SMTP often requires STARTTLS and explicit configuration
        ciphers: "SSLv3"
      }
    });

    const mailOptions = {
      from: `"Nimi Bookstore" <${SMTP_USER}>`,
      to: recipient,
      cc: ccRecipient,
      subject: `Purchase Receipt ${sale.receiptNo} | Nimi Bookstore`,
      html: buildHtmlReceipt(sale)
    };

    console.log(`Sending sale receipt email via SMTP to: ${recipient}...`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error("Failed to send sale receipt email via SMTP:", error.message);
    throw error;
  }
}

module.exports = {
  isEmailConfigured,
  sendSaleEmail
};
