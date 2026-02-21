import camelToSpaced from '../../../lib/camelCaseConvert';
import { AnalysisEntry, StatSummaryData } from '../data';
import { TeamData } from 'requests';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

function quantile(values: number[], q: number) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const position = (sorted.length - 1) * q;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    if (lower === upper) return sorted[lower]!;
    const lowVal = sorted[lower]!;
    const highVal = sorted[upper]!;
    return lowVal + (highVal - lowVal) * (position - lower);
}

function StatSummary({
    table,
    data,
    teamInfoJson,
}: {
    table: StatSummaryData;
    data: AnalysisEntry[];
    teamInfoJson: TeamData;
}) {
    const entries = data
        .map(entry => ({
            teamNumber: entry.teamNumber,
            value: entry[table.column],
        }))
        .filter(
            (entry): entry is { teamNumber: number; value: number } =>
                typeof entry.value === 'number' && Number.isFinite(entry.value)
        );
    const values = entries.map(entry => entry.value).sort((a, b) => a - b);

    if (!values.length) {
        return (
            <p className='rounded border border-white/10 bg-[#1b2130] p-4 text-sm text-gray-300'>
                No data available for this metric.
            </p>
        );
    }

    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance =
        values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    const minValue = values[0]!;
    const maxValue = values[values.length - 1]!;
    const medianValue = quantile(values, 0.5);
    const q1 = quantile(values, 0.25);
    const q3 = quantile(values, 0.75);

    const idealBinCount = Math.ceil(Math.sqrt(values.length));
    const range = maxValue - minValue;
    const binCount = range === 0 ? 1 : Math.min(18, Math.max(6, idealBinCount));
    const binSize = range === 0 ? 1 : range / binCount;

    const bins = Array.from({ length: binCount }, (_, index) => {
        const start = minValue + binSize * index;
        const end = start + binSize;
        return {
            label:
                range === 0
                    ? `${minValue.toFixed(2)}`
                    : `${start.toFixed(2)}-${end.toFixed(2)}`,
            count: 0,
        };
    });

    values.forEach(value => {
        const rawIndex = range === 0 ? 0 : Math.floor((value - minValue) / binSize);
        const index = Math.min(binCount - 1, Math.max(0, rawIndex));
        bins[index]!.count += 1;
    });

    const sortedEntries = [...entries].sort((a, b) => a.value - b.value);
    const low = sortedEntries[0]!;
    const med = sortedEntries[Math.floor(sortedEntries.length / 2)]!;
    const high = sortedEntries[sortedEntries.length - 1]!;

    const avatarFor = (teamNumber: number) =>
        teamInfoJson[teamNumber.toString()]?.avatar;

    return (
        <div className='space-y-4 rounded-xl border border-white/10 bg-[#202736] p-3 text-white'>
            <div>
                <h1 className='text-2xl font-bold'>{camelToSpaced(table.column)}</h1>
                <p className='text-sm text-gray-400'>{table.column}</p>
            </div>

            <div className='grid gap-2 text-sm md:grid-cols-4'>
                <p>Mean: {avg.toFixed(3)}</p>
                <p>Median: {medianValue.toFixed(3)}</p>
                <p>Std Dev: {standardDeviation.toFixed(3)}</p>
                <p>
                    Min/Max: {minValue.toFixed(3)} / {maxValue.toFixed(3)}
                </p>
                <p>Q1: {q1.toFixed(3)}</p>
                <p>Q3: {q3.toFixed(3)}</p>
                <p>IQR: {(q3 - q1).toFixed(3)}</p>
                <p>Sample: {values.length}</p>
            </div>

            <div className='h-[260px] w-full'>
                <ResponsiveContainer width='100%' height='100%'>
                    <BarChart data={bins}>
                        <CartesianGrid strokeDasharray='4 4' opacity={0.2} />
                        <XAxis
                            dataKey='label'
                            tick={{ fill: '#d1d5db', fontSize: 11 }}
                            interval='preserveStartEnd'
                            height={56}
                        />
                        <YAxis tick={{ fill: '#d1d5db' }} allowDecimals={false} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#10141d',
                                borderRadius: '0.5rem',
                                border: '1px solid rgba(255,255,255,0.15)',
                                color: '#f3f4f6',
                            }}
                        />
                        <Bar dataKey='count' fill='#48c55c' />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className='grid gap-2 text-sm md:grid-cols-3'>
                {[
                    { label: 'Low', team: low },
                    { label: 'Median Team', team: med },
                    { label: 'High', team: high },
                ].map(item => (
                    <div
                        key={item.label}
                        className='rounded border border-white/10 bg-[#141a26] p-2'>
                        <p className='text-xs uppercase tracking-wide text-gray-400'>
                            {item.label}
                        </p>
                        <p className='font-semibold text-white'>
                            Team {item.team.teamNumber}
                        </p>
                        <p>Value: {item.team.value.toFixed(3)}</p>
                        {avatarFor(item.team.teamNumber) && (
                            <img
                                src={`data:image/png;base64,${avatarFor(item.team.teamNumber)}`}
                                alt=''
                                className='mt-1 h-10 w-10 rounded border border-white/20 bg-black/30'
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default StatSummary;
