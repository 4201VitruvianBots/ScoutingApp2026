import argparse
from pathlib import Path

from common import load_settings, read_latest_run_pointer
from full_run_utils import run_analysis_chain, run_python_script


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Run full analysis stages by extracting source data from Docker Mongo first.'
    )
    parser.add_argument(
        'run_label',
        nargs='?',
        default='docker_run',
        help='Label used by 01_extract_source.py (e.g. comp_2).',
    )
    parser.add_argument(
        '--settings',
        default='app_settings/settings.json',
        help='Path to app settings JSON.',
    )
    parser.add_argument(
        '--analysis-run-label',
        default=None,
        help='Optional analysis run label passed to stage 02.',
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = load_settings(args.settings)

    run_python_script(
        '01_extract_source.py',
        args.run_label,
        '--settings',
        args.settings,
    )

    raw_root = Path(settings['_raw_runs_root'])
    raw_run_dir = read_latest_run_pointer(raw_root)
    raw_run_id = raw_run_dir.name

    analysis_run_dir = run_analysis_chain(
        settings=settings,
        settings_arg=args.settings,
        raw_run_id=raw_run_id,
        analysis_run_label=args.analysis_run_label,
    )

    print('\nFull Docker-source workflow complete.')
    print(f'Raw run: {raw_run_dir}')
    print(f'Analysis run: {analysis_run_dir}')
    print(f'Picklist payload: {analysis_run_dir / "06_picklist_payload.json"}')


if __name__ == '__main__':
    main()
