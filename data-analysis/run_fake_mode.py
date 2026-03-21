import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict

from common import DEFAULT_CONFIG_PATH, ROOT


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            'Fake Mode: generate fake logs, seed Mongo (clear first), then run analysis '
            'pipeline (01->06) from Mongo.'
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
    parser.set_defaults(include_pit=None)
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

    # Force fake mode defaults for simple day-to-day workflow.
    source_cfg['mode'] = 'mongo'
    fake_cfg['seed_mongo'] = True
    fake_cfg['run_stage_07'] = False


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
        print('Running Fake Mode step 1/2: generate + seed fake logs into Mongo')
        subprocess.run(
            [
                sys.executable,
                str(stage_07_path),
                '--config',
                str(temp_config_path),
            ],
            check=True,
        )

        print('Running Fake Mode step 2/2: Mongo -> stages 01..06')
        subprocess.run(
            [
                sys.executable,
                str(run_pipeline_path),
                '--config',
                str(temp_config_path),
                '--source-mode',
                'mongo',
                '--skip-stage-07',
            ],
            check=True,
        )
    finally:
        if temp_config_path.exists():
            temp_config_path.unlink()


if __name__ == '__main__':
    main()
