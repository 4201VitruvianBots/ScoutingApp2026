import fetch from 'node-fetch';
import { dotenvLoad } from 'dotenv-mono';
import fs from 'fs';
import { TeamData, TeamInfo } from 'requests';

interface ColorData {
    primaryHex: string;
    secondaryHex: string;
    verified: boolean;
}

// avatar info is a list of multiple
type AvatarData = {
    foreign_key: string;
    preferred: boolean;
    type:
        | 'youtube'
        | 'cdphotothread'
        | 'imgur'
        | 'facebook-profile'
        | 'youtube-channel'
        | 'twitter-profile'
        | 'github-profile'
        | 'instagram-profile'
        | 'periscope-profile'
        | 'gitlab-profile'
        | 'grabcad'
        | 'instagram-image'
        | 'external-link'
        | 'avatar';
    details: {
        base64Image: string;
    };
    direct_url: string;
    view_url: string;
}[];

dotenvLoad({ path: '.env' });
dotenvLoad({ path: '.env.local' });
const apiKey = process.env.API_KEY!;

function loadTeamNumbers() {
    const candidateSources = [
        '../data-analysis/output/06_team_profiles.json',
        'static/output_analysis.json',
    ];

    for (const sourcePath of candidateSources) {
        if (!fs.existsSync(sourcePath)) {
            continue;
        }

        const rows = JSON.parse(fs.readFileSync(sourcePath, 'utf-8')) as Array<{
            teamNumber?: number;
        }>;
        const teams = rows
            .map(row => Number(row.teamNumber))
            .filter(teamNumber => Number.isFinite(teamNumber) && teamNumber > 0)
            .sort((a, b) => a - b);

        if (teams.length > 0) {
            console.log(`Using team source: ${sourcePath}`);
            return teams;
        }
    }

    throw new Error(
        'No team source file found. Run data-analysis/run_pipeline.py first or provide static/output_analysis.json.'
    );
}

const teams = loadTeamNumbers();

// Create a teamColors object to store the color for each team
const teamInfo: TeamData = {};

console.log('Getting team colors...');

// Get the color for each team. If it returns a 404, default to gray
for (const team of teams) {
    const color = await fetch(`https://api.frc-colors.com/v1/team/${team}`);
    const colorJson = (await color.json()) as ColorData;
    if (color.status === 404) {
        teamInfo[team] = {
            primaryHex: '#7f7f7f',
            secondaryHex: '#7f7f7f',
            verified: false,
        }; 
    } else {
        teamInfo[team] = {
            primaryHex: colorJson.primaryHex,
            secondaryHex: colorJson.secondaryHex,
            verified: colorJson.verified,
        };
    }
}

console.log('Getting team avatars...');

// Get the avatar for each team.
for (const team of teams) {
    const avatar = await fetch(
        `https://www.thebluealliance.com/api/v3/team/frc${team}/media/2024`,
        {
            headers: {
                'X-TBA-Auth-Key': apiKey,
            },
        }
    );
    const avatarJson = (await avatar.json()) as AvatarData;
    if (avatar.status !== 404) {
        // Some teams have no media results
        teamInfo[team]!.avatar = avatarJson.find(
            e => e.type === 'avatar'
        )?.details.base64Image;
    }
}

console.log('Getting team info...');

// Get the information for each team
for (const team of teams) {
    const info = await fetch(
        `https://www.thebluealliance.com/api/v3/team/frc${team}`,
        {
            headers: {
                'X-TBA-Auth-Key': apiKey,
            },
        }
    );
    if (info.status !== 404) {
        const infoJson = (await info.json()) as TeamInfo;
        teamInfo[team]!.info = infoJson;
    }
}

fs.writeFileSync('static/team_info.json', JSON.stringify(teamInfo));

console.log(
    'Successfully downloaded information for ' + teams.length + ' teams'
);
