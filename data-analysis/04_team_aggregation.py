from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List

from common import (
    coerce_bool,
    coerce_float,
    coerce_int,
    linear_slope,
    load_config,
    mean,
    median,
    parse_args,
    quantile,
    read_csv,
    safe_div,
    stdev,
    write_csv,
)


def coefficient_of_variation(values: List[float]) -> float:
    if len(values) <= 1:
        return 0.0
    avg = abs(mean(values))
    if avg < 1e-9:
        return 2.5
    return min(2.5, stdev(values) / avg)


def main() -> None:
    args = parse_args('Stage 04: aggregate team-level metrics from engineered features')
    config = load_config(args.config)
    output_dir = Path(config['_output_dir'])

    feature_rows = read_csv(output_dir / '03_match_features.csv')
    pit_rows = read_csv(output_dir / '02_pit_clean.csv')

    pit_by_team = {coerce_int(row.get('teamNumber')): row for row in pit_rows}

    by_team: Dict[int, List[Dict[str, str]]] = defaultdict(list)
    for row in feature_rows:
        team_number = coerce_int(row.get('teamNumber', 0))
        if team_number <= 0:
            continue
        by_team[team_number].append(row)

    team_rows: List[Dict[str, Any]] = []

    for team_number, rows in sorted(by_team.items()):
        rows.sort(key=lambda row: coerce_int(row.get('matchNumber', 0)))
        match_count = len(rows)

        avg_auto_fuel = mean([coerce_float(row.get('autoFuelScored', 0)) for row in rows])
        avg_tele_fuel = mean([coerce_float(row.get('teleFuelTotal', 0)) for row in rows])
        avg_fuel = mean([coerce_float(row.get('autoFuelScored', 0)) + coerce_float(row.get('teleFuelTotal', 0)) for row in rows])
        avg_shoot_held = mean([coerce_float(row.get('shootHeldSec', 0)) for row in rows])
        avg_pass_held = mean([coerce_float(row.get('passHeldSec', 0)) for row in rows])
        avg_estimated_shot_balls = mean([coerce_float(row.get('estimatedShotBalls', 0)) for row in rows])
        avg_estimated_pass_balls = mean([coerce_float(row.get('estimatedPassBalls', 0)) for row in rows])
        avg_estimated_fuel_points = mean([coerce_float(row.get('estimatedFuelPoints', 0)) for row in rows])
        avg_fouls = mean([coerce_float(row.get('foulsTotal', 0)) for row in rows])
        avg_breaks = mean([coerce_float(row.get('breaksTotal', 0)) for row in rows])
        breakdown_rate = safe_div(
            sum(1 for row in rows if row.get('breakdown') and row.get('breakdown') != 'None'),
            match_count,
        )
        break_rate_any = safe_div(
            sum(1 for row in rows if coerce_float(row.get('breaksTotal', 0)) > 0),
            match_count,
        )

        defense_heavy_rate = safe_div(
            sum(1 for row in rows if row.get('defenseProvided') == 'heavy'),
            match_count,
        )
        defense_some_rate = safe_div(
            sum(1 for row in rows if row.get('defenseProvided') == 'some'),
            match_count,
        )
        defense_received_rate = safe_div(
            sum(1 for row in rows if coerce_bool(row.get('defenseReceived'))),
            match_count,
        )

        timeline_coverage_rate = safe_div(
            sum(1 for row in rows if coerce_bool(row.get('hasTimeline'))),
            match_count,
        )

        expected_points_values = [coerce_float(row.get('estimatedFuelPoints', 0)) for row in rows]
        consistency_index = 1 / (1 + coefficient_of_variation(expected_points_values))
        reliability_index = max(0.0, 1 - (breakdown_rate * 0.6 + break_rate_any * 0.4))
        discipline_index = max(0.0, 1 - avg_fouls / 6)

        trend_points = [
            (coerce_float(row.get('matchNumber', 0)), coerce_float(row.get('estimatedFuelPoints', 0)))
            for row in rows
        ]
        trend_slope = linear_slope(trend_points)

        pit = pit_by_team.get(team_number, {})

        team_rows.append(
            {
                'teamNumber': team_number,
                'matchCount': match_count,
                'avgAutoFuel': round(avg_auto_fuel, 4),
                'avgTeleFuelPerMatch': round(avg_tele_fuel, 4),
                'avgFuelPerMatch': round(avg_fuel, 4),
                'avgShootHeldSec': round(avg_shoot_held, 4),
                'avgPassHeldSec': round(avg_pass_held, 4),
                'avgEstimatedShotBalls': round(avg_estimated_shot_balls, 4),
                'avgEstimatedPassBalls': round(avg_estimated_pass_balls, 4),
                'estimatedFuelPoints': round(avg_estimated_fuel_points, 4),
                'avgFoulsPerMatch': round(avg_fouls, 4),
                'avgBreaksPerMatch': round(avg_breaks, 4),
                'breakdownRate': round(breakdown_rate, 4),
                'breakRateAny': round(break_rate_any, 4),
                'defenseHeavyRate': round(defense_heavy_rate, 4),
                'defenseSomeRate': round(defense_some_rate, 4),
                'defenseReceivedRate': round(defense_received_rate, 4),
                'timelineCoverageRate': round(timeline_coverage_rate, 4),
                'consistencyIndex': round(consistency_index, 4),
                'reliabilityIndex': round(reliability_index, 4),
                'disciplineIndex': round(discipline_index, 4),
                'expectedFuelTrendPerMatch': round(trend_slope, 4),
                'fuelQ1': round(quantile(expected_points_values, 0.25), 4),
                'fuelMedian': round(median(expected_points_values), 4),
                'fuelQ3': round(quantile(expected_points_values, 0.75), 4),
                'fuelStdev': round(stdev(expected_points_values), 4),
                'pitDrivebase': pit.get('drivebase', ''),
                'pitBatteryCount': coerce_int(pit.get('batteryCount', 0)),
                'pitMaxFuelStorageEstimate': coerce_float(pit.get('maxFuelStorageEstimate', 0)),
                'pitScoringMethod': pit.get('scoringMethod', ''),
                'pitPreferredScoringSpot': pit.get('preferredScoringSpot', ''),
                'pitRobotMaintain': pit.get('robotMaintain', ''),
                'pitTowerCapabilityClaimed': pit.get('towerCapabilityClaimed', ''),
            }
        )

    write_csv(output_dir / '04_team_aggregates.csv', team_rows)

    print(f'Stage 04 complete: wrote {len(team_rows)} team aggregate rows.')


if __name__ == '__main__':
    main()
