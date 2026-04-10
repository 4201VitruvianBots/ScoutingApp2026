import argparse
import subprocess
import sys
from pathlib import Path

from common import load_settings, read_latest_run_pointer, resolve_raw_run_dir_from_settings


SCRIPT_DIR = Path(__file__).resolve().parent
ANALYSIS_STAGE_SCRIPTS = [
    '03_feature_engineering.py',
    '04_team_aggregation.py',
    '05_picklist_scores.py',
    '06_export_app_payloads.py',
]


def run_python_script(script_name: str, *args: str) -> None:
    script_path = SCRIPT_DIR / script_name
    command = [sys.executable, str(script_path), *args]
    print(f'Running: {" ".join(command)}', flush=True)
    subprocess.run(command, check=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Run full analysis pipeline (02-06), optionally exporting raw source from Docker first.'
    )
    parser.add_argument(
        '--settings',
        default='app_settings/settings.json',
        help='Path to app settings JSON.',
    )
    parser.add_argument(
        '--raw-source-mode',
        choices=['existing_raw', 'docker_export'],
        default=None,
        help='Override analysis.raw_source_mode from settings.',
    )
    parser.add_argument(
        '--raw-run',
        default=None,
        help=(
            'Raw run folder name or absolute path when raw source mode is existing_raw. '
            'Defaults to settings.paths.raw_run_folder when set, otherwise latest raw run pointer.'
        ),
    )
    parser.add_argument(
        '--raw-run-base-name',
        default=None,
        help=(
            'Raw run base name override passed to stage 01 when raw source mode is docker_export. '
            'Defaults to settings.paths.raw_run_base_name.'
        ),
    )
    parser.add_argument(
        '--analysis-run-base-name',
        default=None,
        help=(
            'Analysis run base name override passed to stage 02. '
            'Defaults to settings.paths.analysis_run_base_name.'
        ),
    )
    parser.add_argument(
        '--analysis-run-label',
        default=None,
        help='Deprecated alias for --analysis-run-base-name.',
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = load_settings(args.settings)

    raw_source_mode = args.raw_source_mode or str(settings['analysis'].get('raw_source_mode', 'existing_raw'))
    raw_source_mode = raw_source_mode.strip().lower()
    if raw_source_mode not in {'existing_raw', 'docker_export'}:
        raise ValueError(
            f'Unsupported raw source mode "{raw_source_mode}". Expected existing_raw or docker_export.'
        )

    analysis_run_base_name = args.analysis_run_base_name or args.analysis_run_label

    if raw_source_mode == 'docker_export':
        stage_01_args = ['--settings', args.settings]
        if args.raw_run_base_name:
            stage_01_args.extend(['--run-base-name', args.raw_run_base_name])
        run_python_script('01_extract_source.py', *stage_01_args)
        raw_run_dir = read_latest_run_pointer(Path(settings['_raw_runs_root']))
    else:
        raw_run_dir = resolve_raw_run_dir_from_settings(settings, args.raw_run)

    raw_run_reference = str(raw_run_dir.resolve())
    stage_02_args = ['--settings', args.settings, '--raw-run', raw_run_reference]
    if analysis_run_base_name:
        stage_02_args.extend(['--analysis-run-base-name', analysis_run_base_name])
    run_python_script('02_clean_normalize.py', *stage_02_args)

    analysis_run_dir = read_latest_run_pointer(Path(settings['_analysis_runs_root']))
    analysis_run_reference = str(analysis_run_dir.resolve())
    for stage_script in ANALYSIS_STAGE_SCRIPTS:
        run_python_script(
            stage_script,
            '--settings',
            args.settings,
            '--analysis-run',
            analysis_run_reference,
        )

    print('\nFull analysis workflow complete.')
    print(f'Raw source mode: {raw_source_mode}')
    print(f'Raw run: {raw_run_dir}')
    print(f'Analysis run: {analysis_run_dir}')
    print(f'Picklist payload: {analysis_run_dir / "06_picklist_payload.json"}')


if __name__ == '__main__':
    main()
