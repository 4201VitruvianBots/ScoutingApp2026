import { useMemo, useState } from 'react';
import {
    CartesianGrid,
    Line,
    LineChart,
    ReferenceArea,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { MaterialSymbol } from 'react-material-symbols';
import LinkButton from '../../components/LinkButton';
import { useFetchJson } from '../../lib/useFetch';
import { gameConfig } from '../../lib/gameConfig';
import {
    MatchDataAggregations,
    MatchIndividualDataAggregations,
    PicklistPayload,
    PitResult,
    TeamData,
    TeamProfilePayload,
} from 'requests';

type PicklistTab =
    | 'overview'
    | 'team_explorer'
    | 'timeline_heatmap'
    | 'auto_paths'
    | 'pick_builder';

type TimelineMetric = string;

const tabs: Array<{ id: PicklistTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'team_explorer', label: 'Team Explorer' },
    { id: 'timeline_heatmap', label: 'Timeline Heatmap' },
    { id: 'auto_paths', label: 'Auto Paths' },
    { id: 'pick_builder', label: 'Pick Builder' },
];

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function mean(values: number[]) {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatMetric(value: unknown) {
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return 'N/A';
        return Math.abs(value) >= 100 ? value.toFixed(1) : value.toFixed(2);
    }
    if (typeof value === 'string') return value;
    return 'N/A';
}

function formatMetricLabel(metric: string) {
    return metric
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^./, char => char.toUpperCase());
}

function normalizeAutoPath(path: TeamProfilePayload['autoPaths'][number]) {
    if (path.alliance !== 'blue') return path;
    return {
        ...path,
        alliance: 'red' as const,
        points: path.points.map(point => ({
            ...point,
            x: 1 - point.x,
        })),
        shotMarkers: path.shotMarkers.map(point => ({
            ...point,
            x: 1 - point.x,
        })),
    };
}

function buildTimelineBins(
    rows: MatchIndividualDataAggregations[]
): TeamProfilePayload['timeline']['bins'] {
    const totalSec = gameConfig.matchDurationSec;
    const shootBins = Array.from({ length: totalSec }, () => 0);
    const passBins = Array.from({ length: totalSec }, () => 0);

    const withTimeline = rows.filter(row => row.actionTimeline != null);
    withTimeline.forEach(row => {
        row.actionTimeline?.intervals.forEach(interval => {
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
        });
    });

    const divisor = withTimeline.length || 1;
    return Array.from({ length: totalSec }, (_, second) => ({
        second,
        binEndSec: second + 1,
        shootRate: shootBins[second]! / divisor,
        passRate: passBins[second]! / divisor,
        activityRate: (shootBins[second]! + passBins[second]!) / divisor,
    }));
}

function toPayloadFromLive(
    matchAgg: MatchDataAggregations[],
    matchRows: MatchIndividualDataAggregations[]
): PicklistPayload {
    const rowsByTeam = new Map<number, MatchIndividualDataAggregations[]>();
    matchRows.forEach(row => {
        const list = rowsByTeam.get(row._id.teamNumber) ?? [];
        list.push(row);
        rowsByTeam.set(row._id.teamNumber, list);
    });

    const teams: TeamProfilePayload[] = matchAgg
        .map(teamAgg => {
            const teamNumber = teamAgg._id.teamNumber;
            const rows = (rowsByTeam.get(teamNumber) ?? []).filter(
                row => !row.robotAbsent
            );

            const shootHeldSec = mean(
                rows.map(row =>
                    Object.values(row.shootTimeBySegment).reduce(
                        (sum, value) => sum + value,
                        0
                    )
                )
            );
            const passHeldSec = mean(
                rows.map(row =>
                    Object.values(row.passTimeBySegment).reduce(
                        (sum, value) => sum + value,
                        0
                    )
                )
            );
            const ballsPerSecond = mean(rows.map(row => row.ballsPerSecondUsed));
            const estimatedShotBalls = shootHeldSec * ballsPerSecond;
            const estimatedPassBalls = passHeldSec * ballsPerSecond;
            const estimatedFuelPoints =
                estimatedShotBalls * gameConfig.scoring.fuelPointsActive;

            const offenseScore = teamAgg.avgFuelTotal;
            const reliabilityScore = clamp(
                1 - (teamAgg.breakdownRate + teamAgg.breakRateAny) / 2,
                0,
                1
            );
            const disciplineScore = clamp(1 - teamAgg.avgFoulsTotal / 6, 0, 1);
            const timelineScore =
                teamAgg.avgShootActiveSec + teamAgg.avgPassActiveSec;
            const score = clamp(
                50 +
                    offenseScore * 1.6 +
                    reliabilityScore * 20 +
                    disciplineScore * 10 +
                    timelineScore * 0.35,
                0,
                100
            );

            const normalizedPaths = rows
                .map(row => row.autoPath)
                .filter((path): path is NonNullable<typeof path> => path != null)
                .map(normalizeAutoPath);

            return {
                teamNumber,
                matchCount: teamAgg.matchCount,
                score,
                metricContributions: {
                    offense: offenseScore,
                    reliability: reliabilityScore,
                    discipline: disciplineScore,
                    timeline: timelineScore,
                },
                metrics: {
                    avgFuelPerMatch: teamAgg.avgFuelTotal,
                    avgAutoFuel: teamAgg.avgAutoFuel,
                    avgTeleFuel: teamAgg.avgTeleFuelTotal,
                    shootHeldSec,
                    passHeldSec,
                    estimatedShotBalls,
                    estimatedPassBalls,
                    estimatedFuelPoints,
                    avgFoulsPerMatch: teamAgg.avgFoulsTotal,
                    avgBreaksPerMatch: teamAgg.avgBreaksTotal,
                    defenseHeavyRate: teamAgg.defenseHeavyRate,
                    defenseSomeRate: teamAgg.defenseSomeRate,
                    defenseReceivedRate: teamAgg.defenseReceivedRate,
                    avgShootActiveSec: teamAgg.avgShootActiveSec,
                    avgPassActiveSec: teamAgg.avgPassActiveSec,
                },
                timeline: {
                    totalSec: gameConfig.matchDurationSec,
                    binSec: 1,
                    autoEndSec:
                        gameConfig.segments.find(segment => segment.id === 'auto')
                            ?.endSec ?? 20,
                    delayEndSec:
                        gameConfig.segments.find(
                            segment => segment.id === 'transition'
                        )?.endSec ?? 23,
                    bins: buildTimelineBins(rows),
                    rows: rows
                        .filter(row => row.actionTimeline != null)
                        .map(row => ({
                            matchNumber: row._id.matchNumber,
                            intervals: row.actionTimeline?.intervals ?? [],
                        })),
                },
                autoPaths: normalizedPaths,
            };
        })
        .sort((a, b) => a.teamNumber - b.teamNumber);

    return {
        generatedAt: new Date().toISOString(),
        sourceMode: 'mongo',
        teams,
    };
}

function buildDensityGrid(
    traces: TeamProfilePayload['autoPaths'],
    bins = 28
) {
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
            const steps = Math.max(
                2,
                Math.ceil(Math.hypot(next.x - current.x, next.y - current.y) * 90)
            );
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

function PicklistApp() {
    const [analyzedPayload, reloadAnalyzedPayload] = useFetchJson<PicklistPayload>(
        '/data/retrieve/analyzed'
    );
    const [matchAgg, reloadMatchAgg] = useFetchJson<MatchDataAggregations[]>(
        '/data/retrieve'
    );
    const [matchRows, reloadMatchRows] = useFetchJson<
        MatchIndividualDataAggregations[]
    >('/data/retrieve/individualMatch');
    const [pitData, reloadPitData] = useFetchJson<PitResult>('/data/pit');
    const [teamInfo] = useFetchJson<TeamData>('/team_info.json', {});

    const [tab, setTab] = useState<PicklistTab>('overview');
    const [useLiveFallback, setUseLiveFallback] = useState(true);
    const [timelineMetric, setTimelineMetric] = useState<TimelineMetric>('shootRate');
    const [selectedTeamNumber, setSelectedTeamNumber] = useState<number>();

    const livePayload = useMemo(() => {
        if (!matchAgg || !matchRows) return undefined;
        return toPayloadFromLive(matchAgg, matchRows);
    }, [matchAgg, matchRows]);

    const payload = analyzedPayload ?? (useLiveFallback ? livePayload : undefined);
    const sourceLabel = analyzedPayload
        ? `Analyzed payload (${analyzedPayload.sourceMode})`
        : livePayload
          ? 'Live fallback'
          : 'No data source';

    const teams = payload?.teams ?? [];

    const selectedTeam =
        teams.find(team => team.teamNumber === selectedTeamNumber) ?? teams[0];

    const sortedByScore = useMemo(
        () => [...teams].sort((a, b) => b.score - a.score),
        [teams]
    );

    const sectionClass =
        'rounded-xl border border-white/10 bg-[#1d2434] p-4 shadow-lg shadow-black/20';

    const reloadAll = () => {
        reloadAnalyzedPayload();
        reloadMatchAgg();
        reloadMatchRows();
        reloadPitData();
    };

    const timelineChartData = selectedTeam?.timeline.bins ?? [];
    const timelineMetricOptions = useMemo(() => {
        const firstBin = timelineChartData[0];
        if (!firstBin) return ['shootRate', 'passRate', 'activityRate'];
        return Object.keys(firstBin)
            .filter(
                key =>
                    key !== 'second' &&
                    key !== 'binEndSec' &&
                    typeof firstBin[key] === 'number'
            )
            .sort((a, b) => a.localeCompare(b));
    }, [timelineChartData]);
    const activeTimelineMetric = timelineMetricOptions.includes(timelineMetric)
        ? timelineMetric
        : timelineMetricOptions[0] ?? 'shootRate';
    const timelineMaxValue = useMemo(
        () =>
            Math.max(
                1,
                ...timelineChartData.map(row => Number(row[activeTimelineMetric] ?? 0))
            ),
        [timelineChartData, activeTimelineMetric]
    );
    const heatmapSampleStride = Math.max(
        1,
        Math.floor(Math.max(1, timelineChartData.length) / 42)
    );
    const contributionMetricKeys = useMemo(() => {
        const keySet = new Set<string>();
        teams.forEach(team =>
            Object.keys(team.metricContributions ?? {}).forEach(key => keySet.add(key))
        );
        return Array.from(keySet).sort((a, b) => a.localeCompare(b));
    }, [teams]);

    const topAvgFuel =
        teams.length > 0
            ? mean(
                  teams
                      .map(team => Number(team.metrics.avgFuelPerMatch))
                      .filter((value): value is number => Number.isFinite(value))
              )
            : 0;

    const selectedTeamInfo = selectedTeam
        ? teamInfo[selectedTeam.teamNumber.toString()]?.info
        : undefined;

    return (
        <main className='min-h-screen bg-gradient-to-b from-[#111722] via-[#0f1520] to-[#0c111a] px-5 pb-12 text-white'>
            <div className='mx-auto max-w-7xl space-y-5 pt-5'>
                <header className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#1f2737] px-4 py-3'>
                    <div className='flex items-center gap-2'>
                        <LinkButton link='/' className='snap-none'>
                            <MaterialSymbol icon='home' size={44} fill grade={200} color='green' className='snap-none' />
                        </LinkButton>
                        <button
                            className='rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10'
                            onClick={reloadAll}>
                            Refresh
                        </button>
                    </div>
                    <div className='text-right'>
                        <h1 className='text-3xl font-bold text-[#48c55c]'>Picklist 2.0</h1>
                        <p className='text-sm text-gray-300'>
                            {sourceLabel} • {teams.length} teams
                        </p>
                    </div>
                </header>

                <section className='flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-[#182032] p-2'>
                    {tabs.map(item => (
                        <button
                            key={item.id}
                            type='button'
                            onClick={() => setTab(item.id)}
                            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                                tab === item.id
                                    ? 'bg-[#48c55c] text-black'
                                    : 'bg-[#2a3449] text-white'
                            }`}>
                            {item.label}
                        </button>
                    ))}
                </section>

                <section className={sectionClass}>
                    <div className='flex flex-wrap items-center gap-4 text-sm'>
                        <label className='flex items-center gap-2'>
                            <input
                                type='checkbox'
                                checked={useLiveFallback}
                                onChange={event =>
                                    setUseLiveFallback(event.target.checked)
                                }
                            />
                            Enable live fallback if analyzed payload is missing
                        </label>
                        {!analyzedPayload && (
                            <p className='text-amber-300'>
                                Analyzed payload not found; fallback is
                                {useLiveFallback ? ' enabled.' : ' disabled.'}
                            </p>
                        )}
                    </div>
                </section>

                {tab === 'overview' && (
                    <section className={sectionClass}>
                        <h2 className='text-xl font-semibold text-[#48c55c]'>Overview</h2>
                        <div className='mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                            <div className='rounded-lg border border-white/10 bg-[#101827] p-3'>
                                <p className='text-xs uppercase text-gray-400'>Teams</p>
                                <p className='text-2xl font-semibold'>{teams.length}</p>
                            </div>
                            <div className='rounded-lg border border-white/10 bg-[#101827] p-3'>
                                <p className='text-xs uppercase text-gray-400'>Avg Fuel/Team</p>
                                <p className='text-2xl font-semibold'>{topAvgFuel.toFixed(2)}</p>
                            </div>
                            <div className='rounded-lg border border-white/10 bg-[#101827] p-3'>
                                <p className='text-xs uppercase text-gray-400'>Top Team</p>
                                <p className='text-2xl font-semibold'>
                                    {sortedByScore[0]?.teamNumber ?? 'N/A'}
                                </p>
                            </div>
                            <div className='rounded-lg border border-white/10 bg-[#101827] p-3'>
                                <p className='text-xs uppercase text-gray-400'>Top Score</p>
                                <p className='text-2xl font-semibold'>
                                    {sortedByScore[0]?.score?.toFixed(1) ?? 'N/A'}
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                {tab !== 'overview' && (
                    <section className={sectionClass}>
                        <div className='flex flex-wrap items-center gap-2'>
                            <p className='text-sm text-gray-300'>Selected Team</p>
                            <select
                                className='rounded-lg border border-white/20 bg-[#0f1522] px-3 py-1.5 text-sm'
                                value={selectedTeam?.teamNumber ?? ''}
                                onChange={event =>
                                    setSelectedTeamNumber(Number(event.target.value))
                                }>
                                {teams.map(team => (
                                    <option key={team.teamNumber} value={team.teamNumber}>
                                        {team.teamNumber}
                                    </option>
                                ))}
                            </select>
                            {selectedTeamInfo?.nickname && (
                                <p className='text-sm text-gray-300'>
                                    {selectedTeamInfo.nickname}
                                </p>
                            )}
                        </div>
                    </section>
                )}

                {tab === 'team_explorer' && selectedTeam && (
                    <section className={sectionClass}>
                        <h2 className='text-xl font-semibold text-[#48c55c]'>Team Explorer</h2>
                        <p className='mt-1 text-sm text-gray-300'>
                            Team {selectedTeam.teamNumber} metrics from analyzed data.
                        </p>
                        <button
                            type='button'
                            className='mt-3 rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10'
                            onClick={() => setTab('auto_paths')}>
                            View Auto Paths
                        </button>
                        <div className='mt-3 grid gap-2 text-sm text-gray-200 md:grid-cols-2'>
                            {Object.entries(selectedTeam.metrics)
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([key, value]) => (
                                    <p key={key}>
                                        {key}: <span className='font-mono'>{formatMetric(value)}</span>
                                    </p>
                                ))}
                        </div>
                        {pitData?.[selectedTeam.teamNumber] && (
                            <div className='mt-4 rounded-lg border border-white/10 bg-[#101827] p-3 text-sm'>
                                <p className='font-semibold text-white'>Pit Snapshot</p>
                                <p>Drivebase: {pitData[selectedTeam.teamNumber]?.drivebase ?? 'N/A'}</p>
                                <p>Battery Count: {pitData[selectedTeam.teamNumber]?.batteryCount ?? 'N/A'}</p>
                                <p>Max Fuel Storage: {pitData[selectedTeam.teamNumber]?.maxFuelStorageEstimate ?? 'N/A'}</p>
                                <p>Notes: {pitData[selectedTeam.teamNumber]?.notes ?? 'N/A'}</p>
                            </div>
                        )}
                    </section>
                )}

                {tab === 'timeline_heatmap' && selectedTeam && (
                    <section className={sectionClass}>
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                            <h2 className='text-xl font-semibold text-[#48c55c]'>Timeline Heatmap</h2>
                            <select
                                className='rounded-lg border border-white/20 bg-[#0f1522] px-3 py-1.5 text-sm'
                                value={activeTimelineMetric}
                                onChange={event =>
                                    setTimelineMetric(event.target.value as TimelineMetric)
                                }>
                                {timelineMetricOptions.map(metric => (
                                    <option key={metric} value={metric}>
                                        {formatMetricLabel(metric)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className='mt-4 h-[300px] w-full'>
                            <ResponsiveContainer width='100%' height='100%'>
                                <LineChart data={timelineChartData}>
                                    <CartesianGrid strokeDasharray='4 4' opacity={0.2} />
                                    <XAxis dataKey='second' tick={{ fill: '#d1d5db' }} />
                                    <YAxis
                                        tick={{ fill: '#d1d5db' }}
                                        domain={[0, Math.max(1.2, timelineMaxValue * 1.1)]}
                                    />
                                    <Tooltip
                                        formatter={(value: number) => `${(value * 100).toFixed(1)}%`}
                                        labelFormatter={(value: number) => {
                                            const binSec = selectedTeam.timeline.binSec || 1;
                                            return `t=${value}-${value + binSec}s`;
                                        }}
                                    />
                                    {gameConfig.segments.map(segment => (
                                        <ReferenceArea
                                            key={segment.id}
                                            x1={segment.startSec}
                                            x2={segment.endSec}
                                            fill='rgba(148,163,184,0.08)'
                                        />
                                    ))}
                                    <Line
                                        type='monotone'
                                        dataKey={activeTimelineMetric}
                                        stroke='#48c55c'
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        <div className='mt-4 rounded-lg border border-white/10 bg-[#101827] p-3'>
                            <p className='text-sm text-gray-300'>
                                Heat intensity by timeline bin ({selectedTeam.timeline.binSec}s).
                            </p>
                            <div className='mt-2 grid grid-cols-[repeat(41,minmax(0,1fr))] gap-[2px]'>
                                {timelineChartData
                                    .filter((_, index) => index % heatmapSampleStride === 0)
                                    .map(row => {
                                        const intensity = clamp(
                                            Number(row[activeTimelineMetric]),
                                            0,
                                            1
                                        );
                                        return (
                                            <div
                                                key={`heat-${row.second}`}
                                                title={`t=${row.second}s`}
                                                className='h-4 rounded-sm'
                                                style={{
                                                    background: `rgba(72, 197, 92, ${0.12 + intensity * 0.82})`,
                                                }}
                                            />
                                        );
                                    })}
                            </div>
                        </div>
                    </section>
                )}

                {tab === 'auto_paths' && selectedTeam && (
                    <section className={sectionClass}>
                        <h2 className='text-xl font-semibold text-[#48c55c]'>Auto Paths</h2>
                        <p className='mt-1 text-sm text-gray-300'>
                            Canonical red-side orientation heatmap and shot markers.
                        </p>

                        <div className='mt-4 overflow-hidden rounded-lg border border-white/15 bg-[#101826]'>
                            <div className='relative'>
                                <img src='/redsidematch.png' alt='Auto field' className='block w-full select-none' draggable={false} />
                                <svg viewBox='0 0 1000 1000' preserveAspectRatio='none' className='pointer-events-none absolute inset-0'>
                                    {(() => {
                                        const normalizedPaths = selectedTeam.autoPaths.map(normalizeAutoPath);
                                        const density = buildDensityGrid(normalizedPaths);
                                        const cellSize = 1000 / density.bins;
                                        return (
                                            <>
                                                {density.values.map((value, index) => {
                                                    if (value === 0 || density.max === 0) return null;
                                                    const intensity = value / density.max;
                                                    const x = (index % density.bins) * cellSize;
                                                    const y = Math.floor(index / density.bins) * cellSize;
                                                    return (
                                                        <rect
                                                            key={`auto-cell-${index}`}
                                                            x={x}
                                                            y={y}
                                                            width={cellSize}
                                                            height={cellSize}
                                                            fill={`rgba(245, 158, 11, ${0.1 + intensity * 0.55})`}
                                                        />
                                                    );
                                                })}
                                                {normalizedPaths.flatMap((path, pathIndex) =>
                                                    path.shotMarkers.map((marker, markerIndex) => (
                                                        <circle
                                                            key={`shot-${pathIndex}-${markerIndex}`}
                                                            cx={marker.x * 1000}
                                                            cy={marker.y * 1000}
                                                            r='7'
                                                            fill='rgba(72, 197, 92, 0.95)'
                                                            stroke='rgba(0,0,0,0.6)'
                                                            strokeWidth='2'
                                                        />
                                                    ))
                                                )}
                                            </>
                                        );
                                    })()}
                                </svg>
                            </div>
                        </div>
                        <p className='mt-2 text-xs text-gray-300'>
                            {selectedTeam.autoPaths.length} auto traces available.
                        </p>
                    </section>
                )}

                {tab === 'pick_builder' && (
                    <section className={sectionClass}>
                        <h2 className='text-xl font-semibold text-[#48c55c]'>Pick Builder</h2>
                        <div className='mt-3 overflow-x-auto'>
                            <table className='w-full min-w-[780px] text-left text-sm'>
                                <thead>
                                    <tr className='border-b border-white/10 text-xs uppercase text-gray-400'>
                                        <th className='py-2'>Rank</th>
                                        <th className='py-2'>Team</th>
                                        <th className='py-2'>Score</th>
                                        {contributionMetricKeys.map(metricKey => (
                                            <th key={metricKey} className='py-2'>
                                                {formatMetricLabel(metricKey)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedByScore.map((team, index) => (
                                        <tr key={team.teamNumber} className='border-b border-white/5'>
                                            <td className='py-2'>{index + 1}</td>
                                            <td className='py-2 font-semibold'>#{team.teamNumber}</td>
                                            <td className='py-2'>{team.score.toFixed(2)}</td>
                                            {contributionMetricKeys.map(metricKey => (
                                                <td key={metricKey} className='py-2'>
                                                    {formatMetric(
                                                        team.metricContributions?.[metricKey]
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}

export default PicklistApp;

