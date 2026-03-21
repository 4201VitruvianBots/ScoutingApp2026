from pathlib import Path
from typing import Any, Dict, List

from common import coerce_float, load_config, mean, parse_args, read_csv, safe_div, stdev, write_csv


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


def main() -> None:
    args = parse_args('Stage 05: calculate configurable picklist scores from aggregate metrics')
    config = load_config(args.config)
    output_dir = Path(config['_output_dir'])

    team_rows = read_csv(output_dir / '04_team_aggregates.csv')
    metric_registry: Dict[str, Dict[str, Any]] = config['analysis'].get('metrics', {})
    normalization_mode = str(config['analysis'].get('normalization', 'zscore')).lower()

    enabled_metrics = [
        (metric_name, settings)
        for metric_name, settings in metric_registry.items()
        if settings.get('enabled', True)
    ]

    metric_values: Dict[str, List[float]] = {
        metric_name: [coerce_float(row.get(metric_name, 0.0)) for row in team_rows]
        for metric_name, _ in enabled_metrics
    }

    normalized_values: Dict[str, List[float]] = {
        metric_name: normalize_metric(values, normalization_mode)
        for metric_name, values in metric_values.items()
    }

    scale = config['analysis'].get('score_scale', {})
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

        for metric_name, settings in enabled_metrics:
            weight = coerce_float(settings.get('weight', 1.0))
            direction = -1.0 if str(settings.get('direction', 'high')).lower() == 'low' else 1.0

            raw_value = metric_values[metric_name][index]
            normalized = normalized_values[metric_name][index] * direction
            contribution = normalized * weight
            weighted_sum += contribution

            score_row[f'{metric_name}_raw'] = round(raw_value, 6)
            score_row[f'{metric_name}_normalized'] = round(normalized, 6)
            score_row[f'{metric_name}_contribution'] = round(contribution, 6)

            contribution_rows.append(
                {
                    'teamNumber': team_number,
                    'metric': metric_name,
                    'rawValue': round(raw_value, 6),
                    'normalizedValue': round(normalized, 6),
                    'weight': round(weight, 6),
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

    write_csv(output_dir / '05_picklist_scores.csv', score_rows)
    write_csv(output_dir / '05_metric_contributions.csv', contribution_rows)

    print(
        f"Stage 05 complete: wrote {len(score_rows)} scored teams and {len(contribution_rows)} metric contribution rows."
    )


if __name__ == '__main__':
    main()
