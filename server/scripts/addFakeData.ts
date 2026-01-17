import { startDockerContainer } from 'database';
import mongoose from 'mongoose';
import { matchApp, superApp, leaderboardApp } from '../src/Schema.js';
import { CommentValues, MatchData, SuperData, ScouterData } from 'requests';
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
    'source_only',
    'clogging',
    'effective_defense',
    'okay_defense',
    'ineffective_defense',
    'sturdy_build',
    'weak_build',
    'avoids_under_stage',
];

// const scouterLeaderName: leaderboardValues[] = [
//     'Vanessa',
//     'Crisanto',
//     'Christian',
//     'Nathan',
//     'Ashreeya',
//     'Tica',
//];

dotenvLoad({ path: '.env' });
dotenvLoad({ path: '.env.local' });

const apiKey = process.env.API_KEY!;
const eventKey = process.env.EVENT_KEY!;
console.log(apiKey);

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

console.log(result.status);

const data = (await result.json()) as SimpleTeam[];
console.log(data);
const teams = data.map(e => e.team_number).sort((a, b) => a - b);
console.log(teams);

for (let matchNumber = 1; matchNumber < 400; matchNumber++) {
    for (const robotPosition of [
        'red_1',
        'red_2',
        'red_3',
        'blue_1',
        'blue_2',
        'blue_3',
    ] as const) {
        console.log(matchNumber);
        const team = choose(teams);
        await new matchApp({
            autoCoral: {
                L1: randint(5),
                L2: randint(5),
                L3: randint(5),
                L4: randint(5),
                
            },
            autoAlgae: {
                netRobot: randint(5),
                processor: randint(5),
                removed: randint(5),
            },
            climb: choose([
                'shallow',
                'deep',
                'park',
                'none',
                'failed',
            ]),
            leftStartingZone: Math.random() > 0.5,
            metadata: {
                robotPosition,
                robotTeam: team,
                scouterName: 'Jim',
                matchNumber: matchNumber,
            },
            teleCoral: {
                L1: randint(10),
                L2: randint(10),
                L3: randint(10),
                L4: randint(10),
            },
            teleAlgae: {
                netRobot: randint(5),
                processor: randint(5),
                removed: 0
            },

        } satisfies MatchData).save();

        await new superApp({
            metadata: {
                robotPosition,
                scouterName: 'Jim',
                robotTeam: team,
                matchNumber: matchNumber,
            },
            fouls: {
                insideRobot: randint(2),
                protectedZone: randint(2),
                multiplePieces: randint(2),
                other: randint(2),
                pinning: randint(2),
                cageFoul: randint(2)
            },
            break: {
                batteryFall: randint(2),
                commsFail: randint(2),
                mechanismDmg: randint(2),
            },
            defense: choose(['fullDef', 'someDef', 'noDef']),
            defended: Math.random() > 0.5,
            comments: comments.filter(() => randint(4) === 0),
            humanShooter:
                randint(3) === 0
                    ? {
                          Net: Math.random() > 0.5,
                      }
                    : undefined,
            netHuman: randint(4)        
        } satisfies SuperData).save();
    }
}

for (let scouterNumber = 1; scouterNumber < 100; scouterNumber++) {
    console.log(scouterNumber);
        await new leaderboardApp({                
            
                scouterName:choose(['Vanessa', 'Crisanto', 'Christian', 'Nathan', 'Ashreeya', 'Tica']),
                accuracy: randint(100),
            

        } satisfies ScouterData).save();

}

await mongoose.disconnect();
