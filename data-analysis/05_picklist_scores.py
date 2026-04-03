import argparse
from pathlib import Path
from typing import Any, Dict, List

from common import coerce_float, load_settings, mean, read_csv, resolve_run_dir, stdev, utc_now_iso, write_csv, write_json


COMPONENT_KEYS = ['offense', 'auto', 'consistency', 'reliability', 'defense', 'trend']


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Stage 05: calculate interpretable picklist scores from team aggregate metrics.'
    )
    parser.add_argument('--settings', default='app_settings/settings.json', help='Path to app settings JSON.')
    parser.add_argument(
        '--analysis-run',
        default=None,
        help='Analysis run folder name or absolute path. Defaults to latest analysis run pointer.',
    )
    return parser.parse_args()


def normalize_metric(values: List[float], mode: str) -> List[float]:
    if not values:
        return []

    if mode == 'minmax':
        minimum = min(values)
        maximum = max(values)
        spread = maximum - minimum
        if spread == 0:
            return [0.0 for _ in values]
        return [(value - minimum) / spread for value in values]

    avg = mean(values)
    sd = stdev(values)
    if sd == 0:
        return [0.0 for _ in values]
    return [(value - avg) / sd for value in values]


def build_component_raw(team_row: Dict[str, str]) -> Dict[str, float]:
    offense = (
        0.55 * coerce_float(team_row.get('avgFuelPerMatch', 0.0))
        + 0.45 * coerce_float(team_row.get('estimatedFuelPoints', 0.0))
    )
    auto = (
        0.7 * coerce_float(team_row.get('avgAutoFuel', 0.0))
        + 0.3 * coerce_float(team_row.get('fuelQ3', 0.0))
    )
    consistency = (
        1.4 * coerce_float(team_row.get('consistencyIndex', 0.0))
        - 0.12 * coerce_float(team_row.get('fuelStdev', 0.0))
    )
    reliability = (
        0.55 * coerce_float(team_row.get('reliabilityIndex', 0.0))
        + 0.45 * coerce_float(team_row.get('disciplineIndex', 0.0))
    )
    defense = (
        0.7 * coerce_float(team_row.get('defenseEffectiveness', 0.0))
        + 0.3 * coerce_float(team_row.get('defensePlayEstimate', 0.0))
    )
    trend = coerce_float(team_row.get('expectedFuelTrendPerMatch', 0.0))

    return {
        'offense': offense,
        'auto': auto,
        'consistency': consistency,
        'reliability': reliability,
        'defense': defense,
        'trend': trend,
    }


def main() -> None:
    args = parse_args()
    settings = load_settings(args.settings)

    analysis_root = Path(settings['_analysis_runs_root'])
    analysis_run_dir = resolve_run_dir(analysis_root, args.analysis_run)

    team_rows = read_csv(analysis_run_dir / '04_team_aggregates.csv')
    normalization_mode = str(settings['analysis'].get('normalization', 'zscore')).lower()
    component_weights: Dict[str, float] = {
        key: coerce_float(settings['analysis'].get('component_weights', {}).get(key, 1.0), 1.0)
        for key in COMPONENT_KEYS
    }

    raw_components_by_team: Dict[int, Dict[str, float]] = {}
    for team_row in team_rows:
        team_number = int(float(team_row.get('teamNumber', 0) or 0))
        raw_components_by_team[team_number] = build_component_raw(team_row)

    normalized_by_component: Dict[str, List[float]] = {}
    for component in COMPONENT_KEYS:
        component_values = [raw_components_by_team[int(float(row.get('teamNumber', 0) or 0))][component] for row in team_rows]
        normalized_by_component[component] = normalize_metric(component_values, normalization_mode)

    scale = settings['analysis'].get('score_scale', {})
    center = coerce_float(scale.get('center', 50))
    spread = coerce_float(scale.get('spread', 18))
    score_min = coerce_float(scale.get('min', 0))
    score_max = coerce_float(scale.get('max', 100))

    score_rows: List[Dict[str, Any]] = []
    contribution_rows: List[Dict[str, Any]] = []

    for index, team_row in enumerate(team_rows):
        team_number = int(float(team_row.get('teamNumber', 0) or 0))
        weighted_sum = 0.0

        score_row: Dict[str, Any] = {
            'teamNumber': team_number,
            'matchCount': int(float(team_row.get('matchCount', 0) or 0)),
        }

        for component in COMPONENT_KEYS:
            raw_value = raw_components_by_team[team_number][component]
            normalized_value = normalized_by_component[component][index]
            contribution = normalized_value * component_weights[component]
            weighted_sum += contribution

            score_row[f'{component}_raw'] = round(raw_value, 6)
            score_row[f'{component}_normalized'] = round(normalized_value, 6)
            score_row[f'{component}_contribution'] = round(contribution, 6)

            contribution_rows.append(
                {
                    'teamNumber': team_number,
                    'metric': component,
                    'rawValue': round(raw_value, 6),
                    'normalizedValue': round(normalized_value, 6),
                    'weight': round(component_weights[component], 6),
                    'contribution': round(contribution, 6),
                }
            )

        score_value = max(score_min, min(score_max, center + spread * weighted_sum))
        score_row['weightedSum'] = round(weighted_sum, 6)
        score_row['score'] = round(score_value, 6)
        score_rows.append(score_row)

    score_rows.sort(key=lambda row: row['score'], reverse=True)
    for rank, row in enumerate(score_rows, start=1):
        row['rank'] = rank

    write_csv(analysis_run_dir / '05_picklist_scores.csv', score_rows)
    write_csv(analysis_run_dir / '05_metric_contributions.csv', contribution_rows)

    write_json(
        analysis_run_dir / '05_stage_summary.json',
        {
            'stage': '05_picklist_scores',
            'createdAt': utc_now_iso(),
            'analysisRun': str(analysis_run_dir),
            'componentWeights': component_weights,
            'teamCount': len(score_rows),
        },
    )

    print(
        'Stage 05 complete: '
        f'{len(score_rows)} scored teams, {len(contribution_rows)} contribution rows -> {analysis_run_dir}'
    )


if __name__ == '__main__':
    main()
