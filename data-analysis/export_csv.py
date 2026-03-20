import argparse
import csv
import json
import math
import os
import statistics
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Sequence, Tuple

from pymongo import MongoClient

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "client" / "src" / "assets" / "game_config_2026.json"
DEFAULT_OUTPUT_DIR = ROOT / "data-analysis" / "output"

with open(CONFIG_PATH, "r", encoding="utf-8") as config_file:
    GAME_CONFIG = json.load(config_file)

FUEL_POINTS_ACTIVE = float(GAME_CONFIG["scoring"]["fuelPointsActive"])
AUTO_TOWER_POINTS: Dict[str, float] = {
    "none": 0.0,
    "failed": 0.0,
    "level1": float(GAME_CONFIG["scoring"]["towerAuto"]["level1"]),
}
TELE_TOWER_POINTS: Dict[str, float] = {
    "none": 0.0,
    "failed": 0.0,
    "level1": float(GAME_CONFIG["scoring"]["towerTele"]["level1"]),
    "level2": float(GAME_CONFIG["scoring"]["towerTele"]["level2"]),
    "level3": float(GAME_CONFIG["scoring"]["towerTele"]["level3"]),
}
MATCH_TOTAL_SEC = float(GAME_CONFIG.get("matchDurationSec", 163))
AUTO_END_SEC = float(
    next(
        (segment.get("endSec", 20) for segment in GAME_CONFIG.get("segments", []) if segment.get("id") == "auto"),
        20,
    )
)
DELAY_END_SEC = float(
    next(
        (
            segment.get("endSec", 23)
            for segment in GAME_CONFIG.get("segments", [])
            if segment.get("id") == "transition"
        ),
        23,
    )
)

COMMENT_VALUES = [
    "great_driving",
    "good_driving",
    "ok_driving",
    "rough_driving",
    "fast_cycles",
    "drops_fuel",
    "accurate_shots",
    "inaccurate_shots",
    "aggressive_defense",
    "smart_defense",
    "defense_liability",
    "fast_climb",
    "slow_climb",
    "no_climb",
]

DRIVER_QUALITY_SCORE = {
    "great": 3.0,
    "good": 2.0,
    "ok": 1.0,
    "rough": 0.0,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Extract scouting data from MongoDB, export raw JSON/CSV, and build "
            "quantitative + categorical analysis outputs."
        )
    )
    parser.add_argument(
        "--mongo-url",
        default=os.getenv("MONGO_URL", "mongodb://localhost:27017/"),
        help="MongoDB connection URL",
    )
    parser.add_argument(
        "--db",
        default=os.getenv("SCOUT_DB", "test"),
        help="MongoDB database name",
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help="Directory for generated analysis artifacts",
    )
    return parser.parse_args()


def clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(value, max_value))


def safe_div(numerator: float, denominator: float) -> float:
    return numerator / denominator if denominator else 0.0


def to_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return 1.0 if value else 0.0
    if isinstance(value, (int, float)):
        return float(value)
    return None


def json_default(value: Any) -> str:
    return str(value)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as json_file:
        json.dump(payload, json_file, indent=2, default=json_default)


def write_csv(
    path: Path,
    rows: List[Dict[str, Any]],
    fieldnames: Sequence[str] | None = None,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if fieldnames is None:
        fieldnames = sorted({key for row in rows for key in row.keys()})
    with open(path, "w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=list(fieldnames))
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def quantile(values: List[float], q: float) -> float:
    if not values:
        return 0.0
    sorted_values = sorted(values)
    position = (len(sorted_values) - 1) * q
    lower_index = math.floor(position)
    upper_index = math.ceil(position)
    if lower_index == upper_index:
        return sorted_values[lower_index]
    lower = sorted_values[lower_index]
    upper = sorted_values[upper_index]
    return lower + (upper - lower) * (position - lower_index)


def stats_for_values(values: List[float]) -> Dict[str, float | int]:
    if not values:
        return {
            "count": 0,
            "mean": 0.0,
            "median": 0.0,
            "min": 0.0,
            "max": 0.0,
            "stdev": 0.0,
            "q1": 0.0,
            "q3": 0.0,
            "iqr": 0.0,
        }

    mean_value = statistics.fmean(values)
    median_value = statistics.median(values)
    min_value = min(values)
    max_value = max(values)
    stdev = statistics.pstdev(values) if len(values) > 1 else 0.0
    q1 = quantile(values, 0.25)
    q3 = quantile(values, 0.75)
    return {
        "count": len(values),
        "mean": mean_value,
        "median": median_value,
        "min": min_value,
        "max": max_value,
        "stdev": stdev,
        "q1": q1,
        "q3": q3,
        "iqr": q3 - q1,
    }


def mode_and_counts(values: Iterable[Any]) -> Dict[str, Any]:
    normalized = [("null" if value is None else str(value)) for value in values]
    counts = Counter(normalized)
    if not counts:
        return {
            "count": 0,
            "uniqueCount": 0,
            "mode": None,
            "modeCount": 0,
            "counts": {},
        }
    ordered_counts = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    mode_value, mode_count = ordered_counts[0]
    return {
        "count": sum(counts.values()),
        "uniqueCount": len(counts),
        "mode": mode_value,
        "modeCount": mode_count,
        "counts": dict(sorted(counts.items(), key=lambda item: item[0])),
    }


def get_alliance(robot_position: str) -> str:
    return "red" if robot_position.startswith("red") else "blue"


def flip_alliance(alliance: str) -> str:
    return "blue" if alliance == "red" else "red"


def get_shift1_active_hub(
    auto_winner: str,
    shift1_active_if_tie: str | None,
) -> str | None:
    if auto_winner in ("red", "blue"):
        return auto_winner
    if auto_winner == "tie":
        return shift1_active_if_tie
    return None


def compute_active_wasted(match_entry: Mapping[str, Any]) -> Tuple[float, float]:
    tele = match_entry.get("teleFuelBySegment") or {}
    metadata = match_entry.get("metadata") or {}

    alliance = get_alliance(metadata.get("robotPosition") or "")
    shift1_active = get_shift1_active_hub(
        match_entry.get("autoFuelWinner") or "unknown",
        match_entry.get("shift1ActiveHubIfTie"),
    )
    shift_order: List[str] = GAME_CONFIG["hubRule"]["shiftOrder"]
    both_active_segments: List[str] = GAME_CONFIG["hubRule"]["bothActiveSegments"]

    active = 0.0
    wasted = 0.0

    for segment in both_active_segments:
        active += float(tele.get(segment, 0) or 0)

    for index, shift in enumerate(shift_order):
        value = float(tele.get(shift, 0) or 0)
        if value == 0:
            continue
        if shift1_active is None:
            continue
        active_hub = shift1_active if index % 2 == 0 else flip_alliance(shift1_active)
        if active_hub == alliance:
            active += value
        else:
            wasted += value

    return active, wasted


def total_tele(tele: Mapping[str, Any]) -> float:
    return (
        float(tele.get("transition", 0) or 0)
        + float(tele.get("shift1", 0) or 0)
        + float(tele.get("shift2", 0) or 0)
        + float(tele.get("shift3", 0) or 0)
        + float(tele.get("shift4", 0) or 0)
        + float(tele.get("endgame", 0) or 0)
    )


def climb_points_from_tele_tower(tele_tower: str | None) -> float:
    if tele_tower is None:
        return 0.0
    return TELE_TOWER_POINTS.get(tele_tower, 0.0)


def parse_action_intervals(
    timeline: Mapping[str, Any] | None,
) -> List[Dict[str, float | str]]:
    if not timeline:
        return []
    raw_intervals = timeline.get("intervals")
    if not isinstance(raw_intervals, list):
        return []

    intervals: List[Dict[str, float | str]] = []
    for raw in raw_intervals:
        if not isinstance(raw, Mapping):
            continue
        action = raw.get("action")
        if action not in ("shoot", "pass"):
            continue
        start = float(raw.get("startSec", 0) or 0)
        end = float(raw.get("endSec", 0) or 0)
        start = clamp(start, 0.0, MATCH_TOTAL_SEC)
        end = clamp(end, 0.0, MATCH_TOTAL_SEC)
        if end <= start:
            continue
        duration = float(raw.get("durationSec", end - start) or 0)
        if duration <= 0:
            duration = end - start
        intervals.append(
            {
                "action": action,
                "startSec": round(start, 2),
                "endSec": round(end, 2),
                "durationSec": round(max(0.0, duration), 2),
            }
        )

    intervals.sort(key=lambda entry: (float(entry["startSec"]), str(entry["action"])))
    return intervals


def timeline_metrics(match_entry: Mapping[str, Any]) -> Dict[str, float | int | bool | str]:
    raw_timeline = match_entry.get("actionTimeline")
    timeline = raw_timeline if isinstance(raw_timeline, Mapping) else None
    intervals = parse_action_intervals(timeline)

    shoot = [interval for interval in intervals if interval["action"] == "shoot"]
    passed = [interval for interval in intervals if interval["action"] == "pass"]

    shoot_durations = [float(interval["durationSec"]) for interval in shoot]
    pass_durations = [float(interval["durationSec"]) for interval in passed]
    shoot_starts = sorted(float(interval["startSec"]) for interval in shoot)
    shoot_gaps = [
        shoot_starts[index] - shoot_starts[index - 1]
        for index in range(1, len(shoot_starts))
        if shoot_starts[index] - shoot_starts[index - 1] > 0
    ]

    return {
        "hasActionTimeline": timeline is not None,
        "timelineTotalSec": float(timeline.get("totalSec", MATCH_TOTAL_SEC)) if timeline else MATCH_TOTAL_SEC,
        "timelineAutoEndSec": float(timeline.get("autoEndSec", AUTO_END_SEC)) if timeline else AUTO_END_SEC,
        "timelineDelayEndSec": float(timeline.get("delayEndSec", DELAY_END_SEC)) if timeline else DELAY_END_SEC,
        "timelineIntervalCount": len(intervals),
        "shootIntervalCount": len(shoot),
        "passIntervalCount": len(passed),
        "shootActiveSec": sum(shoot_durations),
        "passActiveSec": sum(pass_durations),
        "shootMedianIntervalSec": statistics.median(shoot_durations) if shoot_durations else 0.0,
        "passMedianIntervalSec": statistics.median(pass_durations) if pass_durations else 0.0,
        "shootCycleMedianGapSec": statistics.median(shoot_gaps) if shoot_gaps else 0.0,
        "actionTimelineJson": json.dumps(
            {
                "totalSec": float(timeline.get("totalSec", MATCH_TOTAL_SEC)) if timeline else MATCH_TOTAL_SEC,
                "autoEndSec": float(timeline.get("autoEndSec", AUTO_END_SEC)) if timeline else AUTO_END_SEC,
                "delayEndSec": float(timeline.get("delayEndSec", DELAY_END_SEC)) if timeline else DELAY_END_SEC,
                "intervals": intervals,
            },
            sort_keys=True,
        ),
    }


def flatten_match_entry(entry: Mapping[str, Any]) -> Dict[str, Any]:
    metadata = entry.get("metadata") or {}
    tele = entry.get("teleFuelBySegment") or {}
    active, wasted = compute_active_wasted(entry)
    auto_fuel = float(entry.get("autoFuelScored", 0) or 0)
    tele_total = total_tele(tele)
    auto_tower = str(entry.get("autoTower") or "none")
    tele_tower = str(entry.get("teleTower") or "none")

    expected_points = (
        auto_fuel * FUEL_POINTS_ACTIVE
        + active * FUEL_POINTS_ACTIVE
        + AUTO_TOWER_POINTS.get(auto_tower, 0.0)
        + TELE_TOWER_POINTS.get(tele_tower, 0.0)
    )
    timeline = timeline_metrics(entry)

    return {
        "scouterName": metadata.get("scouterName", ""),
        "matchNumber": metadata.get("matchNumber"),
        "teamNumber": metadata.get("robotTeam"),
        "robotPosition": metadata.get("robotPosition", ""),
        "alliance": get_alliance(metadata.get("robotPosition") or ""),
        "robotAbsent": bool(entry.get("robotAbsent", False)),
        "autoStartingPosition": entry.get("autoStartingPosition"),
        "autoMoved": bool(entry.get("autoMoved", False)),
        "autoFuelScored": auto_fuel,
        "autoTower": auto_tower,
        "autoFuelWinner": entry.get("autoFuelWinner"),
        "shift1ActiveHubIfTie": entry.get("shift1ActiveHubIfTie"),
        "teleFuelTransition": float(tele.get("transition", 0) or 0),
        "teleFuelShift1": float(tele.get("shift1", 0) or 0),
        "teleFuelShift2": float(tele.get("shift2", 0) or 0),
        "teleFuelShift3": float(tele.get("shift3", 0) or 0),
        "teleFuelShift4": float(tele.get("shift4", 0) or 0),
        "teleFuelEndgame": float(tele.get("endgame", 0) or 0),
        "teleFuelTotal": tele_total,
        "teleFuelActiveComputed": active,
        "teleFuelWastedComputed": wasted,
        "teleFuelEfficiencyComputed": safe_div(active, active + wasted),
        "autoTowerPoints": AUTO_TOWER_POINTS.get(auto_tower, 0.0),
        "teleTower": tele_tower,
        "teleTowerPoints": TELE_TOWER_POINTS.get(tele_tower, 0.0),
        "climbPoints": climb_points_from_tele_tower(tele_tower),
        "climbTimeBucket": entry.get("climbTimeBucket"),
        "breakdown": entry.get("breakdown"),
        "driverQuality": entry.get("driverQuality"),
        "driverQualityScore": DRIVER_QUALITY_SCORE.get(
            str(entry.get("driverQuality")),
            0.0,
        ),
        "expectedPoints": expected_points,
        "hasActionTimeline": timeline["hasActionTimeline"],
        "timelineTotalSec": timeline["timelineTotalSec"],
        "timelineAutoEndSec": timeline["timelineAutoEndSec"],
        "timelineDelayEndSec": timeline["timelineDelayEndSec"],
        "timelineIntervalCount": timeline["timelineIntervalCount"],
        "shootIntervalCount": timeline["shootIntervalCount"],
        "passIntervalCount": timeline["passIntervalCount"],
        "shootActiveSec": timeline["shootActiveSec"],
        "passActiveSec": timeline["passActiveSec"],
        "shootMedianIntervalSec": timeline["shootMedianIntervalSec"],
        "passMedianIntervalSec": timeline["passMedianIntervalSec"],
        "shootCycleMedianGapSec": timeline["shootCycleMedianGapSec"],
        "actionTimelineJson": timeline["actionTimelineJson"],
        "notes": entry.get("freeText", ""),
    }


def flatten_super_entry(entry: Mapping[str, Any]) -> Dict[str, Any]:
    metadata = entry.get("metadata") or {}
    fouls = entry.get("fouls") or {}
    breaks = entry.get("breaks") or {}
    comments = [
        comment for comment in (entry.get("comments") or []) if isinstance(comment, str)
    ]

    foul_pinning = float(fouls.get("pinning", 0) or 0)
    foul_tower = float(fouls.get("towerContactInEndgame", 0) or 0)
    foul_out_of_zone = float(fouls.get("outOfZoneShooting", 0) or 0)
    foul_ejected = float(fouls.get("ejectedFuel", 0) or 0)
    foul_other = float(fouls.get("other", 0) or 0)

    break_mechanism = float(breaks.get("mechanism", 0) or 0)
    break_battery = float(breaks.get("battery", 0) or 0)
    break_comms = float(breaks.get("comms", 0) or 0)
    break_bumper = float(breaks.get("bumper", 0) or 0)

    return {
        "scouterName": metadata.get("scouterName", ""),
        "matchNumber": metadata.get("matchNumber"),
        "teamNumber": metadata.get("robotTeam"),
        "robotPosition": metadata.get("robotPosition", ""),
        "defenseProvided": entry.get("defenseProvided", "none"),
        "defenseReceived": bool(entry.get("defenseReceived", False)),
        "foulPinning": foul_pinning,
        "foulTowerContactInEndgame": foul_tower,
        "foulOutOfZoneShooting": foul_out_of_zone,
        "foulEjectedFuel": foul_ejected,
        "foulOther": foul_other,
        "foulsTotal": (
            foul_pinning
            + foul_tower
            + foul_out_of_zone
            + foul_ejected
            + foul_other
        ),
        "breakMechanism": break_mechanism,
        "breakBattery": break_battery,
        "breakComms": break_comms,
        "breakBumper": break_bumper,
        "breaksTotal": break_mechanism + break_battery + break_comms + break_bumper,
        "humanPlayerFuelScored": float(entry.get("humanPlayerFuelScored", 0) or 0),
        "commentCount": len(comments),
        "comments": comments,
    }


def flatten_pit_entry(entry: Mapping[str, Any]) -> Dict[str, Any]:
    intake = entry.get("intakeSources") or {}
    return {
        "scouterName": entry.get("scouterName", ""),
        "teamNumber": entry.get("teamNumber"),
        "drivebase": entry.get("drivebase"),
        "maxFuelStorageEstimate": entry.get("maxFuelStorageEstimate"),
        "intakeDepot": bool(intake.get("depot", False)),
        "intakeOutpostCorral": bool(intake.get("outpostCorral", False)),
        "intakeFloorNeutral": bool(intake.get("floorNeutral", False)),
        "scoringMethod": entry.get("scoringMethod"),
        "preferredScoringSpot": entry.get("preferredScoringSpot"),
        "towerCapabilityClaimed": entry.get("towerCapabilityClaimed"),
        "batteryCount": entry.get("batteryCount"),
        "notes": entry.get("notes", ""),
    }


def coefficient_of_variation(values: List[float]) -> float:
    if len(values) <= 1:
        return 0.0
    mean_value = abs(statistics.fmean(values))
    if mean_value < 1e-9:
        return 2.5
    return min(2.5, statistics.pstdev(values) / mean_value)


def linear_regression(points: List[Tuple[float, float]]) -> Dict[str, float]:
    if len(points) < 2:
        return {
            "slope": 0.0,
            "intercept": points[0][1] if points else 0.0,
            "r": 0.0,
        }

    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    mean_x = statistics.fmean(xs)
    mean_y = statistics.fmean(ys)

    x_var = sum((x - mean_x) ** 2 for x in xs)
    if x_var == 0:
        return {"slope": 0.0, "intercept": mean_y, "r": 0.0}

    covariance = sum((x - mean_x) * (y - mean_y) for x, y in points)
    slope = covariance / x_var
    intercept = mean_y - slope * mean_x

    y_var = sum((y - mean_y) ** 2 for y in ys)
    if x_var == 0 or y_var == 0:
        correlation = 0.0
    else:
        correlation = covariance / math.sqrt(x_var * y_var)

    return {"slope": slope, "intercept": intercept, "r": correlation}


def summarize_quantitative_rows(
    rows: List[Dict[str, Any]],
    dataset: str,
    exclude_fields: set[str] | None = None,
) -> List[Dict[str, Any]]:
    exclude_fields = exclude_fields or set()
    metrics = sorted(
        {
            key
            for row in rows
            for key, value in row.items()
            if to_number(value) is not None and key not in exclude_fields
        }
    )

    summary: List[Dict[str, Any]] = []
    for metric in metrics:
        values = [
            to_number(row.get(metric))
            for row in rows
            if to_number(row.get(metric)) is not None
        ]
        numeric_values = [value for value in values if value is not None]
        if not numeric_values:
            continue
        stats = stats_for_values(numeric_values)
        summary.append({"dataset": dataset, "metric": metric, **stats})
    return summary


def summarize_categorical_rows(
    rows: List[Dict[str, Any]],
    dataset: str,
    exclude_fields: set[str] | None = None,
) -> List[Dict[str, Any]]:
    exclude_fields = exclude_fields or set()
    metrics = sorted(
        {
            key
            for row in rows
            for key, value in row.items()
            if (key not in exclude_fields)
            and (isinstance(value, (str, bool)) or value is None)
        }
    )

    summary: List[Dict[str, Any]] = []
    for metric in metrics:
        values = [row.get(metric) for row in rows]
        mode_stats = mode_and_counts(values)
        summary.append(
            {
                "dataset": dataset,
                "metric": metric,
                "count": mode_stats["count"],
                "uniqueCount": mode_stats["uniqueCount"],
                "mode": mode_stats["mode"],
                "modeCount": mode_stats["modeCount"],
                "countsJson": json.dumps(mode_stats["counts"], sort_keys=True),
            }
        )
    return summary


def build_team_profiles(
    match_rows: List[Dict[str, Any]],
    super_rows: List[Dict[str, Any]],
    pit_rows: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    match_rows_by_team: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    match_rows_by_match: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    super_rows_by_team: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    pit_by_team: Dict[int, Dict[str, Any]] = {}

    for row in pit_rows:
        team_number = row.get("teamNumber")
        if isinstance(team_number, int):
            pit_by_team[team_number] = row

    for row in match_rows:
        team_number = row.get("teamNumber")
        match_number = row.get("matchNumber")
        if not isinstance(team_number, int) or not isinstance(match_number, int):
            continue
        match_rows_by_team[team_number].append(row)
        match_rows_by_match[match_number].append(row)

    for row in super_rows:
        team_number = row.get("teamNumber")
        match_number = row.get("matchNumber")
        if not isinstance(team_number, int) or not isinstance(match_number, int):
            continue
        super_rows_by_team[team_number].append(row)

    team_numbers = sorted(
        set(match_rows_by_team.keys())
        | set(super_rows_by_team.keys())
        | set(pit_by_team.keys())
    )

    team_expected_points_baseline: Dict[int, float] = {}
    for team_number in team_numbers:
        team_matches = [
            row
            for row in match_rows_by_team.get(team_number, [])
            if not row.get("robotAbsent", False)
        ]
        values = [
            float(row.get("expectedPoints", 0.0) or 0.0) for row in team_matches
        ]
        team_expected_points_baseline[team_number] = (
            statistics.fmean(values) if values else 0.0
        )

    field_expected_points_mean = statistics.fmean(
        [team_expected_points_baseline.get(team, 0.0) for team in team_numbers]
    ) if team_numbers else 0.0

    profiles: List[Dict[str, Any]] = []
    for team_number in team_numbers:
        team_matches_all = match_rows_by_team.get(team_number, [])
        team_matches = [
            row for row in team_matches_all if not row.get("robotAbsent", False)
        ]
        team_super = super_rows_by_team.get(team_number, [])
        team_pit = pit_by_team.get(team_number)

        quantitative_inputs: Dict[str, List[float]] = {
            "autoFuelScored": [
                float(row.get("autoFuelScored", 0) or 0) for row in team_matches
            ],
            "teleFuelTotal": [
                float(row.get("teleFuelTotal", 0) or 0) for row in team_matches
            ],
            "teleFuelActiveComputed": [
                float(row.get("teleFuelActiveComputed", 0) or 0)
                for row in team_matches
            ],
            "teleFuelWastedComputed": [
                float(row.get("teleFuelWastedComputed", 0) or 0)
                for row in team_matches
            ],
            "teleFuelEfficiencyComputed": [
                float(row.get("teleFuelEfficiencyComputed", 0) or 0)
                for row in team_matches
            ],
            "expectedPoints": [
                float(row.get("expectedPoints", 0) or 0) for row in team_matches
            ],
            "climbPoints": [
                float(row.get("climbPoints", 0) or 0) for row in team_matches
            ],
            "driverQualityScore": [
                float(row.get("driverQualityScore", 0) or 0) for row in team_matches
            ],
            "shootActiveSec": [
                float(row.get("shootActiveSec", 0) or 0) for row in team_matches
            ],
            "passActiveSec": [
                float(row.get("passActiveSec", 0) or 0) for row in team_matches
            ],
            "shootIntervalCount": [
                float(row.get("shootIntervalCount", 0) or 0) for row in team_matches
            ],
            "passIntervalCount": [
                float(row.get("passIntervalCount", 0) or 0) for row in team_matches
            ],
            "shootMedianIntervalSec": [
                float(row.get("shootMedianIntervalSec", 0) or 0)
                for row in team_matches
            ],
            "passMedianIntervalSec": [
                float(row.get("passMedianIntervalSec", 0) or 0)
                for row in team_matches
            ],
            "shootCycleMedianGapSec": [
                float(row.get("shootCycleMedianGapSec", 0) or 0)
                for row in team_matches
            ],
            "foulsTotal": [
                float(row.get("foulsTotal", 0) or 0) for row in team_super
            ],
            "breaksTotal": [
                float(row.get("breaksTotal", 0) or 0) for row in team_super
            ],
            "humanPlayerFuelScored": [
                float(row.get("humanPlayerFuelScored", 0) or 0)
                for row in team_super
            ],
        }

        if team_pit:
            battery_count = to_number(team_pit.get("batteryCount"))
            max_storage = to_number(team_pit.get("maxFuelStorageEstimate"))
            if battery_count is not None:
                quantitative_inputs["pitBatteryCount"] = [battery_count]
            if max_storage is not None:
                quantitative_inputs["pitMaxFuelStorageEstimate"] = [max_storage]

        quantitative_stats = {
            metric: stats_for_values(values)
            for metric, values in quantitative_inputs.items()
        }

        categorical_inputs: Dict[str, List[Any]] = {
            "autoStartingPosition": [
                row.get("autoStartingPosition") for row in team_matches
            ],
            "autoTower": [row.get("autoTower") for row in team_matches],
            "autoFuelWinner": [row.get("autoFuelWinner") for row in team_matches],
            "teleTower": [row.get("teleTower") for row in team_matches],
            "climbTimeBucket": [row.get("climbTimeBucket") for row in team_matches],
            "breakdown": [row.get("breakdown") for row in team_matches],
            "driverQuality": [row.get("driverQuality") for row in team_matches],
            "defenseProvided": [row.get("defenseProvided") for row in team_super],
            "defenseReceived": [row.get("defenseReceived") for row in team_super],
        }

        if team_pit:
            categorical_inputs["drivebase"] = [team_pit.get("drivebase")]
            categorical_inputs["scoringMethod"] = [team_pit.get("scoringMethod")]
            categorical_inputs["preferredScoringSpot"] = [
                team_pit.get("preferredScoringSpot")
            ]
            categorical_inputs["towerCapabilityClaimed"] = [
                team_pit.get("towerCapabilityClaimed")
            ]

        categorical_stats = {
            metric: mode_and_counts(values)
            for metric, values in categorical_inputs.items()
        }

        comment_counts = Counter()
        for row in team_super:
            for tag in row.get("comments", []):
                comment_counts[tag] += 1

        expected_points_values = quantitative_inputs["expectedPoints"]
        tele_values = quantitative_inputs["teleFuelTotal"]
        climb_values = quantitative_inputs["climbPoints"]
        foul_values = quantitative_inputs["foulsTotal"]

        consistency_components = []
        for values in (expected_points_values, tele_values, climb_values):
            consistency_components.append(math.exp(-coefficient_of_variation(values)))
        if foul_values:
            consistency_components.append(math.exp(-coefficient_of_variation(foul_values)))
        consistency_score = (
            100.0 * statistics.fmean(consistency_components)
            if consistency_components
            else 0.0
        )

        defense_events: List[float] = []
        defended_matches = 0
        for super_row in team_super:
            defense_mode = super_row.get("defenseProvided")
            if defense_mode not in ("some", "heavy"):
                continue
            match_number = super_row.get("matchNumber")
            if not isinstance(match_number, int):
                continue
            team_match_row = next(
                (
                    row
                    for row in match_rows_by_match.get(match_number, [])
                    if row.get("teamNumber") == team_number
                ),
                None,
            )
            if not team_match_row:
                continue
            opponents = [
                row
                for row in match_rows_by_match.get(match_number, [])
                if row.get("alliance") != team_match_row.get("alliance")
                and not row.get("robotAbsent", False)
            ]
            if not opponents:
                continue
            suppressions = []
            for opponent in opponents:
                opponent_team = opponent.get("teamNumber")
                if not isinstance(opponent_team, int):
                    continue
                baseline = team_expected_points_baseline.get(opponent_team, 0.0)
                observed = float(opponent.get("expectedPoints", 0) or 0)
                suppressions.append(baseline - observed)
            if not suppressions:
                continue
            weight = 1.0 if defense_mode == "heavy" else 0.6
            defense_events.append(weight * statistics.fmean(suppressions))
            defended_matches += 1

        defense_impact = statistics.fmean(defense_events) if defense_events else 0.0
        defense_impact_stdev = (
            statistics.pstdev(defense_events) if len(defense_events) > 1 else 0.0
        )
        defense_confidence = 1 - math.exp(-safe_div(defended_matches, 3.0))
        defense_score = clamp(
            50 + 50 * math.tanh(safe_div(defense_impact * defense_confidence, 12)),
            0,
            100,
        )

        breakdown_rate = safe_div(
            sum(
                1
                for row in team_matches
                if row.get("breakdown") not in (None, "none")
            ),
            len(team_matches),
        )
        break_rate_any = safe_div(
            sum(
                1
                for row in team_super
                if float(row.get("breaksTotal", 0) or 0) > 0
            ),
            len(team_super),
        )
        reliability_index = clamp(
            1 - (0.6 * breakdown_rate + 0.4 * break_rate_any),
            0,
            1,
        )
        foul_discipline = clamp(
            1 - safe_div(quantitative_stats["foulsTotal"]["mean"], 6),
            0,
            1,
        )

        trend_points = [
            (
                float(row.get("matchNumber", 0) or 0),
                float(row.get("expectedPoints", 0) or 0),
            )
            for row in sorted(
                team_matches,
                key=lambda row: float(row.get("matchNumber", 0) or 0),
            )
            if row.get("matchNumber") is not None
        ]
        trend = linear_regression(trend_points)

        profile = {
            "teamNumber": team_number,
            "matchCount": len(team_matches),
            "superMatchCount": len(team_super),
            "quantitative": quantitative_stats,
            "categorical": categorical_stats,
            "customMetrics": {
                "consistencyScore": consistency_score,
                "defenseImpactExpectedPoints": defense_impact,
                "defenseImpactStdev": defense_impact_stdev,
                "defenseImpactScore": defense_score,
                "defenseImpactConfidence": defense_confidence,
                "reliabilityIndex": reliability_index,
                "disciplineIndex": foul_discipline,
                "timelineMatchCount": sum(
                    1 for row in team_matches if bool(row.get("hasActionTimeline"))
                ),
                "avgShootActiveSec": quantitative_stats["shootActiveSec"]["mean"],
                "avgPassActiveSec": quantitative_stats["passActiveSec"]["mean"],
                "avgShootIntervalCount": quantitative_stats["shootIntervalCount"]["mean"],
                "avgPassIntervalCount": quantitative_stats["passIntervalCount"]["mean"],
                "avgShootIntervalDurationSec": quantitative_stats["shootMedianIntervalSec"]["mean"],
                "avgPassIntervalDurationSec": quantitative_stats["passMedianIntervalSec"]["mean"],
                "avgShootCycleGapSec": quantitative_stats["shootCycleMedianGapSec"]["mean"],
                "offensiveExpectedPointsAboveField": (
                    quantitative_stats["expectedPoints"]["mean"]
                    - field_expected_points_mean
                ),
                "expectedPointsTrendPerMatch": trend["slope"],
                "expectedPointsTrendCorrelation": trend["r"],
                "floorExpectedPointsQ1": quantitative_stats["expectedPoints"]["q1"],
                "ceilingExpectedPointsQ3": quantitative_stats["expectedPoints"]["q3"],
                "upsideSpreadIQR": quantitative_stats["expectedPoints"]["iqr"],
            },
            "commentCounts": dict(comment_counts),
            "pit": team_pit or {},
        }
        profiles.append(profile)

    selection_components: Dict[str, List[float]] = {
        "offense": [
            profile["quantitative"]["expectedPoints"]["mean"] for profile in profiles
        ],
        "consistency": [
            profile["customMetrics"]["consistencyScore"] for profile in profiles
        ],
        "defense": [
            profile["customMetrics"]["defenseImpactExpectedPoints"]
            for profile in profiles
        ],
        "reliability": [
            profile["customMetrics"]["reliabilityIndex"] for profile in profiles
        ],
        "discipline": [
            profile["customMetrics"]["disciplineIndex"] for profile in profiles
        ],
    }

    component_stats = {
        key: stats_for_values([float(value) for value in values])
        for key, values in selection_components.items()
    }

    for profile in profiles:
        offense_z = safe_div(
            profile["quantitative"]["expectedPoints"]["mean"]
            - component_stats["offense"]["mean"],
            component_stats["offense"]["stdev"] or 1.0,
        )
        consistency_z = safe_div(
            profile["customMetrics"]["consistencyScore"]
            - component_stats["consistency"]["mean"],
            component_stats["consistency"]["stdev"] or 1.0,
        )
        defense_z = safe_div(
            profile["customMetrics"]["defenseImpactExpectedPoints"]
            - component_stats["defense"]["mean"],
            component_stats["defense"]["stdev"] or 1.0,
        )
        reliability_z = safe_div(
            profile["customMetrics"]["reliabilityIndex"]
            - component_stats["reliability"]["mean"],
            component_stats["reliability"]["stdev"] or 1.0,
        )
        discipline_z = safe_div(
            profile["customMetrics"]["disciplineIndex"]
            - component_stats["discipline"]["mean"],
            component_stats["discipline"]["stdev"] or 1.0,
        )

        profile["customMetrics"]["selectionScore"] = clamp(
            50
            + 18 * offense_z
            + 12 * consistency_z
            + 12 * defense_z
            + 8 * reliability_z
            + 6 * discipline_z,
            0,
            100,
        )
        profile["customMetrics"]["offenseZScore"] = offense_z
        profile["customMetrics"]["consistencyZScore"] = consistency_z
        profile["customMetrics"]["defenseZScore"] = defense_z

    return sorted(profiles, key=lambda profile: profile["teamNumber"])


def profile_to_flat_row(profile: Dict[str, Any]) -> Dict[str, Any]:
    row: Dict[str, Any] = {
        "teamNumber": profile["teamNumber"],
        "matchCount": profile["matchCount"],
        "superMatchCount": profile["superMatchCount"],
    }

    for metric, metric_stats in sorted(profile["quantitative"].items()):
        for stat_name, stat_value in metric_stats.items():
            row[f"{metric}_{stat_name}"] = stat_value

    for metric, metric_stats in sorted(profile["categorical"].items()):
        row[f"{metric}_mode"] = metric_stats.get("mode")
        row[f"{metric}_modeCount"] = metric_stats.get("modeCount")
        row[f"{metric}_uniqueCount"] = metric_stats.get("uniqueCount")
        row[f"{metric}_countsJson"] = json.dumps(
            metric_stats.get("counts", {}),
            sort_keys=True,
        )

    for metric, value in sorted(profile["customMetrics"].items()):
        row[metric] = value

    row["commentCountsJson"] = json.dumps(profile["commentCounts"], sort_keys=True)
    return row


def build_picklist_feature_rows(
    team_profiles: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for profile in team_profiles:
        quantitative = profile["quantitative"]
        categorical = profile["categorical"]
        custom = profile["customMetrics"]
        row = {
            "teamNumber": profile["teamNumber"],
            "matchCount": profile["matchCount"],
            "superMatchCount": profile["superMatchCount"],
            "expectedPoints_mean": quantitative["expectedPoints"]["mean"],
            "expectedPoints_median": quantitative["expectedPoints"]["median"],
            "expectedPoints_stdev": quantitative["expectedPoints"]["stdev"],
            "teleFuelTotal_mean": quantitative["teleFuelTotal"]["mean"],
            "teleFuelEfficiency_mean": quantitative["teleFuelEfficiencyComputed"][
                "mean"
            ],
            "autoFuelScored_mean": quantitative["autoFuelScored"]["mean"],
            "climbPoints_mean": quantitative["climbPoints"]["mean"],
            "driverQualityScore_mean": quantitative["driverQualityScore"]["mean"],
            "foulsTotal_mean": quantitative["foulsTotal"]["mean"],
            "breaksTotal_mean": quantitative["breaksTotal"]["mean"],
            "consistencyScore": custom["consistencyScore"],
            "defenseImpactExpectedPoints": custom["defenseImpactExpectedPoints"],
            "defenseImpactScore": custom["defenseImpactScore"],
            "defenseImpactConfidence": custom["defenseImpactConfidence"],
            "reliabilityIndex": custom["reliabilityIndex"],
            "disciplineIndex": custom["disciplineIndex"],
            "timelineMatchCount": custom["timelineMatchCount"],
            "avgShootActiveSec": custom["avgShootActiveSec"],
            "avgPassActiveSec": custom["avgPassActiveSec"],
            "avgShootIntervalCount": custom["avgShootIntervalCount"],
            "avgPassIntervalCount": custom["avgPassIntervalCount"],
            "avgShootIntervalDurationSec": custom["avgShootIntervalDurationSec"],
            "avgPassIntervalDurationSec": custom["avgPassIntervalDurationSec"],
            "avgShootCycleGapSec": custom["avgShootCycleGapSec"],
            "expectedPointsTrendPerMatch": custom["expectedPointsTrendPerMatch"],
            "selectionScore": custom["selectionScore"],
            "teleTower_mode": categorical["teleTower"]["mode"],
            "defenseProvided_mode": categorical["defenseProvided"]["mode"],
            "driverQuality_mode": categorical["driverQuality"]["mode"],
            "breakdown_mode": categorical["breakdown"]["mode"],
        }
        rows.append(row)
    return rows


def build_comment_summary(super_rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    counts = Counter()
    for row in super_rows:
        for comment in row.get("comments", []):
            if comment in COMMENT_VALUES:
                counts[comment] += 1
    total = sum(counts.values())
    return [
        {
            "comment": comment,
            "count": counts.get(comment, 0),
            "rate": safe_div(counts.get(comment, 0), total),
        }
        for comment in COMMENT_VALUES
    ]


def export_legacy_outputs(
    output_dir: Path,
    match_rows: List[Dict[str, Any]],
    super_rows: List[Dict[str, Any]],
    pit_rows: List[Dict[str, Any]],
    picklist_rows: List[Dict[str, Any]],
    quantitative_summary: List[Dict[str, Any]],
) -> None:
    legacy_dir = ROOT / "data-analysis"
    write_csv(legacy_dir / "match_raw_2026.csv", match_rows)
    write_csv(legacy_dir / "super_raw_2026.csv", super_rows)
    write_csv(legacy_dir / "pit_2026.csv", pit_rows)
    write_csv(legacy_dir / "team_agg_2026.csv", picklist_rows)
    write_csv(legacy_dir / "metric_summary_2026.csv", quantitative_summary)

    write_json(output_dir / "legacy_files_written.json", {"path": str(legacy_dir)})


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    client = MongoClient(args.mongo_url)
    db = client[args.db]

    match_entries = list(db.matchapps.find({}))
    super_entries = list(db.superapps.find({}))
    pit_entries = list(db.pitapps.find({}))

    raw_export = {
        "mongo": {
            "url": args.mongo_url,
            "db": args.db,
            "matchCount": len(match_entries),
            "superCount": len(super_entries),
            "pitCount": len(pit_entries),
        },
        "collections": {
            "matchapps": match_entries,
            "superapps": super_entries,
            "pitapps": pit_entries,
        },
    }
    write_json(output_dir / "mongo_raw_2026.json", raw_export)

    match_rows = [flatten_match_entry(entry) for entry in match_entries]
    super_rows = [flatten_super_entry(entry) for entry in super_entries]
    pit_rows = [flatten_pit_entry(entry) for entry in pit_entries]

    team_profiles = build_team_profiles(match_rows, super_rows, pit_rows)
    team_profile_rows = [profile_to_flat_row(profile) for profile in team_profiles]
    picklist_feature_rows = build_picklist_feature_rows(team_profiles)

    quantitative_summary: List[Dict[str, Any]] = []
    quantitative_summary += summarize_quantitative_rows(
        match_rows, "match", {"matchNumber", "teamNumber"}
    )
    quantitative_summary += summarize_quantitative_rows(
        super_rows, "super", {"matchNumber", "teamNumber"}
    )
    quantitative_summary += summarize_quantitative_rows(
        pit_rows, "pit", {"teamNumber"}
    )
    quantitative_summary += summarize_quantitative_rows(
        team_profile_rows, "team_profile", {"teamNumber"}
    )
    quantitative_summary += summarize_quantitative_rows(
        picklist_feature_rows, "picklist", {"teamNumber"}
    )

    categorical_summary: List[Dict[str, Any]] = []
    categorical_summary += summarize_categorical_rows(
        match_rows,
        "match",
        {"notes", "actionTimelineJson"},
    )
    categorical_summary += summarize_categorical_rows(super_rows, "super", {"comments"})
    categorical_summary += summarize_categorical_rows(pit_rows, "pit", {"notes"})
    categorical_summary += summarize_categorical_rows(picklist_feature_rows, "picklist")

    comment_summary = build_comment_summary(super_rows)

    write_json(output_dir / "match_raw_2026.json", match_rows)
    write_json(output_dir / "super_raw_2026.json", super_rows)
    write_json(output_dir / "pit_raw_2026.json", pit_rows)
    write_json(output_dir / "team_profiles_2026.json", team_profiles)
    write_json(output_dir / "team_picklist_features_2026.json", picklist_feature_rows)
    write_json(
        output_dir / "quantitative_metric_summary_2026.json",
        quantitative_summary,
    )
    write_json(
        output_dir / "categorical_metric_summary_2026.json",
        categorical_summary,
    )
    write_json(output_dir / "comment_tag_summary_2026.json", comment_summary)

    write_csv(output_dir / "match_raw_2026.csv", match_rows)
    write_csv(output_dir / "super_raw_2026.csv", super_rows)
    write_csv(output_dir / "pit_raw_2026.csv", pit_rows)
    write_csv(output_dir / "team_profiles_2026.csv", team_profile_rows)
    write_csv(output_dir / "team_picklist_features_2026.csv", picklist_feature_rows)
    write_csv(
        output_dir / "quantitative_metric_summary_2026.csv",
        quantitative_summary,
    )
    write_csv(
        output_dir / "categorical_metric_summary_2026.csv",
        categorical_summary,
    )
    write_csv(output_dir / "comment_tag_summary_2026.csv", comment_summary)

    export_legacy_outputs(
        output_dir=output_dir,
        match_rows=match_rows,
        super_rows=super_rows,
        pit_rows=pit_rows,
        picklist_rows=picklist_feature_rows,
        quantitative_summary=quantitative_summary,
    )

    print(
        "Analysis complete. Wrote raw extracts, quantitative/categorical summaries, "
        "team profiles, and picklist features to "
        f"{output_dir}."
    )


if __name__ == "__main__":
    main()
