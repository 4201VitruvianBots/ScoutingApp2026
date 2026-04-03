import json
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from common import ROOT, load_config, load_game_config, parse_args, write_csv, write_json


ROBOT_POSITIONS = ['red_1', 'red_2', 'red_3', 'red_4', 'blue_1', 'blue_2', 'blue_3', 'blue_4']
ROBOT_POSITION_INDEX = {position: index for index, position in enumerate(ROBOT_POSITIONS)}
SEGMENTS = ['auto', 'transition', 'shift1', 'shift2', 'shift3', 'shift4', 'endgame']
SEGMENT_WEIGHT_BASE = {
    'auto': 0.15,
    'transition': 0.12,
    'shift1': 0.18,
    'shift2': 0.17,
    'shift3': 0.15,
    'shift4': 0.13,
    'endgame': 0.10,
}
SEGMENT_BOUNDS_DEFAULT = {
    'auto': (0.0, 20.0),
    'transition': (20.0, 23.0),
    'shift1': (23.0, 50.5),
    'shift2': (50.5, 78.0),
    'shift3': (78.0, 105.5),
    'shift4': (105.5, 133.0),
    'endgame': (133.0, 163.0),
}


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def weighted_choice(choices: List[tuple[Any, float]]) -> Any:
    total = sum(weight for _, weight in choices)
    roll = random.random() * total
    cursor = 0.0
    for value, weight in choices:
        cursor += weight
        if roll <= cursor:
            return value
    return choices[-1][0]


def normalize_weights(raw_weights: Dict[str, float]) -> Dict[str, float]:
    total = sum(max(0.0001, weight) for weight in raw_weights.values())
    if total <= 0:
        equal = 1.0 / len(raw_weights)
        return {key: equal for key in raw_weights}
    return {key: max(0.0001, weight) / total for key, weight in raw_weights.items()}


def to_output_path(path_like: str) -> Path:
    path = Path(path_like)
    return path if path.is_absolute() else ROOT / path


def load_schedule_slots_by_match(path: Path) -> Dict[int, List[tuple[str, int]]]:
    if not path.exists():
        return {}

    raw = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(raw, dict):
        return {}

    slots_by_match: Dict[int, List[tuple[str, int]]] = {}
    for match_key, assignments in raw.items():
        try:
            match_number = int(match_key)
        except (TypeError, ValueError):
            continue
        if match_number <= 0 or not isinstance(assignments, dict):
            continue

        slots: List[tuple[str, int]] = []
        for robot_position, team_raw in assignments.items():
            if robot_position not in ROBOT_POSITION_INDEX:
                continue
            try:
                team_number = int(team_raw)
            except (TypeError, ValueError):
                continue
            if team_number <= 0:
                continue
            slots.append((robot_position, team_number))

        if not slots:
            continue

        slots_by_match[match_number] = sorted(
            slots,
            key=lambda item: ROBOT_POSITION_INDEX[item[0]],
        )

    return dict(sorted(slots_by_match.items()))


def flatten_match_row(entry: Dict[str, Any]) -> Dict[str, Any]:
    metadata = entry.get('metadata') or {}
    return {
        'scouterName': metadata.get('scouterName', ''),
        'matchNumber': metadata.get('matchNumber'),
        'teamNumber': metadata.get('robotTeam'),
        'robotPosition': metadata.get('robotPosition', ''),
        'robotAbsent': bool(entry.get('robotAbsent', False)),
        'autoStartingPosition': entry.get('autoStartingPosition'),
        'autoPathJson': json.dumps(entry.get('autoPath') or {}, separators=(',', ':')),
        'shootTimeBySegmentJson': json.dumps(entry.get('shootTimeBySegment') or {}, separators=(',', ':')),
        'passTimeBySegmentJson': json.dumps(entry.get('passTimeBySegment') or {}, separators=(',', ':')),
        'actionTimelineJson': json.dumps(entry.get('actionTimeline') or {}, separators=(',', ':')),
        'ballsPerSecondUsed': float(entry.get('ballsPerSecondUsed', 0)),
        'autoFuelScored': float(entry.get('autoFuelScored', 0)),
        'teleFuelBySegmentJson': json.dumps(entry.get('teleFuelBySegment') or {}, separators=(',', ':')),
        'teleTower': entry.get('teleTower', 'None'),
        'breakdown': entry.get('breakdown', 'None'),
        'driverQuality': entry.get('driverQuality', 'ok'),
        'defenseProvided': entry.get('defenseProvided', 'None'),
        'defenseReceived': bool(entry.get('defenseReceived', False)),
        'foulsJson': json.dumps(entry.get('fouls') or {}, separators=(',', ':')),
        'breaksJson': json.dumps(entry.get('breaks') or {}, separators=(',', ':')),
        'freeText': entry.get('freeText', ''),
    }


def flatten_pit_row(entry: Dict[str, Any]) -> Dict[str, Any]:
    intake = entry.get('intakeSources') or {}
    if not isinstance(intake, dict):
        intake = {}

    return {
        'scouterName': entry.get('scouterName', ''),
        'teamNumber': int(entry.get('teamNumber', 0)),
        'drivebase': entry.get('drivebase', ''),
        'maxFuelStorageEstimate': entry.get('maxFuelStorageEstimate', ''),
        'intakeDepot': bool(intake.get('depot', False)),
        'intakeOutpostCorral': bool(intake.get('outpostCorral', False)),
        'intakeFloorNeutral': bool(intake.get('floorNeutral', False)),
        'scoringMethod': entry.get('scoringMethod', ''),
        'preferredScoringSpot': entry.get('preferredScoringSpot', ''),
        'towerCapabilityClaimed': entry.get('towerCapabilityClaimed', ''),
        'batteryCount': int(entry.get('batteryCount', 0)),
        'notes': entry.get('notes', ''),
    }


def build_segment_bounds(game_config: Dict[str, Any]) -> List[Dict[str, float]]:
    raw_segments = game_config.get('segments')
    if not isinstance(raw_segments, list):
        raw_segments = []
    by_id = {
        str(segment.get('id')): segment
        for segment in raw_segments
        if isinstance(segment, dict) and segment.get('id')
    }

    segments: List[Dict[str, float]] = []
    for segment_id in SEGMENTS:
        segment = by_id.get(segment_id, {})
        default_start, default_end = SEGMENT_BOUNDS_DEFAULT[segment_id]
        start_sec = float(segment.get('startSec', default_start))
        end_sec = float(segment.get('endSec', default_end))
        if end_sec <= start_sec:
            start_sec, end_sec = default_start, default_end
        segments.append(
            {
                'id': segment_id,
                'startSec': start_sec,
                'endSec': end_sec,
            }
        )

    return segments


def build_team_profile() -> Dict[str, float]:
    overall = clamp(random.gauss(0, 0.95), -2.8, 2.8)
    return {
        'overall': overall,
        'auto': clamp(overall * 0.70 + random.gauss(0, 0.58), -2.8, 2.8),
        'tele': clamp(overall * 0.85 + random.gauss(0, 0.52), -2.8, 2.8),
        'pass': clamp(overall * 0.48 + random.gauss(0, 0.68), -2.8, 2.8),
        'climb': clamp(overall * 0.62 + random.gauss(0, 0.60), -2.8, 2.8),
        'defense': clamp(overall * 0.25 + random.gauss(0, 0.95), -2.8, 2.8),
        'discipline': clamp(overall * 0.32 + random.gauss(0, 0.72), -2.8, 2.8),
        'reliability': clamp(overall * 0.45 + random.gauss(0, 0.74), -2.8, 2.8),
        'consistency': clamp(overall * 0.28 + random.gauss(0, 0.78), -2.8, 2.8),
        'tempo': clamp(overall * 0.42 + random.gauss(0, 0.66), -2.8, 2.8),
        'autoStyle': clamp(random.gauss(0, 0.75), -2.0, 2.0),
    }


def build_shoot_or_pass_by_segment(total_sec: float, profile: Dict[str, float], action: str) -> Dict[str, float]:
    if total_sec <= 0:
        return {segment: 0.0 for segment in SEGMENTS}

    raw_weights: Dict[str, float] = {}
    for segment in SEGMENTS:
        base = SEGMENT_WEIGHT_BASE[segment]
        random_jitter = random.gauss(0, 0.16)
        bias = 0.0

        if segment == 'auto':
            bias += profile['auto'] * 0.22
            if action == 'pass':
                bias -= 0.05
        elif segment == 'transition':
            bias += profile['tempo'] * 0.05
        elif segment in {'shift1', 'shift2', 'shift3', 'shift4'}:
            bias += profile['tempo'] * 0.08
            if action == 'shoot':
                bias += profile['tele'] * 0.07
            else:
                bias += profile['pass'] * 0.09
        elif segment == 'endgame':
            bias += profile['climb'] * 0.18
            if action == 'shoot':
                bias += profile['tele'] * 0.03

        raw_weights[segment] = max(0.001, base * (1.0 + random_jitter + bias))

    normalized_weights = normalize_weights(raw_weights)

    allocated: Dict[str, float] = {}
    running_total = 0.0
    for segment in SEGMENTS[:-1]:
        value = round(max(0.0, total_sec * normalized_weights[segment]), 2)
        allocated[segment] = value
        running_total += value
    allocated[SEGMENTS[-1]] = round(max(0.0, total_sec - running_total), 2)

    return allocated


def generate_action_timeline(
    shoot_by_segment: Dict[str, float],
    pass_by_segment: Dict[str, float],
    segments: List[Dict[str, float]],
    profile: Dict[str, float],
) -> Dict[str, Any]:
    intervals: List[Dict[str, Any]] = []

    rhythm = clamp(1.0 + profile['tempo'] * 0.13 + random.gauss(0, 0.09), 0.55, 1.55)

    for action, totals, base_interval in (
        ('shoot', shoot_by_segment, 0.58),
        ('pass', pass_by_segment, 0.78),
    ):
        for segment in segments:
            seg_id = str(segment['id'])
            start_sec = float(segment['startSec'])
            end_sec = float(segment['endSec'])
            seg_total = max(0.0, float(totals.get(seg_id, 0.0)))
            if seg_total <= 0.04 or end_sec <= start_sec:
                continue

            cadence = max(0.18, base_interval / rhythm)
            interval_count = int(clamp(round(seg_total / cadence), 1, 7))
            cursor = start_sec + random.uniform(0.0, min(0.42, (end_sec - start_sec) * 0.22))
            remaining = seg_total

            for index in range(interval_count):
                if remaining <= 0.03:
                    break

                intervals_left = interval_count - index
                reserve = 0.03 * max(0, intervals_left - 1)
                max_duration = min(
                    2.35 if action == 'shoot' else 1.95,
                    max(0.06, remaining - reserve),
                )
                if max_duration <= 0.05:
                    break

                min_duration = min(max_duration, 0.09 if action == 'shoot' else 0.11)
                duration = round(random.uniform(min_duration, max_duration), 2)
                latest_start = end_sec - duration
                if latest_start <= start_sec:
                    break

                interval_start = round(
                    clamp(cursor + random.uniform(-0.08, 0.11), start_sec, latest_start),
                    2,
                )
                interval_end = round(interval_start + duration, 2)
                if interval_end <= interval_start:
                    continue

                actual_duration = round(interval_end - interval_start, 2)
                intervals.append(
                    {
                        'action': action,
                        'startSec': interval_start,
                        'endSec': interval_end,
                        'durationSec': actual_duration,
                    }
                )

                remaining = max(0.0, remaining - actual_duration)
                gap = random.uniform(0.06, 0.90 if action == 'pass' else 0.72)
                gap *= clamp(1.2 - rhythm * 0.22, 0.5, 1.4)
                cursor = interval_end + gap
                if cursor >= end_sec:
                    break

            if remaining > 0.05:
                duration = round(min(remaining, max(0.08, (end_sec - start_sec) * 0.25)), 2)
                latest_start = end_sec - duration
                if latest_start > start_sec:
                    interval_start = round(random.uniform(start_sec, latest_start), 2)
                    interval_end = round(interval_start + duration, 2)
                    intervals.append(
                        {
                            'action': action,
                            'startSec': interval_start,
                            'endSec': interval_end,
                            'durationSec': round(interval_end - interval_start, 2),
                        }
                    )

    intervals.sort(key=lambda item: (item['startSec'], item['action']))
    return {'intervals': intervals}


def make_auto_path(
    alliance: str,
    start_position: str | None,
    match_number: int,
    team_number: int,
    profile: Dict[str, float],
) -> Dict[str, Any] | None:
    if start_position is None:
        return None

    start_x = 0.69 if alliance == 'red' else 0.34
    start_y = {'left': 0.33, 'center': 0.5, 'right': 0.67}[start_position]
    direction = -1 if alliance == 'red' else 1

    point_count = random.randint(9, 15)
    arc_height = 0.08 + max(0.0, profile['auto']) * 0.03 + random.uniform(-0.02, 0.02)
    lane_drift = clamp(profile['autoStyle'] * 0.03 + random.uniform(-0.04, 0.04), -0.12, 0.12)
    wobble = clamp(0.03 + max(0.0, -profile['consistency']) * 0.015, 0.02, 0.08)

    points: List[Dict[str, float]] = []
    for index in range(point_count):
        progress = 0.0 if point_count == 1 else index / (point_count - 1)
        eased_progress = progress ** clamp(0.82 + random.uniform(-0.1, 0.12), 0.65, 1.2)
        x = start_x + direction * eased_progress * 0.26 + random.uniform(-wobble, wobble)
        y = (
            start_y
            + arc_height * (1 - abs(0.5 - progress) * 2)
            + lane_drift * (progress - 0.5) * 2
            + random.uniform(-wobble * 0.6, wobble * 0.6)
        )

        points.append(
            {
                'x': round(clamp(x, 0, 1), 4),
                'y': round(clamp(y, 0, 1), 4),
                'tSec': round(progress * 20, 2),
            }
        )

    interior_indexes = list(range(2, max(3, point_count - 1)))
    random.shuffle(interior_indexes)
    marker_count = int(clamp(round(1 + max(0.0, profile['auto']) * 0.8 + random.uniform(0, 1.2)), 1, 3))
    shot_markers = [points[index] for index in sorted(interior_indexes[:marker_count])]

    return {
        'alliance': alliance,
        'startPosition': start_position,
        'points': points,
        'shotMarkers': shot_markers,
        'fingerprint': (
            f'fake-{team_number}-{match_number}-{alliance}-{start_position}-'
            f'{random.randint(10000, 99999)}'
        ),
    }


def chance_to_count(probability: float) -> int:
    if random.random() >= probability:
        return 0
    return 2 if random.random() < min(0.4, probability * 0.25) else 1


def build_foul_payload(profile: Dict[str, float], stress: float) -> Dict[str, int]:
    foul_pressure = (
        0.03
        + max(0.0, -profile['discipline']) * 0.05
        + max(0.0, profile['defense']) * 0.018
        + max(0.0, stress) * 0.015
    )
    foul_pressure = clamp(foul_pressure, 0.01, 0.45)
    return {
        'pinning': chance_to_count(clamp(foul_pressure * 1.1, 0.01, 0.45)),
        'towerContactInEndgame': chance_to_count(clamp(foul_pressure * 0.85, 0.01, 0.35)),
        'outOfZoneShooting': chance_to_count(clamp(foul_pressure * 0.95, 0.01, 0.38)),
        'ejectedFuel': chance_to_count(clamp(foul_pressure * 0.75, 0.01, 0.3)),
        'other': chance_to_count(clamp(foul_pressure * 0.8, 0.01, 0.32)),
    }


def build_break_payload(profile: Dict[str, float], stress: float) -> Dict[str, int]:
    break_pressure = (
        0.02
        + max(0.0, -profile['reliability']) * 0.065
        + max(0.0, stress) * 0.02
    )
    break_pressure = clamp(break_pressure, 0.005, 0.42)
    return {
        'mechanism': chance_to_count(clamp(break_pressure * 1.2, 0.005, 0.42)),
        'battery': chance_to_count(clamp(break_pressure * 0.7, 0.005, 0.28)),
        'comms': chance_to_count(clamp(break_pressure * 0.75, 0.005, 0.3)),
        'bumper': chance_to_count(clamp(break_pressure * 0.6, 0.005, 0.24)),
    }


def build_driver_quality(profile: Dict[str, float], match_form: float) -> str:
    quality_score = profile['tele'] * 0.75 + profile['discipline'] * 0.25 + match_form
    if quality_score >= 1.15:
        return weighted_choice([('great', 0.75), ('good', 0.24), ('ok', 0.01)])
    if quality_score >= 0.3:
        return weighted_choice([('great', 0.2), ('good', 0.62), ('ok', 0.17), ('rough', 0.01)])
    if quality_score >= -0.7:
        return weighted_choice([('good', 0.2), ('ok', 0.6), ('rough', 0.2)])
    return weighted_choice([('ok', 0.35), ('rough', 0.65)])


def build_defense_provided(profile: Dict[str, float], match_form: float) -> str:
    defense_score = profile['defense'] + match_form * 0.35
    if defense_score >= 1.0:
        return weighted_choice([('heavy', 0.62), ('some', 0.3), ('None', 0.08)])
    if defense_score >= 0.1:
        return weighted_choice([('heavy', 0.24), ('some', 0.54), ('None', 0.22)])
    return weighted_choice([('heavy', 0.08), ('some', 0.32), ('None', 0.6)])


def build_tele_tower(profile: Dict[str, float], robot_absent: bool) -> str:
    if robot_absent:
        return 'None'

    climb_score = profile['climb']
    level3_weight = clamp(0.08 + max(0.0, climb_score) * 0.18, 0.04, 0.6)
    level2_weight = clamp(0.2 + max(0.0, climb_score) * 0.12, 0.12, 0.55)
    level1_weight = clamp(0.24 + max(0.0, climb_score) * 0.05, 0.12, 0.5)
    failed_weight = clamp(0.06 + max(0.0, -climb_score) * 0.14, 0.04, 0.48)
    none_weight = clamp(0.22 + max(0.0, -climb_score) * 0.22, 0.08, 0.62)

    return weighted_choice(
        [
            ('None', none_weight),
            ('level1', level1_weight),
            ('level2', level2_weight),
            ('level3', level3_weight),
            ('Failed', failed_weight),
        ]
    )


def build_pit_entry(team: int, profile: Dict[str, float], scouters: List[str]) -> Dict[str, Any]:
    drivebase = weighted_choice(
        [
            ('tank', 0.38 + max(0.0, -profile['overall']) * 0.08),
            ('swerve', 0.34 + max(0.0, profile['overall']) * 0.16),
            ('other', 0.18),
        ]
    )

    tower_capability = weighted_choice(
        [
            ('level1', 0.24),
            ('level2', 0.3 + max(0.0, profile['climb']) * 0.06),
            ('level3', 0.16 + max(0.0, profile['climb']) * 0.13),
            ('unknown', 0.2 + max(0.0, -profile['climb']) * 0.08),
        ]
    )

    scoring_method = weighted_choice(
        [
            ('dump', 0.22 + max(0.0, -profile['tele']) * 0.06),
            ('low-shot', 0.24 + max(0.0, -profile['tele']) * 0.08),
            ('high-shot', 0.26 + max(0.0, profile['tele']) * 0.18),
            ('other', 0.12),
        ]
    )

    preferred_spot = weighted_choice(
        [
            ('nearHub', 0.35 + max(0.0, profile['tele']) * 0.05),
            ('backOfZone', 0.25 + max(0.0, profile['pass']) * 0.04),
            ('varies', 0.4),
        ]
    )

    return {
        'scouterName': random.choice(scouters),
        'teamNumber': team,
        'drivebase': drivebase,
        'maxFuelStorageEstimate': int(
            clamp(round(24 + profile['tele'] * 8 + random.gauss(0, 6)), 5, 60)
        ),
        'intakeSources': {
            'depot': random.random() < clamp(0.66 + profile['reliability'] * 0.05, 0.25, 0.95),
            'outpostCorral': random.random() < clamp(0.42 + profile['pass'] * 0.07, 0.15, 0.9),
            'floorNeutral': random.random() < clamp(0.55 + profile['tele'] * 0.06, 0.2, 0.95),
        },
        'scoringMethod': scoring_method,
        'preferredScoringSpot': preferred_spot,
        'towerCapabilityClaimed': tower_capability,
        'batteryCount': int(clamp(round(4 + profile['reliability'] * 1.1 + random.gauss(0, 1.2)), 2, 8)),
        'notes': weighted_choice(
            [
                ('', 0.55),
                ('Prefers fast cycle rhythm.', 0.12),
                ('Needs occasional reset after defense contact.', 0.08),
                ('Strong auto consistency in center lane.', 0.1),
                ('Can switch between scoring and defense mid-match.', 0.1),
                ('Battery swap critical before playoffs.', 0.05),
            ]
        ),
    }


def main() -> None:
    args = parse_args(
        'Stage 07: generate schema-valid fake data, emit JSON+CSV local sources, and optionally seed MongoDB'
    )
    config = load_config(args.config)
    output_dir = Path(config['_output_dir'])
    game_config = load_game_config()

    fake_cfg = config.get('fake_data', {})
    source_cfg = config.get('source', {})

    match_count = int(fake_cfg.get('match_count', 72))
    team_count = int(fake_cfg.get('team_count', 36))
    team_start = int(fake_cfg.get('team_start', 1000))
    scouter_count = int(fake_cfg.get('scouter_count', 12))
    include_pit = bool(fake_cfg.get('include_pit', True))
    seed_mongo = bool(fake_cfg.get('seed_mongo', False))
    use_match_schedule = bool(fake_cfg.get('use_match_schedule', True))
    match_schedule_path = to_output_path(
        str(fake_cfg.get('match_schedule_json', 'client/src/assets/matchSchedule.json'))
    )

    schedule_slots_by_match: Dict[int, List[tuple[str, int]]] = {}
    if use_match_schedule:
        schedule_slots_by_match = load_schedule_slots_by_match(match_schedule_path)
        if not schedule_slots_by_match:
            print(
                f'Stage 07: no usable schedule rows found at {match_schedule_path}; '
                'falling back to random match generation.'
            )

    teams = sorted(
        {
            team_number
            for slots in schedule_slots_by_match.values()
            for _, team_number in slots
        }
    )
    if not teams:
        teams = [team_start + index for index in range(team_count)]

    scouters = [f'Scout {index + 1}' for index in range(scouter_count)]
    team_profiles = {team: build_team_profile() for team in teams}

    segments = build_segment_bounds(game_config)
    total_sec = float(game_config.get('matchDurationSec', SEGMENT_BOUNDS_DEFAULT['endgame'][1]))
    auto_end = next((segment['endSec'] for segment in segments if segment['id'] == 'auto'), 20.0)
    delay_end = next((segment['endSec'] for segment in segments if segment['id'] == 'transition'), 23.0)

    match_slots_sequence: List[tuple[int, List[tuple[str, int]]]] = []
    if schedule_slots_by_match:
        match_slots_sequence = [
            (match_number, slots)
            for match_number, slots in sorted(schedule_slots_by_match.items())
        ]
        print(
            'Stage 07: generating fake matches from schedule '
            f'({len(match_slots_sequence)} matches, {len(teams)} teams).'
        )
    else:
        print(
            'Stage 07: generating fake matches from random pairings '
            f'({match_count} matches, {len(teams)} teams).'
        )
        for match_number in range(1, match_count + 1):
            selected_teams = random.sample(teams, k=min(len(teams), len(ROBOT_POSITIONS)))
            if len(selected_teams) < len(ROBOT_POSITIONS):
                selected_teams.extend(
                    random.choices(teams, k=len(ROBOT_POSITIONS) - len(selected_teams))
                )
            slots = list(zip(ROBOT_POSITIONS, selected_teams))
            match_slots_sequence.append((match_number, slots))

    fake_matches: List[Dict[str, Any]] = []
    fake_balls_per_second_settings: List[Dict[str, Any]] = []

    for match_number, match_slots in match_slots_sequence:
        field_skill = sum(team_profiles[team]['overall'] for _, team in match_slots) / max(
            1,
            len(match_slots),
        )

        for robot_position, team_number in match_slots:
            profile = team_profiles[team_number]
            alliance = 'red' if robot_position.startswith('red') else 'blue'

            variance_scale = clamp(0.44 - profile['consistency'] * 0.07, 0.14, 0.74)
            match_form = random.gauss(0, variance_scale)
            stress = max(0.0, field_skill - profile['overall']) + max(0.0, -match_form)

            absent_probability = clamp(
                0.012
                + max(0.0, -profile['reliability']) * 0.046
                + max(0.0, -match_form) * 0.015,
                0.005,
                0.18,
            )
            robot_absent = random.random() < absent_probability

            scoring_multiplier = clamp(1.0 + profile['tele'] * 0.21 + match_form * 0.14, 0.3, 2.35)
            auto_multiplier = clamp(1.0 + profile['auto'] * 0.24 + match_form * 0.1, 0.25, 2.2)
            pass_multiplier = clamp(1.0 + profile['pass'] * 0.22 + match_form * 0.1, 0.2, 2.1)

            balls_per_second = round(
                clamp(
                    random.gauss(5.0, 0.55)
                    * scoring_multiplier
                    * clamp(1.0 + profile['tempo'] * 0.05, 0.78, 1.28),
                    2.6,
                    8.2,
                ),
                2,
            )

            shoot_total = 0.0
            pass_total = 0.0
            if not robot_absent:
                shoot_total = clamp(
                    random.uniform(4.8, 11.8) * scoring_multiplier + max(0.0, profile['auto']) * 0.85 * auto_multiplier,
                    0.0,
                    19.5,
                )
                pass_total = clamp(
                    random.uniform(0.8, 5.5) * pass_multiplier + max(0.0, profile['defense']) * 0.28,
                    0.0,
                    8.0,
                )

            shoot_by_segment = build_shoot_or_pass_by_segment(shoot_total, profile, 'shoot')
            pass_by_segment = build_shoot_or_pass_by_segment(pass_total, profile, 'pass')

            action_timeline = generate_action_timeline(shoot_by_segment, pass_by_segment, segments, profile)
            action_timeline['totalSec'] = total_sec
            action_timeline['autoEndSec'] = auto_end
            action_timeline['delayEndSec'] = delay_end

            auto_starting_position = None if robot_absent else random.choice(['left', 'center', 'right'])
            auto_path = make_auto_path(
                alliance,
                auto_starting_position,
                match_number,
                team_number,
                profile,
            )

            tele_fuel_by_segment = {
                segment: round(shoot_by_segment[segment] * balls_per_second, 2)
                for segment in SEGMENTS
                if segment != 'auto'
            }

            breakdown_weights = [
                ('None', clamp(0.86 + profile['reliability'] * 0.06, 0.4, 0.97)),
                ('stuck', clamp(0.03 + max(0.0, -profile['reliability']) * 0.04, 0.01, 0.3)),
                ('tipped', clamp(0.02 + max(0.0, -profile['discipline']) * 0.03, 0.005, 0.2)),
                ('comms', clamp(0.02 + max(0.0, -profile['reliability']) * 0.03, 0.005, 0.2)),
                ('mechanism', clamp(0.03 + max(0.0, -profile['reliability']) * 0.05, 0.01, 0.28)),
                ('other', 0.015),
            ]

            defense_received_probability = clamp(
                0.25
                + max(0.0, field_skill) * 0.04
                + max(0.0, profile['tele']) * 0.06
                + random.uniform(-0.05, 0.08),
                0.08,
                0.88,
            )

            fake_matches.append(
                {
                    'metadata': {
                        'scouterName': random.choice(scouters),
                        'matchNumber': match_number,
                        'robotTeam': team_number,
                        'robotPosition': robot_position,
                    },
                    'robotAbsent': robot_absent,
                    'autoStartingPosition': auto_starting_position,
                    'autoPath': auto_path,
                    'shootTimeBySegment': shoot_by_segment,
                    'passTimeBySegment': pass_by_segment,
                    'actionTimeline': action_timeline,
                    'ballsPerSecondUsed': balls_per_second,
                    'autoFuelScored': round(shoot_by_segment['auto'] * balls_per_second, 2),
                    'teleFuelBySegment': {
                        'transition': tele_fuel_by_segment.get('transition', 0.0),
                        'shift1': tele_fuel_by_segment.get('shift1', 0.0),
                        'shift2': tele_fuel_by_segment.get('shift2', 0.0),
                        'shift3': tele_fuel_by_segment.get('shift3', 0.0),
                        'shift4': tele_fuel_by_segment.get('shift4', 0.0),
                        'endgame': tele_fuel_by_segment.get('endgame', 0.0),
                    },
                    'teleTower': build_tele_tower(profile, robot_absent),
                    'breakdown': 'None' if robot_absent else weighted_choice(breakdown_weights),
                    'driverQuality': build_driver_quality(profile, match_form),
                    'defenseProvided': build_defense_provided(profile, match_form),
                    'defenseReceived': random.random() < defense_received_probability,
                    'fouls': build_foul_payload(profile, stress),
                    'breaks': build_break_payload(profile, stress),
                    'freeText': weighted_choice(
                        [
                            ('', 0.55),
                            (f'Fake note: clean cycles in match {match_number}.', 0.1),
                            (f'Fake note: pressured by defense in match {match_number}.', 0.12),
                            (f'Fake note: auto path drifted in match {match_number}.', 0.08),
                            (f'Fake note: recovered after early fault in match {match_number}.', 0.07),
                            (f'Fake note: switched to defense mid-match {match_number}.', 0.08),
                        ]
                    ),
                }
            )
            fake_balls_per_second_settings.append(
                {
                    'matchNumber': match_number,
                    'robotTeam': team_number,
                    'ballsPerSecond': balls_per_second,
                }
            )

    fake_pit: List[Dict[str, Any]] = []
    if include_pit:
        fake_pit = [build_pit_entry(team, team_profiles[team], scouters) for team in teams]

    fake_match_path = to_output_path(
        source_cfg.get('fake_match_json', 'data-analysis/output/fake_match_source.json')
    )
    fake_pit_path = to_output_path(
        source_cfg.get('fake_pit_json', 'data-analysis/output/fake_pit_source.json')
    )
    fake_match_csv_path = to_output_path(
        source_cfg.get('fake_match_csv', 'data-analysis/output/fake_match_source.csv')
    )
    fake_pit_csv_path = to_output_path(
        source_cfg.get('fake_pit_csv', 'data-analysis/output/fake_pit_source.csv')
    )

    write_json(fake_match_path, fake_matches)
    write_json(fake_pit_path, fake_pit)
    write_csv(fake_match_csv_path, [flatten_match_row(entry) for entry in fake_matches])
    write_csv(fake_pit_csv_path, [flatten_pit_row(entry) for entry in fake_pit])

    team_profile_rows = []
    for team in sorted(team_profiles):
        profile = team_profiles[team]
        team_profile_rows.append(
            {
                'teamNumber': team,
                'overall': round(profile['overall'], 4),
                'auto': round(profile['auto'], 4),
                'tele': round(profile['tele'], 4),
                'pass': round(profile['pass'], 4),
                'climb': round(profile['climb'], 4),
                'defense': round(profile['defense'], 4),
                'discipline': round(profile['discipline'], 4),
                'reliability': round(profile['reliability'], 4),
                'consistency': round(profile['consistency'], 4),
                'tempo': round(profile['tempo'], 4),
            }
        )
    write_csv(output_dir / '07_fake_team_profiles.csv', team_profile_rows)

    seeded = False
    if seed_mongo:
        from pymongo import MongoClient

        client = MongoClient(source_cfg.get('mongo_url', 'mongodb://localhost:27017/'))
        db = client[source_cfg.get('db', 'test')]
        db.matchapps.delete_many({})
        db.pitapps.delete_many({})
        db.ballspersecondapps.delete_many({})
        if fake_matches:
            db.matchapps.insert_many(fake_matches)
        if fake_pit:
            db.pitapps.insert_many(fake_pit)
        if fake_balls_per_second_settings:
            db.ballspersecondapps.insert_many(fake_balls_per_second_settings)
        client.close()
        seeded = True

    report = {
        'stage': '07_seed_fake_data',
        'generatedAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'matchCount': len(fake_matches),
        'uniqueMatches': len(match_slots_sequence),
        'usedMatchSchedule': bool(schedule_slots_by_match),
        'matchSchedulePath': str(match_schedule_path),
        'pitCount': len(fake_pit),
        'ballsPerSecondCount': len(fake_balls_per_second_settings),
        'seededMongo': seeded,
        'fakeMatchPath': str(fake_match_path),
        'fakePitPath': str(fake_pit_path),
        'fakeMatchCsvPath': str(fake_match_csv_path),
        'fakePitCsvPath': str(fake_pit_csv_path),
        'fakeTeamProfileCsvPath': str(output_dir / '07_fake_team_profiles.csv'),
    }
    write_json(output_dir / '07_seed_report.json', report)

    print(
        'Stage 07 complete: '
        f'wrote {len(fake_matches)} fake match docs and {len(fake_pit)} fake pit docs, '
        f'plus CSV sources. Mongo seeded={seeded}.'
    )


if __name__ == '__main__':
    main()
