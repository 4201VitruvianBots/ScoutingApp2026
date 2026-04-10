import argparse
from collections import defaultdict
from typing import Any, Dict, List, Tuple

from common import (
    coerce_bool,
    coerce_float,
    coerce_int,
    linear_slope,
    load_settings,
    mean,
    median,
    quantile,
    read_csv,
    resolve_analysis_run_dir_from_settings,
    safe_div,
    stdev,
    utc_now_iso,
    write_csv,
    write_json,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Stage 04: aggregate team metrics and compute defense effectiveness signals.'
    )
    parser.add_argument('--settings', default='app_settings/settings.json', help='Path to app settings JSON.')
    parser.add_argument(
        '--analysis-run',
        default=None,
        help=(
            'Analysis run folder name or absolute path. '
            'Defaults to settings.paths.analysis_run_folder when set, otherwise latest analysis run pointer.'
        ),
    )
    return parser.parse_args()


def parse_team_csv(value: str | None) -> List[int]:
    if not value:
        return []
    output: List[int] = []
    for chunk in value.split(','):
        team = coerce_int(chunk.strip(), 0)
        if team > 0:
            output.append(team)
    return output


def coefficient_of_variation(values: List[float]) -> float:
    if len(values) <= 1:
        return 0.0
    avg = abs(mean(values))
    if avg < 1e-9:
        return 2.5
    return min(2.5, stdev(values) / avg)


def build_expectation_maps(feature_rows: List[Dict[str, str]], alpha: float = 0.45) -> Dict[Tuple[int, int], Dict[str, float]]:
    by_team: Dict[int, List[Dict[str, str]]] = defaultdict(list)
    for row in feature_rows:
        team = coerce_int(row.get('teamNumber', 0))
        if team <= 0:
            continue
        by_team[team].append(row)

    expectation_map: Dict[Tuple[int, int], Dict[str, float]] = {}

    for team, rows in by_team.items():
        rows.sort(key=lambda row: coerce_int(row.get('matchNumber', 0)))
        ema: float | None = None
        for row in rows:
            match_number = coerce_int(row.get('matchNumber', 0))
            if match_number <= 0:
                continue
            actual = coerce_float(row.get('actualFuelTotal', row.get('estimatedFuelPoints', 0)))
            expected = actual if ema is None else ema
            residual = actual - expected
            expectation_map[(match_number, team)] = {
                'expected': expected,
                'actual': actual,
                'residual': residual,
            }
            ema = expected + alpha * residual if ema is not None else actual

    return expectation_map


def main() -> None:
    args = parse_args()
    settings = load_settings(args.settings)

    analysis_run_dir = resolve_analysis_run_dir_from_settings(settings, args.analysis_run)

    feature_rows = read_csv(analysis_run_dir / '03_match_features.csv')
    pit_rows = read_csv(analysis_run_dir / '02_pit_clean.csv')

    pit_by_team = {coerce_int(row.get('teamNumber')): row for row in pit_rows}

    expectation_map = build_expectation_maps(feature_rows, alpha=0.45)
    by_team: Dict[int, List[Dict[str, str]]] = defaultdict(list)
    by_match: Dict[int, List[Dict[str, str]]] = defaultdict(list)

    for row in feature_rows:
        team_number = coerce_int(row.get('teamNumber', 0))
        match_number = coerce_int(row.get('matchNumber', 0))
        if team_number <= 0 or match_number <= 0:
            continue
        by_team[team_number].append(row)
        by_match[match_number].append(row)

    defense_events: List[Dict[str, Any]] = []
    defense_events_by_team: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    defense_intensity_map = {'None': 0.0, 'some': 0.55, 'heavy': 1.0}

    for row in feature_rows:
        team_number = coerce_int(row.get('teamNumber', 0))
        match_number = coerce_int(row.get('matchNumber', 0))
        if team_number <= 0 or match_number <= 0:
            continue

        defense_label = str(row.get('defenseProvided', 'None'))
        intensity = defense_intensity_map.get(defense_label, 0.0)
        opponents = parse_team_csv(row.get('opponentTeamsCsv'))
        allies = parse_team_csv(row.get('alliedTeamsCsv'))

        opponent_deltas: List[float] = []
        for opponent in opponents:
            opp_expect = expectation_map.get((match_number, opponent))
            if not opp_expect:
                continue
            opponent_deltas.append(opp_expect['expected'] - opp_expect['actual'])

        ally_residuals: List[float] = []
        for ally in allies:
            ally_expect = expectation_map.get((match_number, ally))
            if not ally_expect:
                continue
            ally_residuals.append(ally_expect['residual'])

        opp_suppression = mean(opponent_deltas)
        ally_drift = mean(ally_residuals)
        impact = intensity * (opp_suppression + 0.25 * ally_drift)

        event = {
            'teamNumber': team_number,
            'matchNumber': match_number,
            'defenseProvided': defense_label,
            'defenseIntensity': round(intensity, 6),
            'opponentSuppression': round(opp_suppression, 6),
            'allyResidualDrift': round(ally_drift, 6),
            'impactMatch': round(impact, 6),
            'opponentCount': len(opponent_deltas),
            'allyCount': len(ally_residuals),
        }
        defense_events.append(event)
        defense_events_by_team[team_number].append(event)

    team_rows: List[Dict[str, Any]] = []
    defense_shrinkage_k = max(1.0, coerce_float(settings['analysis'].get('defense_shrinkage_k', 6), 6.0))

    for team_number, rows in sorted(by_team.items()):
        rows.sort(key=lambda row: coerce_int(row.get('matchNumber', 0)))
        match_count = len(rows)

        avg_auto_fuel = mean([coerce_float(row.get('autoFuelScored', 0)) for row in rows])
        avg_tele_fuel = mean([coerce_float(row.get('teleFuelTotal', 0)) for row in rows])
        avg_fuel = mean([coerce_float(row.get('actualFuelTotal', 0)) for row in rows])
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

        role_primary_rate = safe_div(
            sum(1 for row in rows if row.get('roleEstimate') == 'primary_scorer'),
            match_count,
        )
        role_support_rate = safe_div(
            sum(1 for row in rows if row.get('roleEstimate') == 'support'),
            match_count,
        )
        role_defense_rate = safe_div(
            sum(1 for row in rows if row.get('roleEstimate') == 'defense'),
            match_count,
        )

        defense_events_for_team = defense_events_by_team.get(team_number, [])
        defensive_events = [event for event in defense_events_for_team if event['defenseIntensity'] > 0]
        n_def_matches = len(defensive_events)

        raw_defense_impact = mean([coerce_float(event['impactMatch'], 0) for event in defensive_events])
        confidence = safe_div(float(n_def_matches), float(n_def_matches) + defense_shrinkage_k)
        defense_effectiveness = raw_defense_impact * confidence

        declared_defense_rate = mean([
            defense_intensity_map.get(str(row.get('defenseProvided', 'None')), 0.0)
            for row in rows
        ])
        suppression_signal = mean(
            [max(0.0, coerce_float(event['opponentSuppression'], 0.0)) for event in defensive_events]
        )
        suppression_normalized = max(0.0, min(1.0, suppression_signal / 18.0))
        defense_play_estimate = max(0.0, min(1.0, 0.6 * declared_defense_rate + 0.4 * suppression_normalized))

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
                'rolePrimaryScorerRate': round(role_primary_rate, 4),
                'roleSupportRate': round(role_support_rate, 4),
                'roleDefenseRate': round(role_defense_rate, 4),
                'defenseImpactRaw': round(raw_defense_impact, 6),
                'defenseImpactConfidence': round(confidence, 6),
                'defenseEffectiveness': round(defense_effectiveness, 6),
                'defensePlayEstimate': round(defense_play_estimate, 6),
                'defensiveSampleCount': n_def_matches,
                'defenseOpponentSuppressionAvg': round(
                    mean([coerce_float(event['opponentSuppression'], 0.0) for event in defensive_events]),
                    6,
                ),
                'pitDrivebase': pit.get('drivebase', ''),
                'pitBatteryCount': coerce_int(pit.get('batteryCount', 0)),
                'pitMaxFuelStorageEstimate': coerce_float(pit.get('maxFuelStorageEstimate', 0)),
                'pitScoringMethod': pit.get('scoringMethod', ''),
                'pitPreferredScoringSpot': pit.get('preferredScoringSpot', ''),
                'pitRobotMaintain': pit.get('robotMaintain', ''),
                'pitTowerCapabilityClaimed': pit.get('towerCapabilityClaimed', ''),
            }
        )

    write_csv(analysis_run_dir / '04_team_aggregates.csv', team_rows)
    write_csv(analysis_run_dir / '04_defense_events.csv', defense_events)

    write_json(
        analysis_run_dir / '04_stage_summary.json',
        {
            'stage': '04_team_aggregation',
            'createdAt': utc_now_iso(),
            'analysisRun': str(analysis_run_dir),
            'teamCount': len(team_rows),
            'defenseEventCount': len(defense_events),
            'defenseFormula': {
                'impactMatch': 'intensity(defenseProvided) * (opponentSuppression + 0.25 * allyResidualDrift)',
                'opponentSuppression': 'mean(expected_opponent - actual_opponent)',
                'defenseEffectiveness': 'mean(impactMatch over defensive matches) * n/(n+k)',
                'k': defense_shrinkage_k,
            },
        },
    )

    print(f'Stage 04 complete: wrote {len(team_rows)} team aggregate rows -> {analysis_run_dir}')


if __name__ == '__main__':
    main()
