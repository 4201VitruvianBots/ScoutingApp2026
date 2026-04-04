import argparse

from common import load_settings, resolve_raw_run_dir_from_settings
from full_run_utils import run_analysis_chain


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Run analysis stages 02-06 against an existing raw run folder.'
    )
    parser.add_argument(
        '--settings',
        default='app_settings/settings.json',
        help='Path to app settings JSON.',
    )
    parser.add_argument(
        '--raw-run',
        default=None,
        help=(
            'Raw run folder name or absolute path. '
            'Defaults to settings.paths.raw_run_folder when set, otherwise latest raw run pointer.'
        ),
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

    raw_run_dir = resolve_raw_run_dir_from_settings(settings, args.raw_run)
    raw_run_reference = str(raw_run_dir.resolve())

    analysis_run_dir = run_analysis_chain(
        settings=settings,
        settings_arg=args.settings,
        raw_run_reference=raw_run_reference,
        analysis_run_label=args.analysis_run_label,
    )

    print('\nFull analysis workflow complete (stages 02-06).')
    print(f'Raw run: {raw_run_dir}')
    print(f'Analysis run: {analysis_run_dir}')
    print(f'Picklist payload: {analysis_run_dir / "06_picklist_payload.json"}')


if __name__ == '__main__':
    main()
