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
            return 'bg-[#c107f0]';
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

function formatStatValue(key: string, value: number) {
    if (key === 'teamNumber') return value.toString();
    if (key.endsWith('Rate') || key.endsWith('rate')) return formatPercent(value);
    if (key.endsWith('Score') || key.endsWith('ScoreAvg') || key.includes('Score'))
        return formatPercent(value);
    if (key.endsWith('Count')) return Math.round(value).toString();
    return formatNumber(value);
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
    // Get the data for the team specified
    const teamData = data.find(e => e.teamNumber === table.teamNumber);

    const { info: teamInfo, avatar } = teamInfoJson[table.teamNumber] ?? {};
    const teamPitData = pitData[table.teamNumber];

    const teamMatchEntries = matchIndividualData
        .filter(e => e._id.teamNumber === table.teamNumber && !e.robotAbsent)
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

    return (
        <div className='space-y-6 text-white'>
            <section className='rounded-xl border border-white/10 bg-[#2f3646] p-4 shadow-lg shadow-black/20'>
                <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
                    <div className='space-y-2'>
                        <div className='flex items-center gap-3'>
                            {avatar && (
                                <img
                                    className='h-10 w-10 rounded bg-black/10'
                                    src={`data:image/png;base64,${avatar}`}
                                    alt=''
                                />
                            )}
                            <h1 className='text-3xl font-bold'>
                                Team{' '}
                                {teamInfo
                                    ? `${teamInfo.team_number} - ${teamInfo.nickname}`
                                    : table.teamNumber}
                            </h1>
                        </div>

                        {teamInfo && (
                            <div className='space-y-1 text-sm text-gray-200'>
                                <p className='text-gray-300'>{teamInfo.name}</p>
                                <p>
                                    {teamInfo.city}, {teamInfo.state_prov},{' '}
                                    {teamInfo.country}
                                </p>
                                <p>Rookie Year: {teamInfo.rookie_year}</p>
                            </div>
                        )}

                        <div className='grid grid-cols-2 gap-2 pt-2 text-sm'>
                            <div className='rounded-lg border border-white/10 bg-[#1f2432] p-2'>
                                <p className='text-xs uppercase text-gray-400'>
                                    Matches
                                </p>
                                <p className='text-lg font-semibold'>
                                    {typeof teamData?.matchCount === 'number'
                                        ? teamData.matchCount
                                        : 0}
                                </p>
                            </div>
                            <div className='rounded-lg border border-white/10 bg-[#1f2432] p-2'>
                                <p className='text-xs uppercase text-gray-400'>
                                    Super Matches
                                </p>
                                <p className='text-lg font-semibold'>
                                    {typeof teamData?.superMatchCount ===
                                    'number'
                                        ? teamData.superMatchCount
                                        : 0}
                                </p>
                            </div>
                        </div>
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
                    <div className='mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                        <div className='rounded-lg border border-white/10 bg-[#1f2432] p-3'>
                            <p className='text-xs uppercase text-gray-400'>
                                Avg Fuel Total
                            </p>
                            <p className='text-xl font-semibold'>
                                {formatNumber(teamData.avgFuelTotal as number)}
                            </p>
                        </div>
                        <div className='rounded-lg border border-white/10 bg-[#1f2432] p-3'>
                            <p className='text-xs uppercase text-gray-400'>
                                Tele Efficiency
                            </p>
                            <p className='text-xl font-semibold'>
                                {formatPercent(
                                    teamData.teleFuelEfficiency as number
                                )}
                            </p>
                        </div>
                        <div className='rounded-lg border border-white/10 bg-[#1f2432] p-3'>
                            <p className='text-xs uppercase text-gray-400'>
                                Climb Success
                            </p>
                            <p className='text-xl font-semibold'>
                                {formatPercent(
                                    teamData.climbSuccessRate as number
                                )}
                            </p>
                        </div>
                        <div className='rounded-lg border border-white/10 bg-[#1f2432] p-3'>
                            <p className='text-xs uppercase text-gray-400'>
                                Reliability
                            </p>
                            <p className='text-xl font-semibold'>
                                {formatPercent(
                                    ((teamData.reliabilityScore as number) *
                                        (teamData.breakReliabilityScore as number)) as number
                                )}
                            </p>
                        </div>
                    </div>
                )}
            </section>

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

            <div className='grid gap-6 lg:grid-cols-3'>
                <section className='rounded-xl border border-white/10 bg-[#2f3646] p-4 shadow-lg shadow-black/20'>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>
                        Climb Outcomes
                    </h2>
                    <ResponsiveContainer width='100%' height={220}>
                        <BarChart data={climbChartData}>
                            <CartesianGrid
                                strokeDasharray='4 4'
                                opacity={0.2}
                            />
                            <XAxis dataKey='name' tick={{ fill: 'white' }} />
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
                </section>

                <section className='rounded-xl border border-white/10 bg-[#2f3646] p-4 shadow-lg shadow-black/20'>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>
                        Driver Quality
                    </h2>
                    <ResponsiveContainer width='100%' height={220}>
                        <BarChart data={driverChartData}>
                            <CartesianGrid
                                strokeDasharray='4 4'
                                opacity={0.2}
                            />
                            <XAxis dataKey='name' tick={{ fill: 'white' }} />
                            <YAxis tick={{ fill: 'white' }} allowDecimals={false} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'white',
                                    borderRadius: '0.5rem',
                                    border: '1px solid #e5e7eb',
                                }}
                            />
                            <Bar dataKey='count' fill='#4aa3ff' />
                        </BarChart>
                    </ResponsiveContainer>
                </section>

                <section className='rounded-xl border border-white/10 bg-[#2f3646] p-4 shadow-lg shadow-black/20'>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>
                        Breakdowns
                    </h2>
                    <ResponsiveContainer width='100%' height={220}>
                        <BarChart data={breakdownChartData}>
                            <CartesianGrid
                                strokeDasharray='4 4'
                                opacity={0.2}
                            />
                            <XAxis dataKey='name' tick={{ fill: 'white' }} />
                            <YAxis tick={{ fill: 'white' }} allowDecimals={false} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'white',
                                    borderRadius: '0.5rem',
                                    border: '1px solid #e5e7eb',
                                }}
                            />
                            <Bar dataKey='count' fill='#f07f4a' />
                        </BarChart>
                    </ResponsiveContainer>
                </section>
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
                    <h2 className='pb-2 text-lg font-semibold text-[#48c55c]'>
                        Comments
                    </h2>
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
                            Object.values(teamData.Comments).every(
                                v => !v || v <= 0
                            )) && (
                            <p className='text-sm text-gray-300'>
                                No comments yet.
                            </p>
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
                        <p>
                            Scoring Method:{' '}
                            {teamPitData?.scoringMethod ?? 'N/A'}
                        </p>
                        <p>
                            Preferred Spot:{' '}
                            {teamPitData?.preferredScoringSpot ?? 'N/A'}
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
                                        {formatStatValue(
                                            key,
                                            teamData[key] as number
                                        )}
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
