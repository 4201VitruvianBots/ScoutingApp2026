import argparse
import csv
import json
from pathlib import Path
from typing import Any, Dict, Iterable, List

ROOT = Path(__file__).resolve().parents[1]
GAME_CONFIG_PATH = ROOT / 'client' / 'src' / 'assets' / 'game_config_2026.json'
DEFAULT_CONFIG_PATH = ROOT / 'data-analysis' / 'pipeline_config.json'


def parse_args(default_description: str) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=default_description)
    parser.add_argument(
        '--config',
        default=str(DEFAULT_CONFIG_PATH),
        help='Path to pipeline JSON config',
    )
    return parser.parse_args()


def load_json(path: Path) -> Any:
    with open(path, 'r', encoding='utf-8') as file:
        return json.load(file)


def load_config(config_path: str | Path) -> Dict[str, Any]:
    path = Path(config_path)
    with open(path, 'r', encoding='utf-8') as file:
        config = json.load(file)

    config['_config_path'] = str(path.resolve())
    config['_root'] = str(ROOT)

    output_dir = ROOT / config['paths'].get('output_dir', 'data-analysis/output')
    output_dir.mkdir(parents=True, exist_ok=True)
    config['_output_dir'] = str(output_dir)

    return config


def load_game_config() -> Dict[str, Any]:
    return load_json(GAME_CONFIG_PATH)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as file:
        json.dump(payload, file, indent=2)


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
    m = mean(values)
    variance = sum((value - m) ** 2 for value in values) / len(values)
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


def linear_slope(points: List[tuple[float, float]]) -> float:
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
    delay_end = next((segment.get('endSec', 23) for segment in segments if segment.get('id') == 'transition'), 23)
    return {
        'totalSec': float(game_config.get('matchDurationSec', 163)),
        'autoEndSec': float(auto_end),
        'delayEndSec': float(delay_end),
    }
