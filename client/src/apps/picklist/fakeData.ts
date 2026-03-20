import {
    MatchIndividualDataAggregations,
    MatchDataAggregations,
    PitResult,
    SuperIndividualDataAggregations,
    SuperDataAggregations,
    TeamData,
} from 'requests';

type FakeMatchAggBase = Omit<
    MatchDataAggregations,
    | 'autoMovedRate'
    | 'autoStartingPositionLeftRate'
    | 'autoStartingPositionCenterRate'
    | 'autoStartingPositionRightRate'
    | 'autoStartingPositionUnknownRate'
    | 'autoTowerAttemptRate'
    | 'autoTowerLevel1Rate'
    | 'autoTowerFailRate'
    | 'avgTeleFuelTotal'
    | 'avgFuelTotal'
    | 'climbNoAttemptRate'
    | 'climbAttemptRate'
    | 'climbTimeEarlyRate'
    | 'climbTimeMidRate'
    | 'climbTimeLateRate'
    | 'climbTimeKnownRate'
    | 'driverQualityGreatRate'
    | 'driverQualityGoodRate'
    | 'driverQualityOkRate'
    | 'driverQualityRoughRate'
    | 'driverQualityScoreAvg'
    | 'breakdownRateStuck'
    | 'breakdownRateTipped'
    | 'breakdownRateComms'
    | 'breakdownRateMechanism'
    | 'breakdownRateOther'
>;

type FakeSuperAggBase = Omit<
    SuperDataAggregations,
    | 'avgBreaksTotal'
    | 'avgBreaksMechanism'
    | 'avgBreaksBattery'
    | 'avgBreaksComms'
    | 'avgBreaksBumper'
    | 'breakRateAny'
    | 'defenseNoneRate'
    | 'avgCommentTags'
>;

const fakeRobotPositions: MatchIndividualDataAggregations['_id']['robotPosition'][] = [
    'red_1',
    'blue_2',
    'red_3',
    'blue_1',
];

function clamp(value: number, minValue: number, maxValue: number) {
    return Math.max(minValue, Math.min(value, maxValue));
}

function seededValue(seed: number) {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
}

function makeFakeAutoPath(
    teamNumber: number,
    matchNumber: number,
    robotPosition: MatchIndividualDataAggregations['_id']['robotPosition']
): MatchIndividualDataAggregations['autoPath'] {
    const alliance = robotPosition.startsWith('red') ? 'red' : 'blue';
    const startX = alliance === 'red' ? 0.69 : 0.34;
    const startY = 0.32 + seededValue(teamNumber + matchNumber) * 0.34;
    const points = Array.from({ length: 14 }, (_, index) => {
        const progress = index / 13;
        const lateral =
            (seededValue(teamNumber * 100 + matchNumber * 7 + index) - 0.5) * 0.08;
        const towardCenter = alliance === 'red' ? -0.26 : 0.26;
        return {
            x: clamp(startX + towardCenter * progress + lateral, 0, 1),
            y: clamp(startY + Math.sin(progress * Math.PI) * 0.12 + lateral * 0.3, 0, 1),
            tSec: Math.round(progress * 20 * 100) / 100,
        };
    });
    const shotMarkers = [
        points[4],
        points[9],
    ].filter(
        (
            point
        ): point is {
            x: number;
            y: number;
            tSec: number;
        } => point != null
    );
    return {
        alliance,
        startPosition: startY < 0.42 ? 'left' : startY < 0.58 ? 'center' : 'right',
        points,
        shotMarkers,
        fingerprint: `fake-${teamNumber}-${matchNumber}-${alliance}`,
    };
}

const fakeMatchAggBase: FakeMatchAggBase[] = [
    {
        _id: { teamNumber: 254 },
        avgAutoFuel: 4.2,
        avgTeleFuelTransition: 2.4,
        avgTeleFuelShift1: 5.2,
        avgTeleFuelShift2: 5.8,
        avgTeleFuelShift3: 5.1,
        avgTeleFuelShift4: 4.0,
        avgTeleFuelEndgame: 2.0,
        avgTeleFuelActiveComputed: 20.4,
        avgTeleFuelWastedComputed: 4.1,
        climbRateLevel1: 0.05,
        climbRateLevel2: 0.3,
        climbRateLevel3: 0.55,
        climbFailRate: 0.1,
        breakdownRate: 0.02,
        matchCount: 10,
    },
    {
        _id: { teamNumber: 1678 },
        avgAutoFuel: 3.6,
        avgTeleFuelTransition: 1.8,
        avgTeleFuelShift1: 4.6,
        avgTeleFuelShift2: 4.9,
        avgTeleFuelShift3: 4.4,
        avgTeleFuelShift4: 3.5,
        avgTeleFuelEndgame: 1.6,
        avgTeleFuelActiveComputed: 17.2,
        avgTeleFuelWastedComputed: 3.6,
        climbRateLevel1: 0.1,
        climbRateLevel2: 0.4,
        climbRateLevel3: 0.35,
        climbFailRate: 0.15,
        breakdownRate: 0.03,
        matchCount: 10,
    },
    {
        _id: { teamNumber: 971 },
        avgAutoFuel: 2.8,
        avgTeleFuelTransition: 1.5,
        avgTeleFuelShift1: 3.8,
        avgTeleFuelShift2: 4.2,
        avgTeleFuelShift3: 3.9,
        avgTeleFuelShift4: 3.0,
        avgTeleFuelEndgame: 1.4,
        avgTeleFuelActiveComputed: 14.5,
        avgTeleFuelWastedComputed: 3.3,
        climbRateLevel1: 0.15,
        climbRateLevel2: 0.35,
        climbRateLevel3: 0.25,
        climbFailRate: 0.25,
        breakdownRate: 0.05,
        matchCount: 9,
    },
    {
        _id: { teamNumber: 4414 },
        avgAutoFuel: 1.9,
        avgTeleFuelTransition: 1.0,
        avgTeleFuelShift1: 2.6,
        avgTeleFuelShift2: 3.1,
        avgTeleFuelShift3: 3.0,
        avgTeleFuelShift4: 2.3,
        avgTeleFuelEndgame: 1.1,
        avgTeleFuelActiveComputed: 10.2,
        avgTeleFuelWastedComputed: 2.9,
        climbRateLevel1: 0.25,
        climbRateLevel2: 0.25,
        climbRateLevel3: 0.1,
        climbFailRate: 0.4,
        breakdownRate: 0.08,
        matchCount: 8,
    },
    {
        _id: { teamNumber: 1323 },
        avgAutoFuel: 3.1,
        avgTeleFuelTransition: 1.7,
        avgTeleFuelShift1: 4.0,
        avgTeleFuelShift2: 4.5,
        avgTeleFuelShift3: 4.1,
        avgTeleFuelShift4: 3.2,
        avgTeleFuelEndgame: 1.7,
        avgTeleFuelActiveComputed: 16.0,
        avgTeleFuelWastedComputed: 3.2,
        climbRateLevel1: 0.08,
        climbRateLevel2: 0.38,
        climbRateLevel3: 0.4,
        climbFailRate: 0.14,
        breakdownRate: 0.04,
        matchCount: 9,
    },
    {
        _id: { teamNumber: 2056 },
        avgAutoFuel: 3.9,
        avgTeleFuelTransition: 2.1,
        avgTeleFuelShift1: 5.0,
        avgTeleFuelShift2: 5.4,
        avgTeleFuelShift3: 4.8,
        avgTeleFuelShift4: 3.8,
        avgTeleFuelEndgame: 1.9,
        avgTeleFuelActiveComputed: 19.2,
        avgTeleFuelWastedComputed: 3.8,
        climbRateLevel1: 0.05,
        climbRateLevel2: 0.25,
        climbRateLevel3: 0.6,
        climbFailRate: 0.1,
        breakdownRate: 0.02,
        matchCount: 10,
    },
    {
        _id: { teamNumber: 148 },
        avgAutoFuel: 2.1,
        avgTeleFuelTransition: 1.1,
        avgTeleFuelShift1: 3.0,
        avgTeleFuelShift2: 3.4,
        avgTeleFuelShift3: 3.2,
        avgTeleFuelShift4: 2.5,
        avgTeleFuelEndgame: 1.2,
        avgTeleFuelActiveComputed: 11.2,
        avgTeleFuelWastedComputed: 3.2,
        climbRateLevel1: 0.2,
        climbRateLevel2: 0.3,
        climbRateLevel3: 0.2,
        climbFailRate: 0.3,
        breakdownRate: 0.06,
        matchCount: 7,
    },
    {
        _id: { teamNumber: 118 },
        avgAutoFuel: 2.4,
        avgTeleFuelTransition: 1.2,
        avgTeleFuelShift1: 3.2,
        avgTeleFuelShift2: 3.6,
        avgTeleFuelShift3: 3.4,
        avgTeleFuelShift4: 2.7,
        avgTeleFuelEndgame: 1.3,
        avgTeleFuelActiveComputed: 12.0,
        avgTeleFuelWastedComputed: 3.4,
        climbRateLevel1: 0.18,
        climbRateLevel2: 0.32,
        climbRateLevel3: 0.22,
        climbFailRate: 0.28,
        breakdownRate: 0.07,
        matchCount: 7,
    },
    {
        _id: { teamNumber: 330 },
        avgAutoFuel: 1.6,
        avgTeleFuelTransition: 0.9,
        avgTeleFuelShift1: 2.4,
        avgTeleFuelShift2: 2.8,
        avgTeleFuelShift3: 2.6,
        avgTeleFuelShift4: 2.0,
        avgTeleFuelEndgame: 0.9,
        avgTeleFuelActiveComputed: 9.0,
        avgTeleFuelWastedComputed: 2.6,
        climbRateLevel1: 0.3,
        climbRateLevel2: 0.2,
        climbRateLevel3: 0.1,
        climbFailRate: 0.4,
        breakdownRate: 0.1,
        matchCount: 6,
    },
    {
        _id: { teamNumber: 604 },
        avgAutoFuel: 1.2,
        avgTeleFuelTransition: 0.7,
        avgTeleFuelShift1: 2.0,
        avgTeleFuelShift2: 2.2,
        avgTeleFuelShift3: 2.1,
        avgTeleFuelShift4: 1.7,
        avgTeleFuelEndgame: 0.8,
        avgTeleFuelActiveComputed: 7.3,
        avgTeleFuelWastedComputed: 2.2,
        climbRateLevel1: 0.35,
        climbRateLevel2: 0.15,
        climbRateLevel3: 0.05,
        climbFailRate: 0.45,
        breakdownRate: 0.12,
        matchCount: 6,
    },
];

export const fakeMatchAgg: MatchDataAggregations[] = fakeMatchAggBase.map(
    entry => {
        const avgTeleFuelTotal =
            entry.avgTeleFuelTransition +
            entry.avgTeleFuelShift1 +
            entry.avgTeleFuelShift2 +
            entry.avgTeleFuelShift3 +
            entry.avgTeleFuelShift4 +
            entry.avgTeleFuelEndgame;
        const avgFuelTotal = entry.avgAutoFuel + avgTeleFuelTotal;

        const climbAttemptRateRaw =
            entry.climbRateLevel1 +
            entry.climbRateLevel2 +
            entry.climbRateLevel3 +
            entry.climbFailRate;
        const climbAttemptRate = Math.min(1, Math.max(0, climbAttemptRateRaw));
        const climbNoAttemptRate = Math.max(0, 1 - climbAttemptRate);

        const climbTimeEarlyRate = climbAttemptRate * 0.2;
        const climbTimeMidRate = climbAttemptRate * 0.5;
        const climbTimeLateRate = climbAttemptRate * 0.3;
        const climbTimeKnownRate =
            climbTimeEarlyRate + climbTimeMidRate + climbTimeLateRate;

        const driverQualityGreatRate = 0.3;
        const driverQualityGoodRate = 0.4;
        const driverQualityOkRate = 0.2;
        const driverQualityRoughRate = 0.1;
        const driverQualityScoreAvg =
            (driverQualityGreatRate * 3 +
                driverQualityGoodRate * 2 +
                driverQualityOkRate * 1 +
                driverQualityRoughRate * 0) /
            3;

        return {
            ...entry,
            autoMovedRate: 0.9,
            autoStartingPositionLeftRate: 0.33,
            autoStartingPositionCenterRate: 0.34,
            autoStartingPositionRightRate: 0.33,
            autoStartingPositionUnknownRate: 0,
            autoTowerAttemptRate: 0.8,
            autoTowerLevel1Rate: 0.6,
            autoTowerFailRate: 0.2,
            avgTeleFuelTotal,
            avgFuelTotal,
            climbNoAttemptRate,
            climbAttemptRate,
            climbTimeEarlyRate,
            climbTimeMidRate,
            climbTimeLateRate,
            climbTimeKnownRate,
            driverQualityGreatRate,
            driverQualityGoodRate,
            driverQualityOkRate,
            driverQualityRoughRate,
            driverQualityScoreAvg,
            breakdownRateStuck: entry.breakdownRate * 0.25,
            breakdownRateTipped: entry.breakdownRate * 0.2,
            breakdownRateComms: entry.breakdownRate * 0.2,
            breakdownRateMechanism: entry.breakdownRate * 0.25,
            breakdownRateOther: entry.breakdownRate * 0.1,
        };
    }
);

const fakeSuperAggBase: FakeSuperAggBase[] = [
    {
        _id: { teamNumber: 254 },
        avgFoulsTotal: 0.4,
        foulRatePinning: 0.05,
        foulRateTowerContactInEndgame: 0.03,
        foulRateOutOfZoneShooting: 0.08,
        foulRateEjectedFuel: 0.02,
        foulRateOther: 0.22,
        avgHumanPlayerFuelScored: 2.5,
        defenseHeavyRate: 0.05,
        defenseSomeRate: 0.15,
        defenseReceivedRate: 0.4,
        matchCount: 10,
        commentCounts: {
            great_driving: 6,
            fast_cycles: 5,
            accurate_shots: 4,
            fast_climb: 3,
            smart_defense: 2,
            good_driving: 1,
        },
    },
    {
        _id: { teamNumber: 1678 },
        avgFoulsTotal: 0.6,
        foulRatePinning: 0.1,
        foulRateTowerContactInEndgame: 0.05,
        foulRateOutOfZoneShooting: 0.1,
        foulRateEjectedFuel: 0.05,
        foulRateOther: 0.3,
        avgHumanPlayerFuelScored: 2.1,
        defenseHeavyRate: 0.08,
        defenseSomeRate: 0.2,
        defenseReceivedRate: 0.35,
        matchCount: 10,
        commentCounts: {
            great_driving: 5,
            fast_cycles: 4,
            accurate_shots: 3,
            fast_climb: 2,
            good_driving: 2,
            smart_defense: 1,
        },
    },
    {
        _id: { teamNumber: 971 },
        avgFoulsTotal: 0.7,
        foulRatePinning: 0.12,
        foulRateTowerContactInEndgame: 0.06,
        foulRateOutOfZoneShooting: 0.1,
        foulRateEjectedFuel: 0.06,
        foulRateOther: 0.36,
        avgHumanPlayerFuelScored: 1.8,
        defenseHeavyRate: 0.12,
        defenseSomeRate: 0.25,
        defenseReceivedRate: 0.4,
        matchCount: 9,
        commentCounts: {
            good_driving: 4,
            fast_cycles: 3,
            accurate_shots: 2,
            smart_defense: 2,
            slow_climb: 1,
            rough_driving: 1,
        },
    },
    {
        _id: { teamNumber: 4414 },
        avgFoulsTotal: 1.2,
        foulRatePinning: 0.2,
        foulRateTowerContactInEndgame: 0.1,
        foulRateOutOfZoneShooting: 0.15,
        foulRateEjectedFuel: 0.1,
        foulRateOther: 0.65,
        avgHumanPlayerFuelScored: 1.2,
        defenseHeavyRate: 0.25,
        defenseSomeRate: 0.3,
        defenseReceivedRate: 0.5,
        matchCount: 8,
        commentCounts: {
            aggressive_defense: 3,
            defense_liability: 2,
            rough_driving: 2,
            slow_climb: 1,
        },
    },
    {
        _id: { teamNumber: 1323 },
        avgFoulsTotal: 0.5,
        foulRatePinning: 0.08,
        foulRateTowerContactInEndgame: 0.04,
        foulRateOutOfZoneShooting: 0.08,
        foulRateEjectedFuel: 0.04,
        foulRateOther: 0.26,
        avgHumanPlayerFuelScored: 2.0,
        defenseHeavyRate: 0.1,
        defenseSomeRate: 0.22,
        defenseReceivedRate: 0.38,
        matchCount: 9,
        commentCounts: {
            great_driving: 4,
            fast_cycles: 3,
            accurate_shots: 3,
            fast_climb: 2,
            good_driving: 2,
        },
    },
    {
        _id: { teamNumber: 2056 },
        avgFoulsTotal: 0.45,
        foulRatePinning: 0.07,
        foulRateTowerContactInEndgame: 0.04,
        foulRateOutOfZoneShooting: 0.06,
        foulRateEjectedFuel: 0.03,
        foulRateOther: 0.25,
        avgHumanPlayerFuelScored: 2.7,
        defenseHeavyRate: 0.05,
        defenseSomeRate: 0.18,
        defenseReceivedRate: 0.32,
        matchCount: 10,
        commentCounts: {
            great_driving: 6,
            fast_cycles: 5,
            accurate_shots: 4,
            fast_climb: 3,
            smart_defense: 2,
        },
    },
    {
        _id: { teamNumber: 148 },
        avgFoulsTotal: 0.9,
        foulRatePinning: 0.15,
        foulRateTowerContactInEndgame: 0.08,
        foulRateOutOfZoneShooting: 0.12,
        foulRateEjectedFuel: 0.06,
        foulRateOther: 0.49,
        avgHumanPlayerFuelScored: 1.5,
        defenseHeavyRate: 0.18,
        defenseSomeRate: 0.28,
        defenseReceivedRate: 0.45,
        matchCount: 7,
        commentCounts: {
            good_driving: 3,
            accurate_shots: 2,
            aggressive_defense: 2,
            slow_climb: 2,
            drops_fuel: 1,
        },
    },
    {
        _id: { teamNumber: 118 },
        avgFoulsTotal: 1.0,
        foulRatePinning: 0.16,
        foulRateTowerContactInEndgame: 0.09,
        foulRateOutOfZoneShooting: 0.14,
        foulRateEjectedFuel: 0.06,
        foulRateOther: 0.55,
        avgHumanPlayerFuelScored: 1.4,
        defenseHeavyRate: 0.2,
        defenseSomeRate: 0.25,
        defenseReceivedRate: 0.48,
        matchCount: 7,
        commentCounts: {
            ok_driving: 3,
            inaccurate_shots: 2,
            defense_liability: 2,
            slow_climb: 2,
        },
    },
    {
        _id: { teamNumber: 330 },
        avgFoulsTotal: 1.3,
        foulRatePinning: 0.2,
        foulRateTowerContactInEndgame: 0.12,
        foulRateOutOfZoneShooting: 0.2,
        foulRateEjectedFuel: 0.1,
        foulRateOther: 0.68,
        avgHumanPlayerFuelScored: 1.0,
        defenseHeavyRate: 0.3,
        defenseSomeRate: 0.35,
        defenseReceivedRate: 0.55,
        matchCount: 6,
        commentCounts: {
            aggressive_defense: 3,
            defense_liability: 3,
            rough_driving: 2,
            no_climb: 1,
        },
    },
    {
        _id: { teamNumber: 604 },
        avgFoulsTotal: 1.5,
        foulRatePinning: 0.22,
        foulRateTowerContactInEndgame: 0.15,
        foulRateOutOfZoneShooting: 0.22,
        foulRateEjectedFuel: 0.12,
        foulRateOther: 0.79,
        avgHumanPlayerFuelScored: 0.8,
        defenseHeavyRate: 0.32,
        defenseSomeRate: 0.3,
        defenseReceivedRate: 0.6,
        matchCount: 6,
        commentCounts: {
            rough_driving: 3,
            defense_liability: 3,
            no_climb: 2,
            drops_fuel: 2,
        },
    },
];

export const fakeSuperAgg: SuperDataAggregations[] = fakeSuperAggBase.map(
    entry => {
        const defenseNoneRate = Math.max(
            0,
            1 - entry.defenseHeavyRate - entry.defenseSomeRate
        );
        const totalCommentTags = Object.values(entry.commentCounts ?? {}).reduce(
            (sum, value) => sum + (value ?? 0),
            0
        );
        const avgCommentTags = entry.matchCount
            ? totalCommentTags / entry.matchCount
            : 0;

        return {
            ...entry,
            avgBreaksTotal: 0.15,
            avgBreaksMechanism: 0.05,
            avgBreaksBattery: 0.03,
            avgBreaksComms: 0.04,
            avgBreaksBumper: 0.03,
            breakRateAny: 0.2,
            defenseNoneRate,
            avgCommentTags,
        };
    }
);

export const fakeMatchIndividual: MatchIndividualDataAggregations[] =
    fakeMatchAgg.flatMap((entry, teamIndex) => {
        return Array.from({ length: 4 }, (_, index) => {
            const matchNumber = teamIndex * 4 + index + 1;
            const robotPosition = fakeRobotPositions[index % fakeRobotPositions.length]!;
            const autoPath = makeFakeAutoPath(
                entry._id.teamNumber,
                matchNumber,
                robotPosition
            );
            const fallbackStartPosition =
                index % 3 === 0 ? 'left' : index % 3 === 1 ? 'center' : 'right';
            const teleScale = 0.82 + seededValue(matchNumber + teamIndex * 9) * 0.26;
            const teleFuelBySegment = {
                transition: Math.round(entry.avgTeleFuelTransition * teleScale * 10) / 10,
                shift1: Math.round(entry.avgTeleFuelShift1 * teleScale * 10) / 10,
                shift2: Math.round(entry.avgTeleFuelShift2 * teleScale * 10) / 10,
                shift3: Math.round(entry.avgTeleFuelShift3 * teleScale * 10) / 10,
                shift4: Math.round(entry.avgTeleFuelShift4 * teleScale * 10) / 10,
                endgame: Math.round(entry.avgTeleFuelEndgame * teleScale * 10) / 10,
            };
            return {
                _id: {
                    teamNumber: entry._id.teamNumber,
                    matchNumber,
                    robotPosition,
                },
                scouterName: `Fake Scout ${(teamIndex % 6) + 1}`,
                robotAbsent: false,
                autoStartingPosition: autoPath?.startPosition ?? fallbackStartPosition,
                autoPath,
                autoMoved: true,
                shootTimeBySegment: {
                    auto: Math.round((1 + seededValue(matchNumber) * 2) * 100) / 100,
                    transition: Math.round((0.6 + seededValue(matchNumber + 1) * 1.4) * 100) / 100,
                    shift1: Math.round((1.2 + seededValue(matchNumber + 2) * 2.4) * 100) / 100,
                    shift2: Math.round((1.4 + seededValue(matchNumber + 3) * 2.8) * 100) / 100,
                    shift3: Math.round((1.2 + seededValue(matchNumber + 4) * 2.4) * 100) / 100,
                    shift4: Math.round((1.0 + seededValue(matchNumber + 5) * 2.1) * 100) / 100,
                    endgame: Math.round((0.7 + seededValue(matchNumber + 6) * 1.6) * 100) / 100,
                },
                passTimeBySegment: {
                    auto: 0,
                    transition: Math.round((0.2 + seededValue(matchNumber + 7) * 0.7) * 100) / 100,
                    shift1: Math.round((0.5 + seededValue(matchNumber + 8) * 1.1) * 100) / 100,
                    shift2: Math.round((0.6 + seededValue(matchNumber + 9) * 1.2) * 100) / 100,
                    shift3: Math.round((0.5 + seededValue(matchNumber + 10) * 1.0) * 100) / 100,
                    shift4: Math.round((0.4 + seededValue(matchNumber + 11) * 0.9) * 100) / 100,
                    endgame: Math.round((0.2 + seededValue(matchNumber + 12) * 0.8) * 100) / 100,
                },
                ballsPerSecondUsed: 5,
                autoFuelScored: Math.round(entry.avgAutoFuel * teleScale * 10) / 10,
                autoFuelWinner: seededValue(matchNumber + teamIndex) > 0.5 ? 'red' : 'blue',
                shift1ActiveHubIfTie: null,
                teleFuelBySegment,
                teleFuelActiveComputed:
                    Math.round(entry.avgTeleFuelActiveComputed * teleScale * 10) / 10,
                teleFuelWastedComputed:
                    Math.round(entry.avgTeleFuelWastedComputed * teleScale * 10) / 10,
                autoTower: seededValue(matchNumber + 33) > 0.7 ? 'level1' : 'None',
                teleTower:
                    seededValue(matchNumber + 20) > 0.72
                        ? 'level3'
                        : seededValue(matchNumber + 21) > 0.54
                          ? 'level2'
                          : seededValue(matchNumber + 22) > 0.3
                            ? 'level1'
                            : seededValue(matchNumber + 23) > 0.2
                              ? 'Failed'
                              : 'None',
                climbTimeBucket:
                    seededValue(matchNumber + 40) > 0.66
                        ? 'late'
                        : seededValue(matchNumber + 41) > 0.33
                          ? 'mid'
                          : 'early',
                breakdown: seededValue(matchNumber + teamIndex * 3) > 0.9 ? 'comms' : 'None',
                driverQuality:
                    seededValue(matchNumber + 55) > 0.75
                        ? 'great'
                        : seededValue(matchNumber + 56) > 0.45
                          ? 'good'
                          : seededValue(matchNumber + 57) > 0.2
                            ? 'ok'
                            : 'rough',
                defenseProvided:
                    seededValue(matchNumber + 60) > 0.75
                        ? 'heavy'
                        : seededValue(matchNumber + 61) > 0.4
                          ? 'some'
                          : 'None',
                defenseReceived: seededValue(matchNumber + 63) > 0.55,
                fouls: {
                    pinning: seededValue(matchNumber + 70) > 0.85 ? 1 : 0,
                    towerContactInEndgame: seededValue(matchNumber + 71) > 0.9 ? 1 : 0,
                    outOfZoneShooting: seededValue(matchNumber + 72) > 0.88 ? 1 : 0,
                    ejectedFuel: seededValue(matchNumber + 73) > 0.9 ? 1 : 0,
                    other: seededValue(matchNumber + 74) > 0.95 ? 1 : 0,
                },
                breaks: {
                    mechanism: seededValue(matchNumber + 80) > 0.93 ? 1 : 0,
                    battery: seededValue(matchNumber + 81) > 0.94 ? 1 : 0,
                    comms: seededValue(matchNumber + 82) > 0.93 ? 1 : 0,
                    bumper: seededValue(matchNumber + 83) > 0.93 ? 1 : 0,
                },
                comments: [],
                freeText:
                    seededValue(matchNumber + 91) > 0.65
                        ? `Auto path looked clean in match ${matchNumber}.`
                        : '',
            };
        });
    });

export const fakeSuperIndividual: SuperIndividualDataAggregations[] =
    fakeMatchIndividual.map((entry, index) => ({
        _id: {
            teamNumber: entry._id.teamNumber,
            matchNumber: entry._id.matchNumber,
            robotPosition: entry._id.robotPosition,
        },
        scouterName: entry.scouterName,
        defenseProvided: entry.defenseProvided,
        defenseReceived: entry.defenseReceived,
        fouls: entry.fouls,
        breaks: entry.breaks,
        comments: [],
        humanPlayerFuelScored: Math.round((1 + seededValue(index + 101) * 5) * 10) / 10,
    }));

export const fakePitData: PitResult = {
    254: {
        scouterName: 'Alex',
        teamNumber: 254,
        drivebase: 'swerve',
        maxFuelStorageEstimate: 18,
        intakeSources: {
            depot: true,
            outpostCorral: true,
            floorNeutral: true,
        },
        scoringMethod: 'high-shot',
        preferredScoringSpot: 'nearHub',
        towerCapabilityClaimed: 'level3',
        batteryCount: 6,
        notes: 'Fast cycles, stable shooter, consistent level 3 climbs.',
    },
    1678: {
        scouterName: 'Jordan',
        teamNumber: 1678,
        drivebase: 'swerve',
        maxFuelStorageEstimate: 16,
        intakeSources: {
            depot: true,
            outpostCorral: true,
            floorNeutral: true,
        },
        scoringMethod: 'high-shot',
        preferredScoringSpot: 'nearHub',
        towerCapabilityClaimed: 'level3',
        batteryCount: 5,
        notes: 'Quick alignment, strong tele fuel, good endgame.',
    },
    971: {
        scouterName: 'Priya',
        teamNumber: 971,
        drivebase: 'swerve',
        maxFuelStorageEstimate: 15,
        intakeSources: {
            depot: true,
            outpostCorral: false,
            floorNeutral: true,
        },
        scoringMethod: 'high-shot',
        preferredScoringSpot: 'nearHub',
        towerCapabilityClaimed: 'level2',
        batteryCount: 5,
        notes: 'Accurate shooting, occasional climb failures.',
    },
    4414: {
        scouterName: 'Casey',
        teamNumber: 4414,
        drivebase: 'swerve',
        maxFuelStorageEstimate: 14,
        intakeSources: {
            depot: true,
            outpostCorral: true,
            floorNeutral: false,
        },
        scoringMethod: 'low-shot',
        preferredScoringSpot: 'backOfZone',
        towerCapabilityClaimed: 'level2',
        batteryCount: 4,
        notes: 'Solid defense, slower cycles, prefers zone shots.',
    },
    1323: {
        scouterName: 'Morgan',
        teamNumber: 1323,
        drivebase: 'swerve',
        maxFuelStorageEstimate: 17,
        intakeSources: {
            depot: true,
            outpostCorral: true,
            floorNeutral: true,
        },
        scoringMethod: 'high-shot',
        preferredScoringSpot: 'nearHub',
        towerCapabilityClaimed: 'level3',
        batteryCount: 6,
        notes: 'Fast cycles and reliable level 3 climbs.',
    },
    2056: {
        scouterName: 'Sam',
        teamNumber: 2056,
        drivebase: 'swerve',
        maxFuelStorageEstimate: 18,
        intakeSources: {
            depot: true,
            outpostCorral: true,
            floorNeutral: true,
        },
        scoringMethod: 'high-shot',
        preferredScoringSpot: 'nearHub',
        towerCapabilityClaimed: 'level3',
        batteryCount: 6,
        notes: 'Efficient cycles, excellent endgame consistency.',
    },
    148: {
        scouterName: 'Taylor',
        teamNumber: 148,
        drivebase: 'swerve',
        maxFuelStorageEstimate: 14,
        intakeSources: {
            depot: true,
            outpostCorral: false,
            floorNeutral: true,
        },
        scoringMethod: 'high-shot',
        preferredScoringSpot: 'nearHub',
        towerCapabilityClaimed: 'level2',
        batteryCount: 5,
        notes: 'Aggressive defense, solid tele fuel.',
    },
    118: {
        scouterName: 'Riley',
        teamNumber: 118,
        drivebase: 'swerve',
        maxFuelStorageEstimate: 13,
        intakeSources: {
            depot: true,
            outpostCorral: true,
            floorNeutral: false,
        },
        scoringMethod: 'low-shot',
        preferredScoringSpot: 'backOfZone',
        towerCapabilityClaimed: 'level2',
        batteryCount: 4,
        notes: 'Reliable bot, moderate fuel output.',
    },
    330: {
        scouterName: 'Avery',
        teamNumber: 330,
        drivebase: 'tank',
        maxFuelStorageEstimate: 12,
        intakeSources: {
            depot: true,
            outpostCorral: false,
            floorNeutral: false,
        },
        scoringMethod: 'dump',
        preferredScoringSpot: 'varies',
        towerCapabilityClaimed: 'level1',
        batteryCount: 4,
        notes: 'Defense focused, limited climb capability.',
    },
    604: {
        scouterName: 'Jamie',
        teamNumber: 604,
        drivebase: 'tank',
        maxFuelStorageEstimate: 10,
        intakeSources: {
            depot: true,
            outpostCorral: false,
            floorNeutral: false,
        },
        scoringMethod: 'dump',
        preferredScoringSpot: 'varies',
        towerCapabilityClaimed: 'unknown',
        batteryCount: 3,
        notes: 'Rough cycles, high foul risk, minimal climbs.',
    },
};

export const fakeTeamInfo: TeamData = {
    254: {
        primaryHex: '#e42526',
        secondaryHex: '#111111',
        verified: true,
        info: {
            address: null,
            city: 'San Jose',
            country: 'USA',
            gmaps_place_id: null,
            gmaps_url: null,
            home_championship: null,
            key: 'frc254',
            lat: null,
            lng: null,
            location_name: null,
            motto: null,
            name: 'Bellarmine College Preparatory',
            nickname: 'The Cheesy Poofs',
            postal_code: '95126',
            rookie_year: 1999,
            school_name: 'Bellarmine College Preparatory',
            state_prov: 'CA',
            team_number: 254,
            website: null,
        },
    },
    1678: {
        primaryHex: '#ff6a00',
        secondaryHex: '#003049',
        verified: true,
        info: {
            address: null,
            city: 'Davis',
            country: 'USA',
            gmaps_place_id: null,
            gmaps_url: null,
            home_championship: null,
            key: 'frc1678',
            lat: null,
            lng: null,
            location_name: null,
            motto: null,
            name: 'Davis Senior High School',
            nickname: 'Citrus Circuits',
            postal_code: '95616',
            rookie_year: 2005,
            school_name: 'Davis Senior High School',
            state_prov: 'CA',
            team_number: 1678,
            website: null,
        },
    },
    971: {
        primaryHex: '#0b3d91',
        secondaryHex: '#e5e5e5',
        verified: true,
        info: {
            address: null,
            city: 'Mountain View',
            country: 'USA',
            gmaps_place_id: null,
            gmaps_url: null,
            home_championship: null,
            key: 'frc971',
            lat: null,
            lng: null,
            location_name: null,
            motto: null,
            name: 'Mountain View High School',
            nickname: 'Spartan Robotics',
            postal_code: '94040',
            rookie_year: 2002,
            school_name: 'Mountain View High School',
            state_prov: 'CA',
            team_number: 971,
            website: null,
        },
    },
    4414: {
        primaryHex: '#00bcd4',
        secondaryHex: '#004d40',
        verified: true,
        info: {
            address: null,
            city: 'Carlsbad',
            country: 'USA',
            gmaps_place_id: null,
            gmaps_url: null,
            home_championship: null,
            key: 'frc4414',
            lat: null,
            lng: null,
            location_name: null,
            motto: null,
            name: 'Carlsbad High School',
            nickname: 'HighTide',
            postal_code: '92008',
            rookie_year: 2013,
            school_name: 'Carlsbad High School',
            state_prov: 'CA',
            team_number: 4414,
            website: null,
        },
    },
    1323: {
        primaryHex: '#c8102e',
        secondaryHex: '#8d99ae',
        verified: true,
        info: {
            address: null,
            city: 'Madera',
            country: 'USA',
            gmaps_place_id: null,
            gmaps_url: null,
            home_championship: null,
            key: 'frc1323',
            lat: null,
            lng: null,
            location_name: null,
            motto: null,
            name: 'Madera Community College',
            nickname: 'MadTown Robotics',
            postal_code: '93637',
            rookie_year: 2004,
            school_name: 'Madera Community College',
            state_prov: 'CA',
            team_number: 1323,
            website: null,
        },
    },
    2056: {
        primaryHex: '#c62828',
        secondaryHex: '#111111',
        verified: true,
        info: {
            address: null,
            city: 'Stoney Creek',
            country: 'Canada',
            gmaps_place_id: null,
            gmaps_url: null,
            home_championship: null,
            key: 'frc2056',
            lat: null,
            lng: null,
            location_name: null,
            motto: null,
            name: 'Orchard Park Secondary School',
            nickname: 'OP Robotics',
            postal_code: 'L8J',
            rookie_year: 2007,
            school_name: 'Orchard Park Secondary School',
            state_prov: 'ON',
            team_number: 2056,
            website: null,
        },
    },
    148: {
        primaryHex: '#002b5c',
        secondaryHex: '#f2c300',
        verified: true,
        info: {
            address: null,
            city: 'Greenville',
            country: 'USA',
            gmaps_place_id: null,
            gmaps_url: null,
            home_championship: null,
            key: 'frc148',
            lat: null,
            lng: null,
            location_name: null,
            motto: null,
            name: 'Greenville High School',
            nickname: 'Robowranglers',
            postal_code: '75402',
            rookie_year: 1996,
            school_name: 'Greenville High School',
            state_prov: 'TX',
            team_number: 148,
            website: null,
        },
    },
    118: {
        primaryHex: '#0067b1',
        secondaryHex: '#f5c400',
        verified: true,
        info: {
            address: null,
            city: 'Houston',
            country: 'USA',
            gmaps_place_id: null,
            gmaps_url: null,
            home_championship: null,
            key: 'frc118',
            lat: null,
            lng: null,
            location_name: null,
            motto: null,
            name: 'Clear Falls High School',
            nickname: 'Robonauts',
            postal_code: '77062',
            rookie_year: 1998,
            school_name: 'Clear Falls High School',
            state_prov: 'TX',
            team_number: 118,
            website: null,
        },
    },
    330: {
        primaryHex: '#0077b6',
        secondaryHex: '#ffba08',
        verified: true,
        info: {
            address: null,
            city: 'New Port Richey',
            country: 'USA',
            gmaps_place_id: null,
            gmaps_url: null,
            home_championship: null,
            key: 'frc330',
            lat: null,
            lng: null,
            location_name: null,
            motto: null,
            name: 'Suncoast High School',
            nickname: 'Beach Bots',
            postal_code: '34653',
            rookie_year: 1998,
            school_name: 'Suncoast High School',
            state_prov: 'FL',
            team_number: 330,
            website: null,
        },
    },
    604: {
        primaryHex: '#4f46e5',
        secondaryHex: '#111827',
        verified: true,
        info: {
            address: null,
            city: 'San Jose',
            country: 'USA',
            gmaps_place_id: null,
            gmaps_url: null,
            home_championship: null,
            key: 'frc604',
            lat: null,
            lng: null,
            location_name: null,
            motto: null,
            name: 'Lynbrook High School',
            nickname: 'Quixilver',
            postal_code: '95129',
            rookie_year: 2001,
            school_name: 'Lynbrook High School',
            state_prov: 'CA',
            team_number: 604,
            website: null,
        },
    },
};
