import csv
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Tuple

from pymongo import MongoClient

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "client" / "src" / "assets" / "game_config_2026.json"

with open(CONFIG_PATH, "r", encoding="utf-8") as config_file:
    GAME_CONFIG = json.load(config_file)

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017/")
DB_NAME = os.getenv("SCOUT_DB", "test")

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


def get_alliance(robot_position: str) -> str:
    return "red" if robot_position and robot_position.startswith("red") else "blue"


def flip_alliance(color: str) -> str:
    return "blue" if color == "red" else "red"


def get_shift1_active(auto_winner: str, shift1_active_if_tie: str | None) -> str | None:
    if auto_winner in ("red", "blue"):
        return auto_winner
    if auto_winner == "tie":
        return shift1_active_if_tie
    return None


def compute_active_wasted(entry: Dict[str, Any]) -> Tuple[int, int]:
    tele = entry.get("teleFuelBySegment") or {}
    alliance = get_alliance(entry.get("metadata", {}).get("robotPosition", ""))

    both_active = set(GAME_CONFIG["hubRule"]["bothActiveSegments"])
    shift_order = GAME_CONFIG["hubRule"]["shiftOrder"]

    active = 0
    wasted = 0

    for segment in both_active:
        if segment in tele:
            active += tele.get(segment, 0) or 0

    shift1_active = get_shift1_active(
        entry.get("autoFuelWinner"), entry.get("shift1ActiveHubIfTie")
    )
    if shift1_active:
        for index, segment in enumerate(shift_order):
            if segment not in tele:
                continue
            active_hub = shift1_active if index % 2 == 0 else flip_alliance(shift1_active)
            if active_hub == alliance:
                active += tele.get(segment, 0) or 0
            else:
                wasted += tele.get(segment, 0) or 0

    return active, wasted


def write_csv(path: Path, rows: List[Dict[str, Any]], fieldnames: List[str]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def main() -> None:
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

    match_entries = list(db.matchapps.find({}))
    super_entries = list(db.superapps.find({}))
    pit_entries = list(db.pitapps.find({}))

    match_rows: List[Dict[str, Any]] = []
    for entry in match_entries:
        metadata = entry.get("metadata", {})
        tele = entry.get("teleFuelBySegment") or {}
        tele_active, tele_wasted = compute_active_wasted(entry)
        match_rows.append(
            {
                "scouterName": metadata.get("scouterName", ""),
                "matchNumber": metadata.get("matchNumber"),
                "robotTeam": metadata.get("robotTeam"),
                "robotPosition": metadata.get("robotPosition", ""),
                "robotAbsent": entry.get("robotAbsent", False),
                "autoStartingPosition": entry.get("autoStartingPosition"),
                "autoMoved": entry.get("autoMoved", False),
                "autoFuelScored": entry.get("autoFuelScored", 0),
                "autoTower": entry.get("autoTower"),
                "autoFuelWinner": entry.get("autoFuelWinner"),
                "shift1ActiveHubIfTie": entry.get("shift1ActiveHubIfTie"),
                "teleFuelTransition": tele.get("transition", 0),
                "teleFuelShift1": tele.get("shift1", 0),
                "teleFuelShift2": tele.get("shift2", 0),
                "teleFuelShift3": tele.get("shift3", 0),
                "teleFuelShift4": tele.get("shift4", 0),
                "teleFuelEndgame": tele.get("endgame", 0),
                "teleTower": entry.get("teleTower"),
                "climbTimeBucket": entry.get("climbTimeBucket"),
                "breakdown": entry.get("breakdown"),
                "driverQuality": entry.get("driverQuality"),
                "freeText": entry.get("freeText", ""),
                "teleFuelActiveComputed": tele_active,
                "teleFuelWastedComputed": tele_wasted,
            }
        )

    super_rows: List[Dict[str, Any]] = []
    for entry in super_entries:
        metadata = entry.get("metadata", {})
        fouls = entry.get("fouls") or {}
        breaks = entry.get("breaks") or {}
        comments = entry.get("comments") or []
        super_rows.append(
            {
                "scouterName": metadata.get("scouterName", ""),
                "matchNumber": metadata.get("matchNumber"),
                "robotTeam": metadata.get("robotTeam"),
                "robotPosition": metadata.get("robotPosition", ""),
                "defenseProvided": entry.get("defenseProvided"),
                "defenseReceived": entry.get("defenseReceived", False),
                "foulPinning": fouls.get("pinning", 0),
                "foulTowerContactInEndgame": fouls.get("towerContactInEndgame", 0),
                "foulOutOfZoneShooting": fouls.get("outOfZoneShooting", 0),
                "foulEjectedFuel": fouls.get("ejectedFuel", 0),
                "foulOther": fouls.get("other", 0),
                "breakMechanism": breaks.get("mechanism", 0),
                "breakBattery": breaks.get("battery", 0),
                "breakComms": breaks.get("comms", 0),
                "breakBumper": breaks.get("bumper", 0),
                "comments": ";".join(comments),
                "humanPlayerFuelScored": entry.get("humanPlayerFuelScored", 0),
            }
        )

    pit_rows: List[Dict[str, Any]] = []
    for entry in pit_entries:
        intake = entry.get("intakeSources") or {}
        pit_rows.append(
            {
                "scouterName": entry.get("scouterName", ""),
                "teamNumber": entry.get("teamNumber"),
                "drivebase": entry.get("drivebase"),
                "maxFuelStorageEstimate": entry.get("maxFuelStorageEstimate"),
                "intakeDepot": intake.get("depot", False),
                "intakeOutpostCorral": intake.get("outpostCorral", False),
                "intakeFloorNeutral": intake.get("floorNeutral", False),
                "scoringMethod": entry.get("scoringMethod"),
                "preferredScoringSpot": entry.get("preferredScoringSpot"),
                "towerCapabilityClaimed": entry.get("towerCapabilityClaimed"),
                "batteryCount": entry.get("batteryCount", 0),
                "notes": entry.get("notes", ""),
            }
        )

    match_agg: Dict[int, Dict[str, Any]] = {}
    for entry in match_entries:
        metadata = entry.get("metadata", {})
        team = metadata.get("robotTeam")
        if not team or entry.get("robotAbsent"):
            continue
        agg = match_agg.setdefault(
            team,
            {
                "matchCount": 0,
                "autoFuel": 0,
                "teleTransition": 0,
                "teleShift1": 0,
                "teleShift2": 0,
                "teleShift3": 0,
                "teleShift4": 0,
                "teleEndgame": 0,
                "teleActive": 0,
                "teleWasted": 0,
                "climbL1": 0,
                "climbL2": 0,
                "climbL3": 0,
                "climbFail": 0,
                "breakdown": 0,
            },
        )
        tele = entry.get("teleFuelBySegment") or {}
        agg["matchCount"] += 1
        agg["autoFuel"] += entry.get("autoFuelScored", 0)
        agg["teleTransition"] += tele.get("transition", 0)
        agg["teleShift1"] += tele.get("shift1", 0)
        agg["teleShift2"] += tele.get("shift2", 0)
        agg["teleShift3"] += tele.get("shift3", 0)
        agg["teleShift4"] += tele.get("shift4", 0)
        agg["teleEndgame"] += tele.get("endgame", 0)
        tele_active, tele_wasted = compute_active_wasted(entry)
        agg["teleActive"] += tele_active
        agg["teleWasted"] += tele_wasted
        tele_tower = entry.get("teleTower")
        if tele_tower == "level1":
            agg["climbL1"] += 1
        if tele_tower == "level2":
            agg["climbL2"] += 1
        if tele_tower == "level3":
            agg["climbL3"] += 1
        if tele_tower == "failed":
            agg["climbFail"] += 1
        if entry.get("breakdown") and entry.get("breakdown") != "none":
            agg["breakdown"] += 1

    super_agg: Dict[int, Dict[str, Any]] = {}
    for entry in super_entries:
        metadata = entry.get("metadata", {})
        team = metadata.get("robotTeam")
        if not team:
            continue
        agg = super_agg.setdefault(
            team,
            {
                "matchCount": 0,
                "pinning": 0,
                "towerContact": 0,
                "outOfZone": 0,
                "ejectedFuel": 0,
                "other": 0,
                "humanFuel": 0,
                "heavyDefense": 0,
                "someDefense": 0,
                "defenseReceived": 0,
                "commentCounts": {comment: 0 for comment in COMMENT_VALUES},
            },
        )
        fouls = entry.get("fouls") or {}
        agg["matchCount"] += 1
        agg["pinning"] += fouls.get("pinning", 0)
        agg["towerContact"] += fouls.get("towerContactInEndgame", 0)
        agg["outOfZone"] += fouls.get("outOfZoneShooting", 0)
        agg["ejectedFuel"] += fouls.get("ejectedFuel", 0)
        agg["other"] += fouls.get("other", 0)
        agg["humanFuel"] += entry.get("humanPlayerFuelScored", 0)
        if entry.get("defenseProvided") == "heavy":
            agg["heavyDefense"] += 1
        if entry.get("defenseProvided") == "some":
            agg["someDefense"] += 1
        if entry.get("defenseReceived"):
            agg["defenseReceived"] += 1
        for comment in entry.get("comments") or []:
            if comment in agg["commentCounts"]:
                agg["commentCounts"][comment] += 1

    team_numbers = set(match_agg.keys()) | set(super_agg.keys())
    team_rows: List[Dict[str, Any]] = []
    for team in sorted(team_numbers):
        match_team = match_agg.get(team, {})
        super_team = super_agg.get(team, {})
        match_count = match_team.get("matchCount", 0) or 0
        super_count = super_team.get("matchCount", 0) or 0

        def safe_avg(value: int | float, count: int) -> float:
            return value / count if count else 0

        row = {
            "teamNumber": team,
            "avgAutoFuel": safe_avg(match_team.get("autoFuel", 0), match_count),
            "avgTeleFuelTransition": safe_avg(
                match_team.get("teleTransition", 0), match_count
            ),
            "avgTeleFuelShift1": safe_avg(match_team.get("teleShift1", 0), match_count),
            "avgTeleFuelShift2": safe_avg(match_team.get("teleShift2", 0), match_count),
            "avgTeleFuelShift3": safe_avg(match_team.get("teleShift3", 0), match_count),
            "avgTeleFuelShift4": safe_avg(match_team.get("teleShift4", 0), match_count),
            "avgTeleFuelEndgame": safe_avg(
                match_team.get("teleEndgame", 0), match_count
            ),
            "avgTeleFuelActiveComputed": safe_avg(
                match_team.get("teleActive", 0), match_count
            ),
            "avgTeleFuelWastedComputed": safe_avg(
                match_team.get("teleWasted", 0), match_count
            ),
            "climbRateLevel1": safe_avg(match_team.get("climbL1", 0), match_count),
            "climbRateLevel2": safe_avg(match_team.get("climbL2", 0), match_count),
            "climbRateLevel3": safe_avg(match_team.get("climbL3", 0), match_count),
            "climbFailRate": safe_avg(match_team.get("climbFail", 0), match_count),
            "breakdownRate": safe_avg(match_team.get("breakdown", 0), match_count),
            "matchCount": match_count,
            "avgFoulsTotal": safe_avg(
                super_team.get("pinning", 0)
                + super_team.get("towerContact", 0)
                + super_team.get("outOfZone", 0)
                + super_team.get("ejectedFuel", 0)
                + super_team.get("other", 0),
                super_count,
            ),
            "foulRatePinning": safe_avg(super_team.get("pinning", 0), super_count),
            "foulRateTowerContactInEndgame": safe_avg(
                super_team.get("towerContact", 0), super_count
            ),
            "foulRateOutOfZoneShooting": safe_avg(
                super_team.get("outOfZone", 0), super_count
            ),
            "foulRateEjectedFuel": safe_avg(
                super_team.get("ejectedFuel", 0), super_count
            ),
            "foulRateOther": safe_avg(super_team.get("other", 0), super_count),
            "avgHumanPlayerFuelScored": safe_avg(
                super_team.get("humanFuel", 0), super_count
            ),
            "defenseHeavyRate": safe_avg(
                super_team.get("heavyDefense", 0), super_count
            ),
            "defenseSomeRate": safe_avg(
                super_team.get("someDefense", 0), super_count
            ),
            "defenseReceivedRate": safe_avg(
                super_team.get("defenseReceived", 0), super_count
            ),
            "superMatchCount": super_count,
        }
        comment_counts = super_team.get("commentCounts", {})
        for comment in COMMENT_VALUES:
            row[f"comment_{comment}"] = comment_counts.get(comment, 0)

        team_rows.append(row)

    match_fields = [
        "scouterName",
        "matchNumber",
        "robotTeam",
        "robotPosition",
        "robotAbsent",
        "autoStartingPosition",
        "autoMoved",
        "autoFuelScored",
        "autoTower",
        "autoFuelWinner",
        "shift1ActiveHubIfTie",
        "teleFuelTransition",
        "teleFuelShift1",
        "teleFuelShift2",
        "teleFuelShift3",
        "teleFuelShift4",
        "teleFuelEndgame",
        "teleTower",
        "climbTimeBucket",
        "breakdown",
        "driverQuality",
        "freeText",
        "teleFuelActiveComputed",
        "teleFuelWastedComputed",
    ]

    super_fields = [
        "scouterName",
        "matchNumber",
        "robotTeam",
        "robotPosition",
        "defenseProvided",
        "defenseReceived",
        "foulPinning",
        "foulTowerContactInEndgame",
        "foulOutOfZoneShooting",
        "foulEjectedFuel",
        "foulOther",
        "breakMechanism",
        "breakBattery",
        "breakComms",
        "breakBumper",
        "comments",
        "humanPlayerFuelScored",
    ]

    pit_fields = [
        "scouterName",
        "teamNumber",
        "drivebase",
        "maxFuelStorageEstimate",
        "intakeDepot",
        "intakeOutpostCorral",
        "intakeFloorNeutral",
        "scoringMethod",
        "preferredScoringSpot",
        "towerCapabilityClaimed",
        "batteryCount",
        "notes",
    ]

    team_fields = [
        "teamNumber",
        "avgAutoFuel",
        "avgTeleFuelTransition",
        "avgTeleFuelShift1",
        "avgTeleFuelShift2",
        "avgTeleFuelShift3",
        "avgTeleFuelShift4",
        "avgTeleFuelEndgame",
        "avgTeleFuelActiveComputed",
        "avgTeleFuelWastedComputed",
        "climbRateLevel1",
        "climbRateLevel2",
        "climbRateLevel3",
        "climbFailRate",
        "breakdownRate",
        "matchCount",
        "avgFoulsTotal",
        "foulRatePinning",
        "foulRateTowerContactInEndgame",
        "foulRateOutOfZoneShooting",
        "foulRateEjectedFuel",
        "foulRateOther",
        "avgHumanPlayerFuelScored",
        "defenseHeavyRate",
        "defenseSomeRate",
        "defenseReceivedRate",
        "superMatchCount",
    ] + [f"comment_{comment}" for comment in COMMENT_VALUES]

    write_csv(ROOT / "data-analysis" / "match_raw_2026.csv", match_rows, match_fields)
    write_csv(ROOT / "data-analysis" / "super_raw_2026.csv", super_rows, super_fields)
    write_csv(ROOT / "data-analysis" / "pit_2026.csv", pit_rows, pit_fields)
    write_csv(ROOT / "data-analysis" / "team_agg_2026.csv", team_rows, team_fields)

    print("Wrote match_raw_2026.csv, super_raw_2026.csv, pit_2026.csv, team_agg_2026.csv")


if __name__ == "__main__":
    main()
