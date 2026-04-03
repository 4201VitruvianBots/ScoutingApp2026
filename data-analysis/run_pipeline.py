import argparse
import json
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from common import DEFAULT_CONFIG_PATH, ROOT, write_json

CORE_STAGES = [
    '01_extract_source.py',
    '02_clean_normalize.py',
    '03_feature_engineering.py',
    '04_team_aggregation.py',
    '05_picklist_scores.py',
    '06_export_app_payloads.py',
]
FAKE_STAGE = '07_seed_fake_data.py'
DATA_ANALYSIS_DIR = ROOT / 'data-analysis'


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Run analysis pipeline in order (01->06), with optional stage 07 fake-data stage.'
    )
    parser.add_argument(
        '--config',
        default=str(DEFAULT_CONFIG_PATH),
        help='Path to pipeline JSON config.',
    )
    parser.add_argument('--source-mode', choices=['mongo', 'fake', 'csv'])
    parser.add_argument('--mongo-url')
    parser.add_argument('--db')
    parser.add_argument('--output-dir')
    parser.add_argument('--fake-match-json')
    parser.add_argument('--fake-pit-json')
    parser.add_argument('--fake-match-csv')
    parser.add_argument('--fake-pit-csv')
    parser.add_argument('--run-stage-07', action='store_true')
    parser.add_argument('--skip-stage-07', action='store_true')
    parser.add_argument('--seed-mongo', action='store_true')
    parser.add_argument('--no-seed-mongo', action='store_true')
    parser.add_argument('--print-effective-config', action='store_true')
    return parser.parse_args()


def read_json(path: Path) -> Dict[str, Any]:
    with open(path, 'r', encoding='utf-8') as file:
        return json.load(file)


def resolve_repo_path(path_like: str) -> Path:
    path = Path(path_like)
    return path if path.is_absolute() else ROOT / path


def apply_overrides(config: Dict[str, Any], args: argparse.Namespace) -> bool:
    changed = False

    source = config.setdefault('source', {})
    paths = config.setdefault('paths', {})
    fake_data = config.setdefault('fake_data', {})

    if args.source_mode:
        source['mode'] = args.source_mode
        changed = True
    if args.mongo_url:
        source['mongo_url'] = args.mongo_url
        changed = True
    if args.db:
        source['db'] = args.db
        changed = True
    if args.output_dir:
        paths['output_dir'] = args.output_dir
        changed = True
    if args.fake_match_json:
        source['fake_match_json'] = args.fake_match_json
        changed = True
    if args.fake_pit_json:
        source['fake_pit_json'] = args.fake_pit_json
        changed = True
    if args.fake_match_csv:
        source['fake_match_csv'] = args.fake_match_csv
        changed = True
    if args.fake_pit_csv:
        source['fake_pit_csv'] = args.fake_pit_csv
        changed = True
    if args.seed_mongo:
        fake_data['seed_mongo'] = True
        changed = True
    if args.no_seed_mongo:
        fake_data['seed_mongo'] = False
        changed = True
    if args.run_stage_07:
        fake_data['run_stage_07'] = True
        changed = True
    if args.skip_stage_07:
        fake_data['run_stage_07'] = False
        changed = True

    return changed


def resolve_run_stage_07(
    config: Dict[str, Any],
    args: argparse.Namespace,
) -> bool:
    if args.run_stage_07 and args.skip_stage_07:
        raise ValueError('Cannot set both --run-stage-07 and --skip-stage-07.')
    if args.run_stage_07:
        return True
    if args.skip_stage_07:
        return False
    return bool(config.get('fake_data', {}).get('run_stage_07', False))


def build_effective_config(
    config_path: Path,
    args: argparse.Namespace,
) -> tuple[Dict[str, Any], Path | None]:
    config = read_json(config_path)
    changed = apply_overrides(config, args)
    if not changed:
        return config, None

    output_dir = resolve_repo_path(config.get('paths', {}).get('output_dir', 'data-analysis/output'))
    output_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.NamedTemporaryFile(
        mode='w',
        encoding='utf-8',
        suffix='.json',
        prefix='pipeline_effective_',
        dir=output_dir,
        delete=False,
    ) as temp_file:
        json.dump(config, temp_file, indent=2)
        temp_path = Path(temp_file.name)

    return config, temp_path


def run_stage(script_name: str, config_path: Path) -> None:
    stage_path = DATA_ANALYSIS_DIR / script_name
    command = [sys.executable, str(stage_path), '--config', str(config_path)]
    subprocess.run(command, check=True)


def main() -> None:
    args = parse_args()
    config_path = Path(args.config).resolve()
    if not config_path.exists():
        raise FileNotFoundError(f'Config path does not exist: {config_path}')

    config, temp_config_path = build_effective_config(config_path, args)
    effective_config_path = temp_config_path or config_path

    source_mode = str(config.get('source', {}).get('mode', 'mongo')).lower()
    run_stage_07 = resolve_run_stage_07(config, args)
    output_dir = resolve_repo_path(config.get('paths', {}).get('output_dir', 'data-analysis/output'))
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.print_effective_config:
        print(json.dumps(config, indent=2))

    started_at = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    executed_stages: List[str] = []

    try:
        if run_stage_07 and source_mode == 'fake':
            run_stage(FAKE_STAGE, effective_config_path)
            executed_stages.append(FAKE_STAGE)

        for stage in CORE_STAGES:
            run_stage(stage, effective_config_path)
            executed_stages.append(stage)

        if run_stage_07 and source_mode != 'fake':
            run_stage(FAKE_STAGE, effective_config_path)
            executed_stages.append(FAKE_STAGE)
    finally:
        if temp_config_path and temp_config_path.exists():
            temp_config_path.unlink()

    report = {
        'startedAt': started_at,
        'finishedAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'configPath': str(config_path),
        'sourceMode': source_mode,
        'runStage07': run_stage_07,
        'executedStages': executed_stages,
    }
    write_json(output_dir / '00_pipeline_report.json', report)

    print(
        'Pipeline complete: '
        + ' -> '.join(executed_stages)
        + f'. Report: {output_dir / "00_pipeline_report.json"}'
    )


if __name__ == '__main__':
    main()
