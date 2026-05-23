# RPL Database — Setup Guide

## What this does
- After each Roblox game ends, averages are automatically pushed to your Vercel site
- The website polls for new data every 30 seconds (live updates without refresh)
- Admin panel on the site resets all stats with your password

---

## Step 1 — Vercel KV (free database)

1. Go to https://vercel.com/dashboard
2. Open your **rpldatabase** project
3. Click **Storage** tab → **Create Database** → **KV**
4. Name it anything (e.g. `rpl-kv`) → Create
5. Vercel automatically adds the environment variables. Done.

---

## Step 2 — Add environment variables in Vercel

In your Vercel project → **Settings** → **Environment Variables**, add:

| Name | Value |
|------|-------|
| `ROBLOX_SECRET` | Any long random string, e.g. `RPL_roblox_k3y_2025_xQ9m` |
| `ADMIN_PASS` | `RPLHRPASS$` |

Click **Save** on each. Then **Redeploy** your project (Deployments → the latest → Redeploy).

---

## Step 3 — Push the site to GitHub

In Terminal (from wherever your repo is):

```bash
# If you haven't cloned your repo yet:
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO

# Copy these files into your repo:
# - public/index.html  → replace your existing index.html
# - api/averages.js    → new file
# - api/update.js      → new file
# - api/reset.js       → new file
# - vercel.json        → replace/add
# - package.json       → replace/add

git add .
git commit -m "Add live stats API + admin panel"
git push
```

Vercel will auto-deploy from GitHub.

---

## Step 4 — Roblox Studio setup

1. **Enable HTTP Requests**: Game Settings → Security → Allow HTTP Requests ✓

2. **Add the script**:
   - In ServerScriptService, create a new **Script**
   - Name it `[Stats] WebReporter`
   - Paste the contents of `ROBLOX_WebReporter.lua`

3. **Set your secret** in the script (line 25):
   ```lua
   local ROBLOX_SECRET = "RPL_roblox_k3y_2025_xQ9m"
   ```
   *(Must exactly match the `ROBLOX_SECRET` you set in Vercel)*

4. **Publish** your game.

---

## How it works

```
Game ends (Quarter → "---")
    ↓
[Stats] Averages module commits game stats (already exists)
    ↓  (3 second wait)
[Stats] WebReporter loops through all players
    ↓
HTTP POST → https://rpldatabase.vercel.app/api/update
    ↓
Vercel KV stores the data
    ↓
Website auto-fetches every 30s → displays updated leaderboards
```

## Admin reset

1. Go to https://rpldatabase.vercel.app
2. Click **Admin** (top right)
3. Enter password: `RPLHRPASS$`
4. Click **Reset All Stats**

This deletes all player records from the database. The Roblox DataStore averages are **not** affected — use the in-game `.resetallavg` command (from your existing script) to wipe those too.

---

## File structure

```
your-repo/
├── public/
│   └── index.html          ← main site
├── api/
│   ├── averages.js         ← GET all players
│   ├── update.js           ← POST from Roblox
│   └── reset.js            ← POST admin reset
├── vercel.json
├── package.json
└── ROBLOX_WebReporter.lua  ← paste into Studio (not deployed)
```
