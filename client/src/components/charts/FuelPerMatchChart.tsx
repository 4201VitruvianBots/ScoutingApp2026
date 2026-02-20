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
import { MatchIndividualDataAggregations } from 'requests';

export type FuelPerMatchChartMode = 'activeWasted' | 'segments';

type ChartRow =
    | {
          match: number;
          AutoFuel: number;
          TeleActive: number;
          TeleWasted: number;
      }
    | {
          match: number;
          AutoFuel: number;
          Transition: number;
          Shift1: number;
          Shift2: number;
          Shift3: number;
          Shift4: number;
          Endgame: number;
      };

function FuelPerMatchChart({
    data,
    teamNumber,
    mode = 'activeWasted',
    height = 280,
}: {
    data: MatchIndividualDataAggregations[];
    teamNumber?: number;
    mode?: FuelPerMatchChartMode;
    height?: number;
}) {
    if (!teamNumber) {
        return (
            <div className='flex h-[200px] items-center justify-center text-sm text-gray-400'>
                Select a team to view match-level fuel trends.
            </div>
        );
    }

    const teamData = data
        .filter(d => d._id.teamNumber === teamNumber && !d.robotAbsent)
        .sort((a, b) => a._id.matchNumber - b._id.matchNumber);

    if (teamData.length === 0) {
        return (
            <div className='flex h-[200px] items-center justify-center text-sm text-gray-400'>
                No match-level fuel data found for Team {teamNumber}.
            </div>
        );
    }

    const chartData: ChartRow[] =
        mode === 'segments'
            ? teamData.map(entry => ({
                  match: entry._id.matchNumber,
                  AutoFuel: entry.autoFuelScored,
                  Transition: entry.teleFuelBySegment.transition,
                  Shift1: entry.teleFuelBySegment.shift1,
                  Shift2: entry.teleFuelBySegment.shift2,
                  Shift3: entry.teleFuelBySegment.shift3,
                  Shift4: entry.teleFuelBySegment.shift4,
                  Endgame: entry.teleFuelBySegment.endgame,
              }))
            : teamData.map(entry => ({
                  match: entry._id.matchNumber,
                  AutoFuel: entry.autoFuelScored,
                  TeleActive: entry.teleFuelActiveComputed,
                  TeleWasted: entry.teleFuelWastedComputed,
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
                        backgroundColor: 'white',
                        borderRadius: '0.5rem',
                        border: '1px solid #e5e7eb',
                    }}
                />
                <Legend />

                <Bar dataKey='AutoFuel' stackId='a' fill='#4aa3ff' />
                {mode === 'segments' ? (
                    <>
                        <Bar dataKey='Transition' stackId='a' fill='#48c55c' />
                        <Bar dataKey='Shift1' stackId='a' fill='#2dd4bf' />
                        <Bar dataKey='Shift2' stackId='a' fill='#a78bfa' />
                        <Bar dataKey='Shift3' stackId='a' fill='#f59e0b' />
                        <Bar dataKey='Shift4' stackId='a' fill='#fb7185' />
                        <Bar dataKey='Endgame' stackId='a' fill='#9ca3af' />
                    </>
                ) : (
                    <>
                        <Bar dataKey='TeleActive' stackId='a' fill='#48c55c' />
                        <Bar dataKey='TeleWasted' stackId='a' fill='#f07f4a' />
                    </>
                )}
            </BarChart>
        </ResponsiveContainer>
    );
}

export default FuelPerMatchChart;

