# Team 4201 Scouting System (2026)

This repo uses a config-first data analysis pipeline for fake data generation, Docker export, and picklist payload builds.

## Quick Start

1. Install dependencies:

```powershell
git clone https://github.com/4201VitruvianBots/ScoutingApp2026.git
cd ScoutingApp2026
npm install
npm run build --workspace database
```

2. Create a Python environment for data-analysis:

```powershell
cd data-analysis
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ..
```

3. Start server:

```powershell
npm run start
```

Server URL: `http://localhost:8080`

## Data Pipeline Overview

Core pipeline scripts:

- `data-analysis/generate_fake_data.py`
- `data-analysis/01_extract_source.py`
- `data-analysis/02_clean_normalize.py`
- `data-analysis/03_feature_engineering.py`
- `data-analysis/04_team_aggregation.py`
- `data-analysis/05_picklist_scores.py`
- `data-analysis/06_export_app_payloads.py`
- `data-analysis/run_analysis_full.py`

Compatibility shims (kept for old commands):

- `data-analysis/run_fake_local_full.py`
- `data-analysis/run_docker_full.py`

## Config Files

Pipeline config lives in:

- `app_settings/settings.json`
- `app_settings/match_schedule.json`
- `app_settings/teams_list.txt`

### `settings.json` keys

```json
{
  "paths": {
    "raw_runs_root": "data-analysis/raw_runs",
    "analysis_runs_root": "data-analysis/analysis_runs",
    "raw_run_folder": "",
    "analysis_run_folder": "",
    "raw_run_base_name": "test_1",
    "analysis_run_base_name": "test_1"
  },
  "fake_data": {
    "destination": "local_csv",
    "match_source_mode": "schedule",
    "random_match_count": 72,
    "include_pit": true,
    "scouter_count": 12
  },
  "analysis": {
    "raw_source_mode": "existing_raw",
    "timeline_bin_sec": 1
  }
}
```

### How to choose fake data location

- Fake local CSV destination is controlled by:
  - `fake_data.destination = "local_csv"`
  - `paths.raw_runs_root` (root output location)
- Fake Docker destination is controlled by:
  - `fake_data.destination = "docker_db"`
  - `mongo.*` settings for connection/collections

### How to customize fake generation

- Match source:
  - `fake_data.match_source_mode = "schedule"` uses `match_schedule.json`
  - `fake_data.match_source_mode = "random_from_teams"` uses `teams_list.txt` + `random_match_count`
- Other controls:
  - `fake_data.include_pit`
  - `fake_data.scouter_count`

### How run selection works (config-first)

Selection precedence for all scripts:

1. CLI override
2. Settings-selected folder
3. `latest_run.json` pointer

Settings-selected keys:

- Raw run default: `paths.raw_run_folder`
- Analysis run default: `paths.analysis_run_folder`

## Run Folder Naming

Raw and analysis run folder names are compact:

- `<YYMMDD-HHMM>_<base_name_slug>`
- collisions append suffix: `_01`, `_02`, ...

Examples:

- `260406-0915_test_1`
- `260406-0915_test_1_01`

Base names come from:

- Raw: `paths.raw_run_base_name`
- Analysis: `paths.analysis_run_base_name`

## Typical Workflows

### 1) Generate fake raw data to local raw folder

Set:

- `fake_data.destination = "local_csv"`

Run:

```powershell
python data-analysis/generate_fake_data.py
```

Result:

- New raw run folder under `paths.raw_runs_root`
- Writes `01_match_raw.csv`, `01_pit_raw.csv`, source snapshots
- Updates `raw_runs_root/latest_run.json`

### 2) Generate fake data into Docker DB

Set:

- `fake_data.destination = "docker_db"`

Run:

```powershell
python data-analysis/generate_fake_data.py
```

Result:

- Seeds configured Mongo collections
- Writes Docker seed report in `paths.raw_runs_root`

### 3) Export raw source from Docker into raw run folder

Run:

```powershell
python data-analysis/01_extract_source.py
```

Optional raw run base name override:

```powershell
python data-analysis/01_extract_source.py --run-base-name comp2_raw
```

### 4) Analyze an existing raw dataset

Set `paths.raw_run_folder` to a raw run folder name (or abs path), then run stage 02:

```powershell
python data-analysis/02_clean_normalize.py
```

Or override directly:

```powershell
python data-analysis/02_clean_normalize.py --raw-run 260406-0915_test_1
```

### 5) Run analysis stages individually (`03`-`06`)

Set `paths.analysis_run_folder` to the target analysis run, then run:

```powershell
python data-analysis/03_feature_engineering.py
python data-analysis/04_team_aggregation.py
python data-analysis/05_picklist_scores.py
python data-analysis/06_export_app_payloads.py
```

Or pass `--analysis-run` per command.

### 6) Run full pipeline with one command

```powershell
python data-analysis/run_analysis_full.py
```

Behavior:

1. Reads `analysis.raw_source_mode`
2. If `docker_export`, runs stage `01` first
3. Runs `02`
4. Pins `03`-`06` to the same analysis run folder created by `02`

Overrides:

```powershell
python data-analysis/run_analysis_full.py --raw-source-mode existing_raw --raw-run 260406-0915_test_1
python data-analysis/run_analysis_full.py --raw-source-mode docker_export --raw-run-base-name event_a_raw
```

## Stage Inputs and Outputs

### Stage `01_extract_source.py`

- Input: Mongo collections
- Output raw folder:
  - `01_match_raw.csv`
  - `01_pit_raw.csv`
  - `01_raw_snapshot.json`

### Stage `02_clean_normalize.py`

- Input: raw folder (`01_*`)
- Output analysis folder:
  - `02_match_clean.csv`
  - `02_pit_clean.csv`
  - `02_validation_report.csv`
  - `02_stage_summary.json`

### Stage `03_feature_engineering.py`

- Input: `02_*`
- Output:
  - `03_match_features.csv`
  - `03_timeseries_long.csv`
  - `03_auto_path_points.csv`

### Stage `04_team_aggregation.py`

- Input: `03_match_features.csv`, `02_pit_clean.csv`
- Output:
  - `04_team_aggregates.csv`
  - `04_defense_events.csv`

### Stage `05_picklist_scores.py`

- Input: `04_team_aggregates.csv`
- Output:
  - `05_picklist_scores.csv`
  - `05_metric_contributions.csv`

### Stage `06_export_app_payloads.py`

- Input: stage `03`-`05` outputs
- Output:
  - `06_picklist_payload.json`
  - `06_team_profiles.json`

Server `/data/retrieve/analyzed` resolves latest analysis run from `analysis_runs_root/latest_run.json`.

## NPM Shortcuts

```powershell
npm run analysis:generate-fake
npm run analysis:extract-source
npm run analysis:02
npm run analysis:03
npm run analysis:04
npm run analysis:05
npm run analysis:06
npm run analysis:full
npm run analysis:full:fake-local
npm run analysis:full:docker
```

## Notes on Deprecated Wrappers

- `run_fake_local_full.py` and `run_docker_full.py` are retained as compatibility shims.
- Canonical full-run entrypoint is `run_analysis_full.py`.
