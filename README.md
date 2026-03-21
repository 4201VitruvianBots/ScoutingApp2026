# Team 4201 Scouting System (2026)

This README is now the simple two-mode operator runbook.

## One-Time Setup

```powershell
git clone https://github.com/4201VitruvianBots/ScoutingApp2026.git
cd ScoutingApp2026
npm install
npm run build --workspace database
```

Root `.env`:

```env
CONTAINER_NAME=cala-quals
IMAGE_NAME=scouting-database:latest
```

Python setup:

```powershell
cd data-analysis
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ..
```

Optional one-time schema migration:

```powershell
npm run --workspace server migrate-match-schema
```

## Start Server (Required For Both Modes)

```powershell
npm run start
```

Expected:

- `Server running at http://localhost:8080`

## Option A: Real Mode

Use this when data comes from real scouting submissions (tablets) or imported real logs.

1. Ensure server is running (`npm run start`).
2. Collect data normally from tablets, or import logs (see "Import Real Logs Without Tablets").
3. Run analysis from Mongo:

```powershell
npm run analysis:real
```

Outputs:

- `data-analysis/output/06_picklist_payload.json`
- `data-analysis/output/06_team_profiles.json`
- Full stage outputs in `data-analysis/output`

## Option B: Fake Mode

Use this for testing. This mode:

1. Generates fake logs.
2. Clears and reseeds Mongo (`match`, `pit`, and `balls-per-second` collections).
3. Runs the same analysis flow from Mongo as Real Mode.

```powershell
npm run analysis:fake
```

Optional fake-size overrides:

```powershell
python data-analysis/run_fake_mode.py --match-count 90 --team-count 45 --scouter-count 16
```

## Import Real Logs Without Tablets

Use this to push real logs to Mongo through the same HTTP endpoints tablets use.

Server must be running first (`npm run start`).

### Canonical import bundle format

```json
{
  "ballsPerSecondSettings": [
    { "matchNumber": 1, "robotTeam": 1234, "ballsPerSecond": 5.7 }
  ],
  "matchLogs": [],
  "pitLogs": []
}
```

### Import command

```powershell
npm run import:logs -- .\path\to\bundle.json
```

Optional positional report path:

```powershell
npm run import:logs -- .\bundle.json .\import_report.json
```

Advanced flags (direct script call):

```powershell
npx tsx server/scripts/importLogs.ts --file .\bundle.json --server-url http://localhost:8080 --dry-run --fail-fast --report .\import_report.json
```

After import, run:

```powershell
npm run analysis:real
```

## Troubleshooting

### Docker / Mongo does not start

```powershell
npm run build --workspace database
npm run start
```

Make sure Docker Desktop is running.

### Import script returns request errors

- Confirm server is running on `http://localhost:8080`.
- Confirm bundle shape matches canonical format.
- Run dry-run first:

```powershell
npx tsx server/scripts/importLogs.ts --file .\bundle.json --dry-run --report .\import_report.json
```

### Analysis script cannot connect to Mongo

- Ensure server is running (`npm run start`).
- If needed, override Mongo settings:

```powershell
python data-analysis/run_real_mode.py --mongo-url mongodb://localhost:27017/ --db test
```

## Appendix: Advanced Internals

Advanced pipeline internals are still available:

- `data-analysis/run_pipeline.py`
- `data-analysis/pipeline_config.json`
- `data-analysis/export_csv.py` (compatibility wrapper)

Core stage order:

1. `01_extract_source.py`
2. `02_clean_normalize.py`
3. `03_feature_engineering.py`
4. `04_team_aggregation.py`
5. `05_picklist_scores.py`
6. `06_export_app_payloads.py`
7. `07_seed_fake_data.py` (optional)

mongosh "mongodb://localhost:27017/test" --eval "db.matchapps.deleteMany({}); db.pitapps.deleteMany({}); db.ballspersecondapps.deleteMany({}); db.leaderboardapps.deleteMany({});"

mongosh "mongodb://localhost:27017/test" --eval "print('match',db.matchapps.countDocuments()); print('pit',db.pitapps.countDocuments()); print('bps',db.ballspersecondapps.countDocuments()); print('leaderboard',db.leaderboardapps.countDocuments());"
