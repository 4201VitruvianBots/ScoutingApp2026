import fetch from 'node-fetch';
import { dotenvLoad } from 'dotenv-mono';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenvLoad({ path: '.env' });
dotenvLoad({ path: '.env.local' });
const apiKey = process.env.API_KEY!;
const eventKey = process.env.EVENT_KEY!;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

interface SimpleMatch {
    match_number: number;
    alliances: {
        [_ in 'red' | 'blue']: {
            team_keys: string[];
        };
    };
}

const result = await fetch(
    `https://www.thebluealliance.com/api/v3/event/${eventKey}/matches/simple`,
    {
        headers: {
            'X-TBA-Auth-Key': apiKey,
        },
    }
);

function teamNumber(teamString: string) {
    return Number.parseInt(teamString.slice(3), 10);
}

const data = (await result.json()) as SimpleMatch[];
const schedule = Object.fromEntries(
    [...data]
        .sort((a, b) => a.match_number - b.match_number)
        .map(match => [
            match.match_number,
            {
                red_1: teamNumber(match.alliances.red.team_keys[0]),
                red_2: teamNumber(match.alliances.red.team_keys[1]),
                red_3: teamNumber(match.alliances.red.team_keys[2]),
                blue_1: teamNumber(match.alliances.blue.team_keys[0]),
                blue_2: teamNumber(match.alliances.blue.team_keys[1]),
                blue_3: teamNumber(match.alliances.blue.team_keys[2]),
            },
        ])
);

const destinationPath = path.resolve(REPO_ROOT, 'app_settings/match_schedule.json');
fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
fs.writeFileSync(destinationPath, JSON.stringify(schedule, null, 2));

console.log(`Wrote ${Object.keys(schedule).length} matches to ${destinationPath}`);
