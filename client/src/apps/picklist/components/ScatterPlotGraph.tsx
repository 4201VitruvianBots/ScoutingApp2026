import { ChartShallowDataShape, ScatterPlot } from 'reaviz';
import { AnalysisEntry, ScatterPlotGraphData } from '../data';
import { TeamData } from 'requests';

function ScatterPlotGraph({
    table,
    data,
}: {
    table: ScatterPlotGraphData;
    data: AnalysisEntry[];
    teamInfoJson: TeamData;
}) {
    const plotData: ChartShallowDataShape[] = data
        .filter(
            entry =>
                Number.isFinite(entry[table.xColumn] as number) &&
                Number.isFinite(entry[table.yColumn] as number)
        )
        .map(entry => ({
            key: entry.teamNumber.toString(),
            data: [
                entry[table.xColumn] as number,
                entry[table.yColumn] as number,
            ],
        }));

    return <ScatterPlot data={plotData} />;
}

export default ScatterPlotGraph;
