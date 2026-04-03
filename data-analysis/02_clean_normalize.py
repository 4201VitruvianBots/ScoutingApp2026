import json
from pathlib import Path
from typing import Any, Dict, List

from common import (
    coerce_bool,
    coerce_float,
    coerce_int,
    load_config,
    parse_args,
    parse_json_field,
    read_csv,
    write_csv,
)

MATCH_POSITIONS = {
    'red_1',
    'red_2',
    'red_3',
    'red_4',
    'blue_1',
    'blue_2',
    'blue_3',
    'blue_4',
}


SEGMENTS = ['auto', 'transition', 'shift1', 'shift2', 'shift3', 'shift4', 'endgame']


def normalize_segment_map(raw: Any) -> Dict[str, float]:
    payload = parse_json_field(raw, {})
    if not isinstance(payload, dict):
        payload = {}
    return {segment: max(0.0, coerce_float(payload.get(segment, 0.0))) for segment in SEGMENTS}


def flatten_match_row(row: Dict[str, str]) -> tuple[Dict[str, Any] | None, List[str]]:
    issues: List[str] = []

    match_number = coerce_int(row.get('matchNumber'))
    team_number = coerce_int(row.get('teamNumber'))
    robot_position = (row.get('robotPosition') or '').strip()

    if match_number <= 0:
        issues.append('invalid_match_number')
    if team_number <= 0:
        issues.append('invalid_team_number')
    if robot_position not in MATCH_POSITIONS:
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
        'driverQuality': row.get('driverQuality') or 'ok',
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


def flatten_pit_row(row: Dict[str, str]) -> tuple[Dict[str, Any] | None, List[str]]:
    issues: List[str] = []
    team_number = coerce_int(row.get('teamNumber'))
    if team_number <= 0:
        issues.append('invalid_team_number')
        return None, issues

    clean_row = {
        'scouterName': (row.get('scouterName') or '').strip(),
        'teamNumber': team_number,
        'drivebase': row.get('drivebase') or '',
        'swerveModuleType': row.get('swerveModuleType') or '',
        'swerveGearRatio': coerce_float(row.get('swerveGearRatio'), None),
        'maxFuelStorageEstimate': coerce_float(row.get('maxFuelStorageEstimate'), 0),
        'intakeDepot': coerce_bool(row.get('intakeDepot')),
        'intakeOutpostCorral': coerce_bool(row.get('intakeOutpostCorral')),
        'intakeFloorNeutral': coerce_bool(row.get('intakeFloorNeutral')),
        'scoringMethod': row.get('scoringMethod') or '',
        'preferredScoringSpot': row.get('preferredScoringSpot') or '',
        'robotMaintain': row.get('robotMaintain') or '',
        'towerCapabilityClaimed': row.get('towerCapabilityClaimed') or '',
        'batteryCount': max(0, coerce_int(row.get('batteryCount'), 0)),
        'notes': row.get('notes') or '',
    }

    return clean_row, issues


def main() -> None:
    args = parse_args('Stage 02: clean and normalize raw CSV outputs')
    config = load_config(args.config)
    output_dir = Path(config['_output_dir'])

    raw_match = read_csv(output_dir / '01_match_raw.csv')
    raw_pit = read_csv(output_dir / '01_pit_raw.csv')

    clean_match: List[Dict[str, Any]] = []
    clean_pit: List[Dict[str, Any]] = []
    validation_rows: List[Dict[str, Any]] = []

    for index, row in enumerate(raw_match, start=1):
        normalized, issues = flatten_match_row(row)
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

    write_csv(output_dir / '02_match_clean.csv', clean_match)
    write_csv(output_dir / '02_pit_clean.csv', clean_pit)
    write_csv(output_dir / '02_validation_report.csv', validation_rows, fieldnames=['dataset', 'rowNumber', 'severity', 'issues'])

    print(
        f"Stage 02 complete: wrote {len(clean_match)} clean match rows, {len(clean_pit)} clean pit rows, {len(validation_rows)} validation records."
    )


if __name__ == '__main__':
    main()
