# 0–48 Hour Planning — Fasal Indore Ashara 1448H

A static, Excel-style web workbook for department planning after Fasal. No server required.

## Quick start

Open `index.html` in a browser, or serve locally:

```bash
python3 -m http.server 8080
# Visit http://localhost:8080
```

## Access

| Role | How | Permissions |
|------|-----|-------------|
| **Admin** | Username: `admin` / Password: `ashara1448` | Edit all cells, add rows, save, reset |
| **Viewer** | “Continue as viewer” on login | Read-only |

Edits are saved to **localStorage** in the browser (per device).

## Features

- Excel-like grid with department tabs (24 departments)
- Sticky headers, row numbers, priority highlighting
- Export current sheet to CSV
- Reset current department or all data to seed values

## Structure

```
index.html      # App shell
css/styles.css  # Excel-inspired UI
js/data.js      # Seed planning data
js/app.js       # Auth, rendering, persistence
```
