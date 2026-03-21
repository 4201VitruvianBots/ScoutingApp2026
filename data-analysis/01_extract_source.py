import json
from pathlib import Path
from typing import Any, Dict, List

from pymongo import MongoClient

from common import ROOT, coerce_bool, coerce_float, coerce_int, load_config, parse_args, parse_json_field, write_csv, write_json


def flatten_match_row(entry: Dict[str, Any]) -> Dict[str, Any]:
    metadata = entry.get('metadata') or {}
    return {
        'scouterName': metadata.get('scouterName', ''),
        'matchNumber': metadata.get('matchNumber'),
        'teamNumber': metadata.get('robotTeam'),
        'robotPosition': metadata.get('robotPosition', ''),
        'robotAbsent': coerce_bool(entry.get('robotAbsent', False)),
        'autoStartingPosition': entry.get('autoStartingPosition'),
        'autoPathJson': json.dumps(entry.get('autoPath') or {}, separators=(',', ':')),
        'shootTimeBySegmentJson': json.dumps(entry.get('shootTimeBySegment') or {}, separators=(',', ':')),
        'passTimeBySegmentJson': json.dumps(entry.get('passTimeBySegment') or {}, separators=(',', ':')),
        'actionTimelineJson': json.dumps(entry.get('actionTimeline') or {}, separators=(',', ':')),
        'ballsPerSecondUsed': coerce_float(entry.get('ballsPerSecondUsed', 0)),
        'autoFuelScored': coerce_float(entry.get('autoFuelScored', 0)),
        'teleFuelBySegmentJson': json.dumps(entry.get('teleFuelBySegment') or {}, separators=(',', ':')),
        'teleTower': entry.get('teleTower', 'None'),
        'breakdown': entry.get('breakdown', 'None'),
        'driverQuality': entry.get('driverQuality', 'ok'),
        'defenseProvided': entry.get('defenseProvided', 'None'),
        'defenseReceived': coerce_bool(entry.get('defenseReceived', False)),
        'foulsJson': json.dumps(entry.get('fouls') or {}, separators=(',', ':')),
        'breaksJson': json.dumps(entry.get('breaks') or {}, separators=(',', ':')),
        'freeText': entry.get('freeText', ''),
    }


def flatten_pit_row(entry: Dict[str, Any]) -> Dict[str, Any]:
    intake = parse_json_field(entry.get('intakeSources'), {})
    if not isinstance(intake, dict):
        intake = {}

    return {
        'scouterName': entry.get('scouterName', ''),
        'teamNumber': coerce_int(entry.get('teamNumber')),
        'drivebase': entry.get('drivebase', ''),
        'maxFuelStorageEstimate': entry.get('maxFuelStorageEstimate'),
        'intakeDepot': coerce_bool(intake.get('depot', False)),
        'intakeOutpostCorral': coerce_bool(intake.get('outpostCorral', False)),
        'intakeFloorNeutral': coerce_bool(intake.get('floorNeutral', False)),
        'scoringMethod': entry.get('scoringMethod', ''),
        'preferredScoringSpot': entry.get('preferredScoringSpot', ''),
        'towerCapabilityClaimed': entry.get('towerCapabilityClaimed', ''),
        'batteryCount': coerce_int(entry.get('batteryCount', 0)),
        'notes': entry.get('notes', ''),
    }


def load_from_mongo(config: Dict[str, Any]) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    source = config['source']
    client = MongoClient(source['mongo_url'])
    db = client[source['db']]
    match_rows = list(db.matchapps.find({}))
    pit_rows = list(db.pitapps.find({}))
    client.close()
    return match_rows, pit_rows


def load_from_fake(config: Dict[str, Any]) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    source = config['source']
    match_path = ROOT / source['fake_match_json']
    pit_path = ROOT / source['fake_pit_json']

    match_rows = parse_json_field(match_path.read_text(encoding='utf-8'), [])
    pit_rows = parse_json_field(pit_path.read_text(encoding='utf-8'), [])
    if not isinstance(match_rows, list) or not isinstance(pit_rows, list):
        raise ValueError('Fake source JSON must contain list payloads')
    return match_rows, pit_rows


def main() -> None:
    args = parse_args('Stage 01: extract source data from MongoDB or fake JSON source')
    config = load_config(args.config)
    output_dir = Path(config['_output_dir'])

    mode = config['source'].get('mode', 'mongo').lower()
    if mode == 'mongo':
        match_entries, pit_entries = load_from_mongo(config)
    elif mode == 'fake':
        match_entries, pit_entries = load_from_fake(config)
    else:
        raise ValueError(f'Unsupported source mode: {mode}')

    match_rows = [flatten_match_row(entry) for entry in match_entries if isinstance(entry, dict)]
    pit_rows = [flatten_pit_row(entry) for entry in pit_entries if isinstance(entry, dict)]

    write_csv(output_dir / '01_match_raw.csv', match_rows)
    write_csv(output_dir / '01_pit_raw.csv', pit_rows)

    snapshot = {
        'stage': '01_extract_source',
        'sourceMode': mode,
        'counts': {
            'match': len(match_rows),
            'pit': len(pit_rows),
        },
        'configPath': config['_config_path'],
    }
    write_json(output_dir / '01_raw_snapshot.json', snapshot)

    print(
        f"Stage 01 complete: wrote {len(match_rows)} match rows and {len(pit_rows)} pit rows to {output_dir}."
    )


if __name__ == '__main__':
    main()
