import {
    AllianceColor,
    CommentValues,
    MatchData,
    MatchDataAggregations,
    MatchIndividualDataAggregations,
    RobotPosition,
    SuperBreaks,
    SuperDataAggregations,
    SuperFouls,
    SuperIndividualDataAggregations,
    matchOutliersAggregation,
    ScouterData,
} from 'requests';
import { matchApp, pitApp, leaderboardApp } from './Schema.js';

function getAllianceFromPosition(position: RobotPosition): AllianceColor {
    return position.startsWith('red') ? 'red' : 'blue';
}

function flipAlliance(color: AllianceColor): AllianceColor {
    return color === 'red' ? 'blue' : 'red';
}

function getShift1ActiveHub(
    autoFuelWinner: MatchData['autoFuelWinner'],
    shift1ActiveHubIfTie: MatchData['shift1ActiveHubIfTie']
): AllianceColor | null {
    if (autoFuelWinner === 'red' || autoFuelWinner === 'blue') {
        return autoFuelWinner;
    }
    if (autoFuelWinner === 'tie') {
        return shift1ActiveHubIfTie ?? null;
    }
    return null;
}

function computeTeleFuelActiveWasted(entry: MatchData) {
    const shift1Active = getShift1ActiveHub(
        entry.autoFuelWinner,
        entry.shift1ActiveHubIfTie
    );
    const alliance = getAllianceFromPosition(entry.metadata.robotPosition);
    const shift2Active = shift1Active ? flipAlliance(shift1Active) : null;
    const shift3Active = shift1Active ?? null;
    const shift4Active = shift1Active ? flipAlliance(shift1Active) : null;

    const shiftMap: Record<
        'shift1' | 'shift2' | 'shift3' | 'shift4',
        AllianceColor | null
    > = {
        shift1: shift1Active,
        shift2: shift2Active,
        shift3: shift3Active,
        shift4: shift4Active,
    };

    let active = entry.teleFuelBySegment.transition + entry.teleFuelBySegment.endgame;
    let wasted = 0;

    (Object.keys(shiftMap) as Array<keyof typeof shiftMap>).forEach(
        shiftKey => {
            const activeHub = shiftMap[shiftKey];
            if (!activeHub) {
                return;
            }
            if (activeHub === alliance) {
                active += entry.teleFuelBySegment[shiftKey];
            } else {
                wasted += entry.teleFuelBySegment[shiftKey];
            }
        }
    );

    return { active, wasted };
}

const emptyFouls: SuperFouls = {
    pinning: 0,
    towerContactInEndgame: 0,
    outOfZoneShooting: 0,
    ejectedFuel: 0,
    other: 0,
};

const emptyBreaks: SuperBreaks = {
    mechanism: 0,
    battery: 0,
    comms: 0,
    bumper: 0,
};

const emptyActionTimeBySegment: MatchData['shootTimeBySegment'] = {
    auto: 0,
    transition: 0,
    shift1: 0,
    shift2: 0,
    shift3: 0,
    shift4: 0,
    endgame: 0,
};

function getActionTimeBySegment(
    value: MatchData['shootTimeBySegment'] | undefined
) {
    return {
        ...emptyActionTimeBySegment,
        ...(value ?? {}),
    };
}

function getFouls(entry: MatchData): SuperFouls {
    return {
        ...emptyFouls,
        ...(entry.fouls ?? {}),
    };
}

function getBreaks(entry: MatchData): SuperBreaks {
    return {
        ...emptyBreaks,
        ...(entry.breaks ?? {}),
    };
}

function getDefenseProvided(entry: MatchData): MatchData['defenseProvided'] {
    return entry.defenseProvided ?? 'None';
}

function getDefenseReceived(entry: MatchData): boolean {
    return entry.defenseReceived ?? false;
}

function getComments(entry: MatchData): CommentValues[] {
    return entry.comments ?? [];
}

function getAutoPath(entry: MatchData): MatchData['autoPath'] {
    return entry.autoPath ?? null;
}

function getActionTimeline(entry: MatchData): MatchData['actionTimeline'] {
    return entry.actionTimeline ?? null;
}

function median(values: number[]) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[middle - 1]! + sorted[middle]!) / 2;
    }
    return sorted[middle]!;
}

function getTimelineIntervalsByAction(
    timeline: MatchData['actionTimeline'],
    action: 'shoot' | 'pass'
) {
    if (!timeline) return [];
    return timeline.intervals
        .filter(interval => interval.action === action)
        .sort((a, b) => a.startSec - b.startSec);
}

async function averageAndMax(): Promise<MatchDataAggregations[]> {
    const entries = (await matchApp.find().lean()) as MatchData[];
    const byTeam = new Map<number, MatchData[]>();

    entries.forEach(entry => {
        if (!entry.metadata.robotTeam) return;
        const teamEntries = byTeam.get(entry.metadata.robotTeam) ?? [];
        teamEntries.push(entry);
        byTeam.set(entry.metadata.robotTeam, teamEntries);
    });

    return Array.from(byTeam.entries()).map(([teamNumber, teamEntries]) => {
        const validEntries = teamEntries.filter(entry => !entry.robotAbsent);
        const matchCount = validEntries.length;
        if (matchCount === 0) {
            return {
                _id: { teamNumber },
                avgAutoFuel: 0,
                autoMovedRate: 0,
                autoStartingPositionLeftRate: 0,
                autoStartingPositionCenterRate: 0,
                autoStartingPositionRightRate: 0,
                autoStartingPositionUnknownRate: 0,
                autoTowerAttemptRate: 0,
                autoTowerLevel1Rate: 0,
                autoTowerFailRate: 0,
                avgTeleFuelTransition: 0,
                avgTeleFuelShift1: 0,
                avgTeleFuelShift2: 0,
                avgTeleFuelShift3: 0,
                avgTeleFuelShift4: 0,
                avgTeleFuelEndgame: 0,
                avgTeleFuelTotal: 0,
                avgTeleFuelActiveComputed: 0,
                avgTeleFuelWastedComputed: 0,
                avgFuelTotal: 0,
                climbRateLevel1: 0,
                climbRateLevel2: 0,
                climbRateLevel3: 0,
                climbFailRate: 0,
                climbNoAttemptRate: 0,
                climbAttemptRate: 0,
                climbTimeEarlyRate: 0,
                climbTimeMidRate: 0,
                climbTimeLateRate: 0,
                climbTimeKnownRate: 0,
                driverQualityGreatRate: 0,
                driverQualityGoodRate: 0,
                driverQualityOkRate: 0,
                driverQualityRoughRate: 0,
                driverQualityScoreAvg: 0,
                breakdownRate: 0,
                breakdownRateStuck: 0,
                breakdownRateTipped: 0,
                breakdownRateComms: 0,
                breakdownRateMechanism: 0,
                breakdownRateOther: 0,
                timelineMatchCount: 0,
                avgShootActiveSec: 0,
                avgPassActiveSec: 0,
                avgShootIntervalsPerMatch: 0,
                avgPassIntervalsPerMatch: 0,
                avgShootIntervalDurationSec: 0,
                avgPassIntervalDurationSec: 0,
                avgShootCycleGapSec: 0,
                matchCount: 0,
            };
        }

        let autoFuel = 0;
        let autoMoved = 0;
        let autoStartLeft = 0;
        let autoStartCenter = 0;
        let autoStartRight = 0;
        let autoStartUnknown = 0;
        let autoTowerAttempt = 0;
        let autoTowerL1 = 0;
        let autoTowerFail = 0;
        let teleTransition = 0;
        let teleShift1 = 0;
        let teleShift2 = 0;
        let teleShift3 = 0;
        let teleShift4 = 0;
        let teleEndgame = 0;
        let teleActive = 0;
        let teleWasted = 0;
        let climbL1 = 0;
        let climbL2 = 0;
        let climbL3 = 0;
        let climbFail = 0;
        let climbNone = 0;
        let climbTimeEarly = 0;
        let climbTimeMid = 0;
        let climbTimeLate = 0;
        let driverGreat = 0;
        let driverGood = 0;
        let driverOk = 0;
        let driverRough = 0;
        let driverQualityScoreSum = 0;
        let breakdown = 0;
        let breakdownStuck = 0;
        let breakdownTipped = 0;
        let breakdownComms = 0;
        let breakdownMechanism = 0;
        let breakdownOther = 0;
        let timelineMatchCount = 0;
        let shootActiveSec = 0;
        let passActiveSec = 0;
        let shootIntervalsPerMatch = 0;
        let passIntervalsPerMatch = 0;
        let shootIntervalDurationPerMatch = 0;
        let passIntervalDurationPerMatch = 0;
        let shootIntervalDurationMatchCount = 0;
        let passIntervalDurationMatchCount = 0;
        let shootCycleGapMedianSum = 0;
        let shootCycleGapMatchCount = 0;

        validEntries.forEach(entry => {
            autoFuel += entry.autoFuelScored;
            if (entry.autoMoved) autoMoved += 1;
            if (entry.autoStartingPosition === 'left') autoStartLeft += 1;
            if (entry.autoStartingPosition === 'center') autoStartCenter += 1;
            if (entry.autoStartingPosition === 'right') autoStartRight += 1;
            if (entry.autoStartingPosition === null) autoStartUnknown += 1;

            if (entry.autoTower !== 'None') autoTowerAttempt += 1;
            if (entry.autoTower === 'level1') autoTowerL1 += 1;
            if (entry.autoTower === 'Failed') autoTowerFail += 1;

            teleTransition += entry.teleFuelBySegment.transition;
            teleShift1 += entry.teleFuelBySegment.shift1;
            teleShift2 += entry.teleFuelBySegment.shift2;
            teleShift3 += entry.teleFuelBySegment.shift3;
            teleShift4 += entry.teleFuelBySegment.shift4;
            teleEndgame += entry.teleFuelBySegment.endgame;

            const computed = computeTeleFuelActiveWasted(entry);
            teleActive += computed.active;
            teleWasted += computed.wasted;

            if (entry.teleTower === 'level1') climbL1 += 1;
            if (entry.teleTower === 'level2') climbL2 += 1;
            if (entry.teleTower === 'level3') climbL3 += 1;
            if (entry.teleTower === 'Failed') climbFail += 1;
            if (entry.teleTower === 'None') climbNone += 1;

            if (entry.climbTimeBucket === 'early') climbTimeEarly += 1;
            if (entry.climbTimeBucket === 'mid') climbTimeMid += 1;
            if (entry.climbTimeBucket === 'late') climbTimeLate += 1;

            if (entry.driverQuality === 'great') {
                driverGreat += 1;
                driverQualityScoreSum += 3;
            }
            if (entry.driverQuality === 'good') {
                driverGood += 1;
                driverQualityScoreSum += 2;
            }
            if (entry.driverQuality === 'ok') {
                driverOk += 1;
                driverQualityScoreSum += 1;
            }
            if (entry.driverQuality === 'rough') {
                driverRough += 1;
                driverQualityScoreSum += 0;
            }

            if (entry.breakdown !== 'None') breakdown += 1;
            if (entry.breakdown === 'stuck') breakdownStuck += 1;
            if (entry.breakdown === 'tipped') breakdownTipped += 1;
            if (entry.breakdown === 'comms') breakdownComms += 1;
            if (entry.breakdown === 'mechanism') breakdownMechanism += 1;
            if (entry.breakdown === 'other') breakdownOther += 1;

            const actionTimeline = getActionTimeline(entry);
            if (!actionTimeline) {
                return;
            }

            timelineMatchCount += 1;

            const shootIntervals = getTimelineIntervalsByAction(
                actionTimeline,
                'shoot'
            );
            const passIntervals = getTimelineIntervalsByAction(
                actionTimeline,
                'pass'
            );

            const shootDurations = shootIntervals.map(interval => interval.durationSec);
            const passDurations = passIntervals.map(interval => interval.durationSec);

            const shootActive = shootDurations.reduce(
                (sum, duration) => sum + duration,
                0
            );
            const passActive = passDurations.reduce(
                (sum, duration) => sum + duration,
                0
            );
            shootActiveSec += shootActive;
            passActiveSec += passActive;

            shootIntervalsPerMatch += shootIntervals.length;
            passIntervalsPerMatch += passIntervals.length;

            if (shootDurations.length) {
                shootIntervalDurationPerMatch +=
                    shootActive / shootDurations.length;
                shootIntervalDurationMatchCount += 1;
            }

            if (passDurations.length) {
                passIntervalDurationPerMatch += passActive / passDurations.length;
                passIntervalDurationMatchCount += 1;
            }

            if (shootIntervals.length >= 2) {
                const startGaps = shootIntervals
                    .slice(1)
                    .map((interval, index) => interval.startSec - shootIntervals[index]!.startSec)
                    .filter(gap => gap > 0);
                if (startGaps.length) {
                    shootCycleGapMedianSum += median(startGaps);
                    shootCycleGapMatchCount += 1;
                }
            }
        });

        const teleFuelTotal =
            teleTransition +
            teleShift1 +
            teleShift2 +
            teleShift3 +
            teleShift4 +
            teleEndgame;

        return {
            _id: { teamNumber },
            avgAutoFuel: autoFuel / matchCount,
            autoMovedRate: autoMoved / matchCount,
            autoStartingPositionLeftRate: autoStartLeft / matchCount,
            autoStartingPositionCenterRate: autoStartCenter / matchCount,
            autoStartingPositionRightRate: autoStartRight / matchCount,
            autoStartingPositionUnknownRate: autoStartUnknown / matchCount,
            autoTowerAttemptRate: autoTowerAttempt / matchCount,
            autoTowerLevel1Rate: autoTowerL1 / matchCount,
            autoTowerFailRate: autoTowerFail / matchCount,
            avgTeleFuelTransition: teleTransition / matchCount,
            avgTeleFuelShift1: teleShift1 / matchCount,
            avgTeleFuelShift2: teleShift2 / matchCount,
            avgTeleFuelShift3: teleShift3 / matchCount,
            avgTeleFuelShift4: teleShift4 / matchCount,
            avgTeleFuelEndgame: teleEndgame / matchCount,
            avgTeleFuelTotal: teleFuelTotal / matchCount,
            avgTeleFuelActiveComputed: teleActive / matchCount,
            avgTeleFuelWastedComputed: teleWasted / matchCount,
            avgFuelTotal: (autoFuel + teleFuelTotal) / matchCount,
            climbRateLevel1: climbL1 / matchCount,
            climbRateLevel2: climbL2 / matchCount,
            climbRateLevel3: climbL3 / matchCount,
            climbFailRate: climbFail / matchCount,
            climbNoAttemptRate: climbNone / matchCount,
            climbAttemptRate:
                (climbL1 + climbL2 + climbL3 + climbFail) / matchCount,
            climbTimeEarlyRate: climbTimeEarly / matchCount,
            climbTimeMidRate: climbTimeMid / matchCount,
            climbTimeLateRate: climbTimeLate / matchCount,
            climbTimeKnownRate:
                (climbTimeEarly + climbTimeMid + climbTimeLate) / matchCount,
            driverQualityGreatRate: driverGreat / matchCount,
            driverQualityGoodRate: driverGood / matchCount,
            driverQualityOkRate: driverOk / matchCount,
            driverQualityRoughRate: driverRough / matchCount,
            driverQualityScoreAvg: driverQualityScoreSum / (matchCount * 3),
            breakdownRate: breakdown / matchCount,
            breakdownRateStuck: breakdownStuck / matchCount,
            breakdownRateTipped: breakdownTipped / matchCount,
            breakdownRateComms: breakdownComms / matchCount,
            breakdownRateMechanism: breakdownMechanism / matchCount,
            breakdownRateOther: breakdownOther / matchCount,
            timelineMatchCount,
            avgShootActiveSec:
                timelineMatchCount === 0 ? 0 : shootActiveSec / timelineMatchCount,
            avgPassActiveSec:
                timelineMatchCount === 0 ? 0 : passActiveSec / timelineMatchCount,
            avgShootIntervalsPerMatch:
                timelineMatchCount === 0
                    ? 0
                    : shootIntervalsPerMatch / timelineMatchCount,
            avgPassIntervalsPerMatch:
                timelineMatchCount === 0
                    ? 0
                    : passIntervalsPerMatch / timelineMatchCount,
            avgShootIntervalDurationSec:
                shootIntervalDurationMatchCount === 0
                    ? 0
                    : shootIntervalDurationPerMatch /
                      shootIntervalDurationMatchCount,
            avgPassIntervalDurationSec:
                passIntervalDurationMatchCount === 0
                    ? 0
                    : passIntervalDurationPerMatch /
                      passIntervalDurationMatchCount,
            avgShootCycleGapSec:
                shootCycleGapMatchCount === 0
                    ? 0
                    : shootCycleGapMedianSum / shootCycleGapMatchCount,
            matchCount,
        };
    });
}

async function maxIndividual(): Promise<MatchIndividualDataAggregations[]> {
    const entries = (await matchApp.find().lean()) as MatchData[];
    return entries
        .filter(entry => entry.metadata.robotTeam)
        .map(entry => {
            const computed = computeTeleFuelActiveWasted(entry);
            return {
                _id: {
                    teamNumber: entry.metadata.robotTeam!,
                    matchNumber: entry.metadata.matchNumber,
                    robotPosition: entry.metadata.robotPosition,
                },
                scouterName: entry.metadata.scouterName,
                robotAbsent: entry.robotAbsent,
                autoStartingPosition: entry.autoStartingPosition,
                autoPath: getAutoPath(entry),
                autoMoved: entry.autoMoved,
                shootTimeBySegment: getActionTimeBySegment(
                    entry.shootTimeBySegment
                ),
                passTimeBySegment: getActionTimeBySegment(
                    entry.passTimeBySegment
                ),
                actionTimeline: getActionTimeline(entry),
                ballsPerSecondUsed: entry.ballsPerSecondUsed ?? 0,
                autoFuelScored: entry.autoFuelScored,
                autoFuelWinner: entry.autoFuelWinner,
                shift1ActiveHubIfTie: entry.shift1ActiveHubIfTie,
                teleFuelBySegment: entry.teleFuelBySegment,
                teleFuelActiveComputed: computed.active,
                teleFuelWastedComputed: computed.wasted,
                autoTower: entry.autoTower,
                teleTower: entry.teleTower,
                climbTimeBucket: entry.climbTimeBucket,
                breakdown: entry.breakdown,
                driverQuality: entry.driverQuality,
                defenseProvided: getDefenseProvided(entry),
                defenseReceived: getDefenseReceived(entry),
                fouls: getFouls(entry),
                breaks: getBreaks(entry),
                comments: getComments(entry),
                freeText: entry.freeText,
            };
        });
}

async function superAverageAndMax(): Promise<SuperDataAggregations[]> {
    const entries = (await matchApp.find().lean()) as MatchData[];
    const byTeam = new Map<number, MatchData[]>();

    entries.forEach(entry => {
        if (!entry.metadata.robotTeam || entry.robotAbsent) return;
        const teamEntries = byTeam.get(entry.metadata.robotTeam) ?? [];
        teamEntries.push(entry);
        byTeam.set(entry.metadata.robotTeam, teamEntries);
    });

    return Array.from(byTeam.entries()).map(([teamNumber, teamEntries]) => {
        const matchCount = teamEntries.length;
        if (matchCount === 0) {
            return {
                _id: { teamNumber },
                avgFoulsTotal: 0,
                foulRatePinning: 0,
                foulRateTowerContactInEndgame: 0,
                foulRateOutOfZoneShooting: 0,
                foulRateEjectedFuel: 0,
                foulRateOther: 0,
                avgHumanPlayerFuelScored: 0,
                avgBreaksTotal: 0,
                avgBreaksMechanism: 0,
                avgBreaksBattery: 0,
                avgBreaksComms: 0,
                avgBreaksBumper: 0,
                breakRateAny: 0,
                defenseHeavyRate: 0,
                defenseSomeRate: 0,
                defenseNoneRate: 0,
                defenseReceivedRate: 0,
                avgCommentTags: 0,
                matchCount: 0,
                commentCounts: {},
            };
        }

        let pinning = 0;
        let towerContact = 0;
        let outOfZone = 0;
        let ejectedFuel = 0;
        let other = 0;
        let humanFuel = 0;
        let breaksMechanism = 0;
        let breaksBattery = 0;
        let breaksComms = 0;
        let breaksBumper = 0;
        let breaksAny = 0;
        let heavyDefense = 0;
        let someDefense = 0;
        let noneDefense = 0;
        let defenseReceived = 0;
        let totalCommentTags = 0;
        const commentCounts: Partial<Record<CommentValues, number>> = {};

        teamEntries.forEach(entry => {
            const fouls = getFouls(entry);
            const breaks = getBreaks(entry);
            const defenseProvided = getDefenseProvided(entry);
            const defenseReceivedForEntry = getDefenseReceived(entry);
            const comments = getComments(entry);

            pinning += fouls.pinning;
            towerContact += fouls.towerContactInEndgame;
            outOfZone += fouls.outOfZoneShooting;
            ejectedFuel += fouls.ejectedFuel;
            other += fouls.other;
            humanFuel += 0;

            breaksMechanism += breaks.mechanism;
            breaksBattery += breaks.battery;
            breaksComms += breaks.comms;
            breaksBumper += breaks.bumper;
            const breakTotal =
                breaks.mechanism +
                breaks.battery +
                breaks.comms +
                breaks.bumper;
            if (breakTotal > 0) breaksAny += 1;

            if (defenseProvided === 'heavy') heavyDefense += 1;
            if (defenseProvided === 'some') someDefense += 1;
            if (defenseProvided === 'None') noneDefense += 1;
            if (defenseReceivedForEntry) defenseReceived += 1;
            totalCommentTags += comments.length;
            comments.forEach(comment => {
                commentCounts[comment] = (commentCounts[comment] ?? 0) + 1;
            });
        });

        const totalFouls = pinning + towerContact + outOfZone + ejectedFuel + other;
        const totalBreaks =
            breaksMechanism + breaksBattery + breaksComms + breaksBumper;

        return {
            _id: { teamNumber },
            avgFoulsTotal: totalFouls / matchCount,
            foulRatePinning: pinning / matchCount,
            foulRateTowerContactInEndgame: towerContact / matchCount,
            foulRateOutOfZoneShooting: outOfZone / matchCount,
            foulRateEjectedFuel: ejectedFuel / matchCount,
            foulRateOther: other / matchCount,
            avgHumanPlayerFuelScored: humanFuel / matchCount,
            avgBreaksTotal: totalBreaks / matchCount,
            avgBreaksMechanism: breaksMechanism / matchCount,
            avgBreaksBattery: breaksBattery / matchCount,
            avgBreaksComms: breaksComms / matchCount,
            avgBreaksBumper: breaksBumper / matchCount,
            breakRateAny: breaksAny / matchCount,
            defenseHeavyRate: heavyDefense / matchCount,
            defenseSomeRate: someDefense / matchCount,
            defenseNoneRate: noneDefense / matchCount,
            defenseReceivedRate: defenseReceived / matchCount,
            avgCommentTags: totalCommentTags / matchCount,
            matchCount,
            commentCounts,
        };
    });
}

async function superMaxIndividual(): Promise<SuperIndividualDataAggregations[]> {
    const entries = (await matchApp.find().lean()) as MatchData[];
    return entries
        .filter(entry => entry.metadata.robotTeam && !entry.robotAbsent)
        .map(entry => ({
            _id: {
                teamNumber: entry.metadata.robotTeam!,
                matchNumber: entry.metadata.matchNumber,
                robotPosition: entry.metadata.robotPosition,
            },
            scouterName: entry.metadata.scouterName,
            defenseProvided: getDefenseProvided(entry),
            defenseReceived: getDefenseReceived(entry),
            fouls: getFouls(entry),
            breaks: getBreaks(entry),
            comments: getComments(entry),
            humanPlayerFuelScored: 0,
        }));
}

async function matchOutlier(): Promise<matchOutliersAggregation[]> {
    return [];
}

async function scouterRankings(): Promise<ScouterData[]> {
    const filter = {};
    return await leaderboardApp.find(filter);
}

async function robotImageDisplay(
    teamNumber: number
): Promise<Buffer | undefined> {
    return (
        await pitApp.findOne({ teamNumber: teamNumber }, 'teamNumber photo')
    )?.photo;
}

export {
    averageAndMax,
    superAverageAndMax,
    robotImageDisplay,
    scouterRankings,
    superMaxIndividual,
    maxIndividual,
    matchOutlier,
};
