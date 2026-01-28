import {
    AllianceColor,
    MatchData,
    MatchDataAggregations,
    MatchIndividualDataAggregations,
    RobotPosition,
    SuperData,
    SuperDataAggregations,
    SuperFoulAggregationsData,
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
                avgTeleFuelTransition: 0,
                avgTeleFuelShift1: 0,
                avgTeleFuelShift2: 0,
                avgTeleFuelShift3: 0,
                avgTeleFuelShift4: 0,
                avgTeleFuelEndgame: 0,
                avgTeleFuelActiveComputed: 0,
                avgTeleFuelWastedComputed: 0,
                climbRateLevel1: 0,
                climbRateLevel2: 0,
                climbRateLevel3: 0,
                climbFailRate: 0,
                breakdownRate: 0,
                matchCount: 0,
            };
        }

        let autoFuel = 0;
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
        let breakdown = 0;

        validEntries.forEach(entry => {
            autoFuel += entry.autoFuelScored;
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
            if (entry.breakdown !== 'none') breakdown += 1;
        });

        return {
            _id: { teamNumber },
            avgAutoFuel: autoFuel / matchCount,
            avgTeleFuelTransition: teleTransition / matchCount,
            avgTeleFuelShift1: teleShift1 / matchCount,
            avgTeleFuelShift2: teleShift2 / matchCount,
            avgTeleFuelShift3: teleShift3 / matchCount,
            avgTeleFuelShift4: teleShift4 / matchCount,
            avgTeleFuelEndgame: teleEndgame / matchCount,
            avgTeleFuelActiveComputed: teleActive / matchCount,
            avgTeleFuelWastedComputed: teleWasted / matchCount,
            climbRateLevel1: climbL1 / matchCount,
            climbRateLevel2: climbL2 / matchCount,
            climbRateLevel3: climbL3 / matchCount,
            climbFailRate: climbFail / matchCount,
            breakdownRate: breakdown / matchCount,
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
                robotAbsent: entry.robotAbsent,
                autoFuelScored: entry.autoFuelScored,
                autoFuelWinner: entry.autoFuelWinner,
                shift1ActiveHubIfTie: entry.shift1ActiveHubIfTie,
                teleFuelBySegment: entry.teleFuelBySegment,
                teleFuelActiveComputed: computed.active,
                teleFuelWastedComputed: computed.wasted,
                autoTower: entry.autoTower,
                teleTower: entry.teleTower,
                breakdown: entry.breakdown,
                driverQuality: entry.driverQuality,
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
                defenseHeavyRate: 0,
                defenseSomeRate: 0,
                defenseReceivedRate: 0,
                matchCount: 0,
            };
        }

        let pinning = 0;
        let towerContact = 0;
        let outOfZone = 0;
        let ejectedFuel = 0;
        let other = 0;
        let humanFuel = 0;
        let heavyDefense = 0;
        let someDefense = 0;
        let defenseReceived = 0;
        const commentCounts: Partial<Record<string, number>> = {};

        teamEntries.forEach(entry => {
            pinning += entry.fouls.pinning;
            towerContact += entry.fouls.towerContactInEndgame;
            outOfZone += entry.fouls.outOfZoneShooting;
            ejectedFuel += entry.fouls.ejectedFuel;
            other += entry.fouls.other;
            humanFuel += entry.humanPlayerFuelScored;
            if (entry.defenseProvided === 'heavy') heavyDefense += 1;
            if (entry.defenseProvided === 'some') someDefense += 1;
            if (entry.defenseReceived) defenseReceived += 1;
            entry.comments.forEach(comment => {
                commentCounts[comment] = (commentCounts[comment] ?? 0) + 1;
            });
        });

        const totalFouls = pinning + towerContact + outOfZone + ejectedFuel + other;

        return {
            _id: { teamNumber },
            avgFoulsTotal: totalFouls / matchCount,
            foulRatePinning: pinning / matchCount,
            foulRateTowerContactInEndgame: towerContact / matchCount,
            foulRateOutOfZoneShooting: outOfZone / matchCount,
            foulRateEjectedFuel: ejectedFuel / matchCount,
            foulRateOther: other / matchCount,
            avgHumanPlayerFuelScored: humanFuel / matchCount,
            defenseHeavyRate: heavyDefense / matchCount,
            defenseSomeRate: someDefense / matchCount,
            defenseReceivedRate: defenseReceived / matchCount,
            matchCount,
            commentCounts,
        };
    });
}

async function superMaxIndividual(): Promise<SuperFoulAggregationsData[]> {
    const entries = (await superApp.find().lean()) as SuperData[];
    return entries
        .filter(entry => entry.metadata.robotTeam)
        .map(entry => ({
            _id: {
                teamNumber: entry.metadata.robotTeam!,
                matchNumber: entry.metadata.matchNumber,
            },
            pinning: entry.fouls.pinning,
            towerContactInEndgame: entry.fouls.towerContactInEndgame,
            outOfZoneShooting: entry.fouls.outOfZoneShooting,
            ejectedFuel: entry.fouls.ejectedFuel,
            other: entry.fouls.other,
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
