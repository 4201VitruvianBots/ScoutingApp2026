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

interface SimpleTeam {
    team_number: number;
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
const teams = data.map(team => team.team_number).sort((a, b) => a - b);

const destinationPath = path.resolve(REPO_ROOT, 'app_settings/teams_list.txt');
fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
fs.writeFileSync(destinationPath, `${teams.join('\n')}\n`);

console.log(`Wrote ${teams.length} teams to ${destinationPath}`);
