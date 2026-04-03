import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

ROOT = Path(__file__).resolve().parents[1]
APP_SETTINGS_DIR = ROOT / 'app_settings'
SETTINGS_PATH = APP_SETTINGS_DIR / 'settings.json'
SCHEDULE_PATH = APP_SETTINGS_DIR / 'match_schedule.json'
TEAMS_PATH = APP_SETTINGS_DIR / 'teams_list.txt'
GAME_CONFIG_PATH = ROOT / 'client' / 'src' / 'assets' / 'game_config_2026.json'


def load_json(path: Path) -> Any:
    with open(path, 'r', encoding='utf-8-sig') as file:
        return json.load(file)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as file:
        json.dump(payload, file, indent=2)


def read_text(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def load_game_config() -> Dict[str, Any]:
    if not GAME_CONFIG_PATH.exists():
        raise FileNotFoundError(f'Missing game config: {GAME_CONFIG_PATH}')
    return load_json(GAME_CONFIG_PATH)


def get_expected_robot_positions() -> List[str]:
    game_config = load_game_config()
    alliance_size = int(game_config.get('allianceSizeRobots', {}).get('default', 3))
    red = [f'red_{index + 1}' for index in range(alliance_size)]
    blue = [f'blue_{index + 1}' for index in range(alliance_size)]
    return red + blue


def resolve_repo_path(path_like: str | Path) -> Path:
    path = Path(path_like)
    return path if path.is_absolute() else ROOT / path


def load_settings(settings_path: str | Path = SETTINGS_PATH) -> Dict[str, Any]:
    path = resolve_repo_path(settings_path)
    if not path.exists():
        raise FileNotFoundError(f'Settings file does not exist: {path}')

    settings = load_json(path)
    if not isinstance(settings, dict):
        raise ValueError('Settings file must contain a JSON object at the root.')

    required_top = {'paths', 'mongo', 'fake_data', 'analysis'}
    missing = sorted(required_top - set(settings.keys()))
    if missing:
        raise ValueError(f'Missing required settings sections: {", ".join(missing)}')

    paths = settings['paths']
    required_paths = {
        'raw_runs_root',
        'analysis_runs_root',
        'raw_run_base_name',
        'analysis_run_base_name',
    }
    missing_paths = sorted(required_paths - set(paths.keys()))
    if missing_paths:
        raise ValueError(f'Missing required paths settings: {", ".join(missing_paths)}')

    fake_data = settings['fake_data']
    destination = str(fake_data.get('destination', '')).strip().lower()
    if destination not in {'local_csv', 'docker_db'}:
        raise ValueError('fake_data.destination must be either "local_csv" or "docker_db".')

    source_mode = str(fake_data.get('match_source_mode', '')).strip().lower()
    if source_mode not in {'schedule', 'random_from_teams'}:
        raise ValueError(
            'fake_data.match_source_mode must be either "schedule" or "random_from_teams".'
        )

    if source_mode == 'random_from_teams':
        random_match_count = coerce_int(fake_data.get('random_match_count', 0), 0)
        if random_match_count <= 0:
            raise ValueError(
                'fake_data.random_match_count must be a positive integer when using random_from_teams mode.'
            )

    mongo = settings['mongo']
    required_mongo = {
        'mongo_url',
        'db',
        'match_collection',
        'pit_collection',
        'balls_per_second_collection',
    }
    missing_mongo = sorted(required_mongo - set(mongo.keys()))
    if missing_mongo:
        raise ValueError(f'Missing required mongo settings: {", ".join(missing_mongo)}')

    if not str(mongo.get('mongo_url', '')).strip():
        raise ValueError('mongo.mongo_url must be a non-empty string.')
    if not str(mongo.get('db', '')).strip():
        raise ValueError('mongo.db must be a non-empty string.')

    analysis = settings['analysis']
    timeline_bin = coerce_int(analysis.get('timeline_bin_sec', 0), 0)
    if timeline_bin <= 0:
        raise ValueError('analysis.timeline_bin_sec must be a positive integer.')

    raw_root = resolve_repo_path(paths['raw_runs_root'])
    analysis_root = resolve_repo_path(paths['analysis_runs_root'])
    raw_root.mkdir(parents=True, exist_ok=True)
    analysis_root.mkdir(parents=True, exist_ok=True)

    settings['_settings_path'] = str(path)
    settings['_raw_runs_root'] = str(raw_root)
    settings['_analysis_runs_root'] = str(analysis_root)
    settings['_root'] = str(ROOT)
    return settings


def _normalize_schedule_entry(raw_entry: Dict[str, Any], expected_positions: List[str]) -> Dict[str, int]:
    normalized: Dict[str, int] = {}
    for position in expected_positions:
        if position not in raw_entry:
            raise ValueError(f'Schedule entry missing required position "{position}".')
        team_number = coerce_int(raw_entry.get(position), 0)
        if team_number <= 0:
            raise ValueError(f'Schedule position "{position}" must be a positive team number.')
        normalized[position] = team_number

    extra_positions = sorted(set(raw_entry.keys()) - set(expected_positions))
    if extra_positions:
        raise ValueError(
            f'Schedule entry contains unexpected positions: {", ".join(extra_positions)}.'
        )

    if len(set(normalized.values())) != len(normalized):
        raise ValueError('Schedule entry contains duplicate team numbers within the same match.')
    return normalized


def load_match_schedule(schedule_path: str | Path = SCHEDULE_PATH) -> Dict[int, Dict[str, int]]:
    path = resolve_repo_path(schedule_path)
    if not path.exists():
        raise FileNotFoundError(f'Match schedule file does not exist: {path}')

    payload = load_json(path)
    if not isinstance(payload, dict):
        raise ValueError('match_schedule.json must contain an object keyed by match number.')

    expected_positions = get_expected_robot_positions()
    schedule: Dict[int, Dict[str, int]] = {}
    for raw_match_number, raw_entry in payload.items():
        match_number = coerce_int(raw_match_number, 0)
        if match_number <= 0:
            raise ValueError(f'Invalid match number in schedule: {raw_match_number!r}')
        if not isinstance(raw_entry, dict):
            raise ValueError(f'Schedule entry for match {match_number} must be an object.')
        schedule[match_number] = _normalize_schedule_entry(raw_entry, expected_positions)

    if not schedule:
        raise ValueError('Match schedule is empty.')

    return {match_number: schedule[match_number] for match_number in sorted(schedule.keys())}


def load_teams_list(teams_path: str | Path = TEAMS_PATH) -> List[int]:
    path = resolve_repo_path(teams_path)
    if not path.exists():
        raise FileNotFoundError(f'Teams list file does not exist: {path}')

    teams: List[int] = []
    seen: set[int] = set()
    for line in read_text(path).splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        team_number = coerce_int(stripped, 0)
        if team_number <= 0:
            raise ValueError(f'Invalid team number in teams_list.txt: {stripped!r}')
        if team_number in seen:
            raise ValueError(f'Duplicate team number in teams_list.txt: {team_number}')
        teams.append(team_number)
        seen.add(team_number)

    if not teams:
        raise ValueError('teams_list.txt did not contain any valid team numbers.')

    return teams


def to_timestamp() -> str:
    return datetime.now().strftime('%Y-%m-%d_%H-%M-%S')


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def slugify(value: str) -> str:
    trimmed = value.strip().lower()
    if not trimmed:
        return ''
    slug = re.sub(r'[^a-z0-9]+', '_', trimmed)
    return slug.strip('_')


def create_timestamped_run_dir(root_dir: Path, base_name: str, label: str | None = None) -> Path:
    root_dir.mkdir(parents=True, exist_ok=True)
    parts: List[str] = [to_timestamp()]
    label_slug = slugify(label or '')
    if label_slug:
        parts.append(label_slug)
    base_slug = slugify(base_name)
    if base_slug:
        parts.append(base_slug)

    candidate_name = '_'.join(parts)
    candidate = root_dir / candidate_name
    suffix = 1
    while candidate.exists():
        candidate = root_dir / f'{candidate_name}_{suffix:02d}'
        suffix += 1

    candidate.mkdir(parents=True, exist_ok=False)
    return candidate


def latest_run_pointer_path(root_dir: Path) -> Path:
    return root_dir / 'latest_run.json'


def write_latest_run_pointer(root_dir: Path, run_dir: Path) -> None:
    pointer_path = latest_run_pointer_path(root_dir)
    root_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        'runId': run_dir.name,
        'path': str(run_dir.resolve()),
        'relativePath': str(run_dir.resolve().relative_to(ROOT.resolve())),
        'updatedAt': utc_now_iso(),
    }
    write_json(pointer_path, payload)


def read_latest_run_pointer(root_dir: Path) -> Path:
    pointer_path = latest_run_pointer_path(root_dir)
    if not pointer_path.exists():
        raise FileNotFoundError(
            f'No latest run pointer found at {pointer_path}. Run the upstream script first.'
        )

    payload = load_json(pointer_path)
    if not isinstance(payload, dict):
        raise ValueError(f'Invalid pointer payload in {pointer_path}')

    absolute = payload.get('path')
    relative = payload.get('relativePath')

    candidate: Path | None = None
    if isinstance(absolute, str) and absolute:
        candidate = Path(absolute)
    elif isinstance(relative, str) and relative:
        candidate = ROOT / relative

    if candidate is None:
        raise ValueError(f'latest_run pointer missing path fields: {pointer_path}')

    if not candidate.exists() or not candidate.is_dir():
        raise FileNotFoundError(
            f'latest_run pointer target does not exist: {candidate}. Re-run upstream stage.'
        )
    return candidate


def resolve_run_dir(root_dir: Path, run_name_or_path: str | None) -> Path:
    if not run_name_or_path:
        return read_latest_run_pointer(root_dir)

    candidate = Path(run_name_or_path)
    if candidate.is_absolute() and candidate.exists() and candidate.is_dir():
        return candidate

    joined = root_dir / run_name_or_path
    if joined.exists() and joined.is_dir():
        return joined

    raise FileNotFoundError(
        f'Run folder not found for argument "{run_name_or_path}" under {root_dir}'
    )


def write_csv(path: Path, rows: List[Dict[str, Any]], fieldnames: List[str] | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if fieldnames is None:
        fieldnames = sorted({key for row in rows for key in row.keys()})
    with open(path, 'w', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def read_csv(path: Path) -> List[Dict[str, str]]:
    with open(path, 'r', newline='', encoding='utf-8') as file:
        return list(csv.DictReader(file))


def convert_objectid_to_str(obj: Any) -> Any:
    try:
        from bson import ObjectId
    except Exception:
        ObjectId = None  # type: ignore[assignment]

    if ObjectId is not None and isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, dict):
        return {key: convert_objectid_to_str(value) for key, value in obj.items()}
    if isinstance(obj, list):
        return [convert_objectid_to_str(item) for item in obj]
    return obj


def flatten_match_row(entry: Dict[str, Any]) -> Dict[str, Any]:
    metadata = entry.get('metadata') or {}
    return {
        'scouterName': metadata.get('scouterName', ''),
        'matchNumber': metadata.get('matchNumber'),
        'teamNumber': metadata.get('robotTeam'),
        'robotPosition': metadata.get('robotPosition', ''),
        'robotAbsent': coerce_bool(entry.get('robotAbsent', False)),
        'autoStartingPosition': entry.get('autoStartingPosition'),
        'autoPathJson': json.dumps(convert_objectid_to_str(entry.get('autoPath') or {}), separators=(',', ':')),
        'shootTimeBySegmentJson': json.dumps(
            convert_objectid_to_str(entry.get('shootTimeBySegment') or {}), separators=(',', ':')
        ),
        'passTimeBySegmentJson': json.dumps(
            convert_objectid_to_str(entry.get('passTimeBySegment') or {}), separators=(',', ':')
        ),
        'actionTimelineJson': json.dumps(
            convert_objectid_to_str(entry.get('actionTimeline') or {}), separators=(',', ':')
        ),
        'ballsPerSecondUsed': coerce_float(entry.get('ballsPerSecondUsed', 0)),
        'autoFuelScored': coerce_float(entry.get('autoFuelScored', 0)),
        'teleFuelBySegmentJson': json.dumps(
            convert_objectid_to_str(entry.get('teleFuelBySegment') or {}), separators=(',', ':')
        ),
        'teleTower': entry.get('teleTower', 'None'),
        'breakdown': entry.get('breakdown', 'None'),
        'driverQuality': entry.get('driverQuality', 'Ok'),
        'defenseProvided': entry.get('defenseProvided', 'None'),
        'defenseReceived': coerce_bool(entry.get('defenseReceived', False)),
        'foulsJson': json.dumps(convert_objectid_to_str(entry.get('fouls') or {}), separators=(',', ':')),
        'breaksJson': json.dumps(convert_objectid_to_str(entry.get('breaks') or {}), separators=(',', ':')),
        'freeText': entry.get('freeText', ''),
    }


def flatten_pit_row(entry: Dict[str, Any]) -> Dict[str, Any]:
    intake = parse_json_field(convert_objectid_to_str(entry.get('intakeSources')), {})
    if not isinstance(intake, dict):
        intake = {}

    return {
        'scouterName': entry.get('scouterName', ''),
        'teamNumber': coerce_int(entry.get('teamNumber')),
        'drivebase': entry.get('drivebase', ''),
        'sdsSwerveType': entry.get('sdsSwerveType', ''),
        'wpcSwerveType': entry.get('wpcSwerveType', ''),
        'otherSwerveType': entry.get('otherSwerveType', ''),
        'swerveGearRatio': entry.get('swerveGearRatio'),
        'maxFuelStorageEstimate': entry.get('maxFuelStorageEstimate'),
        'intakeDepot': coerce_bool(intake.get('depot', False)),
        'intakeOutpostCorral': coerce_bool(intake.get('outpostCorral', False)),
        'intakeFloorNeutral': coerce_bool(intake.get('floorNeutral', False)),
        'scoringMethod': entry.get('scoringMethod', ''),
        'preferredScoringSpot': entry.get('preferredScoringSpot', ''),
        'robotMaintain': entry.get('robotMaintain', ''),
        'towerCapabilityClaimed': entry.get('towerCapabilityClaimed', ''),
        'batteryCount': coerce_int(entry.get('batteryCount', 0)),
        'notes': entry.get('notes', ''),
    }


def coerce_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def coerce_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in {'1', 'true', 'yes', 'y'}
    return False


def parse_json_field(value: Any, fallback: Any) -> Any:
    if isinstance(value, (dict, list)):
        return value
    if not isinstance(value, str) or not value.strip():
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def safe_div(numerator: float, denominator: float) -> float:
    return numerator / denominator if denominator else 0.0


def mean(values: Iterable[float]) -> float:
    values = list(values)
    if not values:
        return 0.0
    return sum(values) / len(values)


def stdev(values: Iterable[float]) -> float:
    values = list(values)
    if len(values) <= 1:
        return 0.0
    avg = mean(values)
    variance = sum((value - avg) ** 2 for value in values) / len(values)
    return variance ** 0.5


def median(values: Iterable[float]) -> float:
    values = sorted(values)
    if not values:
        return 0.0
    middle = len(values) // 2
    if len(values) % 2 == 0:
        return (values[middle - 1] + values[middle]) / 2
    return values[middle]


def quantile(values: Iterable[float], q: float) -> float:
    sorted_values = sorted(values)
    if not sorted_values:
        return 0.0
    if q <= 0:
        return sorted_values[0]
    if q >= 1:
        return sorted_values[-1]

    pos = (len(sorted_values) - 1) * q
    low = int(pos)
    high = min(low + 1, len(sorted_values) - 1)
    if low == high:
        return sorted_values[low]
    fraction = pos - low
    return sorted_values[low] + (sorted_values[high] - sorted_values[low]) * fraction


def linear_slope(points: List[Tuple[float, float]]) -> float:
    if len(points) <= 1:
        return 0.0
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    x_mean = mean(xs)
    y_mean = mean(ys)
    denominator = sum((x - x_mean) ** 2 for x in xs)
    if denominator == 0:
        return 0.0
    numerator = sum((x - x_mean) * (y - y_mean) for x, y in points)
    return numerator / denominator


def get_segment_boundaries(game_config: Dict[str, Any]) -> Dict[str, float]:
    segments = game_config.get('segments', [])
    auto_end = next((segment.get('endSec', 20) for segment in segments if segment.get('id') == 'auto'), 20)
    delay_end = next(
        (segment.get('endSec', 23) for segment in segments if segment.get('id') == 'transition'),
        23,
    )
    return {
        'totalSec': float(game_config.get('matchDurationSec', 163)),
        'autoEndSec': float(auto_end),
        'delayEndSec': float(delay_end),
    }
