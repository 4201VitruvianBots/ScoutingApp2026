import { startDockerContainer } from 'database';
import mongoose from 'mongoose';
import { matchApp, superApp, leaderboardApp } from '../src/Schema.js';
import {
    CommentValues,
    MatchData,
    SuperData,
    ScouterData,
    AutoFuelWinner,
} from 'requests';
import { dotenvLoad } from 'dotenv-mono';

function randint(max: number, min = 0) {
    return Math.floor((max - min) * Math.random()) + min;
}

function choose<T>(array: T[]) {
    return array[randint(array.length)];
}

await startDockerContainer(process.env.CONTAINER_NAME);
await mongoose.connect('mongodb://0.0.0.0:27017/');

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

dotenvLoad({ path: '.env' });
dotenvLoad({ path: '.env.local' });

const apiKey = process.env.API_KEY!;
const eventKey = process.env.EVENT_KEY!;

interface SimpleTeam {
    key: string;
    team_number: number;
    nickname?: string;
    name: string;
    city?: string;
    state_prov?: string;
    country?: string;
}

const result = await fetch(
    `https://www.thebluealliance.com/api/v3/event/${eventKey}/teams/simple`,
    {
        headers: {
            'X-TBA-Auth-Key': apiKey,
        },
    }
);

const data = (await result.json()) as SimpleTeam[];
const teams = data.map(e => e.team_number).sort((a, b) => a - b);

const autoFuelWinners: AutoFuelWinner[] = ['red', 'blue', 'tie', 'unknown'];

for (let matchNumber = 1; matchNumber < 200; matchNumber++) {
    for (const robotPosition of [
        'red_1',
        'red_2',
        'red_3',
        'blue_1',
        'blue_2',
        'blue_3',
    ] as const) {
        const team = choose(teams);
        const autoFuelWinner = choose(autoFuelWinners);
        await new matchApp({
            metadata: {
                robotPosition,
                robotTeam: team,
                scouterName: 'Jim',
                matchNumber: matchNumber,
            },
            robotAbsent: false,
            autoStartingPosition: choose(['left', 'center', 'right', null]),
            autoMoved: Math.random() > 0.2,
            autoFuelScored: randint(12),
            autoTower: choose(['none', 'level1', 'failed']),
            autoFuelWinner,
            shift1ActiveHubIfTie:
                autoFuelWinner === 'tie' ? choose(['red', 'blue']) : null,
            teleFuelBySegment: {
                transition: randint(8),
                shift1: randint(15),
                shift2: randint(15),
                shift3: randint(15),
                shift4: randint(15),
                endgame: randint(10),
            },
            teleTower: choose(['none', 'level1', 'level2', 'level3', 'failed']),
            climbTimeBucket: choose(['early', 'mid', 'late', null]),
            breakdown: choose(['none', 'stuck', 'tipped', 'comms', 'mechanism']),
            driverQuality: choose(['great', 'good', 'ok', 'rough']),
            freeText: '',
        } satisfies MatchData).save();

        await new superApp({
            metadata: {
                robotPosition,
                scouterName: 'Jim',
                robotTeam: team,
                matchNumber: matchNumber,
            },
            fouls: {
                pinning: randint(2),
                towerContactInEndgame: randint(2),
                outOfZoneShooting: randint(2),
                ejectedFuel: randint(2),
                other: randint(2),
            },
            breaks: {
                mechanism: randint(2),
                battery: randint(2),
                comms: randint(2),
                bumper: randint(2),
            },
            defenseProvided: choose(['none', 'some', 'heavy']),
            defenseReceived: Math.random() > 0.5,
            comments: comments.filter(() => randint(4) === 0),
            humanPlayerFuelScored: randint(6),
        } satisfies SuperData).save();
    }
}

for (let scouterNumber = 1; scouterNumber < 60; scouterNumber++) {
    await new leaderboardApp({
        scouterName: choose([
            'Vanessa',
            'Crisanto',
            'Christian',
            'Nathan',
            'Ashreeya',
            'Tica',
        ]),
        accuracy: randint(100),
    } satisfies ScouterData).save();
}

await mongoose.disconnect();
