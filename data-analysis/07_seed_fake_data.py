import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from pymongo import MongoClient

from common import ROOT, load_config, load_game_config, parse_args, write_json


ROBOT_POSITIONS = ['red_1', 'red_2', 'red_3', 'blue_1', 'blue_2', 'blue_3']
SEGMENTS = ['auto', 'transition', 'shift1', 'shift2', 'shift3', 'shift4', 'endgame']


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


def generate_action_timeline(
    shoot_by_segment: Dict[str, float],
    pass_by_segment: Dict[str, float],
    segments: List[Dict[str, float]],
) -> Dict[str, Any]:
    intervals: List[Dict[str, Any]] = []

    for action, totals in [('shoot', shoot_by_segment), ('pass', pass_by_segment)]:
        for segment in segments:
            seg_id = segment['id']
            start_sec = float(segment['startSec'])
            end_sec = float(segment['endSec'])
            seg_total = totals.get(seg_id, 0.0)
            if seg_total <= 0.05:
                continue

            interval_count = max(1, min(4, round(seg_total / 0.7)))
            cursor = start_sec + random.random() * min(0.35, (end_sec - start_sec) * 0.2)
            remaining = seg_total

            for _ in range(interval_count):
                if remaining <= 0.03:
                    break
                max_duration = min(1.8, remaining)
                duration = round(clamp(random.uniform(0.08, max_duration), 0.05, max_duration), 2)
                latest_start = end_sec - duration
                if latest_start <= start_sec:
                    break

                interval_start = round(clamp(cursor, start_sec, latest_start), 2)
                interval_end = round(interval_start + duration, 2)
                if interval_end <= interval_start:
                    continue

                intervals.append(
                    {
                        'action': action,
                        'startSec': interval_start,
                        'endSec': interval_end,
                        'durationSec': round(interval_end - interval_start, 2),
                    }
                )
                remaining = max(0.0, remaining - (interval_end - interval_start))
                cursor = interval_end + random.uniform(0.08, 0.5)

    intervals.sort(key=lambda item: (item['startSec'], item['action']))
    return {
        'intervals': intervals,
    }


def make_auto_path(alliance: str, start_position: str | None, match_number: int) -> Dict[str, Any] | None:
    if start_position is None:
        return None

    start_x = 0.69 if alliance == 'red' else 0.34
    start_y = {'left': 0.33, 'center': 0.5, 'right': 0.67}[start_position]
    direction = -1 if alliance == 'red' else 1

    points = []
    for index in range(12):
        progress = index / 11
        wobble = random.uniform(-0.05, 0.05)
        points.append(
            {
                'x': round(clamp(start_x + direction * progress * 0.26 + wobble, 0, 1), 4),
                'y': round(clamp(start_y + (0.12 * (1 - abs(0.5 - progress) * 2)) + wobble * 0.6, 0, 1), 4),
                'tSec': round(progress * 20, 2),
            }
        )

    shot_markers = [points[4], points[8]]

    return {
        'alliance': alliance,
        'startPosition': start_position,
        'points': points,
        'shotMarkers': shot_markers,
        'fingerprint': f'fake-{alliance}-{start_position}-{match_number}-{random.randint(1000, 9999)}',
    }


def main() -> None:
    args = parse_args('Stage 07: generate schema-valid fake match/pit data and optionally seed MongoDB')
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

    teams = [team_start + index for index in range(team_count)]
    scouters = [f'Scout {index + 1}' for index in range(scouter_count)]

    segments = game_config.get('segments', [])
    total_sec = float(game_config.get('matchDurationSec', 163))
    auto_end = next((segment.get('endSec', 20) for segment in segments if segment.get('id') == 'auto'), 20)
    delay_end = next((segment.get('endSec', 23) for segment in segments if segment.get('id') == 'transition'), 23)

    fake_matches: List[Dict[str, Any]] = []
    fake_balls_per_second_settings: List[Dict[str, Any]] = []

    for match_number in range(1, match_count + 1):
        random.shuffle(teams)
        selected_teams = teams[: len(ROBOT_POSITIONS)]

        for robot_position, team_number in zip(ROBOT_POSITIONS, selected_teams):
            alliance = 'red' if robot_position.startswith('red') else 'blue'
            robot_absent = random.random() < 0.03
            balls_per_second = round(clamp(random.uniform(3.4, 7.2), 3.0, 8.0), 2)

            shoot_by_segment = {segment: 0.0 for segment in SEGMENTS}
            pass_by_segment = {segment: 0.0 for segment in SEGMENTS}

            if not robot_absent:
                total_shoot = random.uniform(4, 15)
                total_pass = random.uniform(1, 6)
                weights = [0.15, 0.15, 0.18, 0.17, 0.15, 0.12, 0.08]
                for index, segment in enumerate(SEGMENTS):
                    shoot_by_segment[segment] = round(total_shoot * weights[index], 2)
                    pass_by_segment[segment] = round(total_pass * weights[index], 2)

            action_timeline = generate_action_timeline(shoot_by_segment, pass_by_segment, segments)
            action_timeline['totalSec'] = total_sec
            action_timeline['autoEndSec'] = auto_end
            action_timeline['delayEndSec'] = delay_end

            auto_starting_position = None if robot_absent else random.choice(['left', 'center', 'right'])
            auto_path = make_auto_path(alliance, auto_starting_position, match_number)

            tele_fuel_by_segment = {
                segment: round(shoot_by_segment[segment] * balls_per_second, 2)
                for segment in SEGMENTS
                if segment != 'auto'
            }

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
                        'transition': tele_fuel_by_segment.get('transition', 0),
                        'shift1': tele_fuel_by_segment.get('shift1', 0),
                        'shift2': tele_fuel_by_segment.get('shift2', 0),
                        'shift3': tele_fuel_by_segment.get('shift3', 0),
                        'shift4': tele_fuel_by_segment.get('shift4', 0),
                        'endgame': tele_fuel_by_segment.get('endgame', 0),
                    },
                    'teleTower': weighted_choice([
                        ('None', 0.2),
                        ('level1', 0.24),
                        ('level2', 0.3),
                        ('level3', 0.18),
                        ('Failed', 0.08),
                    ]),
                    'breakdown': weighted_choice([
                        ('None', 0.9),
                        ('stuck', 0.03),
                        ('tipped', 0.02),
                        ('comms', 0.02),
                        ('mechanism', 0.02),
                        ('other', 0.01),
                    ]),
                    'driverQuality': weighted_choice([
                        ('great', 0.2),
                        ('good', 0.4),
                        ('ok', 0.3),
                        ('rough', 0.1),
                    ]),
                    'defenseProvided': weighted_choice([
                        ('None', 0.5),
                        ('some', 0.32),
                        ('heavy', 0.18),
                    ]),
                    'defenseReceived': random.random() < 0.42,
                    'fouls': {
                        'pinning': 1 if random.random() < 0.08 else 0,
                        'towerContactInEndgame': 1 if random.random() < 0.05 else 0,
                        'outOfZoneShooting': 1 if random.random() < 0.06 else 0,
                        'ejectedFuel': 1 if random.random() < 0.04 else 0,
                        'other': 1 if random.random() < 0.05 else 0,
                    },
                    'breaks': {
                        'mechanism': 1 if random.random() < 0.05 else 0,
                        'battery': 1 if random.random() < 0.03 else 0,
                        'comms': 1 if random.random() < 0.03 else 0,
                        'bumper': 1 if random.random() < 0.03 else 0,
                    },
                    'freeText': '' if random.random() < 0.7 else f'Fake note for match {match_number}',
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
        for team in teams:
            fake_pit.append(
                {
                    'scouterName': random.choice(scouters),
                    'teamNumber': team,
                    'drivebase': random.choice(['tank', 'swerve', 'other']),
                    'maxFuelStorageEstimate': random.randint(8, 50),
                    'intakeSources': {
                        'depot': random.random() < 0.75,
                        'outpostCorral': random.random() < 0.45,
                        'floorNeutral': random.random() < 0.65,
                    },
                    'scoringMethod': random.choice(['dump', 'low-shot', 'high-shot', 'other']),
                    'preferredScoringSpot': random.choice(['nearHub', 'backOfZone', 'varies']),
                    'robotMaintain': random.choice(['easyMaintain', 'hardMaintain']),
                    'towerCapabilityClaimed': random.choice(['level1', 'level2', 'level3', 'unknown']),
                    'batteryCount': random.randint(2, 7),
                    'notes': '',
                }
            )

    fake_match_path = ROOT / source_cfg.get('fake_match_json', 'data-analysis/output/fake_match_source.json')
    fake_pit_path = ROOT / source_cfg.get('fake_pit_json', 'data-analysis/output/fake_pit_source.json')
    write_json(fake_match_path, fake_matches)
    write_json(fake_pit_path, fake_pit)

    seeded = False
    if seed_mongo:
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
        'pitCount': len(fake_pit),
        'ballsPerSecondCount': len(fake_balls_per_second_settings),
        'seededMongo': seeded,
        'fakeMatchPath': str(fake_match_path),
        'fakePitPath': str(fake_pit_path),
    }
    write_json(output_dir / '07_seed_report.json', report)

    print(
        f"Stage 07 complete: wrote {len(fake_matches)} fake match docs and {len(fake_pit)} fake pit docs. Mongo seeded={seeded}."
    )


if __name__ == '__main__':
    main()
