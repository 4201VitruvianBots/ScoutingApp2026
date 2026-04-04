# Team 4201 Scouting System (2026)

This repository now uses a **config-driven** data workflow with both:

- manual stage scripts (`generate_fake_data.py`, `01`-`06`)
- optional convenience full-run wrappers

- Each stage can be run manually, one script at a time.
- Fake-data generation and analysis behavior are controlled by `app_settings`.

## Quick Start

### 1. Install dependencies

```powershell
git clone https://github.com/4201VitruvianBots/ScoutingApp2026.git
cd ScoutingApp2026
npm install
npm run build --workspace database
```

Python environment:

```powershell
cd data-analysis
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ..
```

### 2. Start app server

```powershell
npm run start
```

Expected server base URL: `http://localhost:8080`.

## `app_settings` Architecture

All generation/analysis controls live under:

- `app_settings/settings.json`
- `app_settings/match_schedule.json`
- `app_settings/teams_list.txt`

### `settings.json`

Required sections:

- `paths`
  - `raw_runs_root`: root folder for raw run outputs
  - `analysis_runs_root`: root folder for analysis run outputs
  - `raw_run_folder` (optional): default raw run folder name/path for stage `02` and `run_fake_local_full.py`
  - `raw_run_base_name`: base suffix used for fake local raw runs
  - `analysis_run_base_name`: base suffix used for analysis runs
- `mongo`
  - `mongo_url`, `db`
  - `match_collection`, `pit_collection`, `balls_per_second_collection`
  - `clear_before_seed`
- `fake_data`
  - `destination`: `local_csv` or `docker_db`
  - `match_source_mode`: `schedule` or `random_from_teams`
  - `random_match_count` (used only in random mode)
  - `include_pit`, `scouter_count`
- `analysis`
  - `timeline_bin_sec`
  - `normalization`
  - `score_scale` (`center`, `spread`, `min`, `max`)
  - `component_weights`
  - `defense_shrinkage_k`

### `match_schedule.json`

Canonical competition schedule keyed by match number:

```json
{
  "1": { "red_1": 1234, "red_2": 5678, "red_3": 9012, "blue_1": 3456, "blue_2": 7890, "blue_3": 2468 }
}
```

Used by:

- fake generation in schedule mode
- analysis context mapping (allies/opponents/alliance)
- server config endpoint for match/admin views

### `teams_list.txt`

One team number per line (unordered). Used when fake generation is in `random_from_teams` mode and by server team list endpoint.

## Manual Data Workflow

### A) Generate fake raw data

Primary script:

```powershell
python data-analysis/generate_fake_data.py
```

Behavior depends on `settings.json`:

- `fake_data.destination = local_csv`
  - creates a **new raw run folder** every run under `paths.raw_runs_root`
  - folder name includes timestamp and configured base name
  - writes:
    - `01_match_raw.csv`
    - `01_pit_raw.csv`
    - `fake_match_source.json`
    - `fake_pit_source.json`
    - `01_raw_snapshot.json`
  - updates `raw_runs_root/latest_run.json`
- `fake_data.destination = docker_db`
  - seeds configured Mongo collections
  - respects `mongo.clear_before_seed`
  - writes a timestamped seed report in raw runs root

Match generation mode:

- `match_source_mode = schedule`: uses `match_schedule.json` exactly
- `match_source_mode = random_from_teams`: builds matches from `teams_list.txt` using `random_match_count`

### B) Extract real source data from Docker DB

```powershell
python data-analysis/01_extract_source.py comp_2
```

Creates a new raw run directory under `paths.raw_runs_root`:

`YYYY-MM-DD_HH-mm-ss_comp_2_docker_source`

Writes:

- `01_match_raw.csv`
- `01_pit_raw.csv`
- `01_raw_snapshot.json`

Updates: `raw_runs_root/latest_run.json`.

### C) Run analysis stages manually (`02` -> `06`)

#### Stage 02 (starts a new analysis run folder)

```powershell
python data-analysis/02_clean_normalize.py
```

Defaults:

- raw source: `paths.raw_run_folder` when set, otherwise latest raw run pointer
- creates a **new analysis run folder** under `paths.analysis_runs_root`
- folder name uses timestamp + `analysis_run_base_name`

Optional source override:

```powershell
python data-analysis/02_clean_normalize.py --raw-run <raw_run_folder_name_or_abs_path>
```

#### Stage 03

```powershell
python data-analysis/03_feature_engineering.py
```

Optional run override:

```powershell
python data-analysis/03_feature_engineering.py --analysis-run <analysis_run_folder_name_or_abs_path>
```

#### Stage 04

```powershell
python data-analysis/04_team_aggregation.py
```

#### Stage 05

```powershell
python data-analysis/05_picklist_scores.py
```

#### Stage 06

```powershell
python data-analysis/06_export_app_payloads.py
```

Stages `03`-`06` default to the latest analysis pointer unless `--analysis-run` is provided.

### D) Optional full-run wrappers

Run full analysis (`02` -> `06`) against an existing raw run:

```powershell
python data-analysis/run_fake_local_full.py
```

Optional raw source override:

```powershell
python data-analysis/run_fake_local_full.py --raw-run <raw_run_folder_name_or_abs_path>
```

Notes:

- does not generate fake data
- uses `--raw-run` when provided
- otherwise uses `paths.raw_run_folder` when set, then falls back to `raw_runs_root/latest_run.json`
- pins `03`-`06` to the same analysis run created by stage `02`

Run full analysis sourced from Docker Mongo:

```powershell
python data-analysis/run_docker_full.py comp_2
```

Notes:

- runs `01_extract_source.py comp_2` then `02` -> `06`
- extracted folder naming follows `YYYY-MM-DD_HH-mm-ss_comp_2_docker_source`

## Run Folder Layout and Naming

### Raw runs

Root from `settings.paths.raw_runs_root`.

- fake local example: `2026-04-03_18-30-22_schedule_raw_fake_data`
- docker extraction example: `2026-04-03_18-30-22_comp_2_docker_source`

Pointer file:

- `raw_runs_root/latest_run.json`

### Analysis runs

Root from `settings.paths.analysis_runs_root`.

Example:

- `2026-04-03_18-36-09_comp_2_analysis_output`

Pointer file:

- `analysis_runs_root/latest_run.json`

## Stage Outputs

Inside each analysis run folder:

- `02_match_clean.csv`
- `02_pit_clean.csv`
- `03_match_features.csv`
- `03_timeseries_long.csv`
- `03_auto_path_points.csv`
- `04_team_aggregates.csv`
- `04_defense_events.csv`
- `05_picklist_scores.csv`
- `05_metric_contributions.csv`
- `06_picklist_payload.json`
- `06_team_profiles.json`

Server endpoint `/data/retrieve/analyzed` now serves:

- latest analysis run `06_picklist_payload.json` resolved via pointer
- by default, this is pointer-first in all environments
- set `PICKLIST_ANALYZED_SOURCE=csv` (or `local`/`output`) to force CSV rebuild mode before serving

## Defense Metric (Stage 04)

Implemented as a residual-based, confidence-shrunk model:

1. Per-team expected offense per match from prior-match EMA.
2. Residual:
   - `residual = actual - expected`
3. Opponent suppression on a match:
   - `opp_suppression = mean(expected_opponent - actual_opponent)`
4. Ally context drift:
   - `ally_drift = mean(ally_residuals)`
5. Defensive impact for a match:
   - `impact_match = intensity(defenseProvided) * (opp_suppression + 0.25 * ally_drift)`
   - intensity mapping: `None=0.0`, `some=0.55`, `heavy=1.0`
6. Team raw impact:
   - mean over defensive matches
7. Confidence shrinkage:
   - `confidence = n_def_matches / (n_def_matches + k)`
   - `k = analysis.defense_shrinkage_k`
8. Final effectiveness:
   - `defenseEffectiveness = rawImpact * confidence`

`defensePlayEstimate` blends declared defense frequency with suppression signal.

## Picklist, Team Profile, Timeline, Auto Heatmaps

### Picklist scoring (Stage 05)

Config-driven weighted components:

- offense
- auto
- consistency
- reliability
- defense
- trend

Exports transparent per-metric contributions in `05_metric_contributions.csv`.

### Team profile payload (Stage 06)

Includes:

- major metrics
- role tendencies
- defense summary
- match history rows
- timeline bins + timeline rows
- auto paths with alliance metadata

### Timeline metrics menu (`PicklistApp`)

Supports:

- metric selection
- alliance filter: `all`, `red`, `blue`
- line view plus cross-match heatmap density

### Auto-path heatmap (`PicklistApp`)

Supports:

- alliance filter: `all`, `red`, `blue`
- high-resolution density overlay
- shot-marker overlay

## Server Config Endpoints

Provided by server:

- `GET /config/match-schedule`
- `GET /config/teams-list`

Consumers:

- Match app schedule load
- Admin app schedule load
- Team dropdown options

## Updating Canonical Schedule and Team List

Scripts:

```powershell
npm run --workspace server download-schedule
npm run --workspace server download-teams
```

These write directly to `app_settings/match_schedule.json` and `app_settings/teams_list.txt`.

## NPM Script Shortcuts

Manual-stage helper scripts at repo root:

- `npm run analysis:generate-fake`
- `npm run analysis:extract-source -- comp_2`
- `npm run analysis:02`
- `npm run analysis:03`
- `npm run analysis:04`
- `npm run analysis:05`
- `npm run analysis:06`
- `npm run analysis:full:fake-local`
- `npm run analysis:full:docker -- comp_2`

## Assumptions and Limits

- No hidden/implicit pipeline is used; full-run wrappers simply execute the same stage scripts sequentially.
- Timeline heatmap is based on timeline activity intervals over time, not teleop XY field coordinates.
- Fake-data fallback payload inside client is secondary; analyzed payload from stage outputs is primary.
