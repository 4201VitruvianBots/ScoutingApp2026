import mongoose from 'mongoose';
import { CommentValues, MatchData, PitFile, SuperData, ScouterData } from 'requests';

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

const superappsMetaDataSchema = {
    scouterName: String,
    matchNumber: Number,
    robotTeam: Number,
    robotPosition: {
        type: String,
        enum: robotPositions,
    },
};

const matchDataSchema = new mongoose.Schema<MatchData>({
    metadata: matchappsMetaDataSchema,
    robotAbsent: Boolean,
    autoStartingPosition: {
        type: String,
        enum: ['left', 'center', 'right', null],
        default: null,
    },
    autoMoved: Boolean,
    autoFuelScored: Number,
    autoTower: {
        type: String,
        enum: ['none', 'level1', 'failed'],
    },
    autoFuelWinner: {
        type: String,
        enum: ['red', 'blue', 'tie', 'unknown'],
    },
    shift1ActiveHubIfTie: {
        type: String,
        enum: ['red', 'blue', null],
        default: null,
    },
    teleFuelBySegment: {
        transition: Number,
        shift1: Number,
        shift2: Number,
        shift3: Number,
        shift4: Number,
        endgame: Number,
    },
    teleTower: {
        type: String,
        enum: ['none', 'level1', 'level2', 'level3', 'failed'],
    },
    climbTimeBucket: {
        type: String,
        enum: ['early', 'mid', 'late', null],
        default: null,
    },
    breakdown: {
        type: String,
        enum: ['none', 'stuck', 'tipped', 'comms', 'mechanism', 'other'],
    },
    driverQuality: {
        type: String,
        enum: ['great', 'good', 'ok', 'rough'],
    },
    freeText: String,
});

const superScoutDataSchema = new mongoose.Schema<SuperData>({
    metadata: superappsMetaDataSchema,
    defenseProvided: {
        type: String,
        enum: ['none', 'some', 'heavy'],
    },
    defenseReceived: Boolean,
    fouls: {
        pinning: Number,
        towerContactInEndgame: Number,
        outOfZoneShooting: Number,
        ejectedFuel: Number,
        other: Number,
    },
    breaks: {
        mechanism: Number,
        battery: Number,
        comms: Number,
        bumper: Number,
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
    humanPlayerFuelScored: Number,
});

const leaderboardDataSchema = new mongoose.Schema<ScouterData>({
    scouterName: String,
    accuracy: Number,
});

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

const pitApp = mongoose.model('pitApp', pitDataSchema);
const matchApp = mongoose.model('matchApp', matchDataSchema);
const superApp = mongoose.model('superApp', superScoutDataSchema);
const leaderboardApp = mongoose.model('leaderboardApp', leaderboardDataSchema);

export {
    matchApp,
    pitApp,
    matchDataSchema,
    pitDataSchema,
    superApp,
    superScoutDataSchema,
    leaderboardApp,
    leaderboardDataSchema,
};
