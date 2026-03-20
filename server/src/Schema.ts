import mongoose from 'mongoose';
import {
    BallsPerSecondSetting,
    CommentValues,
    MatchData,
    PitFile,
    ScouterData,
} from 'requests';

const robotPositions = [
    'red_1',
    'red_2',
    'red_3',
    'red_4',
    'blue_1',
    'blue_2',
    'blue_3',
    'blue_4',
] as const;

const matchappsMetaDataSchema = {
    scouterName: String,
    matchNumber: Number,
    robotTeam: Number,
    robotPosition: {
        type: String,
        enum: robotPositions,
    },
};

const actionTimeBySegmentSchema = {
    auto: { type: Number, default: 0 },
    transition: { type: Number, default: 0 },
    shift1: { type: Number, default: 0 },
    shift2: { type: Number, default: 0 },
    shift3: { type: Number, default: 0 },
    shift4: { type: Number, default: 0 },
    endgame: { type: Number, default: 0 },
};

const autoPathPointSchema = {
    x: { type: Number, required: true, min: 0, max: 1 },
    y: { type: Number, required: true, min: 0, max: 1 },
    tSec: { type: Number, required: true, min: 0 },
};

const autoPathTraceSchema = {
    alliance: {
        type: String,
        enum: ['red', 'blue'],
    },
    startPosition: {
        type: String,
        enum: ['left', 'center', 'right', null],
        default: null,
    },
    points: [autoPathPointSchema],
    shotMarkers: [autoPathPointSchema],
    fingerprint: { type: String, default: '' },
};

const teleFuelBySegmentSchema = {
    transition: { type: Number, default: 0 },
    shift1: { type: Number, default: 0 },
    shift2: { type: Number, default: 0 },
    shift3: { type: Number, default: 0 },
    shift4: { type: Number, default: 0 },
    endgame: { type: Number, default: 0 },
};

const matchDataSchema = new mongoose.Schema<MatchData>({
    metadata: matchappsMetaDataSchema,
    robotAbsent: { type: Boolean, default: false },
    autoStartingPosition: {
        type: String,
        enum: ['left', 'center', 'right', null],
        default: null,
    },
    autoPath: {
        type: autoPathTraceSchema,
        default: null,
    },
    autoMoved: { type: Boolean, default: false },
    shootTimeBySegment: actionTimeBySegmentSchema,
    passTimeBySegment: actionTimeBySegmentSchema,
    ballsPerSecondUsed: { type: Number, default: 5 },
    autoFuelScored: { type: Number, default: 0 },
    autoTower: {
        type: String,
        enum: ['None', 'level1', 'Failed'],
        default: 'None',
    },
    autoFuelWinner: {
        type: String,
        enum: ['red', 'blue', 'tie', 'unknown'],
        default: 'unknown',
    },
    shift1ActiveHubIfTie: {
        type: String,
        enum: ['red', 'blue', null],
        default: null,
    },
    teleFuelBySegment: teleFuelBySegmentSchema,
    teleTower: {
        type: String,
        enum: ['None', 'level1', 'level2', 'level3', 'Failed'],
        default: 'None',
    },
    climbTimeBucket: {
        type: String,
        enum: ['early', 'mid', 'late', null],
        default: null,
    },
    breakdown: {
        type: String,
        enum: ['None', 'stuck', 'tipped', 'comms', 'mechanism', 'other'],
        default: 'None',
    },
    driverQuality: {
        type: String,
        enum: ['great', 'good', 'ok', 'rough'],
        default: 'ok',
    },
    defenseProvided: {
        type: String,
        enum: ['None', 'some', 'heavy'],
        default: 'None',
    },
    defenseReceived: { type: Boolean, default: false },
    fouls: {
        pinning: { type: Number, default: 0 },
        towerContactInEndgame: { type: Number, default: 0 },
        outOfZoneShooting: { type: Number, default: 0 },
        ejectedFuel: { type: Number, default: 0 },
        other: { type: Number, default: 0 },
    },
    breaks: {
        mechanism: { type: Number, default: 0 },
        battery: { type: Number, default: 0 },
        comms: { type: Number, default: 0 },
        bumper: { type: Number, default: 0 },
    },
    comments: [
        {
            type: String,
            enum: [
                'great_driving',
                'good_driving',
                'ok_driving',
                'rough_driving',
                'fast_cycles',
                'drops_fuel',
                'accurate_shots',
                'inaccurate_shots',
                'aggressive_defense',
                'smart_defense',
                'defense_liability',
                'fast_climb',
                'slow_climb',
                'no_climb',
            ] satisfies CommentValues[],
        },
    ],
    freeText: { type: String, default: '' },
});

const leaderboardDataSchema = new mongoose.Schema<ScouterData>({
    scouterName: String,
    accuracy: Number,
});

const ballsPerSecondDataSchema = new mongoose.Schema<BallsPerSecondSetting>({
    matchNumber: { type: Number, required: true },
    robotTeam: { type: Number, required: true },
    ballsPerSecond: { type: Number, required: true, min: 0, default: 5 },
});

ballsPerSecondDataSchema.index(
    { matchNumber: 1, robotTeam: 1 },
    { unique: true }
);

type PitDataSchemaType = {
    [K in keyof PitFile]: K extends 'photo' ? Buffer : PitFile[K];
};

const pitDataSchema = new mongoose.Schema<PitDataSchemaType>({
    scouterName: String,
    teamNumber: Number,
    drivebase: {
        type: String,
        enum: ['tank', 'swerve', 'other'],
    },
    maxFuelStorageEstimate: { type: Number, default: null },
    intakeSources: {
        depot: Boolean,
        outpostCorral: Boolean,
        floorNeutral: Boolean,
    },
    scoringMethod: {
        type: String,
        enum: ['dump', 'low-shot', 'high-shot', 'other'],
    },
    preferredScoringSpot: {
        type: String,
        enum: ['nearHub', 'backOfZone', 'varies'],
    },
    towerCapabilityClaimed: {
        type: String,
        enum: ['level1', 'level2', 'level3', 'unknown'],
    },
    batteryCount: Number,
    photo: Buffer,
    notes: String,
});

const pitApp = mongoose.model<PitDataSchemaType>('pitApp', pitDataSchema);
const matchApp = mongoose.model<MatchData>('matchApp', matchDataSchema);
const leaderboardApp = mongoose.model<ScouterData>(
    'leaderboardApp',
    leaderboardDataSchema
);
const ballsPerSecondApp = mongoose.model<BallsPerSecondSetting>(
    'ballsPerSecondApp',
    ballsPerSecondDataSchema
);

export {
    matchApp,
    pitApp,
    matchDataSchema,
    pitDataSchema,
    leaderboardApp,
    leaderboardDataSchema,
    ballsPerSecondApp,
    ballsPerSecondDataSchema,
};
