const dotenvResult = require("dotenv").config({ override: true });
console.log("Loaded Environment SMTP Settings:");
console.log("dotenvResult error:", dotenvResult.error);
console.log("dotenvResult parsed:", dotenvResult.parsed);
console.log("SMTP_HOST:", process.env.SMTP_HOST);
console.log("SMTP_USER:", process.env.SMTP_USER);
console.log("SMTP_PASS length:", process.env.SMTP_PASS ? process.env.SMTP_PASS.length : 0);

const { sendSaleEmail } = require("./src/utils/emailNotifier");

async function runTest() {
  const dummySale = {
    receiptNo: "TEST-RECEIPT-12345",
    saleDate: new Date().toISOString(),
    customer: {
      name: "Test Customer",
      phone: "9876543210",
      email: "ss190775@outlook.com", // Send to self for verification
      address: "123, Hazratganj, Lucknow",
      pincode: "226001"
    },
    lines: [
      {
        title: "Test Book 1",
        qty: 2,
        price: 350.00,
        amount: 700.00
      },
      {
        title: "Test Book 2",
        qty: 1,
        price: 150.00,
        amount: 150.00
      }
    ],
    itemCount: 3,
    discountPercent: 10,
    subtotal: 850.00,
    discountAmount: 85.00,
    total: 765.00
  };

  console.log("Starting SMTP email send test...");
  try {
    const res = await sendSaleEmail(dummySale);
    console.log("SMTP Send Test PASSED!", res);
  } catch (err) {
    console.error("SMTP Send Test FAILED:", err);
  }
}

runTest();
