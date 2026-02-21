import { TeamData } from 'requests';
import {
    CartesianGrid,
    LabelList,
    ResponsiveContainer,
    Scatter,
    ScatterChart,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import camelToSpaced from '../../../lib/camelCaseConvert';
import { AnalysisEntry, ScatterPlotGraphData } from '../data';

type Point = {
    teamNumber: number;
    x: number;
    y: number;
    label: string;
};

function mean(values: number[]) {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function regression(points: Point[]) {
    if (points.length <= 1) {
        return { slope: 0, intercept: points[0]?.y ?? 0, r: 0 };
    }
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    const xMean = mean(xs);
    const yMean = mean(ys);
    const xVar = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);
    if (xVar === 0) return { slope: 0, intercept: yMean, r: 0 };
    const covariance = points.reduce(
        (sum, point) => sum + (point.x - xMean) * (point.y - yMean),
        0
    );
    const slope = covariance / xVar;
    const intercept = yMean - slope * xMean;
    const yVar = ys.reduce((sum, y) => sum + (y - yMean) ** 2, 0);
    const r = xVar === 0 || yVar === 0 ? 0 : covariance / Math.sqrt(xVar * yVar);
    return { slope, intercept, r };
}

function ScatterPlotGraph({
    table,
    data,
    teamInfoJson: _teamInfoJson,
}: {
    table: ScatterPlotGraphData;
    data: AnalysisEntry[];
    teamInfoJson: TeamData;
}) {
    const points: Point[] = data
        .map(entry => {
            const x = entry[table.xColumn];
            const y = entry[table.yColumn];
            if (typeof x !== 'number' || typeof y !== 'number') return undefined;
            if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
            return {
                teamNumber: entry.teamNumber,
                x,
                y,
                label: `T${entry.teamNumber}`,
            };
        })
        .filter((point): point is Point => point !== undefined);

    if (points.length <= 1) {
        return (
            <p className='rounded border border-white/10 bg-[#1b2130] p-4 text-sm text-gray-300'>
                Scatter plot needs at least 2 teams with numeric values for both metrics.
            </p>
        );
    }

    const fit = regression(points);
    const minX = Math.min(...points.map(point => point.x));
    const maxX = Math.max(...points.map(point => point.x));
    const linePoints = [
        {
            x: minX,
            y: fit.slope * minX + fit.intercept,
        },
        {
            x: maxX,
            y: fit.slope * maxX + fit.intercept,
        },
    ];

    return (
        <div className='space-y-2 rounded-xl border border-white/10 bg-[#202736] p-3'>
            <div className='grid gap-1 text-sm text-gray-200 md:grid-cols-2'>
                <p>
                    Best-fit line:{' '}
                    <span className='font-semibold text-white'>
                        y = {fit.slope.toFixed(3)}x + {fit.intercept.toFixed(3)}
                    </span>
                </p>
                <p>
                    Correlation:{' '}
                    <span className='font-semibold text-white'>
                        r = {fit.r.toFixed(3)} (r² = {(fit.r * fit.r).toFixed(3)})
                    </span>
                </p>
            </div>

            <div className='h-[420px] w-full'>
                <ResponsiveContainer width='100%' height='100%'>
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 12 }}>
                        <CartesianGrid strokeDasharray='4 4' opacity={0.2} />
                        <XAxis
                            type='number'
                            dataKey='x'
                            name={camelToSpaced(table.xColumn)}
                            tick={{ fill: '#d1d5db' }}
                            stroke='#9ca3af'
                        />
                        <YAxis
                            type='number'
                            dataKey='y'
                            name={camelToSpaced(table.yColumn)}
                            tick={{ fill: '#d1d5db' }}
                            stroke='#9ca3af'
                        />
                        <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            contentStyle={{
                                backgroundColor: '#10141d',
                                border: '1px solid rgba(255,255,255,0.15)',
                                color: '#f3f4f6',
                            }}
                            formatter={(value, name) => [
                                Number(value).toFixed(3),
                                name === 'x'
                                    ? camelToSpaced(table.xColumn)
                                    : camelToSpaced(table.yColumn),
                            ]}
                            labelFormatter={(_, payload) => {
                                const point = payload?.[0]?.payload as Point | undefined;
                                return point ? `Team ${point.teamNumber}` : '';
                            }}
                        />
                        <Scatter
                            data={linePoints}
                            line={{ stroke: '#f59e0b', strokeWidth: 2 }}
                            shape={<circle r={0} />}
                            fill='transparent'
                        />
                        <Scatter data={points} fill='#48c55c'>
                            {table.showLabels && (
                                <LabelList dataKey='label' position='top' />
                            )}
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export default ScatterPlotGraph;
