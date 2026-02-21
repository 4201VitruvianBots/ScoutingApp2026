import React from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { SuperIndividualDataAggregations } from 'requests';

type ChartRow = {
    match: number;
    Mechanism: number;
    Battery: number;
    Comms: number;
    Bumper: number;
};

function SuperBreaksPerMatchChart({
    data,
    teamNumber,
    height = 280,
}: {
    data: SuperIndividualDataAggregations[];
    teamNumber?: number;
    height?: number;
}) {
    if (!teamNumber) {
        return (
            <div className='flex h-[200px] items-center justify-center text-sm text-gray-400'>
                Select a team to view match-level break trends.
            </div>
        );
    }

    const teamData = data
        .filter(d => d._id.teamNumber === teamNumber)
        .sort((a, b) => a._id.matchNumber - b._id.matchNumber);

    if (teamData.length === 0) {
        return (
            <div className='flex h-[200px] items-center justify-center text-sm text-gray-400'>
                No match-level break data found for Team {teamNumber}.
            </div>
        );
    }

    const chartData: ChartRow[] = teamData.map(entry => ({
        match: entry._id.matchNumber,
        Mechanism: entry.breaks.mechanism,
        Battery: entry.breaks.battery,
        Comms: entry.breaks.comms,
        Bumper: entry.breaks.bumper,
    }));

    return (
        <ResponsiveContainer width='100%' height={height}>
            <BarChart data={chartData}>
                <CartesianGrid strokeDasharray='4 4' opacity={0.2} />
                <XAxis
                    dataKey='match'
                    tick={{ fill: 'white' }}
                    tickFormatter={m => `M${m}`}
                />
                <YAxis tick={{ fill: 'white' }} />
                <Tooltip
                    contentStyle={{
                        backgroundColor: '#10141d',
                        borderRadius: '0.5rem',
                        border: '1px solid rgba(255,255,255,0.15)',
                    }}
                />
                <Legend />

                <Bar dataKey='Mechanism' stackId='a' fill='#60a5fa' />
                <Bar dataKey='Battery' stackId='a' fill='#f87171' />
                <Bar dataKey='Comms' stackId='a' fill='#fbbf24' />
                <Bar dataKey='Bumper' stackId='a' fill='#34d399' />
            </BarChart>
        </ResponsiveContainer>
    );
}

export default SuperBreaksPerMatchChart;

