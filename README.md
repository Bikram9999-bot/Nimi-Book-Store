# NIMI Lucknow (Front-End Only)

This is a single‑page NIMI Lucknow app with:
- Login gate (password only)
- Catalog + cart + receipt
- Automatic stock sync
- Persistent sales history (localStorage)
- Stock editor

## Run locally

1. Open `bookstore_pos.html` in your browser.
2. Login with password `NIMI`.

## GitHub setup (step by step)

1. Open terminal in this folder:
```bash
cd "C:\Users\ss190\New folder"
```

2. Initialize git:
```bash
git init
```

3. Add files and commit:
```bash
git add .
git commit -m "Initial NIMI Lucknow"
```

4. Create a GitHub repo (on github.com) and copy its URL.

5. Connect and push:
```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

## Deploy with GitHub Pages

1. In GitHub repo settings:
   - Go to `Settings` → `Pages`
   - Source: `Deploy from a branch`
   - Branch: `main`, folder `/ (root)`
2. Save and wait for the public URL.
3. Open the Pages URL to use the POS.

## Deploy with Netlify or Vercel

1. Create a new site and connect your GitHub repo.
2. Build command: leave empty (static site).
3. Publish directory: `/` (root).
4. Deploy.

## Notes

- Data is stored in the browser’s `localStorage`.
- If you clear browser data, sales/stock history will reset.
