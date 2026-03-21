import { AnalysisEntry, TeamSummaryData } from '../data';
import {
    MatchIndividualDataAggregations,
    PitResult,
    TeamData,
} from 'requests';

function TeamSummary({
    table,
    data,
    teamInfoJson,
    pitData,
    matchIndividualData,
}: {
    table: TeamSummaryData;
    data: AnalysisEntry[];
    teamInfoJson: TeamData;
    pitData: PitResult;
    matchIndividualData: MatchIndividualDataAggregations[];
}) {
    const teamData = data.find(entry => entry.teamNumber === table.teamNumber);
    const teamInfo = teamInfoJson[table.teamNumber]?.info;
    const pit = pitData[table.teamNumber];
    const matches = matchIndividualData
        .filter(entry => entry._id.teamNumber === table.teamNumber)
        .sort((a, b) => a._id.matchNumber - b._id.matchNumber);

    return (
        <div className='space-y-4 text-white'>
            <section className='rounded-xl border border-white/10 bg-[#2f3646] p-4'>
                <h2 className='text-xl font-semibold text-[#48c55c]'>Team {table.teamNumber}</h2>
                {teamInfo && (
                    <p className='text-sm text-gray-300'>
                        {teamInfo.nickname} - {teamInfo.city}, {teamInfo.state_prov}
                    </p>
                )}
            </section>

            <section className='rounded-xl border border-white/10 bg-[#2f3646] p-4'>
                <h3 className='text-lg font-semibold text-[#48c55c]'>Summary Metrics</h3>
                <div className='mt-2 grid gap-2 text-sm text-gray-200 md:grid-cols-2'>
                    {teamData
                        ? Object.entries(teamData)
                              .filter(([, value]) => typeof value === 'number')
                              .sort(([a], [b]) => a.localeCompare(b))
                              .map(([key, value]) => (
                                  <p key={key}>
                                      {key}: <span className='font-mono'>{Number(value).toFixed(2)}</span>
                                  </p>
                              ))
                        : <p>No analyzed team data found.</p>}
                </div>
            </section>

            <section className='rounded-xl border border-white/10 bg-[#2f3646] p-4'>
                <h3 className='text-lg font-semibold text-[#48c55c]'>Match Log</h3>
                <div className='mt-2 max-h-[280px] overflow-y-auto text-sm text-gray-200'>
                    {matches.length === 0 ? (
                        <p>No match logs for this team.</p>
                    ) : (
                        <table className='w-full text-left'>
                            <thead>
                                <tr className='text-xs uppercase text-gray-400'>
                                    <th>Match</th>
                                    <th>Auto Fuel</th>
                                    <th>Tele Fuel</th>
                                    <th>Shoot Sec</th>
                                    <th>Pass Sec</th>
                                </tr>
                            </thead>
                            <tbody>
                                {matches.map(row => {
                                    const shootSec = Object.values(row.shootTimeBySegment).reduce((sum, value) => sum + value, 0);
                                    const passSec = Object.values(row.passTimeBySegment).reduce((sum, value) => sum + value, 0);
                                    return (
                                        <tr key={row._id.matchNumber} className='border-t border-white/10'>
                                            <td className='py-1'>M{row._id.matchNumber}</td>
                                            <td>{row.autoFuelScored.toFixed(1)}</td>
                                            <td>{row.teleFuelTotal.toFixed(1)}</td>
                                            <td>{shootSec.toFixed(1)}</td>
                                            <td>{passSec.toFixed(1)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </section>

            <section className='rounded-xl border border-white/10 bg-[#2f3646] p-4'>
                <h3 className='text-lg font-semibold text-[#48c55c]'>Pit Data</h3>
                <p className='text-sm text-gray-200'>Drivebase: {pit?.drivebase ?? 'N/A'}</p>
                <p className='text-sm text-gray-200'>Battery Count: {pit?.batteryCount ?? 'N/A'}</p>
                <p className='text-sm text-gray-200'>Storage: {pit?.maxFuelStorageEstimate ?? 'N/A'}</p>
                <p className='text-sm text-gray-200'>Notes: {pit?.notes ?? 'N/A'}</p>
            </section>
        </div>
    );
}

export default TeamSummary;
