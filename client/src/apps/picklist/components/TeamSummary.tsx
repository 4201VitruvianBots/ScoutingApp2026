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
    ReferenceLine,
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

type TeamAutoPathTrace = NonNullable<MatchIndividualDataAggregations['autoPath']>;
type TeamActionTimeline = NonNullable<
    MatchIndividualDataAggregations['actionTimeline']
>;
type TeamActionInterval = TeamActionTimeline['intervals'][number];

function median(values: number[]) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[middle - 1]! + sorted[middle]!) / 2;
    }
    return sorted[middle]!;
}

function buildActionTimelineSummary(
    entries: MatchIndividualDataAggregations[]
) {
    const timelineEntries = entries
        .map(entry => ({
            matchNumber: entry._id.matchNumber,
            timeline: entry.actionTimeline,
        }))
        .filter(
            (
                row
            ): row is {
                matchNumber: number;
                timeline: TeamActionTimeline;
            } => row.timeline != null
        )
        .sort((a, b) => a.matchNumber - b.matchNumber);

    if (!timelineEntries.length) {
        return null;
    }

    const totalSec = Math.max(
        1,
        Math.round(timelineEntries[0]!.timeline.totalSec)
    );
    const autoEndSec = timelineEntries[0]!.timeline.autoEndSec;
    const delayEndSec = timelineEntries[0]!.timeline.delayEndSec;
    const shootBins = Array.from({ length: totalSec }, () => 0);
    const passBins = Array.from({ length: totalSec }, () => 0);
    const shootDurations: number[] = [];
    const passDurations: number[] = [];
    const shootActivePerMatch: number[] = [];
    const passActivePerMatch: number[] = [];
    const shootCycleGapMedians: number[] = [];

    const rows = timelineEntries.map(entry => {
        const intervals = entry.timeline.intervals
            .filter(interval => interval.endSec > interval.startSec)
            .sort((a, b) => a.startSec - b.startSec);

        let shootActive = 0;
        let passActive = 0;
        const shootStarts: number[] = [];

        intervals.forEach(interval => {
            const startBin = Math.max(0, Math.floor(interval.startSec));
            const endBin = Math.min(totalSec, Math.ceil(interval.endSec));
            for (let second = startBin; second < endBin; second++) {
                const bucketStart = second;
                const bucketEnd = second + 1;
                if (
                    interval.endSec <= bucketStart ||
                    interval.startSec >= bucketEnd
                ) {
                    continue;
                }
                if (interval.action === 'shoot') {
                    shootBins[second] += 1;
                } else {
                    passBins[second] += 1;
                }
            }

            if (interval.action === 'shoot') {
                shootDurations.push(interval.durationSec);
                shootActive += interval.durationSec;
                shootStarts.push(interval.startSec);
            } else {
                passDurations.push(interval.durationSec);
                passActive += interval.durationSec;
            }
        });

        shootActivePerMatch.push(shootActive);
        passActivePerMatch.push(passActive);

        if (shootStarts.length >= 2) {
            const sortedStarts = [...shootStarts].sort((a, b) => a - b);
            const gaps = sortedStarts
                .slice(1)
                .map((start, index) => start - sortedStarts[index]!)
                .filter(gap => gap > 0);
            if (gaps.length) {
                shootCycleGapMedians.push(median(gaps));
            }
        }

        return {
            matchNumber: entry.matchNumber,
            intervals,
        };
    });

    const chartData = Array.from({ length: totalSec }, (_, second) => ({
        second,
        shootRate: shootBins[second]! / timelineEntries.length,
        passRate: passBins[second]! / timelineEntries.length,
    }));

    const mean = (values: number[]) =>
        values.length
            ? values.reduce((sum, value) => sum + value, 0) / values.length
            : 0;

    return {
        totalSec,
        autoEndSec,
        delayEndSec,
        timelineMatchCount: timelineEntries.length,
        chartData,
        rows,
        avgShootCycleGapSec: mean(shootCycleGapMedians),
        medianShootIntervalSec: median(shootDurations),
        medianPassIntervalSec: median(passDurations),
        avgShootActiveSec: mean(shootActivePerMatch),
        avgPassActiveSec: mean(passActivePerMatch),
    };
}

const autoFieldImageByAlliance = {
    red: '/redsidematch.png',
    blue: '/bluesidematch.png',
} as const;

function smoothPath(points: Array<{ x: number; y: number }>) {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;
    if (points.length === 2) {
        return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`;
    }

    let path = `M ${points[0]!.x} ${points[0]!.y}`;
    for (let index = 1; index < points.length - 1; index++) {
        const current = points[index]!;
        const next = points[index + 1]!;
        const midpointX = (current.x + next.x) / 2;
        const midpointY = (current.y + next.y) / 2;
        path += ` Q ${current.x} ${current.y} ${midpointX} ${midpointY}`;
    }
    const last = points[points.length - 1]!;
    path += ` T ${last.x} ${last.y}`;
    return path;
}

function buildDensityGrid(traces: TeamAutoPathTrace[], bins = 28) {
    const values = Array.from({ length: bins * bins }, () => 0);
    let max = 0;

    const mark = (x: number, y: number) => {
        const ix = Math.max(0, Math.min(bins - 1, Math.floor(x * bins)));
        const iy = Math.max(0, Math.min(bins - 1, Math.floor(y * bins)));
        const key = iy * bins + ix;
        values[key] += 1;
        if (values[key] > max) max = values[key];
    };

    traces.forEach(trace => {
        for (let index = 0; index < trace.points.length; index++) {
            const current = trace.points[index]!;
            mark(current.x, current.y);

            const next = trace.points[index + 1];
            if (!next) continue;
            const distance = Math.hypot(next.x - current.x, next.y - current.y);
            const steps = Math.max(2, Math.ceil(distance * 90));
            for (let step = 1; step < steps; step++) {
                const ratio = step / steps;
                mark(
                    current.x + (next.x - current.x) * ratio,
                    current.y + (next.y - current.y) * ratio
                );
            }
        }
    });

    return { values, bins, max };
}

function AutoPathHeatmap({
    traces,
    alliance,
}: {
    traces: TeamAutoPathTrace[];
    alliance: 'red' | 'blue';
}) {
    if (traces.length === 0) {
        return <p className='text-sm text-gray-300'>No {alliance} auto paths logged.</p>;
    }

    const density = buildDensityGrid(traces);
    const cellSize = 1000 / density.bins;

    return (
        <div className='space-y-2'>
            <div className='relative overflow-hidden rounded-lg border border-white/15 bg-[#101826]'>
                <img
                    src={autoFieldImageByAlliance[alliance]}
                    alt={`${alliance} field`}
                    className='block w-full select-none'
                    draggable={false}
                />
                <svg
                    viewBox='0 0 1000 1000'
                    preserveAspectRatio='none'
                    className='pointer-events-none absolute inset-0'>
                    {density.values.map((value, index) => {
                        if (value === 0 || density.max === 0) return null;
                        const intensity = value / density.max;
                        const x = (index % density.bins) * cellSize;
                        const y = Math.floor(index / density.bins) * cellSize;
                        return (
                            <rect
                                key={`${alliance}-cell-${index}`}
                                x={x}
                                y={y}
                                width={cellSize}
                                height={cellSize}
                                fill={`rgba(245, 158, 11, ${0.08 + intensity * 0.5})`}
                            />
                        );
                    })}

                    {traces.map((trace, index) => (
                        <path
                            key={`${trace.fingerprint}-${index}`}
                            d={smoothPath(
                                trace.points.map(point => ({
                                    x: point.x * 1000,
                                    y: point.y * 1000,
                                }))
                            )}
                            fill='none'
                            stroke='rgba(74, 163, 255, 0.38)'
                            strokeWidth='6'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                        />
                    ))}

                    {traces.flatMap((trace, traceIndex) =>
                        trace.shotMarkers.map((marker, markerIndex) => (
                            <circle
                                key={`${traceIndex}-shot-${markerIndex}`}
                                cx={marker.x * 1000}
                                cy={marker.y * 1000}
                                r='8'
                                fill='rgba(72, 197, 92, 0.95)'
                                stroke='rgba(0,0,0,0.6)'
                                strokeWidth='3'
                            />
                        ))
                    )}
                </svg>
            </div>
            <p className='text-xs text-gray-300'>
                {traces.length} {alliance} traces
            </p>
        </div>
    );
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
    const actionTimelineSummary = buildActionTimelineSummary(teamMatchEntries);

    const teamAutoPathTraces = teamMatchEntries
        .map(entry => entry.autoPath)
        .filter((path): path is TeamAutoPathTrace => path != null && path.points.length > 0);
    const redAutoTraces = teamAutoPathTraces.filter(path => path.alliance === 'red');
    const blueAutoTraces = teamAutoPathTraces.filter(path => path.alliance === 'blue');
    const uniqueAutoPathCount = new Set(
        teamAutoPathTraces.map(path =>
            path.fingerprint || JSON.stringify(path.points.map(point => [point.x, point.y]))
        )
    ).size;

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
        { name: 'None', count: climbCounts.None ?? 0 },
        { name: 'L1', count: climbCounts.level1 ?? 0 },
        { name: 'L2', count: climbCounts.level2 ?? 0 },
        { name: 'L3', count: climbCounts.level3 ?? 0 },
        { name: 'Fail', count: climbCounts.Failed ?? 0 },
    ];
    const driverChartData = [
        { name: 'Great', count: driverCounts.great ?? 0 },
        { name: 'Good', count: driverCounts.good ?? 0 },
        { name: 'OK', count: driverCounts.ok ?? 0 },
        { name: 'Rough', count: driverCounts.rough ?? 0 },
    ];
    const breakdownChartData = [
        { name: 'None', count: breakdownCounts.None ?? 0 },
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
        { name: 'None', count: defenseProvidedCounts.None ?? 0 },
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

            <section className='rounded-xl border border-white/10 bg-[#2f3646] p-4 shadow-lg shadow-black/20'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>
                        Action Timeline
                    </h2>
                    <p className='text-xs text-gray-300'>
                        {actionTimelineSummary
                            ? `${actionTimelineSummary.timelineMatchCount} timeline-enabled matches`
                            : 'No timeline-enabled matches'}
                    </p>
                </div>

                {actionTimelineSummary ? (
                    <>
                        <div className='mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
                            <div className='rounded-lg border border-white/10 bg-[#1b2230] p-3'>
                                <p className='text-xs uppercase text-gray-400'>Shoot Cycle Gap</p>
                                <p className='text-xl font-semibold'>
                                    {formatNumber(
                                        actionTimelineSummary.avgShootCycleGapSec
                                    )}
                                    s
                                </p>
                            </div>
                            <div className='rounded-lg border border-white/10 bg-[#1b2230] p-3'>
                                <p className='text-xs uppercase text-gray-400'>Median Shoot Hold</p>
                                <p className='text-xl font-semibold'>
                                    {formatNumber(
                                        actionTimelineSummary.medianShootIntervalSec
                                    )}
                                    s
                                </p>
                            </div>
                            <div className='rounded-lg border border-white/10 bg-[#1b2230] p-3'>
                                <p className='text-xs uppercase text-gray-400'>Median Pass Hold</p>
                                <p className='text-xl font-semibold'>
                                    {formatNumber(
                                        actionTimelineSummary.medianPassIntervalSec
                                    )}
                                    s
                                </p>
                            </div>
                            <div className='rounded-lg border border-white/10 bg-[#1b2230] p-3'>
                                <p className='text-xs uppercase text-gray-400'>Avg Shoot Active</p>
                                <p className='text-xl font-semibold'>
                                    {formatNumber(actionTimelineSummary.avgShootActiveSec)}s
                                </p>
                            </div>
                            <div className='rounded-lg border border-white/10 bg-[#1b2230] p-3'>
                                <p className='text-xs uppercase text-gray-400'>Avg Pass Active</p>
                                <p className='text-xl font-semibold'>
                                    {formatNumber(actionTimelineSummary.avgPassActiveSec)}s
                                </p>
                            </div>
                        </div>

                        <div className='mt-4 grid gap-4 lg:grid-cols-2'>
                            <div className='h-[260px] w-full'>
                                <ResponsiveContainer width='100%' height='100%'>
                                    <LineChart data={actionTimelineSummary.chartData}>
                                        <CartesianGrid strokeDasharray='4 4' opacity={0.2} />
                                        <XAxis
                                            dataKey='second'
                                            tick={{ fill: '#d1d5db' }}
                                            tickFormatter={value => `${value}s`}
                                        />
                                        <YAxis
                                            domain={[0, 1]}
                                            tick={{ fill: '#d1d5db' }}
                                            tickFormatter={value =>
                                                `${Math.round(value * 100)}%`
                                            }
                                        />
                                        <Tooltip
                                            formatter={(value: number, name: string) => [
                                                `${(Number(value) * 100).toFixed(1)}%`,
                                                name === 'shootRate'
                                                    ? 'Shooting Utilization'
                                                    : 'Passing Utilization',
                                            ]}
                                            labelFormatter={label =>
                                                `Second ${label} of ${actionTimelineSummary.totalSec}`
                                            }
                                            contentStyle={{
                                                backgroundColor: '#10141d',
                                                border: '1px solid rgba(255,255,255,0.15)',
                                                color: '#f3f4f6',
                                            }}
                                        />
                                        <ReferenceLine
                                            x={actionTimelineSummary.autoEndSec}
                                            stroke='rgba(248,250,252,0.45)'
                                            strokeDasharray='4 4'
                                        />
                                        <ReferenceLine
                                            x={actionTimelineSummary.delayEndSec}
                                            stroke='rgba(248,250,252,0.45)'
                                            strokeDasharray='4 4'
                                        />
                                        <Line
                                            type='monotone'
                                            dataKey='shootRate'
                                            stroke='#48c55c'
                                            strokeWidth={2}
                                            dot={false}
                                            name='Shooting Utilization'
                                        />
                                        <Line
                                            type='monotone'
                                            dataKey='passRate'
                                            stroke='#4aa3ff'
                                            strokeWidth={2}
                                            dot={false}
                                            name='Passing Utilization'
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            <div className='rounded-lg border border-white/10 bg-[#1b2230] p-3'>
                                <p className='text-xs uppercase tracking-wide text-gray-300'>
                                    Match Timeline Raster
                                </p>
                                <div className='mt-2 max-h-[210px] space-y-2 overflow-y-auto pr-1'>
                                    {actionTimelineSummary.rows.map(row => (
                                        <div
                                            key={`timeline-row-${row.matchNumber}`}
                                            className='grid grid-cols-[44px_1fr] items-center gap-2'>
                                            <span className='text-xs font-semibold text-gray-300'>
                                                M{row.matchNumber}
                                            </span>
                                            <div className='relative h-6 overflow-hidden rounded border border-white/10 bg-[#0f1522]'>
                                                <div
                                                    className='absolute inset-y-0 w-px bg-white/35'
                                                    style={{
                                                        left: `${
                                                            (actionTimelineSummary.autoEndSec /
                                                                actionTimelineSummary.totalSec) *
                                                            100
                                                        }%`,
                                                    }}
                                                />
                                                <div
                                                    className='absolute inset-y-0 w-px bg-white/35'
                                                    style={{
                                                        left: `${
                                                            (actionTimelineSummary.delayEndSec /
                                                                actionTimelineSummary.totalSec) *
                                                            100
                                                        }%`,
                                                    }}
                                                />
                                                {row.intervals.map(
                                                    (
                                                        interval: TeamActionInterval,
                                                        intervalIndex
                                                    ) => {
                                                        const left =
                                                            (interval.startSec /
                                                                actionTimelineSummary.totalSec) *
                                                            100;
                                                        const width = Math.max(
                                                            0.35,
                                                            ((interval.endSec - interval.startSec) /
                                                                actionTimelineSummary.totalSec) *
                                                                100
                                                        );
                                                        return (
                                                            <div
                                                                key={`${row.matchNumber}-${interval.action}-${intervalIndex}`}
                                                                className={`absolute inset-y-0 ${
                                                                    interval.action === 'shoot'
                                                                        ? 'bg-emerald-400/80'
                                                                        : 'bg-sky-400/80'
                                                                }`}
                                                                style={{
                                                                    left: `${left}%`,
                                                                    width: `${width}%`,
                                                                }}
                                                            />
                                                        );
                                                    }
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <p className='mt-2 text-[11px] text-gray-300'>
                                    Green = shooting hold, blue = passing hold.
                                </p>
                            </div>
                        </div>
                    </>
                ) : (
                    <p className='mt-2 text-sm text-gray-300'>
                        No action timeline data recorded yet for this team.
                    </p>
                )}
            </section>

            <section className='rounded-xl border border-white/10 bg-[#2f3646] p-4 shadow-lg shadow-black/20'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>
                        Auto Path Heatmap
                    </h2>
                    <p className='text-xs text-gray-300'>
                        {uniqueAutoPathCount} unique / {teamAutoPathTraces.length} total traces
                    </p>
                </div>
                <div className='mt-3 grid gap-4 lg:grid-cols-2'>
                    <AutoPathHeatmap traces={redAutoTraces} alliance='red' />
                    <AutoPathHeatmap traces={blueAutoTraces} alliance='blue' />
                </div>
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
