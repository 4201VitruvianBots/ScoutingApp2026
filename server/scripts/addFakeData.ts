import fs from 'fs';
import path from 'path';
import { startDockerContainer } from 'database';
import mongoose from 'mongoose';
import { leaderboardApp, matchApp, pitApp, superApp } from '../src/Schema.js';
import {
    AutoFuelWinner,
    CommentValues,
    Drivebase,
    MatchData,
    PitFile,
    PreferredScoringSpot,
    ScoringMethod,
    ScouterData,
    SuperData,
    TowerCapabilityClaimed,
} from 'requests';
import { dotenvLoad } from 'dotenv-mono';

dotenvLoad({ path: '.env' });
dotenvLoad({ path: '.env.local' });

function randint(max: number, min = 0) {
    return Math.floor((max - min) * Math.random()) + min;
}

function randfloat(max: number, min = 0) {
    return (max - min) * Math.random() + min;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function choose<T>(array: T[]) {
    return array[randint(array.length)];
}

function chance(probability: number) {
    return Math.random() < probability;
}

function shuffle<T>(array: T[]) {
    return [...array].sort(() => Math.random() - 0.5);
}

function parseBoolean(value: string | undefined, fallback: boolean) {
    if (!value) return fallback;
    return ['1', 'true', 'yes', 'y'].includes(value.toLowerCase());
}

function parseNumber(value: string | undefined, fallback: number) {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function weightedChoice<T>(choices: Array<[T, number]>) {
    const total = choices.reduce((sum, [, weight]) => sum + weight, 0);
    const roll = Math.random() * total;
    let cursor = 0;
    for (const [value, weight] of choices) {
        cursor += weight;
        if (roll <= cursor) return value;
    }
    return choices[choices.length - 1][0];
}

const mongoUrl = process.env.MONGO_URL ?? 'mongodb://0.0.0.0:27017/';
const matchCount = parseNumber(process.env.FAKE_MATCH_COUNT, 60);
const teamCount = parseNumber(process.env.FAKE_TEAM_COUNT, 36);
const teamStart = parseNumber(process.env.FAKE_TEAM_START, 1000);
const scouterCount = parseNumber(process.env.FAKE_SCOUTER_COUNT, 12);
const shouldClear = parseBoolean(process.env.FAKE_CLEAR, true);
const includePit = parseBoolean(process.env.FAKE_INCLUDE_PIT, true);
const includeLeaderboard = parseBoolean(
    process.env.FAKE_INCLUDE_LEADERBOARD,
    true
);

await startDockerContainer(process.env.CONTAINER_NAME);
await mongoose.connect(mongoUrl);

if (shouldClear) {
    await matchApp.deleteMany({});
    await superApp.deleteMany({});
    await pitApp.deleteMany({});
    await leaderboardApp.deleteMany({});
}

const comments: CommentValues[] = [
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
];

const robotPositions = [
    'red_1',
    'red_2',
    'red_3',
    'blue_1',
    'blue_2',
    'blue_3',
] as const;

const scouterNamesBase = [
    'Vanessa',
    'Crisanto',
    'Christian',
    'Nathan',
    'Ashreeya',
    'Tica',
    'Jim',
    'Ari',
    'Jordan',
    'Sam',
];

const drivebases: Drivebase[] = ['tank', 'swerve', 'other'];
const scoringMethods: ScoringMethod[] = ['dump', 'low-shot', 'high-shot', 'other'];
const preferredScoringSpots: PreferredScoringSpot[] = [
    'nearHub',
    'backOfZone',
    'varies',
];
const towerCapabilities: TowerCapabilityClaimed[] = [
    'level1',
    'level2',
    'level3',
    'unknown',
];

const autoFuelWinners: AutoFuelWinner[] = ['red', 'blue', 'tie', 'unknown'];

type TeamProfile = {
    auto: number;
    tele: number;
    climb: number;
    defense: number;
    discipline: number;
    reliability: number;
};

function loadTeams() {
    const fromEnv = (process.env.FAKE_TEAMS ?? '')
        .split(/[,\s]+/)
        .map(value => Number.parseInt(value, 10))
        .filter(value => Number.isFinite(value));
    if (fromEnv.length) {
        return Array.from(new Set(fromEnv)).sort((a, b) => a - b);
    }

    const teamInfoPath = path.resolve('static/team_info.json');
    if (fs.existsSync(teamInfoPath)) {
        const raw = JSON.parse(fs.readFileSync(teamInfoPath, 'utf-8')) as Record<
            string,
            unknown
        >;
        const teamNumbers = Object.keys(raw)
            .map(value => Number.parseInt(value, 10))
            .filter(value => Number.isFinite(value));
        if (teamNumbers.length) {
            return teamNumbers.sort((a, b) => a - b);
        }
    }

    return Array.from({ length: teamCount }, (_, index) => teamStart + index);
}

function createProfile(): TeamProfile {
    return {
        auto: randfloat(1, 0.2),
        tele: randfloat(1, 0.2),
        climb: randfloat(1, 0.2),
        defense: randfloat(1, 0.2),
        discipline: randfloat(1, 0.2),
        reliability: randfloat(1, 0.2),
    };
}

function buildScouterNames(count: number) {
    if (count <= scouterNamesBase.length) return scouterNamesBase.slice(0, count);
    const names = [...scouterNamesBase];
    while (names.length < count) {
        names.push(`Scout ${names.length + 1}`);
    }
    return names;
}

const teams = loadTeams();
const scouterNames = buildScouterNames(scouterCount);
const profiles = new Map<number, TeamProfile>();
teams.forEach(team => profiles.set(team, createProfile()));

const segmentWeights = [0.16, 0.18, 0.17, 0.17, 0.17, 0.15];

for (let matchNumber = 1; matchNumber <= matchCount; matchNumber++) {
    const matchTeams = shuffle(teams).slice(0, robotPositions.length);

    for (const [index, robotPosition] of robotPositions.entries()) {
        const team = matchTeams[index] ?? choose(teams);
        const profile = profiles.get(team) ?? createProfile();

        const robotAbsent = chance(0.03 + (1 - profile.reliability) * 0.08);
        const autoFuelWinner = weightedChoice<AutoFuelWinner>([
            ['red', 0.44],
            ['blue', 0.44],
            ['tie', 0.08],
            ['unknown', 0.04],
        ]);
        const shift1ActiveHubIfTie =
            autoFuelWinner === 'tie' ? choose(['red', 'blue']) : null;

        const autoFuelScored = robotAbsent
            ? 0
            : clamp(Math.round(profile.auto * 12 + randfloat(4, -2)), 0, 18);
        const teleTotal = robotAbsent
            ? 0
            : clamp(Math.round(profile.tele * 48 + randfloat(12, -8)), 0, 70);
        const teleSegments = segmentWeights.map(weight =>
            robotAbsent
                ? 0
                : clamp(Math.round(teleTotal * weight + randfloat(3, -2)), 0, 30)
        );

        const climbAttempt = !robotAbsent && chance(0.3 + profile.climb * 0.6);
        const climbFail = climbAttempt && chance(0.15 + (1 - profile.climb) * 0.2);
        const teleTower = climbAttempt
            ? climbFail
                ? 'failed'
                : weightedChoice([
                      ['level1', 0.45],
                      ['level2', 0.35],
                      ['level3', 0.2],
                  ])
            : 'none';

        const matchData: MatchData = {
            metadata: {
                robotPosition,
                robotTeam: team,
                scouterName: choose(scouterNames),
                matchNumber,
            },
            robotAbsent,
            autoStartingPosition: robotAbsent
                ? null
                : choose(['left', 'center', 'right', null]),
            autoMoved: robotAbsent ? false : chance(0.85),
            autoFuelScored,
            autoTower: robotAbsent ? 'none' : choose(['none', 'level1', 'failed']),
            autoFuelWinner,
            shift1ActiveHubIfTie,
            teleFuelBySegment: {
                transition: teleSegments[0],
                shift1: teleSegments[1],
                shift2: teleSegments[2],
                shift3: teleSegments[3],
                shift4: teleSegments[4],
                endgame: teleSegments[5],
            },
            teleTower,
            climbTimeBucket: teleTower === 'none' ? null : choose(['early', 'mid', 'late', null]),
            breakdown: robotAbsent
                ? 'none'
                : chance(0.02 + (1 - profile.reliability) * 0.08)
                ? choose(['stuck', 'tipped', 'comms', 'mechanism', 'other'])
                : 'none',
            driverQuality: weightedChoice([
                ['great', 0.2 + profile.tele * 0.35],
                ['good', 0.35],
                ['ok', 0.3],
                ['rough', 0.15 + (1 - profile.tele) * 0.2],
            ]),
            freeText: '',
        };

        await matchApp
            .replaceOne(
                {
                    'metadata.robotTeam': team,
                    'metadata.matchNumber': matchNumber,
                },
                matchData
            )
            .setOptions({ upsert: true });

        const commentPool = comments.filter(() => chance(0.18));
        const defenseProvided = weightedChoice([
            ['none', 0.45],
            ['some', 0.35],
            ['heavy', 0.2 + profile.defense * 0.2],
        ]);

        const superData: SuperData = {
            metadata: {
                robotPosition,
                scouterName: choose(scouterNames),
                robotTeam: team,
                matchNumber,
            },
            fouls: {
                pinning: randint(2 - Math.floor(profile.discipline * 2)),
                towerContactInEndgame: randint(2 - Math.floor(profile.discipline * 2)),
                outOfZoneShooting: randint(2 - Math.floor(profile.discipline * 2)),
                ejectedFuel: randint(2 - Math.floor(profile.discipline * 2)),
                other: randint(2 - Math.floor(profile.discipline * 2)),
            },
            breaks: {
                mechanism: randint(2 - Math.floor(profile.reliability * 2)),
                battery: randint(2 - Math.floor(profile.reliability * 2)),
                comms: randint(2 - Math.floor(profile.reliability * 2)),
                bumper: randint(2 - Math.floor(profile.reliability * 2)),
            },
            defenseProvided,
            defenseReceived: chance(0.3 + profile.defense * 0.4),
            comments: commentPool,
            humanPlayerFuelScored: randint(7),
        };

        await superApp
            .replaceOne(
                {
                    'metadata.robotTeam': team,
                    'metadata.matchNumber': matchNumber,
                },
                superData
            )
            .setOptions({ upsert: true });
    }
}

if (includePit) {
    for (const team of teams) {
        const profile = profiles.get(team) ?? createProfile();
        const pitEntry: Omit<PitFile, 'photo'> & { photo: Buffer } = {
            scouterName: choose(scouterNames),
            teamNumber: team,
            drivebase: choose(drivebases),
            maxFuelStorageEstimate: chance(0.15)
                ? null
                : clamp(Math.round(profile.tele * 40 + randfloat(12, 4)), 0, 60),
            intakeSources: {
                depot: chance(0.75),
                outpostCorral: chance(0.5),
                floorNeutral: chance(0.6),
            },
            scoringMethod: choose(scoringMethods),
            preferredScoringSpot: choose(preferredScoringSpots),
            towerCapabilityClaimed: choose(towerCapabilities),
            batteryCount: clamp(randint(7), 0, 6),
            photo: Buffer.from([]),
            notes: '',
        };

        await pitApp
            .replaceOne({ teamNumber: team }, pitEntry)
            .setOptions({ upsert: true });
    }
}

if (includeLeaderboard) {
    const leaderboardEntries: ScouterData[] = scouterNames.map(name => ({
        scouterName: name,
        accuracy: clamp(Math.round(randfloat(100, 55)), 40, 100),
    }));
    await leaderboardApp.insertMany(leaderboardEntries);
}

await mongoose.disconnect();
