import mongoose from 'mongoose';
import { CommentValues, MatchData, PitFile, SuperData, ScouterData } from 'requests';

const matchappsMetaDataSchema = {
    scouterName: String,
    matchNumber: Number,
    robotTeam: Number,
    robotPosition: {
        type: String,
        enum: ['red_1', 'red_2', 'red_3', 'blue_1', 'blue_2', 'blue_3'],
    },
};

const superappsMetaDataSchema = {
    scouterName: String,
    matchNumber: Number,
    robotTeam: Number,
    robotPosition: {
        type: String,
        enum: ['red_1', 'red_2', 'red_3', 'blue_1', 'blue_2', 'blue_3'],
    },
};

const coral = {
    L1: Number,
    L2: Number,
    L3: Number,
    L4: Number
};
const algae = {
    netRobot: Number,
    processor: Number,
    remove: Number
};

const StartingZone = {
    start1: Boolean,
    start2: Boolean,
    start3: Boolean,
}

const pickup = {
    source1: Boolean,
    source2: Boolean,
    ground1: Boolean,
    ground2: Boolean,
    ground3: Boolean
}

const placeLocation = {
    deposit1: Boolean,
    deposit2: Boolean,
    deposit3: Boolean,
    deposit4: Boolean,
    deposit5: Boolean,
    deposit6: Boolean,
}

const matchDataSchema = new mongoose.Schema<MatchData>({
    metadata: matchappsMetaDataSchema,
    leftStartingZone: Boolean,
    startingZone: StartingZone,
    pickupLocation: pickup,
    placement: placeLocation,
    autoCoral: coral,
    autoAlgae: algae,
    teleCoral: coral, 
    teleAlgae: algae,
    climb: {
        type: String,
        enum: ['shallow','deep', 'park', 'none', 'failed'],
    },
});

const superScoutDataSchema = new mongoose.Schema<SuperData>({
    metadata: superappsMetaDataSchema,
    fouls: {
        insideRobot: Number,
        protectedZone: Number,
        pinning: Number,
        multiplePieces: Number,
        cageFoul: Number,
        other: Number,
    },
    break: {
        mechanismDmg: Number,
        batteryFall: Number,
        commsFail: Number,
        bumperFall: Number
    },
    defense: {
        type: String,
        enum: ['fullDef', 'someDef', 'noDef'],
    },
    defended: Boolean,
    humanShooter: { 
            Success: Number,
            Failed: Number,
    },
    // Are you asking about this error?
    // Currently the error is it's supposed to be a string array but it's only a string
    // yeah I am
    /*n different error now

*/
    comments: [
        {
            type: String,
            enum: [
                'great_driving',
                'good_driving',
                'source_only',
                'clogging',
                'effective_defense',
                'okay_defense',
                'knock_pieces',
                'coral stuck',
                'algae stuck',
                'ineffective_defense',
                'sturdy_build',
                'weak_build',
                'avoids_under_stage',
            ] satisfies CommentValues[],
        },
    ],
});

const leaderboardDataSchema = new mongoose.Schema<ScouterData> ({
    scouterName: String,
    accuracy: Number,
});


type PitDataSchemaType = {
    [K in keyof PitFile]: K extends 'photo' ? Buffer : PitFile[K];
};

const pitDataSchema = new mongoose.Schema<PitDataSchemaType>({
    scouterName: String,
    teamNumber: Number,
    pitBatteryCount: Number,
    hopperIntake: Boolean,
    photo: Buffer,
    comments: String,
});

// const ssApp = ('ssApp', superScoutDataSchema);
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
