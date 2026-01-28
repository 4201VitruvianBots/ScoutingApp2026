import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    TooltipProps,
} from 'recharts';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { MatchIndividualDataAggregations } from 'requests';

const CustomTooltip: React.FC<TooltipProps<ValueType, NameType>> = ({
    active,
    payload,
}) => {
    if (active && payload && payload.length) {
        return (
            <div className='rounded-lg border border-gray-200 bg-white p-2 shadow-md'>
                <p className='font-bold'>{payload[0].payload.match}</p>
                {payload.map((entry, index) => (
                    <p key={index} className='text-gray-700'>
                        {entry.name}: {entry.value}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const BarChartWIP: React.FC<{
    data: MatchIndividualDataAggregations[];
    teamNumber: number;
}> = ({ data, teamNumber }) => {
    const teamData = data.filter(d => d._id.teamNumber === teamNumber);
    const chartData = teamData.map(entry => ({
        match: `Match ${entry._id.matchNumber}`,
        AutoFuel: entry.autoFuelScored,
        TeleActive: entry.teleFuelActiveComputed,
        TeleWasted: entry.teleFuelWastedComputed,
    }));

    return (
        <ResponsiveContainer width='100%' height={300}>
            <BarChart data={chartData}>
                <CartesianGrid strokeDasharray='4 4' />
                <XAxis dataKey='match' tick={{ fill: 'white' }} />
                <YAxis tick={{ fill: 'white' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey='AutoFuel' stackId='a' fill='#4aa3ff' />
                <Bar dataKey='TeleActive' stackId='a' fill='#48c55c' />
                <Bar dataKey='TeleWasted' stackId='a' fill='#f07f4a' />
            </BarChart>
        </ResponsiveContainer>
    );
};

export default BarChartWIP;
