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

## 7) Data Migration + Analysis Pipeline (Unified 01..07)

This workflow is now config-driven and runs through ordered scripts with CSV handoff:

1. `01_extract_source.py`
2. `02_clean_normalize.py`
3. `03_feature_engineering.py`
4. `04_team_aggregation.py`
5. `05_picklist_scores.py`
6. `06_export_app_payloads.py`
7. `07_seed_fake_data.py` (optional, controlled by config/flags)

### 7.1 One-time schema migration (recommended before first 2026 event run)

From repo root:

```powershell
npm run --workspace server migrate-match-schema
```

Migration report output:

- `server/static/match-schema-migration-report.json`

### 7.2 Python setup (once per machine)

```powershell
cd ScoutingApp2026\data-analysis
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 7.3 Configure pipeline behavior

Edit:

- `data-analysis/pipeline_config.json`

Main knobs:

- `source.mode`: `mongo` or `fake`
- `source.mongo_url` / `source.db`
- `paths.output_dir`
- `analysis.metrics` (enabled flags, weights, direction)
- `analysis.timeline_bin_sec`
- `fake_data.*` (including `run_stage_07` and `seed_mongo`)

### 7.4 Run full pipeline (real Mongo data)

Keep server running in terminal #1:

```powershell
npm run start
```

Then in terminal #2:

```powershell
cd ScoutingApp2026\data-analysis
.\venv\Scripts\Activate.ps1
python run_pipeline.py --source-mode mongo
```

### 7.5 Run full pipeline (fake source, with fake generation stage)

```powershell
cd ScoutingApp2026\data-analysis
.\venv\Scripts\Activate.ps1
python run_pipeline.py --source-mode fake --run-stage-07
```

Optional: seed Mongo during stage 07:

```powershell
python run_pipeline.py --source-mode fake --run-stage-07 --seed-mongo
```

### 7.6 Pipeline outputs

All outputs are written to `data-analysis/output` (or `paths.output_dir`):

- `00_pipeline_report.json`
- `01_match_raw.csv`, `01_pit_raw.csv`, `01_raw_snapshot.json`
- `02_match_clean.csv`, `02_pit_clean.csv`, `02_validation_report.csv`
- `03_match_features.csv`, `03_timeseries_long.csv`, `03_auto_path_points.csv`
- `04_team_aggregates.csv`
- `05_picklist_scores.csv`, `05_metric_contributions.csv`
- `06_picklist_payload.json`, `06_team_profiles.json`
- `07_seed_report.json` (only when stage 07 runs)

Picklist app reads analyzed payload from:

- `data-analysis/output/06_picklist_payload.json`
- API route: `GET /data/retrieve/analyzed`

### 7.7 Legacy command compatibility

`python export_csv.py` now forwards to `run_pipeline.py` and uses the same config/flags.

## 8) Fake Data Options

### 8.1 Pipeline-native fake data (recommended)

Use stage 07 directly:

```powershell
cd data-analysis
.\venv\Scripts\Activate.ps1
python 07_seed_fake_data.py
```

Or via orchestrator:

```powershell
python run_pipeline.py --source-mode fake --run-stage-07
```

### 8.2 Legacy server fake scripts (optional / dev-only)

These still exist for server-side testing:

```powershell
npm run --workspace server gen-fake-data
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

Requires either:

- `data-analysis/output/06_team_profiles.json` (preferred; generated by pipeline stage 06), or
- `server/static/output_analysis.json` (legacy fallback).

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

# Migration
npm run --workspace server migrate-match-schema

# Analysis pipeline (real data)
cd data-analysis
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run_pipeline.py --source-mode mongo

# Fake data (pipeline-native)
python run_pipeline.py --source-mode fake --run-stage-07

# Legacy fake data scripts (optional)
cd ..
npm run --workspace server gen-fake-data

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
