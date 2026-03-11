const express = require("express");
const { getDb } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

function toCompletedValue(value) {
  if (value === true || value === 1 || value === "1") return 1;
  if (value === false || value === 0 || value === "0") return 0;
  return null;
}

router.get("/", async (req, res, next) => {
  try {
    const db = getDb();
    const items = await db.all(
      `SELECT id, user_id, title, description, completed, created_at, updated_at
       FROM items
       WHERE user_id = ?
       ORDER BY id DESC`,
      req.user.id
    );
    return res.status(200).json({ items });
  } catch (err) {
    return next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const completedInput = req.body.completed;

    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }

    const completed =
      completedInput === undefined ? 0 : toCompletedValue(completedInput);
    if (completed === null) {
      return res.status(400).json({ error: "completed must be true/false or 1/0" });
    }

    const db = getDb();
    const result = await db.run(
      "INSERT INTO items (user_id, title, description, completed) VALUES (?, ?, ?, ?)",
      req.user.id,
      title,
      description,
      completed
    );

    const item = await db.get(
      `SELECT id, user_id, title, description, completed, created_at, updated_at
       FROM items
       WHERE id = ? AND user_id = ?`,
      result.lastID,
      req.user.id
    );

    return res.status(201).json({ message: "Item created", item });
  } catch (err) {
    return next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const itemId = Number(req.params.id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ error: "invalid item id" });
    }

    const db = getDb();
    const existing = await db.get(
      "SELECT id, title, description, completed FROM items WHERE id = ? AND user_id = ?",
      itemId,
      req.user.id
    );

    if (!existing) {
      return res.status(404).json({ error: "item not found" });
    }

    const nextTitle =
      req.body.title !== undefined ? String(req.body.title).trim() : existing.title;
    const nextDescription =
      req.body.description !== undefined
        ? String(req.body.description).trim()
        : existing.description;
    const nextCompleted =
      req.body.completed !== undefined
        ? toCompletedValue(req.body.completed)
        : existing.completed;

    if (!nextTitle) {
      return res.status(400).json({ error: "title cannot be empty" });
    }
    if (nextCompleted === null) {
      return res.status(400).json({ error: "completed must be true/false or 1/0" });
    }

    await db.run(
      `UPDATE items
       SET title = ?, description = ?, completed = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      nextTitle,
      nextDescription,
      nextCompleted,
      itemId,
      req.user.id
    );

    const item = await db.get(
      `SELECT id, user_id, title, description, completed, created_at, updated_at
       FROM items
       WHERE id = ? AND user_id = ?`,
      itemId,
      req.user.id
    );

    return res.status(200).json({ message: "Item updated", item });
  } catch (err) {
    return next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const itemId = Number(req.params.id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ error: "invalid item id" });
    }

    const db = getDb();
    const result = await db.run(
      "DELETE FROM items WHERE id = ? AND user_id = ?",
      itemId,
      req.user.id
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: "item not found" });
    }

    return res.status(200).json({ message: "Item deleted" });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
