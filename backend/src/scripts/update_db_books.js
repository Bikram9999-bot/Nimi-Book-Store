require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { connectDb } = require('../db');
const Book = require('../models/Book');

const seedPath = path.join(__dirname, '../../../pos_seed.js');

async function syncDatabase() {
  await connectDb();

  // Read pos_seed.js
  const seedContent = fs.readFileSync(seedPath, 'utf8');
  const jsonStr = seedContent.replace(/^window\.POS_SEED\s*=\s*/, '').replace(/;\s*$/, '');
  const seedData = JSON.parse(jsonStr);

  console.log(`Loaded ${seedData.stock.length} stock items from pos_seed.js`);

  let updatedCount = 0;
  let createdCount = 0;

  for (const s of seedData.stock) {
    const serialNo = Number(s.id);
    const title = s.title;
    const price = Number(s.price);
    const totalStock = Number(s.prevStock);
    const stock = Number(s.baseRemaining);
    const status = stock <= 0 ? 'Out of Stock' : (stock <= 5 ? 'Low Stock' : 'In Stock');

    // Attempt 1: Find by serialNo
    let book = await Book.findOne({ serialNo });

    // Attempt 2: Fallback to title matching
    if (!book) {
      book = await Book.findOne({ title: { $regex: new RegExp('^' + escapeRegExp(title) + '$', 'i') } });
    }

    if (book) {
      // Update
      book.title = title;
      book.price = price;
      book.totalStock = totalStock;
      book.stock = stock;
      book.serialNo = serialNo;
      book.status = status;
      await book.save();
      updatedCount++;
    } else {
      // Create
      await Book.create({
        title,
        price,
        totalStock,
        stock,
        serialNo,
        status
      });
      createdCount++;
    }
  }

  console.log(`Database sync complete: Updated ${updatedCount} books, Created ${createdCount} books.`);
  process.exit(0);
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

syncDatabase().catch(err => {
  console.error('Database sync failed:', err);
  process.exit(1);
});
