import argparse
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Tuple

from pymongo import MongoClient

from common import (
    coerce_bool,
    create_timestamped_run_dir,
    flatten_match_row,
    flatten_pit_row,
    get_expected_robot_positions,
    load_game_config,
    load_match_schedule,
    load_settings,
    load_teams_list,
    utc_now_iso,
    write_csv,
    write_json,
    write_latest_run_pointer,
)

SEGMENT_IDS = ['auto', 'transition', 'shift1', 'shift2', 'shift3', 'shift4', 'endgame']


@dataclass
class TeamLatent:
    offense: float
    auto_skill: float
    passing_tendency: float
    defense_tendency: float
    reliability: float
    discipline: float
    volatility: float
    trend: float
    cycle_speed: float


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def bounded_gauss(mean: float, std_dev: float, minimum: float, maximum: float) -> float:
    return clamp(random.gauss(mean, std_dev), minimum, maximum)


def weighted_choice(choices: List[Tuple[Any, float]]) -> Any:
    total = sum(weight for _, weight in choices)
    roll = random.random() * total
    cursor = 0.0
    for value, weight in choices:
        cursor += weight
        if roll <= cursor:
            return value
    return choices[-1][0]


def gamma_split(total: float, weights: List[float]) -> List[float]:
    if total <= 0:
        return [0.0 for _ in weights]

    samples: List[float] = []
    for weight in weights:
        alpha = max(0.08, weight) * 8.0
        samples.append(random.gammavariate(alpha, 1.0))

    sample_total = sum(samples)
    if sample_total <= 0:
        return [round(total / len(weights), 3) for _ in weights]

    return [round(total * (sample / sample_total), 3) for sample in samples]


def get_alliance(position: str) -> str:
    return 'red' if position.startswith('red') else 'blue'


def make_team_latents(teams: List[int]) -> Dict[int, TeamLatent]:
    latents: Dict[int, TeamLatent] = {}
    for team in teams:
        latents[team] = TeamLatent(
            offense=bounded_gauss(0.55, 0.22, 0.05, 0.98),
            auto_skill=bounded_gauss(0.5, 0.24, 0.02, 0.99),
            passing_tendency=bounded_gauss(0.45, 0.23, 0.02, 0.98),
            defense_tendency=bounded_gauss(0.42, 0.25, 0.01, 0.99),
            reliability=bounded_gauss(0.7, 0.2, 0.08, 0.99),
            discipline=bounded_gauss(0.67, 0.2, 0.05, 0.99),
            volatility=bounded_gauss(0.32, 0.18, 0.05, 0.95),
            trend=bounded_gauss(0.0, 0.16, -0.32, 0.35),
            cycle_speed=bounded_gauss(0.56, 0.22, 0.08, 0.98),
        )
    return latents


def build_random_schedule(teams: List[int], random_match_count: int) -> Dict[int, Dict[str, int]]:
    expected_positions = get_expected_robot_positions()
    robots_per_match = len(expected_positions)
    if len(teams) < robots_per_match:
        raise ValueError(
            f'Need at least {robots_per_match} teams in teams_list.txt for random generation.'
        )

    schedule: Dict[int, Dict[str, int]] = {}
    for match_number in range(1, random_match_count + 1):
        selected = random.sample(teams, robots_per_match)
        schedule[match_number] = {
            position: team for position, team in zip(expected_positions, selected)
        }
    return schedule


def assign_roles(alliance_robots: List[Tuple[str, int]], latents: Dict[int, TeamLatent]) -> Dict[int, str]:
    if not alliance_robots:
        return {}

    by_offense = sorted(
        alliance_robots,
        key=lambda item: latents[item[1]].offense + 0.2 * latents[item[1]].auto_skill,
        reverse=True,
    )
    by_defense = sorted(
        alliance_robots,
        key=lambda item: latents[item[1]].defense_tendency,
        reverse=True,
    )

    roles: Dict[int, str] = {}
    roles[by_offense[0][1]] = 'primary_scorer'

    if len(alliance_robots) >= 2:
        support_candidate = by_offense[1][1]
        roles[support_candidate] = 'support'

    defense_candidate = by_defense[0][1]
    if defense_candidate in roles and len(alliance_robots) >= 3:
        defense_candidate = by_defense[1][1]
    roles[defense_candidate] = 'defense'

    for _, team_number in alliance_robots:
        roles.setdefault(team_number, 'support')
    return roles


def role_multipliers(role: str) -> Dict[str, float]:
    if role == 'primary_scorer':
        return {'shoot': 1.22, 'pass': 0.72, 'defense': 0.62}
    if role == 'defense':
        return {'shoot': 0.62, 'pass': 0.9, 'defense': 1.28}
    return {'shoot': 0.9, 'pass': 1.05, 'defense': 0.9}


def split_segment_times(
    shoot_total_sec: float,
    pass_total_sec: float,
    auto_focus: float,
) -> Tuple[Dict[str, float], Dict[str, float]]:
    # Early segments are weighted heavier for high-auto teams.
    shoot_weights = [
        0.17 + auto_focus * 0.18,
        0.12,
        0.17,
        0.16,
        0.15,
        0.13,
        0.1,
    ]
    pass_weights = [
        0.09 + auto_focus * 0.05,
        0.14,
        0.18,
        0.2,
        0.18,
        0.13,
        0.08,
    ]
    shoot_parts = gamma_split(shoot_total_sec, shoot_weights)
    pass_parts = gamma_split(pass_total_sec, pass_weights)

    shoot_map = {segment: round(value, 3) for segment, value in zip(SEGMENT_IDS, shoot_parts)}
    pass_map = {segment: round(value, 3) for segment, value in zip(SEGMENT_IDS, pass_parts)}
    return shoot_map, pass_map


def generate_action_timeline(
    shoot_by_segment: Dict[str, float],
    pass_by_segment: Dict[str, float],
    segments: List[Dict[str, Any]],
) -> Dict[str, Any]:
    intervals: List[Dict[str, Any]] = []

    for action, totals in [('shoot', shoot_by_segment), ('pass', pass_by_segment)]:
        for segment in segments:
            seg_id = segment['id']
            if seg_id not in totals:
                continue
            segment_total = max(0.0, float(totals.get(seg_id, 0.0)))
            if segment_total < 0.08:
                continue

            start = float(segment['startSec'])
            end = float(segment['endSec'])
            segment_len = max(0.1, end - start)
            interval_count = int(clamp(round(segment_total / 0.75), 1, 6))
            remaining = segment_total

            cursor = start + random.random() * min(0.35, segment_len * 0.15)
            for _ in range(interval_count):
                if remaining <= 0.03:
                    break

                max_duration = min(1.9, remaining)
                min_duration = min(0.12, max_duration)
                duration = clamp(random.uniform(min_duration, max_duration), 0.04, max_duration)

                latest_start = end - duration
                if latest_start <= start:
                    break

                interval_start = clamp(cursor, start, latest_start)
                interval_end = interval_start + duration
                if interval_end <= interval_start:
                    continue

                intervals.append(
                    {
                        'action': action,
                        'startSec': round(interval_start, 2),
                        'endSec': round(interval_end, 2),
                        'durationSec': round(interval_end - interval_start, 2),
                    }
                )

                remaining = max(0.0, remaining - (interval_end - interval_start))
                cursor = interval_end + random.uniform(0.07, 0.5)

    intervals.sort(key=lambda row: (row['startSec'], row['action']))
    return {'intervals': intervals}


def make_auto_path(
    alliance: str,
    start_position: str | None,
    auto_skill: float,
    offense: float,
    match_number: int,
    team_number: int,
) -> Dict[str, Any] | None:
    if start_position is None:
        return None

    start_x = 0.69 if alliance == 'red' else 0.34
    start_y = {'left': 0.33, 'center': 0.5, 'right': 0.67}[start_position]
    direction = -1 if alliance == 'red' else 1

    control_bias = (offense - 0.5) * 0.08
    wobble_scale = clamp(0.075 - auto_skill * 0.05, 0.01, 0.08)

    points: List[Dict[str, float]] = []
    count = int(clamp(10 + auto_skill * 8, 10, 18))
    for index in range(count):
        progress = index / max(1, count - 1)
        lateral = (0.14 * (1 - abs(0.5 - progress) * 2)) + control_bias
        wobble = random.uniform(-wobble_scale, wobble_scale)
        points.append(
            {
                'x': round(clamp(start_x + direction * (progress * (0.23 + auto_skill * 0.08)) + wobble, 0.0, 1.0), 4),
                'y': round(clamp(start_y + lateral + wobble * 0.7, 0.0, 1.0), 4),
                'tSec': round(progress * 20.0, 2),
            }
        )

    shot_count = 1 if auto_skill < 0.4 else 2 if auto_skill < 0.75 else 3
    shot_indexes = sorted(random.sample(range(2, max(3, len(points) - 1)), shot_count))
    shot_markers = [points[index] for index in shot_indexes if index < len(points)]

    return {
        'alliance': alliance,
        'startPosition': start_position,
        'points': points,
        'shotMarkers': shot_markers,
        'fingerprint': f'fake-{team_number}-{match_number}-{random.randint(1000, 9999)}',
    }


def pick_driver_quality(offense_signal: float, reliability: float) -> str:
    score = clamp(0.55 * offense_signal + 0.45 * reliability + random.gauss(0.0, 0.11), 0.0, 1.0)
    if score < 0.2:
        return 'Poor'
    if score < 0.4:
        return 'Rough'
    if score < 0.63:
        return 'Ok'
    if score < 0.82:
        return 'Good'
    return 'Great'


def pick_breakdown(reliability: float, volatility: float) -> str:
    failure_prob = clamp((1.0 - reliability) * 0.16 + volatility * 0.05, 0.01, 0.24)
    if random.random() >= failure_prob:
        return 'None'
    return weighted_choice(
        [
            ('stuck', 0.31),
            ('tipped', 0.16),
            ('comms', 0.23),
            ('mechanism', 0.24),
            ('other', 0.06),
        ]
    )


def simulate_match_documents(
    schedule: Dict[int, Dict[str, int]],
    teams: List[int],
    scouter_count: int,
    include_pit: bool,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, float]]]:
    game_config = load_game_config()
    segments = game_config.get('segments', [])
    total_sec = float(game_config.get('matchDurationSec', 163))
    auto_end = next((segment.get('endSec', 20) for segment in segments if segment.get('id') == 'auto'), 20)
    delay_end = next((segment.get('endSec', 23) for segment in segments if segment.get('id') == 'transition'), 23)

    latents = make_team_latents(teams)
    scouters = [f'Scout {index + 1}' for index in range(max(1, scouter_count))]

    expected_positions = get_expected_robot_positions()
    match_docs: List[Dict[str, Any]] = []
    pit_docs: List[Dict[str, Any]] = []
    balls_per_second_docs: List[Dict[str, float]] = []

    ordered_matches = sorted(schedule.items(), key=lambda row: row[0])
    total_matches = len(ordered_matches)

    for match_index, (match_number, assignment) in enumerate(ordered_matches):
        red_robots = [(position, assignment[position]) for position in expected_positions if position.startswith('red_')]
        blue_robots = [(position, assignment[position]) for position in expected_positions if position.startswith('blue_')]

        red_roles = assign_roles(red_robots, latents)
        blue_roles = assign_roles(blue_robots, latents)
        roles = {**red_roles, **blue_roles}

        red_def_strength = sum(latents[team].defense_tendency for _, team in red_robots) / max(1, len(red_robots))
        blue_def_strength = sum(latents[team].defense_tendency for _, team in blue_robots) / max(1, len(blue_robots))

        for position, team_number in sorted(assignment.items()):
            alliance = get_alliance(position)
            role = roles.get(team_number, 'support')
            multipliers = role_multipliers(role)
            latent = latents[team_number]

            progress = match_index / max(1, total_matches - 1)
            trend_factor = 1.0 + latent.trend * progress
            opponent_defense = blue_def_strength if alliance == 'red' else red_def_strength

            stability_noise = random.gauss(1.0, 0.08 + latent.volatility * 0.2)
            performance_signal = clamp(
                (0.6 * latent.offense + 0.4 * latent.cycle_speed)
                * trend_factor
                * (1.05 - opponent_defense * 0.22)
                * stability_noise,
                0.05,
                1.7,
            )

            absent_probability = clamp((1 - latent.reliability) * 0.05 + latent.volatility * 0.01, 0.005, 0.08)
            robot_absent = random.random() < absent_probability

            if robot_absent:
                shoot_total = 0.0
                pass_total = 0.0
                auto_starting_position = None
            else:
                action_budget = clamp(
                    7.0 + 14.0 * latent.cycle_speed * trend_factor,
                    3.2,
                    26.0,
                )
                shoot_share = clamp(
                    0.5
                    + 0.26 * (latent.offense - latent.passing_tendency)
                    + (multipliers['shoot'] - 1.0) * 0.5
                    - opponent_defense * 0.08,
                    0.22,
                    0.86,
                )

                shoot_total = clamp(action_budget * shoot_share * performance_signal * multipliers['shoot'], 0.5, 26.0)
                pass_total = clamp(
                    action_budget
                    * (1.0 - shoot_share)
                    * (0.65 + latent.passing_tendency)
                    * multipliers['pass']
                    * clamp(random.gauss(1.0, 0.14), 0.4, 1.7),
                    0.0,
                    14.0,
                )

                auto_starting_position = weighted_choice(
                    [
                        ('left', 0.34),
                        ('center', 0.32 + latent.auto_skill * 0.22),
                        ('right', 0.34),
                    ]
                )

            shoot_by_segment, pass_by_segment = split_segment_times(
                shoot_total,
                pass_total,
                auto_focus=latent.auto_skill,
            )

            balls_per_second = 0.0
            if not robot_absent:
                balls_per_second = round(
                    clamp(
                        3.3
                        + latent.offense * 1.9
                        + latent.cycle_speed * 1.6
                        - opponent_defense * 0.75
                        + random.gauss(0.0, 0.35),
                        2.6,
                        8.8,
                    ),
                    2,
                )

            action_timeline = generate_action_timeline(shoot_by_segment, pass_by_segment, segments)
            action_timeline['totalSec'] = total_sec
            action_timeline['autoEndSec'] = auto_end
            action_timeline['delayEndSec'] = delay_end

            auto_path = None if robot_absent else make_auto_path(
                alliance=alliance,
                start_position=auto_starting_position,
                auto_skill=latent.auto_skill,
                offense=latent.offense,
                match_number=match_number,
                team_number=team_number,
            )

            tele_fuel_by_segment = {
                segment: round(shoot_by_segment[segment] * balls_per_second, 2)
                for segment in SEGMENT_IDS
                if segment != 'auto'
            }
            auto_fuel_scored = round(shoot_by_segment['auto'] * balls_per_second * clamp(0.78 + latent.auto_skill * 0.42, 0.6, 1.25), 2)

            defense_declared_value = clamp(
                latent.defense_tendency * multipliers['defense']
                + (0.28 if role == 'defense' else 0.0)
                + random.gauss(0.0, 0.12),
                0.0,
                1.3,
            )
            if defense_declared_value < 0.33:
                defense_provided = 'None'
            elif defense_declared_value < 0.72:
                defense_provided = 'some'
            else:
                defense_provided = 'heavy'

            defense_received_probability = clamp(
                0.14 + opponent_defense * 0.55 + (0.08 if role == 'primary_scorer' else 0.0),
                0.05,
                0.9,
            )

            foul_pressure = clamp((1.0 - latent.discipline) * 0.22 + (0.08 if defense_provided == 'heavy' else 0.0), 0.01, 0.36)
            break_pressure = clamp((1.0 - latent.reliability) * 0.22 + latent.volatility * 0.08, 0.01, 0.42)

            driver_quality = pick_driver_quality(performance_signal, latent.reliability)
            breakdown = pick_breakdown(latent.reliability, latent.volatility)

            tele_tower_roll = clamp(
                0.35 * latent.reliability + 0.35 * latent.offense + 0.25 * trend_factor + random.gauss(0.0, 0.18),
                -0.2,
                1.5,
            )
            if robot_absent:
                tele_tower = 'None'
            elif tele_tower_roll < 0.16:
                tele_tower = 'None'
            elif tele_tower_roll < 0.48:
                tele_tower = 'level1'
            elif tele_tower_roll < 0.83:
                tele_tower = 'level2'
            elif tele_tower_roll < 1.08:
                tele_tower = 'level3'
            else:
                tele_tower = 'Failed'

            fouls = {
                'pinning': 1 if random.random() < foul_pressure * 0.55 else 0,
                'towerContactInEndgame': 1 if random.random() < foul_pressure * 0.3 else 0,
                'outOfZoneShooting': 1 if random.random() < foul_pressure * 0.36 else 0,
                'ejectedFuel': 1 if random.random() < foul_pressure * 0.21 else 0,
                'other': 1 if random.random() < foul_pressure * 0.28 else 0,
            }
            breaks = {
                'mechanism': 1 if random.random() < break_pressure * 0.42 else 0,
                'battery': 1 if random.random() < break_pressure * 0.27 else 0,
                'comms': 1 if random.random() < break_pressure * 0.26 else 0,
                'bumper': 1 if random.random() < break_pressure * 0.19 else 0,
            }

            match_docs.append(
                {
                    'metadata': {
                        'scouterName': random.choice(scouters),
                        'matchNumber': match_number,
                        'robotTeam': team_number,
                        'robotPosition': position,
                    },
                    'robotAbsent': robot_absent,
                    'autoStartingPosition': auto_starting_position,
                    'autoPath': auto_path,
                    'shootTimeBySegment': shoot_by_segment,
                    'passTimeBySegment': pass_by_segment,
                    'actionTimeline': action_timeline,
                    'ballsPerSecondUsed': balls_per_second,
                    'autoFuelScored': auto_fuel_scored,
                    'teleFuelBySegment': {
                        'transition': tele_fuel_by_segment.get('transition', 0.0),
                        'shift1': tele_fuel_by_segment.get('shift1', 0.0),
                        'shift2': tele_fuel_by_segment.get('shift2', 0.0),
                        'shift3': tele_fuel_by_segment.get('shift3', 0.0),
                        'shift4': tele_fuel_by_segment.get('shift4', 0.0),
                        'endgame': tele_fuel_by_segment.get('endgame', 0.0),
                    },
                    'teleTower': tele_tower,
                    'breakdown': breakdown,
                    'driverQuality': driver_quality,
                    'defenseProvided': defense_provided,
                    'defenseReceived': random.random() < defense_received_probability,
                    'fouls': fouls,
                    'breaks': breaks,
                    'freeText': (
                        f'Role={role}; trend={latent.trend:+.2f}; volatility={latent.volatility:.2f}'
                        if random.random() < 0.18
                        else ''
                    ),
                }
            )

            balls_per_second_docs.append(
                {
                    'matchNumber': match_number,
                    'robotTeam': team_number,
                    'ballsPerSecond': balls_per_second,
                }
            )

    if include_pit:
        for team_number in teams:
            latent = latents[team_number]
            drivebase = weighted_choice(
                [
                    ('tank', 0.45 - latent.cycle_speed * 0.15),
                    ('swerve', 0.35 + latent.cycle_speed * 0.35),
                    ('other', 0.2),
                ]
            )
            scoring_method = weighted_choice(
                [
                    ('dump', 0.2 + latent.passing_tendency * 0.2),
                    ('low-shot', 0.22),
                    ('high-shot', 0.3 + latent.offense * 0.2),
                    ('other', 0.12),
                ]
            )
            pit_docs.append(
                {
                    'scouterName': random.choice(scouters),
                    'teamNumber': team_number,
                    'drivebase': drivebase,
                    'sdsSwerveType': weighted_choice(
                        [('mk4', 0.23), ('mk4i', 0.25), ('mk4n', 0.11), ('mk4c', 0.09), ('mk5n', 0.18), ('mk5i', 0.14)]
                    )
                    if drivebase == 'swerve'
                    else None,
                    'wpcSwerveType': None,
                    'otherSwerveType': 'other' if drivebase == 'other' else None,
                    'swerveGearRatio': round(5.5 + latent.cycle_speed * 3.2 + random.uniform(-0.5, 0.5), 2)
                    if drivebase == 'swerve'
                    else None,
                    'maxFuelStorageEstimate': int(round(9 + latent.offense * 36 + random.uniform(-4, 6))),
                    'intakeSources': {
                        'depot': random.random() < clamp(0.5 + latent.reliability * 0.3, 0.15, 0.95),
                        'outpostCorral': random.random() < clamp(0.34 + latent.passing_tendency * 0.33, 0.1, 0.93),
                        'floorNeutral': random.random() < clamp(0.4 + latent.offense * 0.35, 0.15, 0.95),
                    },
                    'scoringMethod': scoring_method,
                    'preferredScoringSpot': weighted_choice(
                        [('nearHub', 0.42), ('backOfZone', 0.24), ('scoreOnTheRun', 0.22), ('varies', 0.12)]
                    ),
                    'robotMaintain': 'easyMaintain' if latent.reliability > 0.58 else 'hardMaintain',
                    'towerCapabilityClaimed': weighted_choice(
                        [('level1', 0.24), ('level2', 0.34), ('level3', 0.29), ('unknown', 0.13)]
                    ),
                    'batteryCount': int(clamp(round(2 + latent.reliability * 5 + random.uniform(-1, 1)), 1, 8)),
                    'notes': '',
                }
            )

    return match_docs, pit_docs, balls_per_second_docs


def write_local_raw_run(
    settings: Dict[str, Any],
    source_mode: str,
    schedule: Dict[int, Dict[str, int]],
    match_docs: List[Dict[str, Any]],
    pit_docs: List[Dict[str, Any]],
) -> Path:
    paths = settings['paths']
    raw_root = Path(settings['_raw_runs_root'])
    run_dir = create_timestamped_run_dir(
        raw_root,
        base_name=paths['raw_run_base_name'],
        label=source_mode,
    )

    match_rows = [flatten_match_row(entry) for entry in match_docs]
    pit_rows = [flatten_pit_row(entry) for entry in pit_docs]

    write_csv(run_dir / '01_match_raw.csv', match_rows)
    write_csv(run_dir / '01_pit_raw.csv', pit_rows)
    write_json(run_dir / 'fake_match_source.json', match_docs)
    write_json(run_dir / 'fake_pit_source.json', pit_docs)

    snapshot = {
        'stage': 'generate_fake_data',
        'createdAt': utc_now_iso(),
        'destination': 'local_csv',
        'matchSourceMode': source_mode,
        'matchCount': len(schedule),
        'matchRows': len(match_rows),
        'pitRows': len(pit_rows),
        'settingsPath': settings['_settings_path'],
        'runFolder': str(run_dir),
    }
    write_json(run_dir / '01_raw_snapshot.json', snapshot)
    write_latest_run_pointer(raw_root, run_dir)
    return run_dir


def seed_docker_db(
    settings: Dict[str, Any],
    match_docs: List[Dict[str, Any]],
    pit_docs: List[Dict[str, Any]],
    balls_per_second_docs: List[Dict[str, float]],
) -> None:
    mongo = settings['mongo']
    client = MongoClient(mongo['mongo_url'])
    db = client[mongo['db']]

    match_collection = db[mongo['match_collection']]
    pit_collection = db[mongo['pit_collection']]
    bps_collection = db[mongo['balls_per_second_collection']]

    if coerce_bool(mongo.get('clear_before_seed', True)):
        match_collection.delete_many({})
        pit_collection.delete_many({})
        bps_collection.delete_many({})

    if match_docs:
        match_collection.insert_many(match_docs)
    if pit_docs:
        pit_collection.insert_many(pit_docs)
    if balls_per_second_docs:
        bps_collection.insert_many(balls_per_second_docs)

    client.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Generate realistic fake scouting data using app_settings config.'
    )
    parser.add_argument(
        '--settings',
        default='app_settings/settings.json',
        help='Path to app settings JSON.',
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = load_settings(args.settings)

    fake_cfg = settings['fake_data']
    destination = str(fake_cfg['destination']).lower()
    source_mode = str(fake_cfg['match_source_mode']).lower()
    random_match_count = int(fake_cfg.get('random_match_count', 72))
    include_pit = bool(fake_cfg.get('include_pit', True))
    scouter_count = int(fake_cfg.get('scouter_count', 12))

    schedule = load_match_schedule()
    teams = load_teams_list()

    if source_mode == 'random_from_teams':
        schedule = build_random_schedule(teams, random_match_count)

    all_teams = sorted({team for match in schedule.values() for team in match.values()})
    match_docs, pit_docs, balls_per_second_docs = simulate_match_documents(
        schedule=schedule,
        teams=all_teams,
        scouter_count=scouter_count,
        include_pit=include_pit,
    )

    if destination == 'local_csv':
        run_dir = write_local_raw_run(settings, source_mode, schedule, match_docs, pit_docs)
        print(
            'Fake data generation complete (local_csv): '
            f'{len(match_docs)} match docs, {len(pit_docs)} pit docs -> {run_dir}'
        )
        return

    if destination == 'docker_db':
        seed_docker_db(settings, match_docs, pit_docs, balls_per_second_docs)
        report = {
            'stage': 'generate_fake_data',
            'createdAt': utc_now_iso(),
            'destination': 'docker_db',
            'matchSourceMode': source_mode,
            'matchDocs': len(match_docs),
            'pitDocs': len(pit_docs),
            'ballsPerSecondDocs': len(balls_per_second_docs),
            'settingsPath': settings['_settings_path'],
        }
        raw_root = Path(settings['_raw_runs_root'])
        report_path = raw_root / f'{utc_now_iso().replace(":", "-")}_docker_seed_report.json'
        write_json(report_path, report)
        print(
            'Fake data generation complete (docker_db): '
            f'{len(match_docs)} match docs, {len(pit_docs)} pit docs seeded.'
        )
        return

    raise ValueError(f'Unsupported fake_data.destination: {destination}')


if __name__ == '__main__':
    main()
