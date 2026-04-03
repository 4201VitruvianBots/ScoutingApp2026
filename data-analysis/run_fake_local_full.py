import argparse
from pathlib import Path

from common import load_settings, read_latest_run_pointer
from full_run_utils import run_analysis_chain, run_python_script


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Run fake-data generation (local CSV) and full analysis stages 02-06.'
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

    destination = str(settings['fake_data'].get('destination', '')).strip().lower()
    if destination != 'local_csv':
        raise ValueError(
            'run_fake_local_full.py requires fake_data.destination = "local_csv" '
            f'in {args.settings}. Current value: {destination!r}'
        )

    run_python_script('generate_fake_data.py', '--settings', args.settings)

    raw_root = Path(settings['_raw_runs_root'])
    raw_run_dir = read_latest_run_pointer(raw_root)
    raw_run_id = raw_run_dir.name

    analysis_run_dir = run_analysis_chain(
        settings=settings,
        settings_arg=args.settings,
        raw_run_id=raw_run_id,
        analysis_run_label=args.analysis_run_label,
    )

    print('\nFull fake local workflow complete.')
    print(f'Raw run: {raw_run_dir}')
    print(f'Analysis run: {analysis_run_dir}')
    print(f'Picklist payload: {analysis_run_dir / "06_picklist_payload.json"}')


if __name__ == '__main__':
    main()
