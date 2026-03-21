import argparse
import subprocess
import sys
from pathlib import Path

from common import DEFAULT_CONFIG_PATH


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Real Mode: run analysis pipeline (01->06) from Mongo data.'
    )
    parser.add_argument(
        '--config',
        default=str(DEFAULT_CONFIG_PATH),
        help='Path to pipeline JSON config.',
    )
    parser.add_argument('--mongo-url', help='Mongo connection URL override.')
    parser.add_argument('--db', help='Mongo database name override.')
    parser.add_argument('--output-dir', help='Output directory override.')
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    run_pipeline_path = Path(__file__).resolve().with_name('run_pipeline.py')

    command = [
        sys.executable,
        str(run_pipeline_path),
        '--config',
        str(Path(args.config).resolve()),
        '--source-mode',
        'mongo',
        '--skip-stage-07',
    ]

    if args.mongo_url:
        command.extend(['--mongo-url', args.mongo_url])
    if args.db:
        command.extend(['--db', args.db])
    if args.output_dir:
        command.extend(['--output-dir', args.output_dir])

    print('Running Real Mode: Mongo -> stages 01..06')
    subprocess.run(command, check=True)


if __name__ == '__main__':
    main()
