import {
    AllianceColor,
    CommentValues,
    MatchData,
    MatchDataAggregations,
    MatchIndividualDataAggregations,
    RobotPosition,
    SuperData,
    SuperDataAggregations,
    SuperIndividualDataAggregations,
    matchOutliersAggregation,
    ScouterData,
} from 'requests';
import { matchApp, superApp, pitApp, leaderboardApp } from './Schema.js';

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

        validEntries.forEach(entry => {
            autoFuel += entry.autoFuelScored;
            if (entry.autoMoved) autoMoved += 1;
            if (entry.autoStartingPosition === 'left') autoStartLeft += 1;
            if (entry.autoStartingPosition === 'center') autoStartCenter += 1;
            if (entry.autoStartingPosition === 'right') autoStartRight += 1;
            if (entry.autoStartingPosition === null) autoStartUnknown += 1;

            if (entry.autoTower !== 'none') autoTowerAttempt += 1;
            if (entry.autoTower === 'level1') autoTowerL1 += 1;
            if (entry.autoTower === 'failed') autoTowerFail += 1;

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
            if (entry.teleTower === 'failed') climbFail += 1;
            if (entry.teleTower === 'none') climbNone += 1;

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

            if (entry.breakdown !== 'none') breakdown += 1;
            if (entry.breakdown === 'stuck') breakdownStuck += 1;
            if (entry.breakdown === 'tipped') breakdownTipped += 1;
            if (entry.breakdown === 'comms') breakdownComms += 1;
            if (entry.breakdown === 'mechanism') breakdownMechanism += 1;
            if (entry.breakdown === 'other') breakdownOther += 1;
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
                autoMoved: entry.autoMoved,
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
                freeText: entry.freeText,
            };
        });
}

async function superAverageAndMax(): Promise<SuperDataAggregations[]> {
    const entries = (await superApp.find().lean()) as SuperData[];
    const byTeam = new Map<number, SuperData[]>();

    entries.forEach(entry => {
        if (!entry.metadata.robotTeam) return;
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
            pinning += entry.fouls.pinning;
            towerContact += entry.fouls.towerContactInEndgame;
            outOfZone += entry.fouls.outOfZoneShooting;
            ejectedFuel += entry.fouls.ejectedFuel;
            other += entry.fouls.other;
            humanFuel += entry.humanPlayerFuelScored;

            breaksMechanism += entry.breaks.mechanism;
            breaksBattery += entry.breaks.battery;
            breaksComms += entry.breaks.comms;
            breaksBumper += entry.breaks.bumper;
            const breakTotal =
                entry.breaks.mechanism +
                entry.breaks.battery +
                entry.breaks.comms +
                entry.breaks.bumper;
            if (breakTotal > 0) breaksAny += 1;

            if (entry.defenseProvided === 'heavy') heavyDefense += 1;
            if (entry.defenseProvided === 'some') someDefense += 1;
            if (entry.defenseProvided === 'none') noneDefense += 1;
            if (entry.defenseReceived) defenseReceived += 1;
            totalCommentTags += entry.comments.length;
            entry.comments.forEach(comment => {
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
    const entries = (await superApp.find().lean()) as SuperData[];
    return entries
        .filter(entry => entry.metadata.robotTeam)
        .map(entry => ({
            _id: {
                teamNumber: entry.metadata.robotTeam!,
                matchNumber: entry.metadata.matchNumber,
                robotPosition: entry.metadata.robotPosition,
            },
            scouterName: entry.metadata.scouterName,
            defenseProvided: entry.defenseProvided,
            defenseReceived: entry.defenseReceived,
            fouls: entry.fouls,
            breaks: entry.breaks,
            comments: entry.comments,
            humanPlayerFuelScored: entry.humanPlayerFuelScored,
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
