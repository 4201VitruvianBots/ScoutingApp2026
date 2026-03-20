# Team 4201 Scouting System (2026)

[![Build all components](https://github.com/4201VitruvianBots/ScoutingApp2026/actions/workflows/build.yml/badge.svg)](https://github.com/4201VitruvianBots/ScoutingApp2026/actions/workflows/build.yml)
[![Format with Prettier](https://github.com/4201VitruvianBots/ScoutingApp2026/actions/workflows/format.yml/badge.svg)](https://github.com/4201VitruvianBots/ScoutingApp2026/actions/workflows/format.yml)

This README is an operations runbook for setup, competition use, tablets, data export/analysis, fake data generation, and development.

## 1) What This System Runs

- `client` (React + Vite + PWA): scouting tablet UI and analysis UIs
- `server` (Node + Express + TypeScript): API, status sockets, static hosting
- `database` (Docker-managed MongoDB image): local MongoDB container startup/build helpers
- `data-analysis` (Python): exports Mongo collections into CSV/JSON analysis outputs

## 2) Required Software

Install these on the scouting laptop before anything else:

1. Git
2. Node.js 20+ (recommended: latest LTS)
3. npm (comes with Node)
4. Docker Desktop (must be running before starting server)
5. Visual Studio Code (recommended)
6. Python 3.10+ (for data-analysis scripts)
7. Google Chrome on tablets

Optional but useful:

1. MongoDB Compass (inspect local DB at `mongodb://localhost:27017`)
2. nvm / nvm-windows (manage Node versions)

Note on MongoDB: this project runs MongoDB in Docker. You do not need a separate MongoDB server install to run scouting.

## 3) Network and Hardware Requirements (Competition)

- Scouting laptop static IP: `192.168.1.200`
- Tablets connect via ethernet adapters to the tote network
- Laptop and tablets must be on the same local subnet (255.255.255.0 is fine I think)

## 4) One-Time Project Setup (Fresh Machine)

Run this once per laptop.

### 4.1 Clone and install

```powershell
git clone https://github.com/4201VitruvianBots/ScoutingApp2026.git
cd ScoutingApp2026
npm install
```

### 4.2 Configure `.env`

Repository root has `.env` used by Docker helper scripts.

Current required values:

```env
CONTAINER_NAME=cala-quals
IMAGE_NAME=scouting-database:latest
```

If you need event/TBA scripts or remote sync, add these in `.env.local` (root):

```env
API_KEY=your_tba_api_key
EVENT_KEY=2026xxxx
NGROK_TOKEN=your_ngrok_token
REMOTE_SERVER_URL=https://your-remote-server
MONGO_URL=mongodb://0.0.0.0:27017/
```

### 4.3 Build database image (required before first start)

From repo root:

```powershell
npm run build --workspace database
```

## 5) Competition Startup Procedure (Initial Scouting Setup)

Use this at events.

### 5.1 Start Docker Desktop

- Open Docker Desktop and wait until it reports running.

### 5.2 Start scouting server stack

From repo root:

```powershell
npm run start
```

Expected success line:

- `Server running at http://localhost:8080`

This basically:
- Starts/creates MongoDB Docker container named `cala-quals` or whatever
- Starts Node server on port `8080`
- Serves built client from `client/dist`

### 5.3 Stop safely when done

In the same terminal, press `Ctrl + C` once.

The app handles shutdown and stops the Mongo container cleanly.

## 6) Tablet Procedure (Load App, Scout Offline, Re-Send Queue)

### 6.1 Load app on each tablet

1. Connect tablet ethernet adapter into scouting network.
2. Open Chrome on tablet.
3. Go to `http://192.168.1.200:8080`.
4. Open desired app (Match / Pit / etc.).
5. Keep page loaded; tablet can continue scouting even if briefly disconnected.

### 6.2 During scouting (offline behavior)

- Submissions are queued locally on the tablet when network is unavailable.
- Queue count appears in UI (`Queue: N`).

### 6.3 Upload queued data from tablet back to laptop

1. Reconnect tablet to scouting network.
2. Open scouting app page again.
3. Scroll to bottom and press yellow `Resend All` button.
4. Confirm queue returns to `0`.

Repeat for every tablet.

## 7) Data Export and Analysis Procedure

Use this when you need CSV/JSON outputs for strategy and picklist work.

### 7.1 Keep backend running

In terminal #1 (repo root):

```powershell
npm run start
```

### 7.2 Run analysis script

In terminal #2:

```powershell
cd ScoutingApp2026\data-analysis
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python export_csv.py
```

### 7.3 Output locations

Primary outputs go to:

- `data-analysis/output`

Legacy CSV outputs are also written to:

- `data-analysis/match_raw_2026.csv`
- `data-analysis/super_raw_2026.csv`
- `data-analysis/pit_2026.csv`
- `data-analysis/team_agg_2026.csv`
- `data-analysis/metric_summary_2026.csv`

### 7.4 Optional analysis flags

```powershell
python export_csv.py --mongo-url mongodb://localhost:27017/ --db test --output-dir .\output
```

## 8) Generate Fake Data (for Testing Picklist/Recon)

There are two fake-data paths.

### 8.1 Database fake scouting data (recommended)

Populates Mongo collections with synthetic match/pit/leaderboard entries.

From repo root:

```powershell
npm run --workspace server gen-fake-data
```

Optional environment overrides (PowerShell examples):

```powershell
$env:FAKE_MATCH_COUNT='80'
$env:FAKE_TEAM_COUNT='40'
$env:FAKE_SCOUTER_COUNT='16'
$env:FAKE_CLEAR='true'
$env:FAKE_INCLUDE_PIT='true'
$env:FAKE_INCLUDE_LEADERBOARD='true'
$env:FAKE_INCLUDE_AUTO_PATH='true'
npm run --workspace server gen-fake-data
```

### 8.2 Static analysis JSON file

Writes `server/static/output_analysis.json`.

From repo root:

```powershell
npm run --workspace server gen-fake-json
```

## 9) Development Procedures (Non-Competition)

Do not use dev mode for live event scouting.

### 9.1 Run both client and server (preferred dev workflow)

From repo root:

```powershell
npm run dev
```

- Vite client: `http://localhost:5173`
- Server API: `http://localhost:8081`
- In dev mode, server proxies frontend requests to Vite.

### 9.2 Run only one side

Client only:

```powershell
npm run dev --workspace client
```

Server only:

```powershell
npm run dev --workspace server
```

### 9.3 Build all workspaces

```powershell
npm run build
```

### 9.4 Lint/format

```powershell
npm run lint:check
npm run format:check
```

## 10) Event Data Utilities (TBA + Team Metadata)

These require `.env.local` with `API_KEY` and `EVENT_KEY`.

Run from repo root.

### 10.1 Download event team list

```powershell
npm run --workspace server download-teams
```

Writes: `client/src/assets/teams.txt`

### 10.2 Download event match schedule

```powershell
npm run --workspace server download-schedule
```

Writes: `client/src/assets/matchSchedule.json`

### 10.3 Generate team metadata/colors/avatars

Requires `server/static/output_analysis.json` (generate with `gen-fake-json` or provide your own).

```powershell
npm run --workspace server gen-team-info
```

Writes: `server/static/team_info.json`

## 11) Backup Procedure

From repo root:

```powershell
npm run --workspace server backup
```

Writes: `server/static/backup.json`

## 12) Remote/Ngrok Modes

### 12.1 Start production-style server with ngrok

Requires `NGROK_TOKEN`.

```powershell
npm run start:remote
```

### 12.2 Start dev mode with remote flag

```powershell
npm run dev:remote
```

## 13) Quick Command Index

```powershell
# First-time
npm install
npm run build --workspace database

# Competition run
npm run start

# Dev run
npm run dev

# Analysis
cd data-analysis
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python export_csv.py

# Fake data
cd ..
npm run --workspace server gen-fake-data
npm run --workspace server gen-fake-json

# Event utilities
npm run --workspace server download-teams
npm run --workspace server download-schedule
npm run --workspace server gen-team-info

# Backup
npm run --workspace server backup
```

## 14) Troubleshooting

### Docker errors on startup

- Ensure Docker Desktop is running.
- Rebuild DB image:

```powershell
npm run build --workspace database
```

### Tablets cannot load app

- Confirm laptop IP is `192.168.1.200`.
- Confirm server is running on laptop (`npm run start`).
- Verify tablet URL exactly `http://192.168.1.200:8080`.

### Analysis script cannot connect to Mongo

- Ensure backend is running (`npm run start`) or Mongo container is up.
- Check mongo URL (`mongodb://localhost:27017/`).

### `sendExport` script note

- `server/scripts/sendExport.ts` currently connects to `mongodb://0.0.0.0:27107/` (port typo vs `27017`). Update that file before relying on this script.
