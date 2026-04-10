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
    TeamMatchHistoryRow,
    TeamProfilePayload,
    TeamTimelineRow,
} from 'requests';

type PicklistTab =
    | 'overview'
    | 'team_explorer'
    | 'timeline_heatmap'
    | 'auto_paths'
    | 'pick_builder';

type TimelineMetric = string;
type AllianceFilter = 'all' | 'red' | 'blue';
type HeatmapRow = {
    matchNumber: number;
    alliance: TeamTimelineRow['alliance'];
    values: number[];
};

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

function getMetricNumber(value: unknown, fallback = 0) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
}

function formatAllianceLabel(value: TeamTimelineRow['alliance']) {
    if (value === 'red') return 'Red';
    if (value === 'blue') return 'Blue';
    return 'N/A';
}

function getAllianceFromRobotPosition(position: string): 'red' | 'blue' {
    return position.startsWith('red') ? 'red' : 'blue';
}

function isAllianceIncluded(
    row: TeamTimelineRow,
    allianceFilter: AllianceFilter
) {
    if (allianceFilter === 'all') return true;
    return row.alliance === allianceFilter;
}

function normalizeLiveAutoPath(
    path: NonNullable<MatchIndividualDataAggregations['autoPath']>
) {
    const shouldFlip = path.alliance === 'blue';
    return {
        ...path,
        points: path.points.map(point => ({
            ...point,
            x: shouldFlip ? 1 - point.x : point.x,
        })),
        shotMarkers: path.shotMarkers.map(point => ({
            ...point,
            x: shouldFlip ? 1 - point.x : point.x,
        })),
    };
}

function buildTimelineBins(
    rows: TeamTimelineRow[],
    totalSec: number,
    binSec: number
): TeamProfilePayload['timeline']['bins'] {
    const safeTotalSec = Math.max(1, totalSec);
    const safeBinSec = Math.max(1, binSec);
    const binCount = Math.ceil(safeTotalSec / safeBinSec);
    const shootBins = Array.from({ length: binCount }, () => 0);
    const passBins = Array.from({ length: binCount }, () => 0);

    rows.forEach(row => {
        row.intervals.forEach(interval => {
            const startSec = clamp(interval.startSec, 0, safeTotalSec);
            const endSec = clamp(interval.endSec, 0, safeTotalSec);
            if (endSec <= startSec) return;

            const startBin = Math.max(0, Math.floor(startSec / safeBinSec));
            const endBin = Math.min(binCount, Math.ceil(endSec / safeBinSec));
            for (let binIndex = startBin; binIndex < endBin; binIndex++) {
                const bucketStart = binIndex * safeBinSec;
                const bucketEnd = Math.min(safeTotalSec, bucketStart + safeBinSec);
                const overlap =
                    Math.min(endSec, bucketEnd) - Math.max(startSec, bucketStart);
                if (overlap <= 0) continue;
                const normalizedOverlap = overlap / Math.max(1, bucketEnd - bucketStart);
                if (interval.action === 'shoot') {
                    shootBins[binIndex] += normalizedOverlap;
                } else if (interval.action === 'pass') {
                    passBins[binIndex] += normalizedOverlap;
                }
            }
        });
    });

    const divisor = Math.max(1, rows.length);
    return Array.from({ length: binCount }, (_, index) => {
        const second = index * safeBinSec;
        const binEndSec = Math.min(safeTotalSec, second + safeBinSec);
        const shootRate = shootBins[index] / divisor;
        const passRate = passBins[index] / divisor;
        return {
            second,
            binEndSec,
            shootRate,
            passRate,
            activityRate: shootRate + passRate,
        };
    });
}

function buildTimelineRowsFromLiveRows(
    rows: MatchIndividualDataAggregations[]
): TeamTimelineRow[] {
    return rows
        .filter(row => row.actionTimeline != null)
        .map(row => ({
            matchNumber: row._id.matchNumber,
            alliance: getAllianceFromRobotPosition(row._id.robotPosition),
            robotPosition: row._id.robotPosition,
            intervals: row.actionTimeline?.intervals ?? [],
        }))
        .sort((a, b) => a.matchNumber - b.matchNumber);
}

function buildTimelineHeatmapRows(
    rows: TeamTimelineRow[],
    metric: TimelineMetric,
    totalSec: number,
    binSec: number
): HeatmapRow[] {
    const safeTotalSec = Math.max(1, totalSec);
    const safeBinSec = Math.max(1, binSec);
    const binCount = Math.ceil(safeTotalSec / safeBinSec);

    return rows
        .map(row => {
            const shootValues = Array.from({ length: binCount }, () => 0);
            const passValues = Array.from({ length: binCount }, () => 0);

            row.intervals.forEach(interval => {
                const startSec = clamp(interval.startSec, 0, safeTotalSec);
                const endSec = clamp(interval.endSec, 0, safeTotalSec);
                if (endSec <= startSec) return;

                const startBin = Math.max(0, Math.floor(startSec / safeBinSec));
                const endBin = Math.min(binCount, Math.ceil(endSec / safeBinSec));
                for (let binIndex = startBin; binIndex < endBin; binIndex++) {
                    const bucketStart = binIndex * safeBinSec;
                    const bucketEnd = Math.min(safeTotalSec, bucketStart + safeBinSec);
                    const overlap =
                        Math.min(endSec, bucketEnd) - Math.max(startSec, bucketStart);
                    if (overlap <= 0) continue;
                    const normalizedOverlap = overlap / Math.max(1, bucketEnd - bucketStart);
                    if (interval.action === 'shoot') {
                        shootValues[binIndex] += normalizedOverlap;
                    } else if (interval.action === 'pass') {
                        passValues[binIndex] += normalizedOverlap;
                    }
                }
            });

            const values = Array.from({ length: binCount }, (_, index) => {
                const shoot = clamp(shootValues[index], 0, 1);
                const pass = clamp(passValues[index], 0, 1);
                if (metric === 'shootRate') return shoot;
                if (metric === 'passRate') return pass;
                return clamp(shoot + pass, 0, 1);
            });

            return {
                matchNumber: row.matchNumber,
                alliance: row.alliance,
                values,
            };
        })
        .sort((a, b) => a.matchNumber - b.matchNumber);
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
                .map(normalizeLiveAutoPath);

            const timelineRows = buildTimelineRowsFromLiveRows(rows);
            const timelineRowsRed = timelineRows.filter(
                row => row.alliance === 'red'
            );
            const timelineRowsBlue = timelineRows.filter(
                row => row.alliance === 'blue'
            );
            const timelineBins = buildTimelineBins(
                timelineRows,
                gameConfig.matchDurationSec,
                1
            );
            const timelineBinsRed = buildTimelineBins(
                timelineRowsRed,
                gameConfig.matchDurationSec,
                1
            );
            const timelineBinsBlue = buildTimelineBins(
                timelineRowsBlue,
                gameConfig.matchDurationSec,
                1
            );

            const matchHistory: TeamMatchHistoryRow[] = rows
                .map(row => {
                    const shootSec = Object.values(row.shootTimeBySegment).reduce(
                        (sum, value) => sum + value,
                        0
                    );
                    const passSec = Object.values(row.passTimeBySegment).reduce(
                        (sum, value) => sum + value,
                        0
                    );
                    const rowEstimatedShotBalls = shootSec * row.ballsPerSecondUsed;
                    const rowEstimatedPassBalls = passSec * row.ballsPerSecondUsed;
                    return {
                        matchNumber: row._id.matchNumber,
                        alliance: getAllianceFromRobotPosition(row._id.robotPosition),
                        robotPosition: row._id.robotPosition,
                        roleEstimate:
                            row.defenseProvided === 'heavy' ||
                            (row.defenseProvided === 'some' &&
                                rowEstimatedShotBalls < 22)
                                ? ('defense' as const)
                                : rowEstimatedShotBalls >=
                                      rowEstimatedPassBalls * 1.35
                                  ? ('primary_scorer' as const)
                                  : ('support' as const),
                        autoFuelScored: row.autoFuelScored,
                        teleFuelTotal: row.teleFuelTotal,
                        actualFuelTotal: row.autoFuelScored + row.teleFuelTotal,
                        estimatedFuelPoints:
                            rowEstimatedShotBalls *
                            gameConfig.scoring.fuelPointsActive,
                        defenseProvided: row.defenseProvided,
                        defenseReceived: row.defenseReceived,
                        foulsTotal: Object.values(row.fouls).reduce(
                            (sum, value) => sum + value,
                            0
                        ),
                        breaksTotal: Object.values(row.breaks).reduce(
                            (sum, value) => sum + value,
                            0
                        ),
                        breakdown: row.breakdown,
                        driverQuality: row.driverQuality,
                        timelineIntervalCount:
                            row.actionTimeline?.intervals.length ?? 0,
                    };
                })
                .sort((a, b) => a.matchNumber - b.matchNumber);

            const matchHistoryCount = Math.max(1, matchHistory.length);
            const rolePrimaryCount = matchHistory.filter(
                row => row.roleEstimate === 'primary_scorer'
            ).length;
            const roleSupportCount = matchHistory.filter(
                row => row.roleEstimate === 'support'
            ).length;
            const roleDefenseCount = matchHistory.filter(
                row => row.roleEstimate === 'defense'
            ).length;
            const defenseHeavyCount = matchHistory.filter(
                row => row.defenseProvided === 'heavy'
            ).length;
            const defenseSomeCount = matchHistory.filter(
                row => row.defenseProvided === 'some'
            ).length;
            const defensiveSampleCount = defenseHeavyCount + defenseSomeCount;
            const defensePlayEstimate = clamp(
                (defenseHeavyCount + defenseSomeCount * 0.55) / matchHistoryCount,
                0,
                1
            );
            const defenseImpactRaw = defensePlayEstimate * 0.4;
            const defenseImpactConfidence =
                defensiveSampleCount / (defensiveSampleCount + 6);

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
                roleTendencies: {
                    primaryScorerRate: rolePrimaryCount / matchHistoryCount,
                    supportRate: roleSupportCount / matchHistoryCount,
                    defenseRate: roleDefenseCount / matchHistoryCount,
                },
                defenseSummary: {
                    defenseHeavyRate: defenseHeavyCount / matchHistoryCount,
                    defenseSomeRate: defenseSomeCount / matchHistoryCount,
                    defensePlayEstimate,
                    defenseImpactRaw,
                    defenseImpactConfidence,
                    defenseEffectiveness:
                        defenseImpactRaw * defenseImpactConfidence,
                    defensiveSampleCount,
                    opponentSuppressionAvg: 0,
                },
                matchHistory,
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
                    bins: timelineBins,
                    binsByAlliance: {
                        red: timelineBinsRed,
                        blue: timelineBinsBlue,
                    },
                    rows: timelineRows,
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
    bins = 48
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

function buildTeamInsights(team: TeamProfilePayload | undefined) {
    if (!team) return [] as string[];
    const insights: string[] = [];

    const avgFuel = getMetricNumber(team.metrics.avgFuelPerMatch, 0);
    const reliability = getMetricNumber(team.metrics.reliabilityIndex, 0.5);
    const trend = getMetricNumber(team.metrics.expectedFuelTrendPerMatch, 0);
    const defensePlayRate = getMetricNumber(
        team.defenseSummary?.defensePlayEstimate,
        0
    );
    const defenseEffectiveness = getMetricNumber(
        team.defenseSummary?.defenseEffectiveness,
        0
    );

    if (avgFuel >= 22) {
        insights.push('Strong scoring floor with consistent fuel output.');
    } else if (avgFuel >= 14) {
        insights.push('Mid-tier scoring profile with useful alliance value.');
    } else {
        insights.push('Lower scoring ceiling; evaluate fit-based use cases.');
    }

    if (defensePlayRate >= 0.55 || defenseEffectiveness >= 0.35) {
        insights.push('Meaningful defensive involvement with positive suppression signal.');
    } else {
        insights.push('Defense appears situational rather than a primary role.');
    }

    const primaryRate = getMetricNumber(
        team.roleTendencies?.primaryScorerRate,
        0
    );
    const supportRate = getMetricNumber(team.roleTendencies?.supportRate, 0);
    if (primaryRate >= 0.5) {
        insights.push('Commonly operates as a primary scoring option.');
    } else if (supportRate >= 0.5) {
        insights.push('Most often contributes as support and ball movement.');
    } else {
        insights.push('Role usage is mixed across matches.');
    }

    if (reliability >= 0.85) {
        insights.push('High reliability profile with low disruption risk.');
    } else if (reliability <= 0.55) {
        insights.push('Reliability risk is elevated; check breakdown patterns.');
    }

    if (trend >= 0.15) {
        insights.push('Performance trend is notably positive over recent matches.');
    } else if (trend <= -0.15) {
        insights.push('Performance trend is declining; verify latest match context.');
    }

    return insights;
}

function PicklistApp() {
    const [analyzedPayload, reloadAnalyzedPayload] = useFetchJson<PicklistPayload>(
        '/data/retrieve/analyzed'
    );
    const [localAnalyzedPayload, reloadLocalAnalyzedPayload] =
        useFetchJson<PicklistPayload>('/06_picklist_payload.local.json');
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
    const [timelineAllianceFilter, setTimelineAllianceFilter] =
        useState<AllianceFilter>('all');
    const [autoAllianceFilter, setAutoAllianceFilter] =
        useState<AllianceFilter>('all');
    const [selectedTeamNumber, setSelectedTeamNumber] = useState<number>();

    const livePayload = useMemo(() => {
        if (!matchAgg || !matchRows) return undefined;
        return toPayloadFromLive(matchAgg, matchRows);
    }, [matchAgg, matchRows]);

    const resolvedAnalyzedPayload = analyzedPayload ?? localAnalyzedPayload;
    const payload = resolvedAnalyzedPayload ?? (useLiveFallback ? livePayload : undefined);
    const sourceLabel = analyzedPayload
        ? `Analyzed payload (${analyzedPayload.sourceMode}${
              analyzedPayload.analysisRunId
                  ? ` • ${analyzedPayload.analysisRunId}`
                  : ''
          })`
        : localAnalyzedPayload
          ? `Local analyzed copy (${localAnalyzedPayload.sourceMode}${
                localAnalyzedPayload.analysisRunId
                    ? ` • ${localAnalyzedPayload.analysisRunId}`
                    : ''
            })`
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
        reloadLocalAnalyzedPayload();
        reloadMatchAgg();
        reloadMatchRows();
        reloadPitData();
    };

    const timelineTotalSec = selectedTeam?.timeline.totalSec ?? gameConfig.matchDurationSec;
    const timelineBinSec = Math.max(1, selectedTeam?.timeline.binSec ?? 1);
    const timelineRows = selectedTeam?.timeline.rows ?? [];
    const timelineRowsFiltered = useMemo(
        () =>
            timelineRows.filter(row =>
                isAllianceIncluded(row, timelineAllianceFilter)
            ),
        [timelineAllianceFilter, timelineRows]
    );
    const timelineChartData = useMemo(() => {
        if (!selectedTeam) return [];

        const fallbackFromRows = buildTimelineBins(
            timelineRowsFiltered,
            timelineTotalSec,
            timelineBinSec
        );

        if (timelineAllianceFilter === 'all') {
            return selectedTeam.timeline.bins.length
                ? selectedTeam.timeline.bins
                : fallbackFromRows;
        }

        const binsByAlliance = selectedTeam.timeline.binsByAlliance?.[
            timelineAllianceFilter
        ];
        if (binsByAlliance && binsByAlliance.length) {
            return binsByAlliance;
        }
        return fallbackFromRows;
    }, [
        selectedTeam,
        timelineRowsFiltered,
        timelineTotalSec,
        timelineBinSec,
        timelineAllianceFilter,
    ]);
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
    const timelineHeatmapRows = useMemo(
        () =>
            buildTimelineHeatmapRows(
                timelineRowsFiltered,
                activeTimelineMetric,
                timelineTotalSec,
                timelineBinSec
            ),
        [
            timelineRowsFiltered,
            activeTimelineMetric,
            timelineTotalSec,
            timelineBinSec,
        ]
    );
    const timelineHeatmapMax = useMemo(
        () =>
            Math.max(
                0.000001,
                ...timelineHeatmapRows.flatMap(row => row.values),
                0
            ),
        [timelineHeatmapRows]
    );
    const selectedTeamAutoPaths = useMemo(() => {
        if (!selectedTeam) return [];
        if (autoAllianceFilter === 'all') return selectedTeam.autoPaths;
        return selectedTeam.autoPaths.filter(
            path => path.alliance === autoAllianceFilter
        );
    }, [selectedTeam, autoAllianceFilter]);
    const autoPathDensity = useMemo(
        () => buildDensityGrid(selectedTeamAutoPaths, 52),
        [selectedTeamAutoPaths]
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
                      .map(team => getMetricNumber(team.metrics.avgFuelPerMatch))
                      .filter((value): value is number => Number.isFinite(value))
              )
            : 0;

    const selectedTeamInfo = selectedTeam
        ? teamInfo[selectedTeam.teamNumber.toString()]?.info
        : undefined;
    const selectedTeamInsights = useMemo(
        () => buildTeamInsights(selectedTeam),
        [selectedTeam]
    );

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
                        {!resolvedAnalyzedPayload && (
                            <p className='text-amber-300'>
                                Analyzed payload not found via API or local copy; fallback is
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
                        <div className='flex flex-wrap items-center justify-between gap-3'>
                            <div>
                                <h2 className='text-xl font-semibold text-[#48c55c]'>Team Profile</h2>
                                <p className='mt-1 text-sm text-gray-300'>
                                    Team {selectedTeam.teamNumber} metrics and match log.
                                </p>
                            </div>
                            <button
                                type='button'
                                className='rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10'
                                onClick={() => setTab('auto_paths')}>
                                View Auto Paths
                            </button>
                        </div>

                        <div className='mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                            <div className='rounded-lg border border-white/10 bg-[#101827] p-3'>
                                <p className='text-xs uppercase text-gray-400'>Pick Score</p>
                                <p className='text-2xl font-semibold'>{selectedTeam.score.toFixed(2)}</p>
                            </div>
                            <div className='rounded-lg border border-white/10 bg-[#101827] p-3'>
                                <p className='text-xs uppercase text-gray-400'>Matches</p>
                                <p className='text-2xl font-semibold'>{selectedTeam.matchCount}</p>
                            </div>
                            <div className='rounded-lg border border-white/10 bg-[#101827] p-3'>
                                <p className='text-xs uppercase text-gray-400'>Defense Eff.</p>
                                <p className='text-2xl font-semibold'>
                                    {formatMetric(selectedTeam.defenseSummary?.defenseEffectiveness)}
                                </p>
                            </div>
                            <div className='rounded-lg border border-white/10 bg-[#101827] p-3'>
                                <p className='text-xs uppercase text-gray-400'>Trend</p>
                                <p className='text-2xl font-semibold'>
                                    {formatMetric(selectedTeam.metrics.expectedFuelTrendPerMatch)}
                                </p>
                            </div>
                        </div>

                        <div className='mt-4 grid gap-3 lg:grid-cols-2'>
                            <div className='rounded-lg border border-white/10 bg-[#101827] p-3 text-sm'>
                                <p className='font-semibold text-white'>Role Tendencies</p>
                                <p>
                                    Primary Scorer:{' '}
                                    <span className='font-mono'>
                                        {formatMetric(selectedTeam.roleTendencies?.primaryScorerRate)}
                                    </span>
                                </p>
                                <p>
                                    Support:{' '}
                                    <span className='font-mono'>
                                        {formatMetric(selectedTeam.roleTendencies?.supportRate)}
                                    </span>
                                </p>
                                <p>
                                    Defense:{' '}
                                    <span className='font-mono'>
                                        {formatMetric(selectedTeam.roleTendencies?.defenseRate)}
                                    </span>
                                </p>
                            </div>
                            <div className='rounded-lg border border-white/10 bg-[#101827] p-3 text-sm'>
                                <p className='font-semibold text-white'>Defense Summary</p>
                                <p>
                                    Play Estimate:{' '}
                                    <span className='font-mono'>
                                        {formatMetric(selectedTeam.defenseSummary?.defensePlayEstimate)}
                                    </span>
                                </p>
                                <p>
                                    Effectiveness:{' '}
                                    <span className='font-mono'>
                                        {formatMetric(selectedTeam.defenseSummary?.defenseEffectiveness)}
                                    </span>
                                </p>
                                <p>
                                    Confidence:{' '}
                                    <span className='font-mono'>
                                        {formatMetric(selectedTeam.defenseSummary?.defenseImpactConfidence)}
                                    </span>
                                </p>
                                <p>
                                    Defensive Samples:{' '}
                                    <span className='font-mono'>
                                        {formatMetric(selectedTeam.defenseSummary?.defensiveSampleCount)}
                                    </span>
                                </p>
                            </div>
                        </div>

                        {selectedTeamInsights.length > 0 && (
                            <div className='mt-4 rounded-lg border border-white/10 bg-[#101827] p-3 text-sm'>
                                <p className='font-semibold text-white'>Summary Insights</p>
                                <ul className='mt-2 list-disc space-y-1 pl-5 text-gray-200'>
                                    {selectedTeamInsights.map((insight, index) => (
                                        <li key={`insight-${index}`}>{insight}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

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

                        <div className='mt-4 rounded-lg border border-white/10 bg-[#101827] p-3'>
                            <div className='flex items-center justify-between gap-2'>
                                <p className='font-semibold text-white'>Match History</p>
                                <p className='text-xs text-gray-300'>
                                    {(selectedTeam.matchHistory ?? []).length} rows
                                </p>
                            </div>
                            <div className='mt-3 max-h-[340px] overflow-auto'>
                                <table className='w-full min-w-[980px] text-left text-xs'>
                                    <thead>
                                        <tr className='border-b border-white/10 text-gray-400'>
                                            <th className='py-2'>Match</th>
                                            <th className='py-2'>Alliance</th>
                                            <th className='py-2'>Position</th>
                                            <th className='py-2'>Role</th>
                                            <th className='py-2'>Fuel Total</th>
                                            <th className='py-2'>Est. Points</th>
                                            <th className='py-2'>Defense</th>
                                            <th className='py-2'>Defended</th>
                                            <th className='py-2'>Fouls</th>
                                            <th className='py-2'>Breaks</th>
                                            <th className='py-2'>Breakdown</th>
                                            <th className='py-2'>Driver</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(selectedTeam.matchHistory ?? []).map(historyRow => (
                                            <tr
                                                key={`history-${historyRow.matchNumber}`}
                                                className='border-b border-white/5'>
                                                <td className='py-2'>{historyRow.matchNumber}</td>
                                                <td className='py-2'>
                                                    {formatAllianceLabel(historyRow.alliance)}
                                                </td>
                                                <td className='py-2'>{historyRow.robotPosition}</td>
                                                <td className='py-2'>{historyRow.roleEstimate}</td>
                                                <td className='py-2'>
                                                    {historyRow.actualFuelTotal.toFixed(2)}
                                                </td>
                                                <td className='py-2'>
                                                    {historyRow.estimatedFuelPoints.toFixed(2)}
                                                </td>
                                                <td className='py-2'>{historyRow.defenseProvided}</td>
                                                <td className='py-2'>
                                                    {historyRow.defenseReceived ? 'Yes' : 'No'}
                                                </td>
                                                <td className='py-2'>
                                                    {historyRow.foulsTotal.toFixed(0)}
                                                </td>
                                                <td className='py-2'>
                                                    {historyRow.breaksTotal.toFixed(0)}
                                                </td>
                                                <td className='py-2'>{historyRow.breakdown}</td>
                                                <td className='py-2'>{historyRow.driverQuality}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
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
                        <div className='mt-3 flex flex-wrap items-center gap-2 text-xs'>
                            <p className='text-gray-300'>Alliance Filter:</p>
                            {(['all', 'red', 'blue'] as const).map(option => (
                                <button
                                    key={`timeline-filter-${option}`}
                                    type='button'
                                    onClick={() => setTimelineAllianceFilter(option)}
                                    className={`rounded-lg px-2.5 py-1.5 font-semibold ${
                                        timelineAllianceFilter === option
                                            ? 'bg-[#48c55c] text-black'
                                            : 'bg-[#2a3449] text-white'
                                    }`}>
                                    {option.toUpperCase()}
                                </button>
                            ))}
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
                                            return `t=${value}-${value + timelineBinSec}s`;
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
                                Cross-match timeline density for the selected metric.
                            </p>
                            <div className='mt-3 max-h-[360px] overflow-auto'>
                                {timelineHeatmapRows.length === 0 ? (
                                    <p className='text-sm text-gray-400'>
                                        No timeline rows available for the selected filter.
                                    </p>
                                ) : (
                                    <div className='min-w-[900px] space-y-1.5'>
                                        {timelineHeatmapRows.map(row => (
                                            <div
                                                key={`timeline-heat-${row.matchNumber}`}
                                                className='grid items-center gap-2'
                                                style={{
                                                    gridTemplateColumns:
                                                        '110px minmax(0, 1fr)',
                                                }}>
                                                <p className='text-xs text-gray-300'>
                                                    M{row.matchNumber} •{' '}
                                                    {formatAllianceLabel(row.alliance)}
                                                </p>
                                                <div
                                                    className='grid gap-[1px]'
                                                    style={{
                                                        gridTemplateColumns: `repeat(${Math.max(
                                                            1,
                                                            row.values.length
                                                        )}, minmax(0, 1fr))`,
                                                    }}>
                                                    {row.values.map((value, index) => {
                                                        const intensity = clamp(
                                                            value / timelineHeatmapMax,
                                                            0,
                                                            1
                                                        );
                                                        return (
                                                            <div
                                                                key={`timeline-cell-${row.matchNumber}-${index}`}
                                                                className='h-3 rounded-[2px]'
                                                                title={`Match ${row.matchNumber}, t=${
                                                                    index * timelineBinSec
                                                                }-${Math.min(
                                                                    timelineTotalSec,
                                                                    (index + 1) * timelineBinSec
                                                                )}s`}
                                                                style={{
                                                                    background: `rgba(72, 197, 92, ${
                                                                        0.08 + intensity * 0.88
                                                                    })`,
                                                                }}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {tab === 'auto_paths' && selectedTeam && (
                    <section className={sectionClass}>
                        <h2 className='text-xl font-semibold text-[#48c55c]'>Auto Paths</h2>
                        <p className='mt-1 text-sm text-gray-300'>
                            High-resolution canonical heatmap and shot markers.
                        </p>
                        <div className='mt-3 flex flex-wrap items-center gap-2 text-xs'>
                            <p className='text-gray-300'>Alliance Filter:</p>
                            {(['all', 'red', 'blue'] as const).map(option => (
                                <button
                                    key={`auto-filter-${option}`}
                                    type='button'
                                    onClick={() => setAutoAllianceFilter(option)}
                                    className={`rounded-lg px-2.5 py-1.5 font-semibold ${
                                        autoAllianceFilter === option
                                            ? 'bg-[#48c55c] text-black'
                                            : 'bg-[#2a3449] text-white'
                                    }`}>
                                    {option.toUpperCase()}
                                </button>
                            ))}
                        </div>

                        <div className='mt-4 overflow-hidden rounded-lg border border-white/15 bg-[#101826]'>
                            <div className='relative'>
                                <img src='/redsidematch.png' alt='Auto field' className='block w-full select-none' draggable={false} />
                                <svg viewBox='0 0 1000 1000' preserveAspectRatio='none' className='pointer-events-none absolute inset-0'>
                                    {(() => {
                                        const cellSize = 1000 / autoPathDensity.bins;
                                        return (
                                            <>
                                                {autoPathDensity.values.map((value, index) => {
                                                    if (value === 0 || autoPathDensity.max === 0) return null;
                                                    const intensity = value / autoPathDensity.max;
                                                    const x = (index % autoPathDensity.bins) * cellSize;
                                                    const y = Math.floor(index / autoPathDensity.bins) * cellSize;
                                                    return (
                                                        <rect
                                                            key={`auto-cell-${index}`}
                                                            x={x}
                                                            y={y}
                                                            width={cellSize}
                                                            height={cellSize}
                                                            fill={`rgba(245, 158, 11, ${0.05 + intensity * 0.8})`}
                                                        />
                                                    );
                                                })}
                                                {selectedTeamAutoPaths.flatMap((path, pathIndex) =>
                                                    path.shotMarkers.map((marker, markerIndex) => (
                                                        <circle
                                                            key={`shot-${pathIndex}-${markerIndex}`}
                                                            cx={marker.x * 1000}
                                                            cy={marker.y * 1000}
                                                            r='5'
                                                            fill='rgba(72, 197, 92, 0.98)'
                                                            stroke='rgba(0,0,0,0.7)'
                                                            strokeWidth='1.5'
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
                            {selectedTeamAutoPaths.length} auto traces for {autoAllianceFilter.toUpperCase()} filter.
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

