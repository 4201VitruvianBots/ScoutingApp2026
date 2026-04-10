import argparse
import subprocess
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Compatibility shim: runs run_analysis_full.py in existing_raw mode.'
    )
    parser.add_argument(
        '--settings',
        default='app_settings/settings.json',
        help='Path to app settings JSON.',
    )
    parser.add_argument(
        '--raw-run',
        default=None,
        help='Raw run folder name or absolute path override.',
    )
    parser.add_argument(
        '--analysis-run-label',
        default=None,
        help='Deprecated alias for analysis run folder override.',
    )
    parser.add_argument(
        '--analysis-run-base-name',
        default=None,
        help='Analysis run folder override.',
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    command = [
        sys.executable,
        str(SCRIPT_DIR / 'run_analysis_full.py'),
        '--settings',
        args.settings,
        '--raw-source-mode',
        'existing_raw',
    ]
    if args.raw_run:
        command.extend(['--raw-run', args.raw_run])
    if args.analysis_run_base_name:
        command.extend(['--analysis-run-base-name', args.analysis_run_base_name])
    elif args.analysis_run_label:
        command.extend(['--analysis-run-label', args.analysis_run_label])

    print(
        'run_fake_local_full.py is deprecated; forwarding to run_analysis_full.py '
        '(raw-source-mode=existing_raw).'
    )
    subprocess.run(command, check=True)


if __name__ == '__main__':
    main()
