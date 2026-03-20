import {
    MatchDataAggregations,
    MatchIndividualDataAggregations,
    PitResult,
    SuperDataAggregations,
    SuperIndividualDataAggregations,
    TeamData,
    TeleTowerResult,
} from 'requests';
import { gameConfig } from '../../lib/gameConfig';
import { AnalysisEntry } from './data';

type NumberList = number[];

function clamp(value: number, minValue: number, maxValue: number) {
    return Math.max(minValue, Math.min(maxValue, value));
}

function safeDiv(numerator: number, denominator: number) {
    return denominator === 0 ? 0 : numerator / denominator;
}

function mean(values: NumberList) {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: NumberList) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1]! + sorted[mid]!) / 2;
    }
    return sorted[mid]!;
}

function stdDev(values: NumberList) {
    if (values.length <= 1) return 0;
    const m = mean(values);
    const variance =
        values.reduce((sum, value) => sum + (value - m) ** 2, 0) / values.length;
    return Math.sqrt(variance);
}

function quantile(values: NumberList, q: number) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * q;
    const low = Math.floor(pos);
    const high = Math.ceil(pos);
    if (low === high) return sorted[low]!;
    const lowVal = sorted[low]!;
    const highVal = sorted[high]!;
    return lowVal + (highVal - lowVal) * (pos - low);
}

function coefficientOfVariation(values: NumberList) {
    if (values.length <= 1) return 0;
    const magnitude = Math.abs(mean(values));
    if (magnitude < 1e-9) return 2.5;
    return Math.min(2.5, stdDev(values) / magnitude);
}

function zScore(value: number, values: NumberList) {
    const m = mean(values);
    const sd = stdDev(values);
    if (sd === 0) return 0;
    return (value - m) / sd;
}

function allianceFromRobotPosition(robotPosition: string) {
    return robotPosition.startsWith('red') ? 'red' : 'blue';
}

function totalTeleFuel(entry: MatchIndividualDataAggregations) {
    return (
        entry.teleFuelBySegment.transition +
        entry.teleFuelBySegment.shift1 +
        entry.teleFuelBySegment.shift2 +
        entry.teleFuelBySegment.shift3 +
        entry.teleFuelBySegment.shift4 +
        entry.teleFuelBySegment.endgame
    );
}

function climbPoints(teleTower: TeleTowerResult) {
    const points = gameConfig.scoring.towerTele;
    if (teleTower === 'level1') return points.level1;
    if (teleTower === 'level2') return points.level2;
    if (teleTower === 'level3') return points.level3;
    return 0;
}

function autoTowerPoints(autoTower: MatchIndividualDataAggregations['autoTower']) {
    if (autoTower === 'level1') return gameConfig.scoring.towerAuto.level1;
    return 0;
}

function expectedPointsFromMatch(entry: MatchIndividualDataAggregations) {
    return (
        (entry.autoFuelScored + entry.teleFuelActiveComputed) *
            gameConfig.scoring.fuelPointsActive +
        autoTowerPoints(entry.autoTower) +
        climbPoints(entry.teleTower)
    );
}

function linearRegression(points: Array<{ x: number; y: number }>) {
    if (points.length <= 1) {
        return { slope: 0, intercept: points[0]?.y ?? 0, r: 0 };
    }
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    const xMean = mean(xs);
    const yMean = mean(ys);
    const xVar = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);
    if (xVar === 0) return { slope: 0, intercept: yMean, r: 0 };
    const covariance = points.reduce(
        (sum, point) => sum + (point.x - xMean) * (point.y - yMean),
        0
    );
    const slope = covariance / xVar;
    const intercept = yMean - slope * xMean;
    const yVar = ys.reduce((sum, y) => sum + (y - yMean) ** 2, 0);
    const r = xVar === 0 || yVar === 0 ? 0 : covariance / Math.sqrt(xVar * yVar);
    return { slope, intercept, r };
}

function toTeamMap<T extends { _id: { teamNumber: number } }>(rows: T[]) {
    return new Map(rows.map(row => [row._id.teamNumber, row]));
}

function groupByTeam<T>(
    rows: T[],
    teamGetter: (row: T) => number | undefined
): Map<number, T[]> {
    const grouped = new Map<number, T[]>();
    rows.forEach(row => {
        const teamNumber = teamGetter(row);
        if (teamNumber === undefined) return;
        const current = grouped.get(teamNumber) ?? [];
        current.push(row);
        grouped.set(teamNumber, current);
    });
    return grouped;
}

function groupByMatch(
    rows: MatchIndividualDataAggregations[]
): Map<number, MatchIndividualDataAggregations[]> {
    const grouped = new Map<number, MatchIndividualDataAggregations[]>();
    rows.forEach(row => {
        const matchNumber = row._id.matchNumber;
        const current = grouped.get(matchNumber) ?? [];
        current.push(row);
        grouped.set(matchNumber, current);
    });
    return grouped;
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
    superAgg: SuperDataAggregations[];
    matchIndividual: MatchIndividualDataAggregations[];
    superIndividual: SuperIndividualDataAggregations[];
    pitData: PitResult;
    teamInfo: TeamData;
};

export function buildAnalyzedData({
    matchAgg,
    superAgg,
    matchIndividual,
    superIndividual,
    pitData,
    teamInfo,
}: BuildAnalyzedDataArgs): AnalysisEntry[] {
    const matchAggByTeam = toTeamMap(matchAgg);
    const superAggByTeam = toTeamMap(superAgg);
    const matchIndividualByTeam = groupByTeam(
        matchIndividual,
        entry => entry._id.teamNumber
    );
    const superIndividualByTeam = groupByTeam(
        superIndividual,
        entry => entry._id.teamNumber
    );
    const matchRowsByMatch = groupByMatch(
        matchIndividual.filter(entry => !entry.robotAbsent)
    );

    const teams = new Set<number>();
    matchAgg.forEach(entry => teams.add(entry._id.teamNumber));
    superAgg.forEach(entry => teams.add(entry._id.teamNumber));
    matchIndividual.forEach(entry => teams.add(entry._id.teamNumber));
    superIndividual.forEach(entry => teams.add(entry._id.teamNumber));
    Object.keys(pitData).forEach(key => {
        const teamNumber = Number(key);
        if (Number.isFinite(teamNumber)) teams.add(teamNumber);
    });

    const baselineExpectedPoints = new Map<number, number>();
    teams.forEach(teamNumber => {
        const rows = (matchIndividualByTeam.get(teamNumber) ?? []).filter(
            entry => !entry.robotAbsent
        );
        const values = rows.map(expectedPointsFromMatch);
        const fallback = matchAggByTeam.get(teamNumber);
        const fallbackExpected = fallback
            ? (fallback.avgAutoFuel + fallback.avgTeleFuelActiveComputed) *
                  gameConfig.scoring.fuelPointsActive +
              fallback.autoTowerLevel1Rate * gameConfig.scoring.towerAuto.level1 +
              fallback.climbRateLevel1 * gameConfig.scoring.towerTele.level1 +
              fallback.climbRateLevel2 * gameConfig.scoring.towerTele.level2 +
              fallback.climbRateLevel3 * gameConfig.scoring.towerTele.level3
            : 0;
        baselineExpectedPoints.set(
            teamNumber,
            values.length ? mean(values) : fallbackExpected
        );
    });

    const fieldExpectedMean = mean(Array.from(baselineExpectedPoints.values()));
    const rows: AnalysisEntry[] = [];

    teams.forEach(teamNumber => {
        const matchEntry = matchAggByTeam.get(teamNumber);
        const superEntry = superAggByTeam.get(teamNumber);
        const matchRows = (matchIndividualByTeam.get(teamNumber) ?? []).filter(
            entry => !entry.robotAbsent
        );
        const superRows = superIndividualByTeam.get(teamNumber) ?? [];

        const expectedPointsValues = matchRows.map(expectedPointsFromMatch);
        const teleTotalValues = matchRows.map(totalTeleFuel);
        const climbValues = matchRows.map(entry => climbPoints(entry.teleTower));
        const foulValues = superRows.map(
            entry =>
                entry.fouls.pinning +
                entry.fouls.towerContactInEndgame +
                entry.fouls.outOfZoneShooting +
                entry.fouls.ejectedFuel +
                entry.fouls.other
        );

        const estimatedExpectedPoints =
            baselineExpectedPoints.get(teamNumber) ?? 0;
        const expectedMean = expectedPointsValues.length
            ? mean(expectedPointsValues)
            : estimatedExpectedPoints;
        const expectedMedian = expectedPointsValues.length
            ? median(expectedPointsValues)
            : estimatedExpectedPoints;
        const expectedStd = expectedPointsValues.length
            ? stdDev(expectedPointsValues)
            : 0;
        const expectedQ1 = expectedPointsValues.length
            ? quantile(expectedPointsValues, 0.25)
            : estimatedExpectedPoints;
        const expectedQ3 = expectedPointsValues.length
            ? quantile(expectedPointsValues, 0.75)
            : estimatedExpectedPoints;

        const consistencyPieces = [
            Math.exp(-coefficientOfVariation(expectedPointsValues)),
            Math.exp(-coefficientOfVariation(teleTotalValues)),
            Math.exp(-coefficientOfVariation(climbValues)),
        ];
        if (foulValues.length) {
            consistencyPieces.push(Math.exp(-coefficientOfVariation(foulValues)));
        }
        const consistencyScore = mean(consistencyPieces) * 100;

        const defenseEvents: number[] = [];
        let defendedMatches = 0;
        superRows.forEach(superRow => {
            if (
                superRow.defenseProvided !== 'some' &&
                superRow.defenseProvided !== 'heavy'
            ) {
                return;
            }
            const ownMatch = matchRows.find(
                matchRow => matchRow._id.matchNumber === superRow._id.matchNumber
            );
            if (!ownMatch) return;
            const matchEntries = matchRowsByMatch.get(superRow._id.matchNumber) ?? [];
            const ownAlliance = allianceFromRobotPosition(ownMatch._id.robotPosition);
            const opponents = matchEntries.filter(
                matchRow =>
                    allianceFromRobotPosition(matchRow._id.robotPosition) !== ownAlliance
            );
            if (!opponents.length) return;
            const suppressions = opponents.map(opponent => {
                const baseline = baselineExpectedPoints.get(opponent._id.teamNumber) ?? 0;
                const observed = expectedPointsFromMatch(opponent);
                return baseline - observed;
            });
            if (!suppressions.length) return;
            const weight = superRow.defenseProvided === 'heavy' ? 1 : 0.6;
            defenseEvents.push(mean(suppressions) * weight);
            defendedMatches += 1;
        });

        const defenseImpactExpectedPoints = defenseEvents.length
            ? mean(defenseEvents)
            : 0;
        const defenseImpactStdev = defenseEvents.length
            ? stdDev(defenseEvents)
            : 0;
        const defenseImpactConfidence = 1 - Math.exp(-safeDiv(defendedMatches, 3));
        const defenseImpactScore = clamp(
            50 +
                50 *
                    Math.tanh(
                        safeDiv(
                            defenseImpactExpectedPoints * defenseImpactConfidence,
                            12
                        )
                    ),
            0,
            100
        );

        const trend = linearRegression(
            matchRows.map(matchRow => ({
                x: matchRow._id.matchNumber,
                y: expectedPointsFromMatch(matchRow),
            }))
        );

        const avgAutoFuel = matchEntry?.avgAutoFuel ?? 0;
        const avgTeleFuelTransition = matchEntry?.avgTeleFuelTransition ?? 0;
        const avgTeleFuelShift1 = matchEntry?.avgTeleFuelShift1 ?? 0;
        const avgTeleFuelShift2 = matchEntry?.avgTeleFuelShift2 ?? 0;
        const avgTeleFuelShift3 = matchEntry?.avgTeleFuelShift3 ?? 0;
        const avgTeleFuelShift4 = matchEntry?.avgTeleFuelShift4 ?? 0;
        const avgTeleFuelEndgame = matchEntry?.avgTeleFuelEndgame ?? 0;
        const avgTeleFuelTotal =
            avgTeleFuelTransition +
            avgTeleFuelShift1 +
            avgTeleFuelShift2 +
            avgTeleFuelShift3 +
            avgTeleFuelShift4 +
            avgTeleFuelEndgame;
        const avgFuelTotal = avgAutoFuel + avgTeleFuelTotal;
        const avgTeleFuelActiveComputed =
            matchEntry?.avgTeleFuelActiveComputed ?? 0;
        const avgTeleFuelWastedComputed =
            matchEntry?.avgTeleFuelWastedComputed ?? 0;
        const teleFuelActiveRate = avgTeleFuelTotal
            ? avgTeleFuelActiveComputed / avgTeleFuelTotal
            : 0;
        const teleFuelEfficiency =
            avgTeleFuelActiveComputed + avgTeleFuelWastedComputed
                ? avgTeleFuelActiveComputed /
                  (avgTeleFuelActiveComputed + avgTeleFuelWastedComputed)
                : 0;
        const climbFailRate = matchEntry?.climbFailRate ?? 0;
        const climbRateLevel2 = matchEntry?.climbRateLevel2 ?? 0;
        const climbRateLevel3 = matchEntry?.climbRateLevel3 ?? 0;
        const breakdownRate = matchEntry?.breakdownRate ?? 0;

        const avgFoulsTotal = superEntry?.avgFoulsTotal ?? 0;
        const defenseHeavyRate = superEntry?.defenseHeavyRate ?? 0;
        const defenseSomeRate = superEntry?.defenseSomeRate ?? 0;
        const breakRateAny = superEntry?.breakRateAny ?? 0;

        const pitBatteryCount = pitData[teamNumber]?.batteryCount ?? 0;
        const pitMaxFuelStorageEstimate =
            pitData[teamNumber]?.maxFuelStorageEstimate ?? 0;
        const pitIsSwerve = pitData[teamNumber]?.drivebase === 'swerve';
        const rookieYear = teamInfo?.[teamNumber.toString()]?.info?.rookie_year ?? 0;
        const yearsActive = rookieYear
            ? Math.max(0, new Date().getFullYear() - rookieYear)
            : 0;

        rows.push({
            teamNumber,
            avgAutoFuel,
            avgTeleFuelTransition,
            avgTeleFuelShift1,
            avgTeleFuelShift2,
            avgTeleFuelShift3,
            avgTeleFuelShift4,
            avgTeleFuelEndgame,
            avgTeleFuelActiveComputed,
            avgTeleFuelWastedComputed,
            avgTeleFuelTotal,
            avgFuelTotal,
            teleFuelActiveRate,
            teleFuelEfficiency,
            climbRateLevel1: matchEntry?.climbRateLevel1 ?? 0,
            climbRateLevel2,
            climbRateLevel3,
            climbFailRate,
            climbNoAttemptRate: matchEntry?.climbNoAttemptRate ?? 0,
            climbAttemptRate: matchEntry?.climbAttemptRate ?? 0,
            climbTimeEarlyRate: matchEntry?.climbTimeEarlyRate ?? 0,
            climbTimeMidRate: matchEntry?.climbTimeMidRate ?? 0,
            climbTimeLateRate: matchEntry?.climbTimeLateRate ?? 0,
            climbTimeKnownRate: matchEntry?.climbTimeKnownRate ?? 0,
            climbSuccessRate: Math.max(0, 1 - climbFailRate),
            climbLevel2PlusRate: climbRateLevel2 + climbRateLevel3,
            breakdownRate,
            reliabilityScore: Math.max(0, 1 - breakdownRate),
            breakdownRateStuck: matchEntry?.breakdownRateStuck ?? 0,
            breakdownRateTipped: matchEntry?.breakdownRateTipped ?? 0,
            breakdownRateComms: matchEntry?.breakdownRateComms ?? 0,
            breakdownRateMechanism: matchEntry?.breakdownRateMechanism ?? 0,
            breakdownRateOther: matchEntry?.breakdownRateOther ?? 0,
            timelineMatchCount: matchEntry?.timelineMatchCount ?? 0,
            avgShootActiveSec: matchEntry?.avgShootActiveSec ?? 0,
            avgPassActiveSec: matchEntry?.avgPassActiveSec ?? 0,
            avgShootIntervalsPerMatch: matchEntry?.avgShootIntervalsPerMatch ?? 0,
            avgPassIntervalsPerMatch: matchEntry?.avgPassIntervalsPerMatch ?? 0,
            avgShootIntervalDurationSec:
                matchEntry?.avgShootIntervalDurationSec ?? 0,
            avgPassIntervalDurationSec:
                matchEntry?.avgPassIntervalDurationSec ?? 0,
            avgShootCycleGapSec: matchEntry?.avgShootCycleGapSec ?? 0,
            driverQualityGreatRate: matchEntry?.driverQualityGreatRate ?? 0,
            driverQualityGoodRate: matchEntry?.driverQualityGoodRate ?? 0,
            driverQualityOkRate: matchEntry?.driverQualityOkRate ?? 0,
            driverQualityRoughRate: matchEntry?.driverQualityRoughRate ?? 0,
            driverQualityScoreAvg: matchEntry?.driverQualityScoreAvg ?? 0,
            matchCount: matchEntry?.matchCount ?? matchRows.length,
            avgFoulsTotal,
            foulRatePinning: superEntry?.foulRatePinning ?? 0,
            foulRateTowerContactInEndgame:
                superEntry?.foulRateTowerContactInEndgame ?? 0,
            foulRateOutOfZoneShooting:
                superEntry?.foulRateOutOfZoneShooting ?? 0,
            foulRateEjectedFuel: superEntry?.foulRateEjectedFuel ?? 0,
            foulRateOther: superEntry?.foulRateOther ?? 0,
            avgHumanPlayerFuelScored: superEntry?.avgHumanPlayerFuelScored ?? 0,
            avgBreaksTotal: superEntry?.avgBreaksTotal ?? 0,
            avgBreaksMechanism: superEntry?.avgBreaksMechanism ?? 0,
            avgBreaksBattery: superEntry?.avgBreaksBattery ?? 0,
            avgBreaksComms: superEntry?.avgBreaksComms ?? 0,
            avgBreaksBumper: superEntry?.avgBreaksBumper ?? 0,
            breakRateAny,
            breakReliabilityScore: Math.max(0, 1 - breakRateAny),
            defenseHeavyRate,
            defenseSomeRate,
            defenseNoneRate: superEntry?.defenseNoneRate ?? 0,
            defenseReceivedRate: superEntry?.defenseReceivedRate ?? 0,
            defenseAggressionScore: defenseHeavyRate * 2 + defenseSomeRate,
            disciplineScore: Math.max(0, 1 - avgFoulsTotal / 6),
            avgCommentTags: superEntry?.avgCommentTags ?? 0,
            superMatchCount: superEntry?.matchCount ?? superRows.length,
            pitBatteryCount,
            pitMaxFuelStorageEstimate,
            pitIsSwerve: pitIsSwerve ? 1 : 0,
            rookieYear,
            yearsActive,
            expectedPointsAvg: expectedMean,
            expectedPointsMedian: expectedMedian,
            expectedPointsStdDev: expectedStd,
            expectedPointsQ1: expectedQ1,
            expectedPointsQ3: expectedQ3,
            expectedPointsIqr: expectedQ3 - expectedQ1,
            consistencyScore,
            defenseImpactExpectedPoints,
            defenseImpactStdev,
            defenseImpactConfidence,
            defenseImpactScore,
            expectedPointsTrendPerMatch: trend.slope,
            expectedPointsTrendCorrelation: trend.r,
            offensiveExpectedPointsAboveField: expectedMean - fieldExpectedMean,
            Comments: superEntry?.commentCounts ?? {},
        });
    });

    const offenseValues = rows.map(row => (row.expectedPointsAvg as number) ?? 0);
    const consistencyValues = rows.map(row => (row.consistencyScore as number) ?? 0);
    const defenseValues = rows.map(
        row => (row.defenseImpactExpectedPoints as number) ?? 0
    );
    const reliabilityValues = rows.map(
        row =>
            (((row.reliabilityScore as number) ?? 0) *
                ((row.breakReliabilityScore as number) ?? 0))
    );
    const disciplineValues = rows.map(row => (row.disciplineScore as number) ?? 0);

    rows.forEach(row => {
        const offense = (row.expectedPointsAvg as number) ?? 0;
        const consistency = (row.consistencyScore as number) ?? 0;
        const defense = (row.defenseImpactExpectedPoints as number) ?? 0;
        const reliability =
            ((row.reliabilityScore as number) ?? 0) *
            ((row.breakReliabilityScore as number) ?? 0);
        const discipline = (row.disciplineScore as number) ?? 0;

        const offenseZ = zScore(offense, offenseValues);
        const consistencyZ = zScore(consistency, consistencyValues);
        const defenseZ = zScore(defense, defenseValues);
        const reliabilityZ = zScore(reliability, reliabilityValues);
        const disciplineZ = zScore(discipline, disciplineValues);

        row.offenseZScore = offenseZ;
        row.consistencyZScore = consistencyZ;
        row.defenseZScore = defenseZ;
        row.selectionScore = clamp(
            50 +
                18 * offenseZ +
                12 * consistencyZ +
                12 * defenseZ +
                8 * reliabilityZ +
                6 * disciplineZ,
            0,
            100
        );
    });

    return rows.sort((a, b) => a.teamNumber - b.teamNumber);
}
