import { TeamData } from 'requests';
import {
    Bar,
    CartesianGrid,
    ComposedChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import camelToSpaced from '../../../lib/camelCaseConvert';
import { AnalysisEntry, BarGraphData } from '../data';

function formatValue(value: number) {
    if (!Number.isFinite(value)) return 'N/A';
    if (Math.abs(value) >= 100) return value.toFixed(1);
    if (Math.abs(value) >= 10) return value.toFixed(2);
    return value.toFixed(3);
}

function BarGraph({
    table,
    data,
    teamInfoJson,
}: {
    table: BarGraphData;
    data: AnalysisEntry[];
    teamInfoJson: TeamData;
}) {
    const values = data
        .map(entry => entry[table.column])
        .filter((value): value is number => typeof value === 'number')
        .filter(value => Number.isFinite(value));

    if (!values.length) {
        return (
            <p className='rounded border border-white/10 bg-[#1b2130] p-4 text-sm text-gray-300'>
                No numeric values available for this metric.
            </p>
        );
    }

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const binCount = Math.max(4, Math.min(30, table.bins || 10));
    const range = maxValue - minValue;
    const binSize = range === 0 ? 1 : range / binCount;
    const xDomain: [number, number] =
        range === 0 ? [minValue - 1, maxValue + 1] : [minValue, maxValue];

    const bins = Array.from({ length: binCount }, (_, index) => {
        const start = minValue + index * binSize;
        const end = start + binSize;
        return {
            start,
            end,
            x: range === 0 ? minValue : start + binSize / 2,
            count: 0,
        };
    });

    values.forEach(value => {
        const rawIndex = range === 0 ? 0 : Math.floor((value - minValue) / binSize);
        const index = Math.max(0, Math.min(binCount - 1, rawIndex));
        bins[index]!.count += 1;
    });

    const sortedValues = [...values].sort((a, b) => a - b);
    const percentileFor = (value: number) => {
        const belowOrEqual = sortedValues.filter(item => item <= value).length;
        return (belowOrEqual / sortedValues.length) * 100;
    };

    const highlighted = (table.highlightedTeams ?? [])
        .map(teamNumber => {
            const teamEntry = data.find(entry => entry.teamNumber === teamNumber);
            const value = teamEntry?.[table.column];
            if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
            return {
                teamNumber,
                value,
                percentile: percentileFor(value),
                color:
                    teamInfoJson[teamNumber.toString()]?.primaryHex ?? '#f59e0b',
            };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);

    return (
        <div className='space-y-3 rounded-xl border border-white/10 bg-[#202736] p-3'>
            <p className='text-sm text-gray-300'>
                Histogram of <span className='font-semibold text-white'>{camelToSpaced(table.column)}</span> with team placement markers.
            </p>

            <div className='h-[360px] w-full'>
                <ResponsiveContainer width='100%' height='100%'>
                    <ComposedChart data={bins}>
                        <CartesianGrid strokeDasharray='4 4' opacity={0.2} />
                        <XAxis
                            type='number'
                            dataKey='x'
                            domain={xDomain}
                            tick={{ fill: '#d1d5db' }}
                            tickFormatter={value => formatValue(value as number)}
                        />
                        <YAxis
                            allowDecimals={false}
                            tick={{ fill: '#d1d5db' }}
                        />
                        <Tooltip
                            labelFormatter={value => `Metric: ${formatValue(Number(value))}`}
                            formatter={(value, _, payload) => {
                                const start = payload?.payload?.start as number;
                                const end = payload?.payload?.end as number;
                                return [
                                    `${value} teams`,
                                    `${formatValue(start)} to ${formatValue(end)}`,
                                ];
                            }}
                            contentStyle={{
                                backgroundColor: '#10141d',
                                border: '1px solid rgba(255,255,255,0.15)',
                                color: '#f3f4f6',
                            }}
                        />
                        <Bar
                            dataKey='count'
                            fill='#4aa3ff'
                            fillOpacity={0.75}
                            barSize={Math.max(8, Math.floor(500 / binCount))}
                        />
                        {highlighted.map(team => (
                            <ReferenceLine
                                key={team.teamNumber}
                                x={team.value}
                                stroke={team.color}
                                strokeWidth={2}
                                label={{
                                    value: `T${team.teamNumber}`,
                                    fill: team.color,
                                    fontSize: 11,
                                    position: 'insideTopRight',
                                }}
                            />
                        ))}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {highlighted.length > 0 && (
                <div className='rounded border border-white/10 bg-[#141a26] p-2 text-sm text-gray-200'>
                    <p className='mb-2 font-semibold text-white'>Highlighted Team Placement</p>
                    <div className='grid gap-1 md:grid-cols-2'>
                        {highlighted
                            .sort((a, b) => b.value - a.value)
                            .map(team => (
                                <p key={team.teamNumber}>
                                    Team {team.teamNumber}: {formatValue(team.value)} ({team.percentile.toFixed(1)} percentile)
                                </p>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default BarGraph;
