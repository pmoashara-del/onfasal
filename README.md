# 0–48 Hour Planning — Fasal Indore Ashara 1448H

A static, Excel-style web workbook for department planning after Fasal. No server required.

## Quick start

Open `index.html` in a browser, or serve locally:

```bash
python3 -m http.server 8080
# Visit http://localhost:8080
```

## Access

The app opens in **viewer mode** by default (read-only). Admins click **Sign in as admin** in the toolbar.

| Role | How | Permissions |
|------|-----|-------------|
| **Viewer** | Default on open | View all sheets, export Excel |
| **Admin** | Toolbar → Sign in as admin (`admin` / `ashara1448`) | Edit cells, add rows, save, reset |

Admin edits are saved automatically to **localStorage** in this browser (auto-save ~400ms after typing, on tab change, exit admin, and when closing the tab). Viewers always see the latest saved data on refresh.

**Note:** Data stays on this device/browser only — not synced to a server. Clearing site data or using another browser will not show your edits.

## Features

- Excel-like grid with department tabs (24 departments)
- Sticky headers, row numbers, priority highlighting
- **Export Excel (this sheet)** — current department as `.xlsx`
- **Export Excel (all sheets)** — one workbook with every department on its own tab
- Reset options (admin only)

## Structure

```
index.html      # App shell
css/styles.css  # Excel-inspired UI
js/data.js      # Seed planning data
js/app.js       # Auth, rendering, persistence
```
