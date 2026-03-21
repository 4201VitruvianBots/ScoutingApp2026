import mongoose from 'mongoose';
import {
    AutoFieldOrientationSetting,
    BallsPerSecondSetting,
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
    scouterName: { type: String, required: true, default: '' },
    matchNumber: { type: Number, required: true, min: 1 },
    robotTeam: { type: Number, required: true, min: 1 },
    robotPosition: {
        type: String,
        enum: robotPositions,
        required: true,
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

const actionIntervalSchema = {
    action: {
        type: String,
        enum: ['shoot', 'pass'],
        required: true,
    },
    startSec: { type: Number, required: true, min: 0 },
    endSec: { type: Number, required: true, min: 0 },
    durationSec: { type: Number, required: true, min: 0 },
};

const matchActionTimelineSchema = {
    totalSec: { type: Number, required: true, min: 0 },
    autoEndSec: { type: Number, required: true, min: 0 },
    delayEndSec: { type: Number, required: true, min: 0 },
    intervals: [actionIntervalSchema],
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
    shootTimeBySegment: actionTimeBySegmentSchema,
    passTimeBySegment: actionTimeBySegmentSchema,
    actionTimeline: {
        type: matchActionTimelineSchema,
        default: null,
    },
    ballsPerSecondUsed: { type: Number, default: 5 },
    autoFuelScored: { type: Number, default: 0 },
    teleFuelBySegment: teleFuelBySegmentSchema,
    teleTower: {
        type: String,
        enum: ['None', 'level1', 'level2', 'level3', 'Failed'],
        default: 'None',
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
    freeText: { type: String, default: '' },
});

matchDataSchema.index(
    { 'metadata.robotTeam': 1, 'metadata.matchNumber': 1 },
    { unique: true }
);
matchDataSchema.index({ 'metadata.matchNumber': 1, 'metadata.robotPosition': 1 });

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

const autoFieldOrientationSchema = new mongoose.Schema<AutoFieldOrientationSetting>({
    side: {
        type: String,
        enum: ['red', 'blue'],
        required: true,
    },
    orientation: {
        type: String,
        enum: ['orientation1', 'orientation2'],
        required: true,
        default: 'orientation1',
    },
});

autoFieldOrientationSchema.index({ side: 1 }, { unique: true });

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
const autoFieldOrientationApp = mongoose.model<AutoFieldOrientationSetting>(
    'autoFieldOrientationApp',
    autoFieldOrientationSchema
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
    autoFieldOrientationApp,
    autoFieldOrientationSchema,
};
