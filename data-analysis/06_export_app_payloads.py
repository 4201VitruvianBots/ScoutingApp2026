import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

from common import (
    coerce_float,
    coerce_int,
    get_segment_boundaries,
    load_config,
    load_game_config,
    parse_args,
    parse_json_field,
    read_csv,
    safe_div,
    write_json,
)


def parse_timeline_rows(match_features: List[Dict[str, str]]) -> Dict[int, List[Dict[str, Any]]]:
    by_team: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    for row in match_features:
        team_number = coerce_int(row.get('teamNumber', 0))
        if team_number <= 0:
            continue
        match_number = coerce_int(row.get('matchNumber', 0))
        timeline = parse_json_field(row.get('actionTimelineJson', ''), {})
        intervals = timeline.get('intervals') if isinstance(timeline, dict) else []
        if not isinstance(intervals, list):
            intervals = []
        normalized_intervals = []
        for interval in intervals:
            if not isinstance(interval, dict):
                continue
            action = interval.get('action')
            if action not in ('shoot', 'pass'):
                continue
            start_sec = coerce_float(interval.get('startSec', 0))
            end_sec = coerce_float(interval.get('endSec', 0))
            duration_sec = coerce_float(interval.get('durationSec', end_sec - start_sec))
            if end_sec <= start_sec:
                continue
            normalized_intervals.append(
                {
                    'action': action,
                    'startSec': round(start_sec, 3),
                    'endSec': round(end_sec, 3),
                    'durationSec': round(duration_sec, 3),
                }
            )

        by_team[team_number].append(
            {
                'matchNumber': match_number,
                'intervals': normalized_intervals,
            }
        )

    for rows in by_team.values():
        rows.sort(key=lambda row: row['matchNumber'])

    return by_team


def parse_timeseries_bins(
    timeseries_rows: List[Dict[str, str]],
    total_sec: int,
    bin_sec: int,
) -> Dict[int, List[Dict[str, float]]]:
    grouped: Dict[Tuple[int, int], Dict[str, float]] = {}
    bin_end_by_key: Dict[Tuple[int, int], int] = {}
    team_match_counts: Dict[int, set[int]] = defaultdict(set)
    active_metric_keys: set[str] = {'shootActive', 'passActive'}

    for row in timeseries_rows:
        team_number = coerce_int(row.get('teamNumber', 0))
        match_number = coerce_int(row.get('matchNumber', 0))
        second = coerce_int(row.get('second', 0))
        if team_number <= 0 or match_number <= 0:
            continue
        key = (team_number, second)
        if key not in grouped:
            grouped[key] = {}

        for metric_key, value in row.items():
            if not metric_key.endswith('Active'):
                continue
            active_metric_keys.add(metric_key)
            grouped[key][metric_key] = grouped[key].get(metric_key, 0.0) + coerce_float(value)

        default_bin_end = min(total_sec, second + bin_sec)
        parsed_bin_end = coerce_int(row.get('binEndSec', default_bin_end), default_bin_end)
        bin_end_by_key[key] = max(second + 1, min(total_sec, parsed_bin_end))
        team_match_counts[team_number].add(match_number)

    bins_by_team: Dict[int, List[Dict[str, float]]] = {}
    for team_number, match_set in team_match_counts.items():
        divisor = len(match_set) or 1
        bins: List[Dict[str, float]] = []
        for second in range(0, total_sec, bin_sec):
            key = (team_number, second)
            values = grouped.get(key, {})
            bin_end_sec = float(bin_end_by_key.get(key, min(total_sec, second + bin_sec)))

            row_payload: Dict[str, float] = {
                'second': float(second),
                'binEndSec': bin_end_sec,
            }

            for active_metric_key in sorted(active_metric_keys):
                base_metric = active_metric_key[:-6] if active_metric_key.endswith('Active') else active_metric_key
                rate_metric_key = f'{base_metric}Rate'
                row_payload[rate_metric_key] = round(
                    safe_div(values.get(active_metric_key, 0.0), divisor),
                    6,
                )

            row_payload['activityRate'] = round(
                row_payload.get('shootRate', 0.0) + row_payload.get('passRate', 0.0),
                6,
            )
            bins.append(row_payload)

        bins_by_team[team_number] = bins

    return bins_by_team


def parse_auto_paths(
    auto_path_rows: List[Dict[str, str]],
    match_features: List[Dict[str, str]],
) -> Dict[int, List[Dict[str, Any]]]:
    start_position_map = {
        (coerce_int(row.get('teamNumber', 0)), coerce_int(row.get('matchNumber', 0))): row.get('autoStartingPosition') or None
        for row in match_features
    }

    grouped: Dict[Tuple[int, int, str], Dict[str, Any]] = {}

    for row in auto_path_rows:
        team_number = coerce_int(row.get('teamNumber', 0))
        match_number = coerce_int(row.get('matchNumber', 0))
        fingerprint = row.get('fingerprint') or f'{team_number}-{match_number}'
        if team_number <= 0 or match_number <= 0:
            continue

        key = (team_number, match_number, fingerprint)
        if key not in grouped:
            grouped[key] = {
                'teamNumber': team_number,
                'matchNumber': match_number,
                'fingerprint': fingerprint,
                'points': [],
                'shotMarkers': [],
            }

        target = grouped[key]
        payload = {
            'x': round(coerce_float(row.get('canonicalX', 0)), 6),
            'y': round(coerce_float(row.get('canonicalY', 0)), 6),
            'tSec': round(coerce_float(row.get('tSec', 0)), 3),
            'index': coerce_int(row.get('index', 0)),
        }

        if row.get('kind') == 'shot':
            target['shotMarkers'].append(payload)
        else:
            target['points'].append(payload)

    by_team: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    for (team_number, match_number, _), path in sorted(grouped.items()):
        points = sorted(path['points'], key=lambda item: item['index'])
        shots = sorted(path['shotMarkers'], key=lambda item: item['index'])
        by_team[team_number].append(
            {
                'alliance': 'red',
                'startPosition': start_position_map.get((team_number, match_number)),
                'points': [
                    {'x': point['x'], 'y': point['y'], 'tSec': point['tSec']}
                    for point in points
                ],
                'shotMarkers': [
                    {'x': point['x'], 'y': point['y'], 'tSec': point['tSec']}
                    for point in shots
                ],
                'fingerprint': path['fingerprint'],
            }
        )

    return by_team


def main() -> None:
    args = parse_args('Stage 06: export app payloads for picklist and team profiles')
    config = load_config(args.config)
    output_dir = Path(config['_output_dir'])

    team_aggregates = read_csv(output_dir / '04_team_aggregates.csv')
    score_rows = read_csv(output_dir / '05_picklist_scores.csv')
    contribution_rows = read_csv(output_dir / '05_metric_contributions.csv')
    match_features = read_csv(output_dir / '03_match_features.csv')
    timeseries_rows = read_csv(output_dir / '03_timeseries_long.csv')
    auto_path_rows = read_csv(output_dir / '03_auto_path_points.csv')

    game_config = load_game_config()
    segment_boundaries = get_segment_boundaries(game_config)
    total_sec = int(segment_boundaries['totalSec'])
    timeline_bin_sec = max(1, coerce_int(config.get('analysis', {}).get('timeline_bin_sec', 1), 1))

    aggregate_by_team = {
        coerce_int(row.get('teamNumber', 0)): row
        for row in team_aggregates
    }
    score_by_team = {coerce_int(row.get('teamNumber', 0)): row for row in score_rows}

    contribution_by_team: Dict[int, Dict[str, float]] = defaultdict(dict)
    for row in contribution_rows:
        team_number = coerce_int(row.get('teamNumber', 0))
        metric = row.get('metric') or ''
        if team_number <= 0 or not metric:
            continue
        contribution_by_team[team_number][metric] = round(coerce_float(row.get('contribution', 0)), 6)

    timeline_rows_by_team = parse_timeline_rows(match_features)
    timeline_bins_by_team = parse_timeseries_bins(timeseries_rows, total_sec, timeline_bin_sec)
    auto_paths_by_team = parse_auto_paths(auto_path_rows, match_features)

    team_numbers = sorted(
        set(aggregate_by_team.keys()) | set(score_by_team.keys()) | set(timeline_rows_by_team.keys())
    )

    teams_payload: List[Dict[str, Any]] = []
    team_profiles: List[Dict[str, Any]] = []

    for team_number in team_numbers:
        if team_number <= 0:
            continue

        aggregate = aggregate_by_team.get(team_number, {})
        score_row = score_by_team.get(team_number, {})
        contributions = contribution_by_team.get(team_number, {})

        metrics = {
            key: (
                coerce_float(value)
                if value not in ('', None) and key not in {
                    'pitDrivebase',
                    'pitScoringMethod',
                    'pitPreferredScoringSpot',
                    'pitTowerCapabilityClaimed',
                }
                else value
            )
            for key, value in aggregate.items()
            if key not in {'teamNumber', 'matchCount'}
        }

        team_payload = {
            'teamNumber': team_number,
            'matchCount': coerce_int(aggregate.get('matchCount', score_row.get('matchCount', 0))),
            'score': coerce_float(score_row.get('score', 0)),
            'metricContributions': contributions,
            'metrics': metrics,
            'timeline': {
                'totalSec': total_sec,
                'binSec': timeline_bin_sec,
                'autoEndSec': segment_boundaries['autoEndSec'],
                'delayEndSec': segment_boundaries['delayEndSec'],
                'bins': timeline_bins_by_team.get(team_number, []),
                'rows': timeline_rows_by_team.get(team_number, []),
            },
            'autoPaths': auto_paths_by_team.get(team_number, []),
        }

        teams_payload.append(team_payload)

        team_profiles.append(
            {
                'teamNumber': team_number,
                'score': team_payload['score'],
                'rank': coerce_int(score_row.get('rank', 0)),
                'metrics': metrics,
                'metricContributions': contributions,
            }
        )

    payload = {
        'generatedAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'sourceMode': str(config['source'].get('mode', 'mongo')).lower(),
        'teams': sorted(teams_payload, key=lambda row: row['teamNumber']),
    }

    write_json(output_dir / '06_picklist_payload.json', payload)
    write_json(output_dir / '06_team_profiles.json', sorted(team_profiles, key=lambda row: row['teamNumber']))

    print(
        f"Stage 06 complete: wrote payload with {len(teams_payload)} teams."
    )


if __name__ == '__main__':
    main()
