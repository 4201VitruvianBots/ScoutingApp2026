import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, Optional

from common import read_latest_run_pointer


SCRIPT_DIR = Path(__file__).resolve().parent


def run_python_script(script_name: str, *args: str) -> None:
    script_path = SCRIPT_DIR / script_name
    command = [sys.executable, str(script_path), *args]
    print(f'Running: {" ".join(command)}', flush=True)
    subprocess.run(command, check=True)


def run_analysis_chain(
    settings: Dict[str, Any],
    settings_arg: str,
    raw_run_id: str,
    analysis_run_label: Optional[str] = None,
) -> Path:
    stage_02_args = ['--settings', settings_arg, '--raw-run', raw_run_id]
    if analysis_run_label:
        stage_02_args.extend(['--analysis-run-label', analysis_run_label])

    run_python_script('02_clean_normalize.py', *stage_02_args)

    analysis_root = Path(settings['_analysis_runs_root'])
    analysis_run_dir = read_latest_run_pointer(analysis_root)
    analysis_run_id = analysis_run_dir.name

    for stage_script in [
        '03_feature_engineering.py',
        '04_team_aggregation.py',
        '05_picklist_scores.py',
        '06_export_app_payloads.py',
    ]:
        run_python_script(
            stage_script,
            '--settings',
            settings_arg,
            '--analysis-run',
            analysis_run_id,
        )

    return analysis_run_dir
