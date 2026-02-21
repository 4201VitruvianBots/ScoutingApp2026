import Dialog from '../../../components/Dialog';
import camelToSpaced from '../../../lib/camelCaseConvert';
import { AnalysisEntry, TeamSummaryData } from '../data';
import {
    MatchIndividualDataAggregations,
    PitResult,
    SuperIndividualDataAggregations,
    TeamData,
} from 'requests';
import RobotPhotoDialog from './RobotPhotoDialog';
import { snakeToSpaced } from '../../../lib/snakeCaseConvert';
import FuelPerMatchChart from '../../../components/charts/FuelPerMatchChart';
import SuperBreaksPerMatchChart from '../../../components/charts/SuperBreaksPerMatchChart';
import SuperFoulsPerMatchChart from '../../../components/charts/SuperFoulsPerMatchChart';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

function commentToColor(comment: string) {
    switch (comment) {
        case 'great_driving':
        case 'fast_cycles':
        case 'accurate_shots':
        case 'smart_defense':
        case 'fast_climb':
            return 'bg-[#5ac750]';
        case 'good_driving':
            return 'bg-[#50a1c7]';
        case 'ok_driving':
        case 'slow_climb':
            return 'bg-[#c78450]';
        case 'drops_fuel':
        case 'inaccurate_shots':
        case 'defense_liability':
        case 'no_climb':
            return 'bg-[#c78450]';
        case 'aggressive_defense':
            return 'bg-[#8e5cf7]';
        case 'rough_driving':
            return 'bg-[#c75050]';
        default:
            return 'bg-gray-500';
    }
}

function formatPercent(value: number, digits = 1) {
    if (!Number.isFinite(value)) return 'N/A';
    return `${(value * 100).toFixed(digits)}%`;
}

function formatNumber(value: number, digits = 2) {
    if (!Number.isFinite(value)) return 'N/A';
    return value.toFixed(digits);
}

function expectedPoints(entry: MatchIndividualDataAggregations) {
    const telePoints = entry.teleFuelActiveComputed;
    const autoPoints = entry.autoFuelScored;
    const autoTowerPoints = entry.autoTower === 'level1' ? 15 : 0;
    const teleTowerPoints =
        entry.teleTower === 'level1'
            ? 10
            : entry.teleTower === 'level2'
              ? 20
              : entry.teleTower === 'level3'
                ? 30
                : 0;
    return telePoints + autoPoints + autoTowerPoints + teleTowerPoints;
}

function TeamSummary({
    table,
    data,
    teamInfoJson,
    pitData,
    matchIndividualData,
    superIndividualData,
}: {
    table: TeamSummaryData;
    data: AnalysisEntry[];
    teamInfoJson: TeamData;
    pitData: PitResult;
    matchIndividualData: MatchIndividualDataAggregations[];
    superIndividualData: SuperIndividualDataAggregations[];
}) {
    const teamData = data.find(entry => entry.teamNumber === table.teamNumber);
    const { info: teamInfo, avatar } = teamInfoJson[table.teamNumber] ?? {};
    const teamPitData = pitData[table.teamNumber];

    const teamMatchEntries = matchIndividualData
        .filter(entry => entry._id.teamNumber === table.teamNumber && !entry.robotAbsent)
        .sort((a, b) => a._id.matchNumber - b._id.matchNumber);
    const teamSuperEntries = superIndividualData
        .filter(entry => entry._id.teamNumber === table.teamNumber)
        .sort((a, b) => a._id.matchNumber - b._id.matchNumber);

    const climbCounts = teamMatchEntries.reduce(
        (acc, entry) => {
            acc[entry.teleTower] = (acc[entry.teleTower] ?? 0) + 1;
            return acc;
        },
        {} as Record<string, number>
    );
    const driverCounts = teamMatchEntries.reduce(
        (acc, entry) => {
            acc[entry.driverQuality] = (acc[entry.driverQuality] ?? 0) + 1;
            return acc;
        },
        {} as Record<string, number>
    );
    const breakdownCounts = teamMatchEntries.reduce(
        (acc, entry) => {
            acc[entry.breakdown] = (acc[entry.breakdown] ?? 0) + 1;
            return acc;
        },
        {} as Record<string, number>
    );

    const climbChartData = [
        { name: 'None', count: climbCounts.none ?? 0 },
        { name: 'L1', count: climbCounts.level1 ?? 0 },
        { name: 'L2', count: climbCounts.level2 ?? 0 },
        { name: 'L3', count: climbCounts.level3 ?? 0 },
        { name: 'Fail', count: climbCounts.failed ?? 0 },
    ];
    const driverChartData = [
        { name: 'Great', count: driverCounts.great ?? 0 },
        { name: 'Good', count: driverCounts.good ?? 0 },
        { name: 'OK', count: driverCounts.ok ?? 0 },
        { name: 'Rough', count: driverCounts.rough ?? 0 },
    ];
    const breakdownChartData = [
        { name: 'None', count: breakdownCounts.none ?? 0 },
        { name: 'Stuck', count: breakdownCounts.stuck ?? 0 },
        { name: 'Tipped', count: breakdownCounts.tipped ?? 0 },
        { name: 'Comms', count: breakdownCounts.comms ?? 0 },
        { name: 'Mech', count: breakdownCounts.mechanism ?? 0 },
        { name: 'Other', count: breakdownCounts.other ?? 0 },
    ];

    const expectedPointsData = teamMatchEntries.map(entry => ({
        match: entry._id.matchNumber,
        expected: expectedPoints(entry),
        teleActive: entry.teleFuelActiveComputed,
        autoFuel: entry.autoFuelScored,
    }));

    const recentNotes = teamMatchEntries
        .filter(entry => entry.freeText.trim().length > 0)
        .slice(-8)
        .reverse()
        .map(entry => ({
            match: entry._id.matchNumber,
            note: entry.freeText.trim(),
        }));

    const defenseProvidedCounts = teamSuperEntries.reduce(
        (acc, entry) => {
            acc[entry.defenseProvided] = (acc[entry.defenseProvided] ?? 0) + 1;
            return acc;
        },
        {} as Record<string, number>
    );

    const defenseChartData = [
        { name: 'None', count: defenseProvidedCounts.none ?? 0 },
        { name: 'Some', count: defenseProvidedCounts.some ?? 0 },
        { name: 'Heavy', count: defenseProvidedCounts.heavy ?? 0 },
    ];

    return (
        <div className='space-y-6 text-white'>
            <section className='rounded-xl border border-white/10 bg-[#2f3646] p-4 shadow-lg shadow-black/20'>
                <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
                    <div className='space-y-3'>
                        <div className='flex items-center gap-3'>
                            {avatar && (
                                <img
                                    className='h-12 w-12 rounded border border-white/15 bg-black/20'
                                    src={`data:image/png;base64,${avatar}`}
                                    alt=''
                                />
                            )}
                            <div>
                                <h1 className='text-3xl font-bold'>
                                    Team{' '}
                                    {teamInfo
                                        ? `${teamInfo.team_number} - ${teamInfo.nickname}`
                                        : table.teamNumber}
                                </h1>
                                {teamInfo && (
                                    <p className='text-sm text-gray-300'>
                                        {teamInfo.name}
                                    </p>
                                )}
                            </div>
                        </div>

                        {teamInfo && (
                            <div className='grid gap-1 text-sm text-gray-200 sm:grid-cols-2'>
                                <p>
                                    Location: {teamInfo.city}, {teamInfo.state_prov},{' '}
                                    {teamInfo.country}
                                </p>
                                <p>Rookie Year: {teamInfo.rookie_year}</p>
                                <p>School: {teamInfo.school_name}</p>
                                <p>Website: {teamInfo.website ?? 'N/A'}</p>
                            </div>
                        )}
                    </div>

                    <Dialog
                        trigger={open => (
                            <button onClick={open} className='w-full md:w-auto'>
                                <img
                                    src={`/image/${table.teamNumber}.jpeg`}
                                    width='420'
                                    className='max-h-[240px] w-full rounded-lg border border-white/10 bg-[#1f2432] object-contain'
                                    alt=''
                                />
                            </button>
                        )}>
                        {close => (
                            <RobotPhotoDialog
                                teamNumber={table.teamNumber}
                                onClose={close}
                            />
                        )}
                    </Dialog>
                </div>

                {teamData && (
                    <div className='mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'>
                        <div className='rounded-lg border border-white/10 bg-[#1b2230] p-3'>
                            <p className='text-xs uppercase text-gray-400'>Selection Score</p>
                            <p className='text-xl font-semibold'>
                                {formatNumber(teamData.selectionScore as number, 1)}
                            </p>
                        </div>
                        <div className='rounded-lg border border-white/10 bg-[#1b2230] p-3'>
                            <p className='text-xs uppercase text-gray-400'>Expected Points</p>
                            <p className='text-xl font-semibold'>
                                {formatNumber(teamData.expectedPointsAvg as number)}
                            </p>
                        </div>
                        <div className='rounded-lg border border-white/10 bg-[#1b2230] p-3'>
                            <p className='text-xs uppercase text-gray-400'>Consistency</p>
                            <p className='text-xl font-semibold'>
                                {formatNumber(teamData.consistencyScore as number, 1)}
                            </p>
                        </div>
                        <div className='rounded-lg border border-white/10 bg-[#1b2230] p-3'>
                            <p className='text-xs uppercase text-gray-400'>Defense Impact</p>
                            <p className='text-xl font-semibold'>
                                {formatNumber(
                                    teamData.defenseImpactExpectedPoints as number
                                )}
                            </p>
                        </div>
                        <div className='rounded-lg border border-white/10 bg-[#1b2230] p-3'>
                            <p className='text-xs uppercase text-gray-400'>Reliability</p>
                            <p className='text-xl font-semibold'>
                                {formatPercent(
                                    ((teamData.reliabilityScore as number) *
                                        (teamData.breakReliabilityScore as number)) as number
                                )}
                            </p>
                        </div>
                        <div className='rounded-lg border border-white/10 bg-[#1b2230] p-3'>
                            <p className='text-xs uppercase text-gray-400'>Trend / Match</p>
                            <p className='text-xl font-semibold'>
                                {formatNumber(teamData.expectedPointsTrendPerMatch as number)}
                            </p>
                        </div>
                    </div>
                )}
            </section>

            <div className='grid gap-6 lg:grid-cols-2'>
                <section className='rounded-xl border border-white/10 bg-[#2f3646] p-4 shadow-lg shadow-black/20'>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>
                        Expected Points Trend
                    </h2>
                    {expectedPointsData.length ? (
                        <div className='h-[260px] w-full'>
                            <ResponsiveContainer width='100%' height='100%'>
                                <LineChart data={expectedPointsData}>
                                    <CartesianGrid strokeDasharray='4 4' opacity={0.2} />
                                    <XAxis dataKey='match' tick={{ fill: '#d1d5db' }} />
                                    <YAxis tick={{ fill: '#d1d5db' }} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#10141d',
                                            border: '1px solid rgba(255,255,255,0.15)',
                                            color: '#f3f4f6',
                                        }}
                                    />
                                    <Line
                                        type='monotone'
                                        dataKey='expected'
                                        stroke='#48c55c'
                                        strokeWidth={2}
                                        dot={{ r: 3 }}
                                    />
                                    <Line
                                        type='monotone'
                                        dataKey='teleActive'
                                        stroke='#4aa3ff'
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <p className='text-sm text-gray-300'>No match trend data yet.</p>
                    )}
                </section>

                <section className='rounded-xl border border-white/10 bg-[#2f3646] p-4 shadow-lg shadow-black/20'>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>
                        Match Notes
                    </h2>
                    <div className='max-h-[250px] space-y-2 overflow-y-auto'>
                        {recentNotes.length ? (
                            recentNotes.map(note => (
                                <div
                                    key={`${note.match}-${note.note}`}
                                    className='rounded border border-white/10 bg-[#1a2232] p-2 text-sm'>
                                    <p className='text-xs uppercase text-gray-400'>
                                        Match {note.match}
                                    </p>
                                    <p className='text-gray-100'>{note.note}</p>
                                </div>
                            ))
                        ) : (
                            <p className='text-sm text-gray-300'>
                                No detailed match notes recorded yet.
                            </p>
                        )}
                    </div>
                </section>
            </div>

            <div className='grid gap-6 lg:grid-cols-2'>
                <section className='rounded-xl border border-white/10 bg-[#2f3646] p-4 shadow-lg shadow-black/20'>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>
                        Fuel Per Match (Segments)
                    </h2>
                    <FuelPerMatchChart
                        data={matchIndividualData}
                        teamNumber={table.teamNumber}
                        mode='segments'
                    />
                </section>

                <section className='rounded-xl border border-white/10 bg-[#2f3646] p-4 shadow-lg shadow-black/20'>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>
                        Tele Fuel (Active vs Wasted)
                    </h2>
                    <FuelPerMatchChart
                        data={matchIndividualData}
                        teamNumber={table.teamNumber}
                        mode='activeWasted'
                    />
                </section>
            </div>

            <div className='grid gap-6 lg:grid-cols-4'>
                {[
                    { title: 'Climb Outcomes', data: climbChartData, color: '#48c55c' },
                    { title: 'Driver Quality', data: driverChartData, color: '#4aa3ff' },
                    { title: 'Breakdowns', data: breakdownChartData, color: '#f07f4a' },
                    { title: 'Defense Usage', data: defenseChartData, color: '#a78bfa' },
                ].map(chart => (
                    <section
                        key={chart.title}
                        className='rounded-xl border border-white/10 bg-[#2f3646] p-4 shadow-lg shadow-black/20'>
                        <h2 className='text-lg font-semibold text-[#48c55c]'>
                            {chart.title}
                        </h2>
                        <ResponsiveContainer width='100%' height={220}>
                            <BarChart data={chart.data}>
                                <CartesianGrid strokeDasharray='4 4' opacity={0.2} />
                                <XAxis dataKey='name' tick={{ fill: '#d1d5db' }} />
                                <YAxis tick={{ fill: '#d1d5db' }} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#10141d',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        color: '#f3f4f6',
                                    }}
                                />
                                <Bar dataKey='count' fill={chart.color} />
                            </BarChart>
                        </ResponsiveContainer>
                    </section>
                ))}
            </div>

            <div className='grid gap-6 lg:grid-cols-2'>
                <section className='rounded-xl border border-white/10 bg-[#2f3646] p-4 shadow-lg shadow-black/20'>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>
                        Fouls Per Match
                    </h2>
                    <SuperFoulsPerMatchChart
                        data={superIndividualData}
                        teamNumber={table.teamNumber}
                    />
                </section>

                <section className='rounded-xl border border-white/10 bg-[#2f3646] p-4 shadow-lg shadow-black/20'>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>
                        Breaks Per Match
                    </h2>
                    <SuperBreaksPerMatchChart
                        data={superIndividualData}
                        teamNumber={table.teamNumber}
                    />
                </section>
            </div>

            <div className='grid gap-6 lg:grid-cols-2'>
                <section className='rounded-xl border border-white/10 bg-[#2f3646] p-4 shadow-lg shadow-black/20'>
                    <h2 className='pb-2 text-lg font-semibold text-[#48c55c]'>Comments</h2>
                    <div className='flex flex-wrap gap-2'>
                        {teamData &&
                            teamData.Comments &&
                            Object.entries(teamData.Comments)
                                .sort(([_, a], [__, b]) => b - a)
                                .map(
                                    ([comment, count]) =>
                                        count > 0 && (
                                            <p
                                                key={comment}
                                                className={`text-md max-w-fit rounded-lg border py-1 pl-2 text-zinc-100 saturate-[75%] ${commentToColor(comment)}`}>
                                                {snakeToSpaced(comment)}{' '}
                                                <span className='rounded-r-lg bg-black/15 p-2 py-1'>
                                                    {count}
                                                </span>
                                            </p>
                                        )
                                )}
                        {(!teamData ||
                            !teamData.Comments ||
                            Object.values(teamData.Comments).every(value => !value)) && (
                            <p className='text-sm text-gray-300'>No comments yet.</p>
                        )}
                    </div>
                </section>

                <section className='rounded-xl border border-white/10 bg-[#2f3646] p-4 shadow-lg shadow-black/20'>
                    <h2 className='pb-2 text-lg font-semibold text-[#48c55c]'>
                        Pit Scout Info
                    </h2>
                    <div className='space-y-1 text-sm text-gray-200'>
                        <p>Batteries: {teamPitData?.batteryCount ?? 'N/A'}</p>
                        <p>Drivebase: {teamPitData?.drivebase ?? 'N/A'}</p>
                        <p>
                            Max Fuel Storage:{' '}
                            {teamPitData?.maxFuelStorageEstimate ?? 'N/A'}
                        </p>
                        <p>
                            Intake Sources:{' '}
                            {teamPitData?.intakeSources
                                ? Object.entries(teamPitData.intakeSources)
                                      .filter(([, value]) => value)
                                      .map(([key]) => snakeToSpaced(key))
                                      .join(', ') || 'None'
                                : 'N/A'}
                        </p>
                        <p>Scoring Method: {teamPitData?.scoringMethod ?? 'N/A'}</p>
                        <p>
                            Preferred Spot: {teamPitData?.preferredScoringSpot ?? 'N/A'}
                        </p>
                        <p>
                            Tower Capability:{' '}
                            {teamPitData?.towerCapabilityClaimed ?? 'N/A'}
                        </p>
                        <p>Notes: {teamPitData?.notes ?? 'N/A'}</p>
                    </div>
                </section>
            </div>

            {teamData && (
                <details className='rounded-xl border border-white/10 bg-[#2f3646] p-4 shadow-lg shadow-black/20'>
                    <summary className='cursor-pointer text-lg font-semibold text-[#48c55c]'>
                        All Metrics (Raw)
                    </summary>
                    <div className='mt-3 grid gap-1 text-sm text-gray-200 md:grid-cols-2'>
                        {Object.keys(teamData)
                            .filter(
                                key =>
                                    key !== 'Comments' &&
                                    typeof teamData[key] === 'number'
                            )
                            .sort()
                            .map(key => (
                                <p key={key} className='flex justify-between gap-3'>
                                    <span className='text-gray-300'>
                                        {camelToSpaced(key)}
                                    </span>
                                    <span className='font-mono'>
                                        {formatNumber(teamData[key] as number)}
                                    </span>
                                </p>
                            ))}
                    </div>
                </details>
            )}
        </div>
    );
}

export default TeamSummary;
