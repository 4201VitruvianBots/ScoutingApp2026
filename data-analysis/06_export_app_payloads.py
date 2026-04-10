import argparse
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

from common import (
    coerce_float,
    coerce_int,
    get_segment_boundaries,
    load_game_config,
    load_settings,
    parse_json_field,
    read_csv,
    resolve_analysis_run_dir_from_settings,
    utc_now_iso,
    write_json,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Stage 06: export analyzed payloads for picklist + team profile views.'
    )
    parser.add_argument('--settings', default='app_settings/settings.json', help='Path to app settings JSON.')
    parser.add_argument(
        '--analysis-run',
        default=None,
        help=(
            'Analysis run folder name or absolute path. '
            'Defaults to settings.paths.analysis_run_folder.'
        ),
    )
    return parser.parse_args()


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
                'alliance': row.get('alliance') or '',
                'robotPosition': row.get('scheduledRobotPosition') or row.get('robotPosition') or '',
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
) -> Tuple[Dict[int, List[Dict[str, float]]], Dict[int, Dict[str, List[Dict[str, float]]]]]:
    grouped_all: Dict[Tuple[int, int], Dict[str, float]] = {}
    grouped_by_alliance: Dict[Tuple[int, str, int], Dict[str, float]] = {}
    bin_end_by_key: Dict[Tuple[int, int], int] = {}
    bin_end_by_key_alliance: Dict[Tuple[int, str, int], int] = {}

    team_match_counts_all: Dict[int, set[int]] = defaultdict(set)
    team_match_counts_by_alliance: Dict[int, Dict[str, set[int]]] = defaultdict(
        lambda: {'red': set(), 'blue': set()}
    )

    active_metric_keys: set[str] = {'shootActive', 'passActive'}

    for row in timeseries_rows:
        team_number = coerce_int(row.get('teamNumber', 0))
        match_number = coerce_int(row.get('matchNumber', 0))
        second = coerce_int(row.get('second', 0))
        alliance = (row.get('alliance') or '').strip().lower()
        if team_number <= 0 or match_number <= 0:
            continue

        if alliance not in {'red', 'blue'}:
            alliance = ''

        key_all = (team_number, second)
        grouped_all.setdefault(key_all, {})

        key_alliance = (team_number, alliance, second)
        grouped_by_alliance.setdefault(key_alliance, {})

        for metric_key, value in row.items():
            if not metric_key.endswith('Active'):
                continue
            active_metric_keys.add(metric_key)
            grouped_all[key_all][metric_key] = grouped_all[key_all].get(metric_key, 0.0) + coerce_float(value)
            grouped_by_alliance[key_alliance][metric_key] = grouped_by_alliance[key_alliance].get(metric_key, 0.0) + coerce_float(value)

        default_bin_end = min(total_sec, second + bin_sec)
        parsed_bin_end = coerce_int(row.get('binEndSec', default_bin_end), default_bin_end)
        bin_end_by_key[key_all] = max(second + 1, min(total_sec, parsed_bin_end))
        bin_end_by_key_alliance[key_alliance] = max(second + 1, min(total_sec, parsed_bin_end))

        team_match_counts_all[team_number].add(match_number)
        if alliance in {'red', 'blue'}:
            team_match_counts_by_alliance[team_number][alliance].add(match_number)

    def build_bin_row(values: Dict[str, float], divisor: int, second: int, bin_end_sec: int) -> Dict[str, float]:
        payload: Dict[str, float] = {
            'second': float(second),
            'binEndSec': float(bin_end_sec),
        }
        for active_metric_key in sorted(active_metric_keys):
            base_metric = active_metric_key[:-6] if active_metric_key.endswith('Active') else active_metric_key
            rate_metric_key = f'{base_metric}Rate'
            payload[rate_metric_key] = round(values.get(active_metric_key, 0.0) / max(1, divisor), 6)

        payload['activityRate'] = round(payload.get('shootRate', 0.0) + payload.get('passRate', 0.0), 6)
        return payload

    bins_by_team: Dict[int, List[Dict[str, float]]] = {}
    bins_by_team_and_alliance: Dict[int, Dict[str, List[Dict[str, float]]]] = {}

    for team_number, match_set in team_match_counts_all.items():
        divisor = len(match_set) or 1
        bins: List[Dict[str, float]] = []
        for second in range(0, total_sec, bin_sec):
            key = (team_number, second)
            values = grouped_all.get(key, {})
            bin_end_sec = bin_end_by_key.get(key, min(total_sec, second + bin_sec))
            bins.append(build_bin_row(values, divisor, second, bin_end_sec))
        bins_by_team[team_number] = bins

        bins_by_team_and_alliance[team_number] = {}
        for alliance in ('red', 'blue'):
            alliance_divisor = len(team_match_counts_by_alliance[team_number][alliance]) or 1
            alliance_bins: List[Dict[str, float]] = []
            for second in range(0, total_sec, bin_sec):
                key_alliance = (team_number, alliance, second)
                values = grouped_by_alliance.get(key_alliance, {})
                bin_end_sec = bin_end_by_key_alliance.get(key_alliance, min(total_sec, second + bin_sec))
                alliance_bins.append(build_bin_row(values, alliance_divisor, second, bin_end_sec))
            bins_by_team_and_alliance[team_number][alliance] = alliance_bins

    return bins_by_team, bins_by_team_and_alliance


def parse_auto_paths(
    auto_path_rows: List[Dict[str, str]],
    match_features: List[Dict[str, str]],
) -> Dict[int, List[Dict[str, Any]]]:
    start_position_map = {
        (coerce_int(row.get('teamNumber', 0)), coerce_int(row.get('matchNumber', 0))): row.get('autoStartingPosition') or None
        for row in match_features
    }

    grouped: Dict[Tuple[int, int, str, str], Dict[str, Any]] = {}

    for row in auto_path_rows:
        team_number = coerce_int(row.get('teamNumber', 0))
        match_number = coerce_int(row.get('matchNumber', 0))
        alliance = (row.get('alliance') or 'red').lower()
        fingerprint = row.get('fingerprint') or f'{team_number}-{match_number}-{alliance}'
        if team_number <= 0 or match_number <= 0:
            continue

        key = (team_number, match_number, alliance, fingerprint)
        if key not in grouped:
            grouped[key] = {
                'teamNumber': team_number,
                'matchNumber': match_number,
                'alliance': alliance,
                'fingerprint': fingerprint,
                'points': [],
                'shotMarkers': [],
            }

        target = grouped[key]
        payload = {
            'x': round(coerce_float(row.get('canonicalX', row.get('x', 0))), 6),
            'y': round(coerce_float(row.get('canonicalY', row.get('y', 0))), 6),
            'tSec': round(coerce_float(row.get('tSec', 0)), 3),
            'index': coerce_int(row.get('index', 0)),
        }

        if row.get('kind') == 'shot':
            target['shotMarkers'].append(payload)
        else:
            target['points'].append(payload)

    by_team: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    for (team_number, match_number, alliance, _), path in sorted(grouped.items()):
        points = sorted(path['points'], key=lambda item: item['index'])
        shots = sorted(path['shotMarkers'], key=lambda item: item['index'])
        by_team[team_number].append(
            {
                'alliance': alliance,
                'startPosition': start_position_map.get((team_number, match_number)),
                'points': [{'x': point['x'], 'y': point['y'], 'tSec': point['tSec']} for point in points],
                'shotMarkers': [{'x': point['x'], 'y': point['y'], 'tSec': point['tSec']} for point in shots],
                'fingerprint': path['fingerprint'],
            }
        )

    return by_team


def build_match_history(match_features: List[Dict[str, str]]) -> Dict[int, List[Dict[str, Any]]]:
    history: Dict[int, List[Dict[str, Any]]] = defaultdict(list)

    for row in match_features:
        team_number = coerce_int(row.get('teamNumber', 0))
        match_number = coerce_int(row.get('matchNumber', 0))
        if team_number <= 0 or match_number <= 0:
            continue

        history[team_number].append(
            {
                'matchNumber': match_number,
                'alliance': row.get('alliance') or '',
                'robotPosition': row.get('scheduledRobotPosition') or row.get('robotPosition') or '',
                'roleEstimate': row.get('roleEstimate') or '',
                'autoFuelScored': round(coerce_float(row.get('autoFuelScored', 0)), 4),
                'teleFuelTotal': round(coerce_float(row.get('teleFuelTotal', 0)), 4),
                'actualFuelTotal': round(coerce_float(row.get('actualFuelTotal', 0)), 4),
                'estimatedFuelPoints': round(coerce_float(row.get('estimatedFuelPoints', 0)), 4),
                'defenseProvided': row.get('defenseProvided') or 'None',
                'defenseReceived': bool(row.get('defenseReceived') in {'True', 'true', '1', True}),
                'foulsTotal': round(coerce_float(row.get('foulsTotal', 0)), 4),
                'breaksTotal': round(coerce_float(row.get('breaksTotal', 0)), 4),
                'breakdown': row.get('breakdown') or 'None',
                'driverQuality': row.get('driverQuality') or 'Ok',
                'timelineIntervalCount': coerce_int(row.get('timelineIntervalCount', 0)),
            }
        )

    for rows in history.values():
        rows.sort(key=lambda row: row['matchNumber'])

    return history


def main() -> None:
    args = parse_args()
    settings = load_settings(args.settings)

    analysis_run_dir = resolve_analysis_run_dir_from_settings(settings, args.analysis_run)

    team_aggregates = read_csv(analysis_run_dir / '04_team_aggregates.csv')
    score_rows = read_csv(analysis_run_dir / '05_picklist_scores.csv')
    contribution_rows = read_csv(analysis_run_dir / '05_metric_contributions.csv')
    match_features = read_csv(analysis_run_dir / '03_match_features.csv')
    timeseries_rows = read_csv(analysis_run_dir / '03_timeseries_long.csv')
    auto_path_rows = read_csv(analysis_run_dir / '03_auto_path_points.csv')

    game_config = load_game_config()
    segment_boundaries = get_segment_boundaries(game_config)
    total_sec = int(segment_boundaries['totalSec'])
    timeline_bin_sec = max(1, coerce_int(settings['analysis'].get('timeline_bin_sec', 1), 1))

    aggregate_by_team = {coerce_int(row.get('teamNumber', 0)): row for row in team_aggregates}
    score_by_team = {coerce_int(row.get('teamNumber', 0)): row for row in score_rows}

    contribution_by_team: Dict[int, Dict[str, float]] = defaultdict(dict)
    for row in contribution_rows:
        team_number = coerce_int(row.get('teamNumber', 0))
        metric = row.get('metric') or ''
        if team_number <= 0 or not metric:
            continue
        contribution_by_team[team_number][metric] = round(coerce_float(row.get('contribution', 0)), 6)

    timeline_rows_by_team = parse_timeline_rows(match_features)
    timeline_bins_by_team, timeline_bins_by_team_and_alliance = parse_timeseries_bins(
        timeseries_rows,
        total_sec,
        timeline_bin_sec,
    )
    auto_paths_by_team = parse_auto_paths(auto_path_rows, match_features)
    match_history_by_team = build_match_history(match_features)

    team_numbers = sorted(
        set(aggregate_by_team.keys())
        | set(score_by_team.keys())
        | set(timeline_rows_by_team.keys())
        | set(match_history_by_team.keys())
    )

    teams_payload: List[Dict[str, Any]] = []
    team_profiles: List[Dict[str, Any]] = []

    string_metric_keys = {
        'pitDrivebase',
        'pitScoringMethod',
        'pitPreferredScoringSpot',
        'pitRobotMaintain',
        'pitTowerCapabilityClaimed',
    }

    for team_number in team_numbers:
        if team_number <= 0:
            continue

        aggregate = aggregate_by_team.get(team_number, {})
        score_row = score_by_team.get(team_number, {})
        contributions = contribution_by_team.get(team_number, {})

        metrics = {
            key: (
                coerce_float(value)
                if value not in ('', None) and key not in string_metric_keys
                else value
            )
            for key, value in aggregate.items()
            if key not in {'teamNumber', 'matchCount'}
        }

        role_tendencies = {
            'primaryScorerRate': coerce_float(aggregate.get('rolePrimaryScorerRate', 0)),
            'supportRate': coerce_float(aggregate.get('roleSupportRate', 0)),
            'defenseRate': coerce_float(aggregate.get('roleDefenseRate', 0)),
        }

        defense_summary = {
            'defenseHeavyRate': coerce_float(aggregate.get('defenseHeavyRate', 0)),
            'defenseSomeRate': coerce_float(aggregate.get('defenseSomeRate', 0)),
            'defensePlayEstimate': coerce_float(aggregate.get('defensePlayEstimate', 0)),
            'defenseImpactRaw': coerce_float(aggregate.get('defenseImpactRaw', 0)),
            'defenseImpactConfidence': coerce_float(aggregate.get('defenseImpactConfidence', 0)),
            'defenseEffectiveness': coerce_float(aggregate.get('defenseEffectiveness', 0)),
            'defensiveSampleCount': coerce_int(aggregate.get('defensiveSampleCount', 0)),
            'opponentSuppressionAvg': coerce_float(aggregate.get('defenseOpponentSuppressionAvg', 0)),
        }

        team_payload = {
            'teamNumber': team_number,
            'matchCount': coerce_int(aggregate.get('matchCount', score_row.get('matchCount', 0))),
            'score': coerce_float(score_row.get('score', 0)),
            'metricContributions': contributions,
            'metrics': metrics,
            'roleTendencies': role_tendencies,
            'defenseSummary': defense_summary,
            'matchHistory': match_history_by_team.get(team_number, []),
            'timeline': {
                'totalSec': total_sec,
                'binSec': timeline_bin_sec,
                'autoEndSec': segment_boundaries['autoEndSec'],
                'delayEndSec': segment_boundaries['delayEndSec'],
                'bins': timeline_bins_by_team.get(team_number, []),
                'binsByAlliance': timeline_bins_by_team_and_alliance.get(team_number, {'red': [], 'blue': []}),
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
                'roleTendencies': role_tendencies,
                'defenseSummary': defense_summary,
            }
        )

    payload = {
        'generatedAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'sourceMode': 'analyzed',
        'analysisRunId': analysis_run_dir.name,
        'teams': sorted(teams_payload, key=lambda row: row['teamNumber']),
    }

    write_json(analysis_run_dir / '06_picklist_payload.json', payload)
    write_json(analysis_run_dir / '06_team_profiles.json', sorted(team_profiles, key=lambda row: row['teamNumber']))

    write_json(
        analysis_run_dir / '06_stage_summary.json',
        {
            'stage': '06_export_app_payloads',
            'createdAt': utc_now_iso(),
            'analysisRun': str(analysis_run_dir),
            'teamCount': len(teams_payload),
        },
    )

    print(f'Stage 06 complete: wrote payload with {len(teams_payload)} teams -> {analysis_run_dir}')


if __name__ == '__main__':
    main()
