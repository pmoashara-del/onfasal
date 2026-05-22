# Ashara Mubaraka 1448H — Post Fasal 48 Hour Checklist

Static web app for post-Fasal implementation tracking (Indore Ashara 1448H).

## Pages

| Page | URL | Purpose |
|------|-----|---------|
| **Home** | `index.html` | Landing — choose Department or Zone view |
| **Department wise** | `department.html` | 24 department planning sheets (existing Excel data) |
| **Zone wise** | `zone.html` | Zone implementation checklist (22 items) |

## Logo

Place your official logo at `assets/ashara-logo.png` (used on the home page). If missing, the included `assets/ashara-logo.svg` is shown automatically.

## Quick start

```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

## Access

Opens in **viewer mode** by default. Admins use **Sign in as admin** (`admin` / `ashara1448`).

Data is saved separately per view in browser localStorage:
- Departments: `fasal-planning-v1`
- Zone checklist: `fasal-zone-checklist-v1`

## Features

- Excel-like grids with arrow keys, column selection, auto-save
- Department view: chairman/PC editable, export one or all sheets
- Zone view: full implementation checklist with zone, owner, status, remarks
