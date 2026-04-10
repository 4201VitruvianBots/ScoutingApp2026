import argparse
from pathlib import Path
from typing import Any, Dict, List, Tuple

from pymongo import MongoClient

from common import (
    coerce_int,
    create_timestamped_run_dir,
    flatten_match_row,
    flatten_pit_row,
    load_settings,
    utc_now_iso,
    write_csv,
    write_json,
    write_latest_run_pointer,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Extract source data from Docker MongoDB into a new raw run folder.'
    )
    parser.add_argument(
        'run_label',
        nargs='?',
        default=None,
        help='Legacy compatibility name override for the raw run folder base name.',
    )
    parser.add_argument(
        '--run-base-name',
        default=None,
        help='Raw run folder base name override. Defaults to settings.paths.raw_run_base_name.',
    )
    parser.add_argument(
        '--settings',
        default='app_settings/settings.json',
        help='Path to app settings JSON.',
    )
    return parser.parse_args()


def load_from_mongo(settings: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    mongo = settings['mongo']
    client = MongoClient(mongo['mongo_url'])
    db = client[mongo['db']]
    match_rows = list(db[mongo['match_collection']].find({}))
    pit_rows = list(db[mongo['pit_collection']].find({}))
    client.close()
    return match_rows, pit_rows


def main() -> None:
    args = parse_args()
    settings = load_settings(args.settings)

    raw_root = Path(settings['_raw_runs_root'])
    configured_base = str(settings['paths'].get('raw_run_base_name', 'raw')).strip() or 'raw'
    run_base_name = (args.run_base_name or args.run_label or configured_base).strip() or configured_base
    raw_run_dir = create_timestamped_run_dir(raw_root, base_name=run_base_name)

    match_entries, pit_entries = load_from_mongo(settings)
    match_rows = [flatten_match_row(entry) for entry in match_entries if isinstance(entry, dict)]
    pit_rows = [flatten_pit_row(entry) for entry in pit_entries if isinstance(entry, dict)]

    write_csv(raw_run_dir / '01_match_raw.csv', match_rows)
    write_csv(raw_run_dir / '01_pit_raw.csv', pit_rows)

    snapshot = {
        'stage': '01_extract_source',
        'createdAt': utc_now_iso(),
        'sourceMode': 'docker_export',
        'runBaseName': run_base_name,
        'counts': {
            'match': len(match_rows),
            'pit': len(pit_rows),
            'uniqueTeamsInMatches': len({coerce_int(row.get('teamNumber', 0)) for row in match_rows}),
        },
        'settingsPath': settings['_settings_path'],
        'runFolder': str(raw_run_dir),
    }
    write_json(raw_run_dir / '01_raw_snapshot.json', snapshot)
    write_latest_run_pointer(raw_root, raw_run_dir)

    print(
        'Stage 01 complete: '
        f'{len(match_rows)} match rows, {len(pit_rows)} pit rows -> {raw_run_dir}'
    )


if __name__ == '__main__':
    main()
