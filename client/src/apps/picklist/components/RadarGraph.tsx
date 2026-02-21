import { TeamData } from 'requests';
import {
    Legend,
    PolarAngleAxis,
    PolarGrid,
    PolarRadiusAxis,
    Radar,
    RadarChart,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';
import camelToSpaced from '../../../lib/camelCaseConvert';
import { AnalysisEntry, RadarGraphData } from '../data';

const fallbackColors = [
    '#48c55c',
    '#4aa3ff',
    '#f07f4a',
    '#a78bfa',
    '#eab308',
    '#22d3ee',
];

function RadarGraph({
    table,
    data,
    teamInfoJson,
}: {
    table: RadarGraphData;
    data: AnalysisEntry[];
    teamInfoJson: TeamData;
}) {
    const selectedTeams = table.teamNumbers
        .map(teamNumber => data.find(entry => entry.teamNumber === teamNumber))
        .filter((entry): entry is AnalysisEntry => entry !== undefined);

    if (!selectedTeams.length) {
        return (
            <p className='rounded border border-white/10 bg-[#1b2130] p-4 text-sm text-gray-300'>
                No valid team data selected for this radar chart.
            </p>
        );
    }

    const metrics = table.columns.filter(metric =>
        selectedTeams.every(
            team =>
                typeof team[metric] === 'number' &&
                Number.isFinite(team[metric] as number)
        )
    );

    if (metrics.length < 3) {
        return (
            <p className='rounded border border-white/10 bg-[#1b2130] p-4 text-sm text-gray-300'>
                Radar chart needs at least 3 numeric metrics with data.
            </p>
        );
    }

    const chartData = metrics.map(metric => {
        const values = selectedTeams.map(team => team[metric] as number);
        const max = Math.max(...values);
        const row: Record<string, string | number> = {
            metric: camelToSpaced(metric),
        };
        selectedTeams.forEach(team => {
            const value = team[metric] as number;
            row[String(team.teamNumber)] =
                table.normalize && max > 0 ? (value / max) * 100 : value;
            row[`${team.teamNumber}__raw`] = value;
        });
        return row;
    });

    return (
        <div className='space-y-2 rounded-xl border border-white/10 bg-[#202736] p-3'>
            <p className='text-sm text-gray-300'>
                {table.normalize
                    ? 'Metrics normalized to 0-100 per axis.'
                    : 'Raw values shown per axis.'}
            </p>
            <div className='h-[430px] w-full'>
                <ResponsiveContainer width='100%' height='100%'>
                    <RadarChart data={chartData}>
                        <PolarGrid stroke='rgba(255,255,255,0.2)' />
                        <PolarAngleAxis
                            dataKey='metric'
                            tick={{ fill: '#d1d5db', fontSize: 12 }}
                        />
                        <PolarRadiusAxis
                            stroke='rgba(255,255,255,0.3)'
                            tick={{ fill: '#9ca3af', fontSize: 11 }}
                        />
                        <Tooltip
                            formatter={(value, name, payload) => {
                                const rawValue = payload?.payload?.[
                                    `${String(name)}__raw`
                                ];
                                if (table.normalize) {
                                    return [
                                        `${Number(value).toFixed(1)}% (raw ${Number(rawValue).toFixed(2)})`,
                                        `Team ${name}`,
                                    ];
                                }
                                return [
                                    Number(value).toFixed(2),
                                    `Team ${name}`,
                                ];
                            }}
                            contentStyle={{
                                backgroundColor: '#10141d',
                                border: '1px solid rgba(255,255,255,0.15)',
                                color: '#f3f4f6',
                            }}
                        />
                        <Legend />
                        {selectedTeams.map((team, index) => {
                            const teamKey = String(team.teamNumber);
                            const color =
                                teamInfoJson[teamKey]?.primaryHex ??
                                fallbackColors[index % fallbackColors.length]!;
                            return (
                                <Radar
                                    key={teamKey}
                                    name={teamKey}
                                    dataKey={teamKey}
                                    stroke={color}
                                    fill={color}
                                    fillOpacity={0.2}
                                    strokeWidth={2}
                                />
                            );
                        })}
                    </RadarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export default RadarGraph;
