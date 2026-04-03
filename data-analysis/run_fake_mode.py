import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List

from common import DEFAULT_CONFIG_PATH, ROOT


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            'Fake Mode: generate fake logs, write local fake CSV/JSON sources, optionally seed Mongo, '
            'then run analysis pipeline (01->06) from local CSV source.'
        )
    )
    parser.add_argument(
        '--config',
        default=str(DEFAULT_CONFIG_PATH),
        help='Path to pipeline JSON config.',
    )
    parser.add_argument('--mongo-url', help='Mongo connection URL override.')
    parser.add_argument('--db', help='Mongo database name override.')
    parser.add_argument('--output-dir', help='Output directory override.')
    parser.add_argument('--fake-match-csv', help='Fake match CSV path override.')
    parser.add_argument('--fake-pit-csv', help='Fake pit CSV path override.')
    parser.add_argument(
        '--match-schedule-json',
        help='Match schedule JSON path used for schedule-based fake generation.',
    )
    parser.add_argument(
        '--use-match-schedule',
        dest='use_match_schedule',
        action='store_true',
        help='Generate fake matches based on match schedule JSON.',
    )
    parser.add_argument(
        '--no-use-match-schedule',
        dest='use_match_schedule',
        action='store_false',
        help='Generate fake matches with random pairings instead of schedule JSON.',
    )
    parser.add_argument('--match-count', type=int, help='Fake match count override.')
    parser.add_argument('--team-count', type=int, help='Fake team count override.')
    parser.add_argument('--team-start', type=int, help='Fake team number start override.')
    parser.add_argument('--scouter-count', type=int, help='Fake scouter count override.')
    parser.add_argument(
        '--include-pit',
        dest='include_pit',
        action='store_true',
        help='Include fake pit docs.',
    )
    parser.add_argument(
        '--no-include-pit',
        dest='include_pit',
        action='store_false',
        help='Skip fake pit docs.',
    )
    parser.add_argument(
        '--seed-mongo',
        dest='seed_mongo',
        action='store_true',
        help='Also seed fake docs into Mongo.',
    )
    parser.add_argument(
        '--no-seed-mongo',
        dest='seed_mongo',
        action='store_false',
        help='Do not seed fake docs into Mongo.',
    )
    parser.add_argument(
        '--verify-picklist-artifacts',
        action='store_true',
        help=(
            'Validate that fake-source and stage 01..06 output files exist, and that '
            '06_picklist_payload.json contains at least one team.'
        ),
    )
    parser.set_defaults(include_pit=None)
    parser.set_defaults(seed_mongo=None)
    parser.set_defaults(use_match_schedule=None)
    return parser.parse_args()


def load_config(path: Path) -> Dict[str, Any]:
    with open(path, 'r', encoding='utf-8') as file:
        return json.load(file)


def resolve_repo_path(path_like: str) -> Path:
    path = Path(path_like)
    return path if path.is_absolute() else ROOT / path


def apply_fake_mode_overrides(config: Dict[str, Any], args: argparse.Namespace) -> None:
    source_cfg = config.setdefault('source', {})
    paths_cfg = config.setdefault('paths', {})
    fake_cfg = config.setdefault('fake_data', {})

    if args.mongo_url:
        source_cfg['mongo_url'] = args.mongo_url
    if args.db:
        source_cfg['db'] = args.db
    if args.output_dir:
        paths_cfg['output_dir'] = args.output_dir
    if args.fake_match_csv:
        source_cfg['fake_match_csv'] = args.fake_match_csv
    if args.fake_pit_csv:
        source_cfg['fake_pit_csv'] = args.fake_pit_csv
    if args.match_schedule_json:
        fake_cfg['match_schedule_json'] = args.match_schedule_json

    if args.match_count is not None:
        fake_cfg['match_count'] = args.match_count
    if args.team_count is not None:
        fake_cfg['team_count'] = args.team_count
    if args.team_start is not None:
        fake_cfg['team_start'] = args.team_start
    if args.scouter_count is not None:
        fake_cfg['scouter_count'] = args.scouter_count
    if args.include_pit is not None:
        fake_cfg['include_pit'] = args.include_pit
    if args.seed_mongo is not None:
        fake_cfg['seed_mongo'] = args.seed_mongo
    if args.use_match_schedule is not None:
        fake_cfg['use_match_schedule'] = args.use_match_schedule

    # Force fake mode defaults for simple day-to-day workflow:
    # 1) generate fake files with stage 07
    # 2) run analytics off local CSV source
    source_cfg['mode'] = 'csv'
    fake_cfg['run_stage_07'] = False
    if 'use_match_schedule' not in fake_cfg:
        fake_cfg['use_match_schedule'] = True


def required_picklist_artifact_paths(config: Dict[str, Any]) -> List[Path]:
    output_dir = resolve_repo_path(
        str(config.get('paths', {}).get('output_dir', 'data-analysis/output'))
    )
    source_cfg = config.get('source', {})
    fake_match_csv_path = resolve_repo_path(
        str(source_cfg.get('fake_match_csv', 'data-analysis/output/fake_match_source.csv'))
    )
    fake_pit_csv_path = resolve_repo_path(
        str(source_cfg.get('fake_pit_csv', 'data-analysis/output/fake_pit_source.csv'))
    )

    return [
        fake_match_csv_path,
        fake_pit_csv_path,
        output_dir / '01_match_raw.csv',
        output_dir / '01_pit_raw.csv',
        output_dir / '02_match_clean.csv',
        output_dir / '02_pit_clean.csv',
        output_dir / '03_match_features.csv',
        output_dir / '03_timeseries_long.csv',
        output_dir / '03_auto_path_points.csv',
        output_dir / '04_team_aggregates.csv',
        output_dir / '05_picklist_scores.csv',
        output_dir / '05_metric_contributions.csv',
        output_dir / '06_picklist_payload.json',
        output_dir / '06_team_profiles.json',
    ]


def validate_picklist_artifacts(config: Dict[str, Any]) -> int:
    required_paths = required_picklist_artifact_paths(config)
    missing_paths = [str(path) for path in required_paths if not path.exists()]
    if missing_paths:
        missing_text = '\n'.join(f' - {path}' for path in missing_paths)
        raise FileNotFoundError(
            'Fake Mode validation failed: missing required picklist artifacts:\n'
            f'{missing_text}'
        )

    output_dir = resolve_repo_path(
        str(config.get('paths', {}).get('output_dir', 'data-analysis/output'))
    )
    payload_path = output_dir / '06_picklist_payload.json'

    with open(payload_path, 'r', encoding='utf-8') as payload_file:
        payload = json.load(payload_file)

    teams = payload.get('teams')
    if not isinstance(teams, list):
        raise RuntimeError(
            'Fake Mode validation failed: 06_picklist_payload.json has no `teams` list.'
        )

    valid_team_count = sum(
        1
        for row in teams
        if isinstance(row, dict) and isinstance(row.get('teamNumber'), int)
    )
    if valid_team_count <= 0:
        raise RuntimeError(
            'Fake Mode validation failed: picklist payload contains zero valid teams.'
        )

    return valid_team_count


def main() -> None:
    args = parse_args()
    config_path = Path(args.config).resolve()
    if not config_path.exists():
        raise FileNotFoundError(f'Config path does not exist: {config_path}')

    config = load_config(config_path)
    apply_fake_mode_overrides(config, args)

    output_dir = resolve_repo_path(config.get('paths', {}).get('output_dir', 'data-analysis/output'))
    output_dir.mkdir(parents=True, exist_ok=True)

    data_analysis_dir = Path(__file__).resolve().parent
    stage_07_path = data_analysis_dir / '07_seed_fake_data.py'
    run_pipeline_path = data_analysis_dir / 'run_pipeline.py'

    with tempfile.NamedTemporaryFile(
        mode='w',
        encoding='utf-8',
        suffix='.json',
        prefix='fake_mode_',
        dir=output_dir,
        delete=False,
    ) as temp_file:
        json.dump(config, temp_file, indent=2)
        temp_config_path = Path(temp_file.name)

    try:
        print('Running Fake Mode step 1/2: generate fake logs and local CSV/JSON sources', flush=True)
        subprocess.run(
            [
                sys.executable,
                str(stage_07_path),
                '--config',
                str(temp_config_path),
            ],
            check=True,
        )

        print('Running Fake Mode step 2/2: local CSV -> stages 01..06', flush=True)
        subprocess.run(
            [
                sys.executable,
                str(run_pipeline_path),
                '--config',
                str(temp_config_path),
                '--source-mode',
                'csv',
                '--skip-stage-07',
            ],
            check=True,
        )

        if args.verify_picklist_artifacts:
            valid_team_count = validate_picklist_artifacts(config)
            print(
                'Fake Mode verification complete: '
                f'validated stage outputs and found {valid_team_count} teams in '
                '06_picklist_payload.json.',
                flush=True,
            )
    finally:
        if temp_config_path.exists():
            temp_config_path.unlink()


if __name__ == '__main__':
    main()
