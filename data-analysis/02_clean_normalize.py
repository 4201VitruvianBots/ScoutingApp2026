import argparse
import json
from pathlib import Path
from typing import Any, Dict, List, Tuple

from common import (
    coerce_bool,
    coerce_float,
    coerce_int,
    create_timestamped_run_dir,
    get_expected_robot_positions,
    load_settings,
    parse_json_field,
    read_csv,
    resolve_raw_run_dir_from_settings,
    utc_now_iso,
    write_csv,
    write_json,
    write_latest_run_pointer,
)

SEGMENTS = ['auto', 'transition', 'shift1', 'shift2', 'shift3', 'shift4', 'endgame']


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Stage 02: clean and normalize raw source data into a new analysis run folder.'
    )
    parser.add_argument('--settings', default='app_settings/settings.json', help='Path to app settings JSON.')
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
        help='Optional label included in the new analysis run folder name.',
    )
    return parser.parse_args()


def normalize_segment_map(raw: Any) -> Dict[str, float]:
    payload = parse_json_field(raw, {})
    if not isinstance(payload, dict):
        payload = {}
    return {segment: max(0.0, coerce_float(payload.get(segment, 0.0))) for segment in SEGMENTS}


def flatten_match_row(row: Dict[str, str], valid_positions: set[str]) -> Tuple[Dict[str, Any] | None, List[str]]:
    issues: List[str] = []

    match_number = coerce_int(row.get('matchNumber'))
    team_number = coerce_int(row.get('teamNumber'))
    robot_position = (row.get('robotPosition') or '').strip()

    if match_number <= 0:
        issues.append('invalid_match_number')
    if team_number <= 0:
        issues.append('invalid_team_number')
    if robot_position not in valid_positions:
        issues.append('invalid_robot_position')

    shoot = normalize_segment_map(row.get('shootTimeBySegmentJson'))
    passed = normalize_segment_map(row.get('passTimeBySegmentJson'))
    tele = normalize_segment_map(row.get('teleFuelBySegmentJson'))
    fouls = parse_json_field(row.get('foulsJson'), {})
    breaks = parse_json_field(row.get('breaksJson'), {})

    if not isinstance(fouls, dict):
        fouls = {}
    if not isinstance(breaks, dict):
        breaks = {}

    clean_row = {
        'scouterName': (row.get('scouterName') or '').strip(),
        'matchNumber': match_number,
        'teamNumber': team_number,
        'robotPosition': robot_position,
        'robotAbsent': coerce_bool(row.get('robotAbsent')),
        'autoStartingPosition': row.get('autoStartingPosition') or '',
        'autoPathJson': json.dumps(parse_json_field(row.get('autoPathJson'), {}), separators=(',', ':')),
        'actionTimelineJson': json.dumps(parse_json_field(row.get('actionTimelineJson'), {}), separators=(',', ':')),
        'ballsPerSecondUsed': max(0.0, coerce_float(row.get('ballsPerSecondUsed', 0))),
        'autoFuelScored': max(0.0, coerce_float(row.get('autoFuelScored', 0))),
        'teleFuelTransition': tele['transition'],
        'teleFuelShift1': tele['shift1'],
        'teleFuelShift2': tele['shift2'],
        'teleFuelShift3': tele['shift3'],
        'teleFuelShift4': tele['shift4'],
        'teleFuelEndgame': tele['endgame'],
        'shootSecAuto': shoot['auto'],
        'shootSecTransition': shoot['transition'],
        'shootSecShift1': shoot['shift1'],
        'shootSecShift2': shoot['shift2'],
        'shootSecShift3': shoot['shift3'],
        'shootSecShift4': shoot['shift4'],
        'shootSecEndgame': shoot['endgame'],
        'passSecAuto': passed['auto'],
        'passSecTransition': passed['transition'],
        'passSecShift1': passed['shift1'],
        'passSecShift2': passed['shift2'],
        'passSecShift3': passed['shift3'],
        'passSecShift4': passed['shift4'],
        'passSecEndgame': passed['endgame'],
        'teleTower': row.get('teleTower') or 'None',
        'breakdown': row.get('breakdown') or 'None',
        'driverQuality': row.get('driverQuality') or 'Ok',
        'defenseProvided': row.get('defenseProvided') or 'None',
        'defenseReceived': coerce_bool(row.get('defenseReceived')),
        'foulPinning': max(0.0, coerce_float(fouls.get('pinning', 0))),
        'foulTowerContactInEndgame': max(0.0, coerce_float(fouls.get('towerContactInEndgame', 0))),
        'foulOutOfZoneShooting': max(0.0, coerce_float(fouls.get('outOfZoneShooting', 0))),
        'foulEjectedFuel': max(0.0, coerce_float(fouls.get('ejectedFuel', 0))),
        'foulOther': max(0.0, coerce_float(fouls.get('other', 0))),
        'breakMechanism': max(0.0, coerce_float(breaks.get('mechanism', 0))),
        'breakBattery': max(0.0, coerce_float(breaks.get('battery', 0))),
        'breakComms': max(0.0, coerce_float(breaks.get('comms', 0))),
        'breakBumper': max(0.0, coerce_float(breaks.get('bumper', 0))),
        'freeText': row.get('freeText') or '',
    }

    if issues:
        return None, issues
    return clean_row, issues


def flatten_pit_row(row: Dict[str, str]) -> Tuple[Dict[str, Any] | None, List[str]]:
    issues: List[str] = []
    team_number = coerce_int(row.get('teamNumber'))
    if team_number <= 0:
        issues.append('invalid_team_number')
        return None, issues

    clean_row = {
        'scouterName': (row.get('scouterName') or '').strip(),
        'teamNumber': team_number,
        'drivebase': row.get('drivebase') or '',
        'sdsSwerveType': row.get('sdsSwerveType') or '',
        'wpcSwerveType': row.get('wpcSwerveType') or '',
        'otherSwerveType': row.get('otherSwerveType') or '',
        'swerveGearRatio': coerce_float(row.get('swerveGearRatio'), 0.0),
        'maxFuelStorageEstimate': coerce_float(row.get('maxFuelStorageEstimate'), 0.0),
        'intakeDepot': coerce_bool(row.get('intakeDepot')),
        'intakeOutpostCorral': coerce_bool(row.get('intakeOutpostCorral')),
        'intakeFloorNeutral': coerce_bool(row.get('intakeFloorNeutral')),
        'scoringMethod': row.get('scoringMethod') or '',
        'preferredScoringSpot': row.get('preferredScoringSpot') or '',
        'robotMaintain': row.get('robotMaintain') or '',
        'robotQuality': row.get('robotQuality') or '',
        'towerCapabilityClaimed': row.get('towerCapabilityClaimed') or '',
        'batteryCount': max(0, coerce_int(row.get('batteryCount'), 0)),
        'notes': row.get('notes') or '',
    }

    return clean_row, issues


def main() -> None:
    args = parse_args()
    settings = load_settings(args.settings)

    analysis_root = Path(settings['_analysis_runs_root'])

    raw_run_dir = resolve_raw_run_dir_from_settings(settings, args.raw_run)

    analysis_base_name = settings['paths']['analysis_run_base_name']
    analysis_label = args.analysis_run_label or raw_run_dir.name
    analysis_run_dir = create_timestamped_run_dir(
        analysis_root,
        base_name=analysis_base_name,
        label=analysis_label,
    )

    raw_match = read_csv(raw_run_dir / '01_match_raw.csv')
    raw_pit = read_csv(raw_run_dir / '01_pit_raw.csv')

    clean_match: List[Dict[str, Any]] = []
    clean_pit: List[Dict[str, Any]] = []
    validation_rows: List[Dict[str, Any]] = []

    valid_positions = set(get_expected_robot_positions())

    for index, row in enumerate(raw_match, start=1):
        normalized, issues = flatten_match_row(row, valid_positions)
        if normalized is None:
            validation_rows.append(
                {
                    'dataset': 'match',
                    'rowNumber': index,
                    'severity': 'error',
                    'issues': ','.join(issues),
                }
            )
            continue
        clean_match.append(normalized)

    for index, row in enumerate(raw_pit, start=1):
        normalized, issues = flatten_pit_row(row)
        if normalized is None:
            validation_rows.append(
                {
                    'dataset': 'pit',
                    'rowNumber': index,
                    'severity': 'error',
                    'issues': ','.join(issues),
                }
            )
            continue
        clean_pit.append(normalized)

    write_csv(analysis_run_dir / '02_match_clean.csv', clean_match)
    write_csv(analysis_run_dir / '02_pit_clean.csv', clean_pit)
    write_csv(
        analysis_run_dir / '02_validation_report.csv',
        validation_rows,
        fieldnames=['dataset', 'rowNumber', 'severity', 'issues'],
    )

    run_summary = {
        'stage': '02_clean_normalize',
        'createdAt': utc_now_iso(),
        'sourceRawRun': str(raw_run_dir),
        'analysisRun': str(analysis_run_dir),
        'counts': {
            'rawMatch': len(raw_match),
            'rawPit': len(raw_pit),
            'cleanMatch': len(clean_match),
            'cleanPit': len(clean_pit),
            'validationIssues': len(validation_rows),
        },
    }
    write_json(analysis_run_dir / '02_stage_summary.json', run_summary)
    write_latest_run_pointer(analysis_root, analysis_run_dir)

    print(
        'Stage 02 complete: '
        f'{len(clean_match)} clean match rows, {len(clean_pit)} clean pit rows, '
        f'{len(validation_rows)} validation records -> {analysis_run_dir}'
    )


if __name__ == '__main__':
    main()
    
