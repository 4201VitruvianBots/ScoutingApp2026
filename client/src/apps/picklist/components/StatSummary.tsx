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

const empty1x1Base64: string =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

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
        .filter(entry => Number.isFinite(entry[table.column] as number))
        .map<[number, number]>(e => [e.teamNumber, e[table.column] as number]);
    const sortedEntries = entries.sort((a, b) => a[1] - b[1]);

    if (!sortedEntries.length) {
        return <p>No data available for this metric.</p>;
    }

    const sortedEntryTeamNumbers = sortedEntries.map(entry =>
        entry[0].toString()
    );
    const sortedEntryDataPoints = sortedEntries.map(entry => entry[1]);

    const mean =
        sortedEntryDataPoints.reduce((sum, value) => sum + value, 0) /
        sortedEntryDataPoints.length;
    const variance =
        sortedEntryDataPoints.reduce(
            (sum, value) => sum + (value - mean) ** 2,
            0
        ) / sortedEntryDataPoints.length;
    const standardDeviation = Math.sqrt(variance);

    // Create a list of the avatar data for each team based on the base64 images stored under the key 'avatar' in the team_info.json file
    const lowTeamNumber = sortedEntryTeamNumbers[0];
    const lowTeamAvatar = teamInfoJson[lowTeamNumber]?.avatar ?? empty1x1Base64;
    const lowDataPoint = sortedEntryDataPoints[0];

    const medianTeamNumber =
        sortedEntryTeamNumbers[Math.floor(sortedEntryTeamNumbers.length / 2)];
    const medianTeamAvatar =
        teamInfoJson[medianTeamNumber]?.avatar ?? empty1x1Base64;
    const medainDataPoint =
        sortedEntryDataPoints[Math.floor(sortedEntryDataPoints.length / 2)];

    const highTeamNumber =
        sortedEntryTeamNumbers[sortedEntryTeamNumbers.length - 1];
    const highTeamAvatar =
        teamInfoJson[highTeamNumber]?.avatar ?? empty1x1Base64;
    const highDataPoint =
        sortedEntryDataPoints[sortedEntryDataPoints.length - 1];

    const quantile = (sortedValues: number[], q: number) => {
        const position = (sortedValues.length - 1) * q;
        const baseIndex = Math.floor(position);
        const fraction = position - baseIndex;
        const lower = sortedValues[baseIndex] ?? sortedValues[0];
        const upper = sortedValues[baseIndex + 1] ?? lower;
        return lower + (upper - lower) * fraction;
    };

    const q1 = quantile(sortedEntryDataPoints, 0.25);
    const q3 = quantile(sortedEntryDataPoints, 0.75);
    const iqr = q3 - q1;

    const minValue = sortedEntryDataPoints[0];
    const maxValue = sortedEntryDataPoints[sortedEntryDataPoints.length - 1];
    const idealBinCount = Math.ceil(Math.sqrt(sortedEntryDataPoints.length));
    const range = maxValue - minValue;
    const binCount =
        range === 0 ? 1 : Math.min(16, Math.max(6, idealBinCount));
    const binSize = range === 0 ? 1 : range / binCount;

    const bins = Array.from({ length: binCount }, (_, index) => {
        const start = minValue + binSize * index;
        const end = start + binSize;
        return {
            label:
                range === 0
                    ? `${minValue.toFixed(2)}`
                    : `${start.toFixed(2)}–${end.toFixed(2)}`,
            count: 0,
        };
    });

    sortedEntryDataPoints.forEach(value => {
        const rawIndex = range === 0 ? 0 : Math.floor((value - minValue) / binSize);
        const index = Math.min(binCount - 1, Math.max(0, rawIndex));
        bins[index]!.count += 1;
    });

    return (
        <>
            <h1 className='text-3xl'>{camelToSpaced(table.column)}</h1>
            <p className='text-0.5xl text-gray-500'>{table.column}</p>

            <br />

            <div className='flex space-x-4'>
                <p>Mean: {mean.toFixed(3)}</p>
                <p>Standard Deviation: {standardDeviation.toFixed(3)}</p>
                <p>Min: {minValue.toFixed(3)}</p>
                <p>Max: {maxValue.toFixed(3)}</p>
                <p>Q1: {q1.toFixed(3)}</p>
                <p>Q3: {q3.toFixed(3)}</p>
                <p>IQR: {iqr.toFixed(3)}</p>
            </div>

            <br />

            <div className='h-[220px] w-full'>
                <ResponsiveContainer width='100%' height='100%'>
                    <BarChart data={bins}>
                        <CartesianGrid strokeDasharray='4 4' opacity={0.2} />
                        <XAxis
                            dataKey='label'
                            tick={{ fill: 'white' }}
                            interval='preserveStartEnd'
                            height={60}
                        />
                        <YAxis tick={{ fill: 'white' }} allowDecimals={false} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'white',
                                borderRadius: '0.5rem',
                                border: '1px solid #e5e7eb',
                            }}
                        />
                        <Bar dataKey='count' fill='#48c55c' />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <br />

            <div className='flex space-x-4'>
                <p>Low: {lowDataPoint}</p>
                <p>by </p>
                <img
                    src={`data:image/png;base64,${lowTeamAvatar}`}
                    max-width='32'
                    max-height='32'
                />
                <p>Team {lowTeamNumber}</p>
            </div>

            <div className='flex space-x-4'>
                <p>Median: {medainDataPoint}</p>
                <p>by </p>
                <img
                    src={`data:image/png;base64,${medianTeamAvatar}`}
                    max-width='32'
                    max-height='32'
                />
                <p>Team {medianTeamNumber}</p>
            </div>

            <div className='flex space-x-4'>
                <p>High: {highDataPoint}</p>
                <p>by </p>
                <img
                    src={`data:image/png;base64,${highTeamAvatar}`}
                    max-width='32'
                    max-height='32'
                />
                <p>Team {highTeamNumber}</p>
            </div>
        </>
    );
}

export default StatSummary;
