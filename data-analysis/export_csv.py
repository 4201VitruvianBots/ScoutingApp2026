import argparse
import subprocess
import sys
from pathlib import Path

from common import DEFAULT_CONFIG_PATH


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            'Compatibility wrapper for the unified 01..07 analysis pipeline. '
            'Prefer running `python run_pipeline.py` directly.'
        )
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


def main() -> None:
    args = parse_args()
    run_pipeline_path = Path(__file__).resolve().with_name('run_pipeline.py')

    command = [
        sys.executable,
        str(run_pipeline_path),
        '--config',
        str(Path(args.config).resolve()),
    ]

    for option_name, option_value in (
        ('--source-mode', args.source_mode),
        ('--mongo-url', args.mongo_url),
        ('--db', args.db),
        ('--output-dir', args.output_dir),
        ('--fake-match-json', args.fake_match_json),
        ('--fake-pit-json', args.fake_pit_json),
        ('--fake-match-csv', args.fake_match_csv),
        ('--fake-pit-csv', args.fake_pit_csv),
    ):
        if option_value:
            command.extend([option_name, str(option_value)])

    for flag_name, enabled in (
        ('--run-stage-07', args.run_stage_07),
        ('--skip-stage-07', args.skip_stage_07),
        ('--seed-mongo', args.seed_mongo),
        ('--no-seed-mongo', args.no_seed_mongo),
        ('--print-effective-config', args.print_effective_config),
    ):
        if enabled:
            command.append(flag_name)

    subprocess.run(command, check=True)


if __name__ == '__main__':
    main()
