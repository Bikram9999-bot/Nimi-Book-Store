# Backend Setup (Beginner Friendly)

This backend uses:
- Node.js + Express
- SQLite database (saved in a file, so data is permanent)
- JWT auth (register/login)
- Password hashing with bcrypt
- User-scoped item CRUD APIs

## 1. Folder structure

```text
backend/
  .env.example
  package.json
  data/
    app.db                  # Created automatically on first run
  src/
    db.js                   # SQLite connection + table creation
    server.js               # Express app bootstrap
    middleware/
      auth.js               # JWT auth middleware
    routes/
      authRoutes.js         # /api/auth/register + /api/auth/login
      itemRoutes.js         # /api/items CRUD (protected)
```

## 2. Install and run (step by step)

Open terminal in `backend/` and run:

```bash
npm init -y
npm install express cors dotenv sqlite sqlite3 bcryptjs jsonwebtoken
npm install -D nodemon
```

If you already have `package.json` in this folder (included in this project), just run:

```bash
npm install
```

Create env file:

```bash
copy .env.example .env
```

Edit `.env` and set a strong `JWT_SECRET`.

Start server:

```bash
npm run dev
```

Or normal start:

```bash
npm start
```

Server will run at:

```text
http://localhost:4000
```

Health check:

```text
GET http://localhost:4000/api/health
```

## 3. API endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`

### Items (JWT required)
- `GET /api/items`
- `POST /api/items`
- `PUT /api/items/:id`
- `DELETE /api/items/:id`

All requests/responses are JSON.

## 4. Example request bodies

### Register
`POST /api/auth/register`

```json
{
  "name": "Aman",
  "email": "aman@example.com",
  "password": "password123"
}
```

### Login
`POST /api/auth/login`

```json
{
  "email": "aman@example.com",
  "password": "password123"
}
```

### Create item
`POST /api/items` (Authorization: Bearer TOKEN)

```json
{
  "title": "Buy books",
  "description": "For exam prep",
  "completed": false
}
```

### Update item
`PUT /api/items/1` (Authorization: Bearer TOKEN)

```json
{
  "title": "Buy science books",
  "completed": true
}
```

## 5. Front-end `fetch()` examples

Use this in your existing plain HTML + JS file.  
Set your API base:

```js
const API_BASE = "http://localhost:4000/api";
```

Store token after login:

```js
localStorage.setItem("token", loginResponse.token);
```

Helper for auth headers:

```js
function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}
```

### Load items on page load (GET /items)

```js
async function loadItems() {
  const res = await fetch(`${API_BASE}/items`, {
    method: "GET",
    headers: authHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load items");
  return data.items;
}

window.addEventListener("DOMContentLoaded", async () => {
  try {
    const items = await loadItems();
    console.log(items);
    // Render items in your UI here
  } catch (err) {
    console.error(err.message);
  }
});
```

### Save new item (POST /items)

```js
async function createItem(title, description = "") {
  const res = await fetch(`${API_BASE}/items`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ title, description, completed: false })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create item");
  return data.item;
}
```

### Update item (PUT /items/:id)

```js
async function updateItem(id, updates) {
  const res = await fetch(`${API_BASE}/items/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(updates)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update item");
  return data.item;
}
```

### Delete item (DELETE /items/:id)

```js
async function deleteItem(id) {
  const res = await fetch(`${API_BASE}/items/${id}`, {
    method: "DELETE",
    headers: authHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to delete item");
  return data;
}
```

### Register + Login examples

```js
async function register(name, email, password) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Register failed");
  localStorage.setItem("token", data.token);
  return data;
}

async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  localStorage.setItem("token", data.token);
  return data;
}
```

## 6. Where to paste your current HTML/CSS/JS

- Keep your existing UI files where they are.
- In your current JS, replace in-memory arrays with the `fetch()` functions above.
- Keep your design unchanged, only update the data layer.
- Point all requests to `http://localhost:4000/api/...`.

If your front-end runs on another port (for example Live Server), CORS is already enabled by `FRONTEND_ORIGIN` in `.env`.

## 7. Notes

- Data is persistent because SQLite writes to `backend/data/app.db`.
- Each user sees only their own items due to JWT + `user_id` filtering in SQL.
- If you share your current HTML file next, I will map these exact functions to your existing buttons/forms without redesigning your UI.
