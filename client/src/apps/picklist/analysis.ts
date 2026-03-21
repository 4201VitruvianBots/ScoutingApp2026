import {
    MatchDataAggregations,
    MatchIndividualDataAggregations,
    PitResult,
    TeamData,
} from 'requests';
import { AnalysisEntry } from './data';

function mean(values: number[]) {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

export function getNumericMetricColumns(
    data: AnalysisEntry[],
    includeLowVariance = false
) {
    const keys = Array.from(
        new Set(
            data.flatMap(entry =>
                Object.keys(entry).filter(
                    key =>
                        key !== 'teamNumber' &&
                        typeof entry[key] === 'number' &&
                        Number.isFinite(entry[key] as number)
                )
            )
        )
    );

    return keys
        .filter(key => {
            const values = data
                .map(entry => entry[key])
                .filter((value): value is number => typeof value === 'number');
            if (!values.length) return false;
            if (includeLowVariance) return true;
            return Math.max(...values) - Math.min(...values) > 1e-9;
        })
        .sort((a, b) => a.localeCompare(b));
}

type BuildAnalyzedDataArgs = {
    matchAgg: MatchDataAggregations[];
    matchIndividual: MatchIndividualDataAggregations[];
    pitData: PitResult;
    teamInfo: TeamData;
};

export function buildAnalyzedData({
    matchAgg,
    matchIndividual,
    pitData,
    teamInfo,
}: BuildAnalyzedDataArgs): AnalysisEntry[] {
    const byTeam = new Map<number, MatchIndividualDataAggregations[]>();
    matchIndividual.forEach(row => {
        const list = byTeam.get(row._id.teamNumber) ?? [];
        list.push(row);
        byTeam.set(row._id.teamNumber, list);
    });

    return matchAgg
        .map(entry => {
            const teamNumber = entry._id.teamNumber;
            const rows = (byTeam.get(teamNumber) ?? []).filter(row => !row.robotAbsent);
            const shootHeldSec = mean(rows.map(row => row.shootTimeBySegment.auto + row.shootTimeBySegment.transition + row.shootTimeBySegment.shift1 + row.shootTimeBySegment.shift2 + row.shootTimeBySegment.shift3 + row.shootTimeBySegment.shift4 + row.shootTimeBySegment.endgame));
            const passHeldSec = mean(rows.map(row => row.passTimeBySegment.auto + row.passTimeBySegment.transition + row.passTimeBySegment.shift1 + row.passTimeBySegment.shift2 + row.passTimeBySegment.shift3 + row.passTimeBySegment.shift4 + row.passTimeBySegment.endgame));
            const ballsPerSecond = mean(rows.map(row => row.ballsPerSecondUsed));
            const estimatedShotBalls = shootHeldSec * ballsPerSecond;
            const estimatedPassBalls = passHeldSec * ballsPerSecond;
            const score = clamp(
                50 +
                    entry.avgFuelTotal * 1.5 +
                    entry.avgShootActiveSec * 0.8 -
                    entry.avgFoulsTotal * 2 -
                    entry.avgBreaksTotal * 2,
                0,
                100
            );

            return {
                teamNumber,
                matchCount: entry.matchCount,
                avgFuelTotal: entry.avgFuelTotal,
                avgAutoFuel: entry.avgAutoFuel,
                avgTeleFuelTotal: entry.avgTeleFuelTotal,
                avgShootActiveSec: entry.avgShootActiveSec,
                avgPassActiveSec: entry.avgPassActiveSec,
                avgFoulsTotal: entry.avgFoulsTotal,
                avgBreaksTotal: entry.avgBreaksTotal,
                defenseHeavyRate: entry.defenseHeavyRate,
                defenseSomeRate: entry.defenseSomeRate,
                defenseReceivedRate: entry.defenseReceivedRate,
                timelineMatchCount: entry.timelineMatchCount,
                shootHeldSec,
                passHeldSec,
                estimatedShotBalls,
                estimatedPassBalls,
                estimatedFuelPoints: estimatedShotBalls,
                pitBatteryCount: pitData[teamNumber]?.batteryCount ?? 0,
                pitMaxFuelStorageEstimate: pitData[teamNumber]?.maxFuelStorageEstimate ?? 0,
                yearsActive: teamInfo?.[teamNumber.toString()]?.info?.rookie_year
                    ? Math.max(0, new Date().getFullYear() - (teamInfo?.[teamNumber.toString()]?.info?.rookie_year ?? new Date().getFullYear()))
                    : 0,
                selectionScore: score,
            } satisfies AnalysisEntry;
        })
        .sort((a, b) => a.teamNumber - b.teamNumber);
}
