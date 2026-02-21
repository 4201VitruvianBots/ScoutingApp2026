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
    Pinning: number;
    TowerContact: number;
    OutOfZone: number;
    EjectedFuel: number;
    Other: number;
};

function SuperFoulsPerMatchChart({
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
                Select a team to view match-level foul trends.
            </div>
        );
    }

    const teamData = data
        .filter(d => d._id.teamNumber === teamNumber)
        .sort((a, b) => a._id.matchNumber - b._id.matchNumber);

    if (teamData.length === 0) {
        return (
            <div className='flex h-[200px] items-center justify-center text-sm text-gray-400'>
                No match-level foul data found for Team {teamNumber}.
            </div>
        );
    }

    const chartData: ChartRow[] = teamData.map(entry => ({
        match: entry._id.matchNumber,
        Pinning: entry.fouls.pinning,
        TowerContact: entry.fouls.towerContactInEndgame,
        OutOfZone: entry.fouls.outOfZoneShooting,
        EjectedFuel: entry.fouls.ejectedFuel,
        Other: entry.fouls.other,
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

                <Bar dataKey='Pinning' stackId='a' fill='#ef4444' />
                <Bar dataKey='TowerContact' stackId='a' fill='#f97316' />
                <Bar dataKey='OutOfZone' stackId='a' fill='#eab308' />
                <Bar dataKey='EjectedFuel' stackId='a' fill='#a855f7' />
                <Bar dataKey='Other' stackId='a' fill='#6b7280' />
            </BarChart>
        </ResponsiveContainer>
    );
}

export default SuperFoulsPerMatchChart;

