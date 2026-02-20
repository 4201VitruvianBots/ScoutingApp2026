import { BarChart, BarSeries, ChartDataShape, ColorSchemeType } from 'reaviz';
import { AnalysisEntry, BarGraphData } from '../data';
import { TeamData } from 'requests';

function BarGraph({
    table,
    data,
    teamInfoJson,
}: {
    table: BarGraphData;
    data: AnalysisEntry[];
    teamInfoJson: TeamData;
}) {
    const entries = data
        .filter(
            entry =>
                typeof entry[table.column] === 'number' &&
                Number.isFinite(entry[table.column] as number)
        )
        .map<ChartDataShape>(entry => ({
            key: entry.teamNumber.toString(),
            data: entry[table.column] as number,
        }));

    const sortedEntries = [...entries].sort(
        (a, b) => (a.data as number) - (b.data as number)
    );
    if (!table.ascending) sortedEntries.reverse();

    const limitedEntries =
        table.top && table.top > 0 && table.top < sortedEntries.length
            ? sortedEntries.slice(0, table.top)
            : sortedEntries;

    // Create a list of colors for each team based on the colors stored in team_info.json
    const sortedTeamNumbers = limitedEntries.map(entry => entry.key as string);

    const teamColors: ColorSchemeType = sortedTeamNumbers.map(
        teamNumber => teamInfoJson[teamNumber]?.primaryHex ?? '#7f7f7f'
    );

    return (
        <BarChart
            data={limitedEntries}
            series={<BarSeries colorScheme={teamColors} />}
        />
    );
}

export default BarGraph;
