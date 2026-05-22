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

Edits are saved to **localStorage** in the browser (per device).

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
