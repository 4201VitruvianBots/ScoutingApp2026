import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, TooltipProps } from 'recharts';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { MatchIndividualDataAggregations, SuperFoulAggregationsData } from 'requests';



const CustomTooltip: React.FC<TooltipProps<ValueType, NameType>> = ({
  active,
  payload,
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-2 rounded-lg shadow-md border border-gray-200">
        <p className="font-bold">{payload[0].payload.name}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-gray-700">
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// :3
export interface MatchAndSuper extends Pick<MatchIndividualDataAggregations, 'totalL1' | 'totalL2' | 'totalL3' | 'totalL4' | 'totalProcessor' | 'totalNet' | 'totalRemoved'>, SuperFoulAggregationsData {}

const BarChartWIP: React.FC<{ data: MatchAndSuper[]; teamNumber: number }> = ({ data, teamNumber }) => { 



//   //grabs data for a specific team
   const teamData = data.filter(d => d._id.teamNumber === teamNumber);

 // Transform data for charts to have nicer labels (when tooltip works), d. means the item in the teamdata, match is for the x-axis (i pray this works w/ data :sob:)
  const chartData = teamData.map(d => ({
      match: `Match ${d._id.matchNumber}`, 
      Processor: d.totalProcessor,
      Net: d.totalNet,
      Removed: d.totalRemoved,
      CoralL1: d.totalL1,
      CoralL2: d.totalL2,
      CoralL3: d.totalL3,
      CoralL4: d.totalL4,
      InsideRobot: d.totalInsideRobot*-1,
      ProtectedZone: d.totalProtectedZone*-1,
      Pinning: d.totalPinning*-1,
      MultiplePieces: d.totalMultiplePieces*-1,
      CageFoul: d.totalCageFoul*-1,
      Other: d.totalOther*-1,
  }));

  
 
  return (
    
    <ResponsiveContainer width="100%" height={300}>
      <BarChart stackOffset='sign' data={chartData}>
        <CartesianGrid strokeDasharray="4 4" />
        <XAxis dataKey="match" tick={{ fill: "white" }} />
        <YAxis tick={{ fill: "white" }} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="Processor" stackId='a' fill="#EEE600" />
        <Bar dataKey="Net" stackId='a' fill="#EEE600" />
        <Bar dataKey="Removed" stackId='a' fill="#EEE600" />
        <Bar dataKey="CoralL1" stackId='a' fill="#13B3AC" />
        <Bar dataKey="CoralL2" stackId='a' fill="#13B3AC" />
        <Bar dataKey="CoralL3" stackId='a' fill="#13B3AC" />
        <Bar dataKey="CoralL4" stackId='a' fill="#13B3AC" />
        <Bar dataKey="InsideRobot" stackId='a' fill="#800020" />
        <Bar dataKey="ProtectedZone" stackId='a' fill="#800020" />
        <Bar dataKey="Pinning" stackId='a' fill="#800020" />
        <Bar dataKey="MultiplePieces" stackId='a' fill="#800020" />
        <Bar dataKey="CageFoul" stackId='a' fill="#800020" />
        <Bar dataKey="Other" stackId='a' fill="#800020" />
      </BarChart>
    </ResponsiveContainer>
    
  );
};

export default BarChartWIP;
