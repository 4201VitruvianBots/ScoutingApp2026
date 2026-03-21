import json
from pathlib import Path
from typing import Any, Dict, List

from common import (
    coerce_float,
    coerce_int,
    get_segment_boundaries,
    load_config,
    load_game_config,
    median,
    parse_args,
    parse_json_field,
    read_csv,
    write_csv,
)


SEGMENTS = ['auto', 'transition', 'shift1', 'shift2', 'shift3', 'shift4', 'endgame']


def parse_intervals(timeline_json: str, total_sec: int) -> List[Dict[str, Any]]:
    timeline = parse_json_field(timeline_json, {})
    if not isinstance(timeline, dict):
        return []
    raw_intervals = timeline.get('intervals')
    if not isinstance(raw_intervals, list):
        return []

    intervals: List[Dict[str, Any]] = []
    for raw in raw_intervals:
        if not isinstance(raw, dict):
            continue
        action = raw.get('action')
        if action not in ('shoot', 'pass'):
            continue
        start_sec = max(0.0, min(float(total_sec), coerce_float(raw.get('startSec', 0.0))))
        end_sec = max(0.0, min(float(total_sec), coerce_float(raw.get('endSec', 0.0))))
        if end_sec <= start_sec:
            continue
        duration_sec = coerce_float(raw.get('durationSec', end_sec - start_sec))
        if duration_sec <= 0:
            duration_sec = end_sec - start_sec
        intervals.append(
            {
                'action': action,
                'startSec': round(start_sec, 2),
                'endSec': round(end_sec, 2),
                'durationSec': round(max(0.0, duration_sec), 2),
            }
        )

    intervals.sort(key=lambda row: (row['startSec'], row['action']))
    return intervals


def build_features_row(
    row: Dict[str, str],
    fuel_points_active: float,
    total_sec: int,
) -> Dict[str, Any]:
    # Segment-safe lookups.
    shoot = {
        segment: coerce_float(
            row[
                {
                    'auto': 'shootSecAuto',
                    'transition': 'shootSecTransition',
                    'shift1': 'shootSecShift1',
                    'shift2': 'shootSecShift2',
                    'shift3': 'shootSecShift3',
                    'shift4': 'shootSecShift4',
                    'endgame': 'shootSecEndgame',
                }[segment]
            ]
        )
        for segment in SEGMENTS
    }
    passed = {
        segment: coerce_float(
            row[
                {
                    'auto': 'passSecAuto',
                    'transition': 'passSecTransition',
                    'shift1': 'passSecShift1',
                    'shift2': 'passSecShift2',
                    'shift3': 'passSecShift3',
                    'shift4': 'passSecShift4',
                    'endgame': 'passSecEndgame',
                }[segment]
            ]
        )
        for segment in SEGMENTS
    }

    shoot_held_sec = sum(shoot.values())
    pass_held_sec = sum(passed.values())
    balls_per_second = coerce_float(row.get('ballsPerSecondUsed', 0.0))

    estimated_shot_balls = shoot_held_sec * balls_per_second
    estimated_pass_balls = pass_held_sec * balls_per_second
    estimated_fuel_points = estimated_shot_balls * fuel_points_active

    fouls_total = (
        coerce_float(row.get('foulPinning', 0))
        + coerce_float(row.get('foulTowerContactInEndgame', 0))
        + coerce_float(row.get('foulOutOfZoneShooting', 0))
        + coerce_float(row.get('foulEjectedFuel', 0))
        + coerce_float(row.get('foulOther', 0))
    )
    breaks_total = (
        coerce_float(row.get('breakMechanism', 0))
        + coerce_float(row.get('breakBattery', 0))
        + coerce_float(row.get('breakComms', 0))
        + coerce_float(row.get('breakBumper', 0))
    )

    tele_fuel_total = (
        coerce_float(row.get('teleFuelTransition', 0))
        + coerce_float(row.get('teleFuelShift1', 0))
        + coerce_float(row.get('teleFuelShift2', 0))
        + coerce_float(row.get('teleFuelShift3', 0))
        + coerce_float(row.get('teleFuelShift4', 0))
        + coerce_float(row.get('teleFuelEndgame', 0))
    )

    intervals = parse_intervals(row.get('actionTimelineJson', ''), total_sec)
    shoot_intervals = [interval for interval in intervals if interval['action'] == 'shoot']
    pass_intervals = [interval for interval in intervals if interval['action'] == 'pass']

    shoot_durations = [coerce_float(interval.get('durationSec', 0)) for interval in shoot_intervals]
    pass_durations = [coerce_float(interval.get('durationSec', 0)) for interval in pass_intervals]

    shoot_starts = sorted(coerce_float(interval.get('startSec', 0)) for interval in shoot_intervals)
    shoot_gaps = [
        shoot_starts[index] - shoot_starts[index - 1]
        for index in range(1, len(shoot_starts))
        if shoot_starts[index] - shoot_starts[index - 1] > 0
    ]

    return {
        **row,
        'teleFuelTotal': tele_fuel_total,
        'shootHeldSec': round(shoot_held_sec, 3),
        'passHeldSec': round(pass_held_sec, 3),
        'estimatedShotBalls': round(estimated_shot_balls, 3),
        'estimatedPassBalls': round(estimated_pass_balls, 3),
        'estimatedFuelPoints': round(estimated_fuel_points, 3),
        'foulsTotal': round(fouls_total, 3),
        'breaksTotal': round(breaks_total, 3),
        'shootIntervalCount': len(shoot_intervals),
        'passIntervalCount': len(pass_intervals),
        'shootMedianIntervalSec': round(median(shoot_durations), 3),
        'passMedianIntervalSec': round(median(pass_durations), 3),
        'shootCycleMedianGapSec': round(median(shoot_gaps), 3),
        'timelineIntervalCount': len(intervals),
        'hasTimeline': len(intervals) > 0,
    }


def build_timeseries_rows(
    feature_rows: List[Dict[str, Any]],
    total_sec: int,
    bin_sec: int,
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for row in feature_rows:
        intervals = parse_intervals(str(row.get('actionTimelineJson', '')), total_sec)
        team_number = coerce_int(row.get('teamNumber', 0))
        match_number = coerce_int(row.get('matchNumber', 0))

        for second in range(0, total_sec, bin_sec):
            bin_end = min(total_sec, second + bin_sec)
            shoot_overlap = 0.0
            pass_overlap = 0.0
            for interval in intervals:
                overlap_start = max(second, coerce_float(interval.get('startSec', 0)))
                overlap_end = min(bin_end, coerce_float(interval.get('endSec', 0)))
                if overlap_end <= overlap_start:
                    continue
                if interval['action'] == 'shoot':
                    shoot_overlap += overlap_end - overlap_start
                if interval['action'] == 'pass':
                    pass_overlap += overlap_end - overlap_start

            normalized_shoot = min(1.0, shoot_overlap / max(1, bin_end - second))
            normalized_pass = min(1.0, pass_overlap / max(1, bin_end - second))

            rows.append(
                {
                    'teamNumber': team_number,
                    'matchNumber': match_number,
                    'second': second,
                    'binEndSec': bin_end,
                    'binSec': bin_sec,
                    'shootActive': round(normalized_shoot, 6),
                    'passActive': round(normalized_pass, 6),
                }
            )
    return rows


def build_auto_path_rows(feature_rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for row in feature_rows:
        path = parse_json_field(row.get('autoPathJson', ''), {})
        if not isinstance(path, dict):
            continue

        points = path.get('points')
        shot_markers = path.get('shotMarkers')
        if not isinstance(points, list):
            points = []
        if not isinstance(shot_markers, list):
            shot_markers = []

        alliance = path.get('alliance', 'red')
        fingerprint = path.get('fingerprint', '')
        team_number = coerce_int(row.get('teamNumber', 0))
        match_number = coerce_int(row.get('matchNumber', 0))

        for index, point in enumerate(points):
            if not isinstance(point, dict):
                continue
            x = coerce_float(point.get('x', 0))
            y = coerce_float(point.get('y', 0))
            t_sec = coerce_float(point.get('tSec', 0))
            canonical_x = 1 - x if alliance == 'blue' else x
            rows.append(
                {
                    'teamNumber': team_number,
                    'matchNumber': match_number,
                    'alliance': alliance,
                    'kind': 'path',
                    'index': index,
                    'x': x,
                    'y': y,
                    'canonicalX': canonical_x,
                    'canonicalY': y,
                    'tSec': t_sec,
                    'fingerprint': fingerprint,
                }
            )

        for index, marker in enumerate(shot_markers):
            if not isinstance(marker, dict):
                continue
            x = coerce_float(marker.get('x', 0))
            y = coerce_float(marker.get('y', 0))
            t_sec = coerce_float(marker.get('tSec', 0))
            canonical_x = 1 - x if alliance == 'blue' else x
            rows.append(
                {
                    'teamNumber': team_number,
                    'matchNumber': match_number,
                    'alliance': alliance,
                    'kind': 'shot',
                    'index': index,
                    'x': x,
                    'y': y,
                    'canonicalX': canonical_x,
                    'canonicalY': y,
                    'tSec': t_sec,
                    'fingerprint': fingerprint,
                }
            )

    return rows


def main() -> None:
    args = parse_args('Stage 03: feature engineering for match, timeseries, and auto-path data')
    config = load_config(args.config)
    output_dir = Path(config['_output_dir'])

    match_rows = read_csv(output_dir / '02_match_clean.csv')
    game_config = load_game_config()
    segment_boundaries = get_segment_boundaries(game_config)
    total_sec = int(segment_boundaries['totalSec'])
    timeline_bin_sec = max(1, coerce_int(config.get('analysis', {}).get('timeline_bin_sec', 1), 1))
    fuel_points_active = float(game_config.get('scoring', {}).get('fuelPointsActive', 1))

    feature_rows = [
        build_features_row(row, fuel_points_active, total_sec)
        for row in match_rows
    ]

    timeseries_rows = build_timeseries_rows(feature_rows, total_sec, timeline_bin_sec)
    auto_path_rows = build_auto_path_rows(feature_rows)

    write_csv(output_dir / '03_match_features.csv', feature_rows)
    write_csv(output_dir / '03_timeseries_long.csv', timeseries_rows)
    write_csv(output_dir / '03_auto_path_points.csv', auto_path_rows)

    print(
        f"Stage 03 complete: wrote {len(feature_rows)} feature rows, {len(timeseries_rows)} timeseries rows, {len(auto_path_rows)} auto-path rows."
    )


if __name__ == '__main__':
    main()
