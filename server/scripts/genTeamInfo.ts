import fetch from 'node-fetch';
import { dotenvLoad } from 'dotenv-mono';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TeamData, TeamInfo } from 'requests';

interface ColorData {
    primaryHex: string;
    secondaryHex: string;
    verified: boolean;
}

type AvatarData = {
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
}[];

dotenvLoad({ path: '.env' });
dotenvLoad({ path: '.env.local' });
const apiKey = process.env.API_KEY!;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

function repoPath(...parts: string[]) {
    return path.resolve(REPO_ROOT, ...parts);
}

function getLatestAnalysisProfilesPath() {
    const settingsPath = repoPath('app_settings/settings.json');
    if (!fs.existsSync(settingsPath)) {
        return null;
    }

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as {
        paths?: {
            analysis_runs_root?: string;
            analysis_run_folder?: string;
            analysis_run_base_name?: string;
        };
    };
    const analysisRootSetting = settings.paths?.analysis_runs_root;
    if (!analysisRootSetting) {
        return null;
    }

    const analysisRoot = path.isAbsolute(analysisRootSetting)
        ? analysisRootSetting
        : repoPath(analysisRootSetting);
    const configuredRunFolder = (settings.paths?.analysis_run_folder ?? '').trim();
    const configuredBaseName = (settings.paths?.analysis_run_base_name ?? '').trim();
    const runFolder = configuredRunFolder || configuredBaseName;
    if (!runFolder) {
        return null;
    }
    const runDir = path.isAbsolute(runFolder)
        ? path.resolve(runFolder)
        : path.resolve(analysisRoot, runFolder);
    if (!fs.existsSync(runDir)) {
        return null;
    }

    const profilesPath = path.resolve(runDir, '06_team_profiles.json');
    return fs.existsSync(profilesPath) ? profilesPath : null;
}

function readTeamsListFallback() {
    const teamsPath = repoPath('app_settings/teams_list.txt');
    if (!fs.existsSync(teamsPath)) {
        return [] as number[];
    }

    return fs
        .readFileSync(teamsPath, 'utf8')
        .split(/\r?\n/g)
        .map(line => Number.parseInt(line.trim(), 10))
        .filter(team => Number.isFinite(team) && team > 0);
}

function loadTeamNumbers() {
    const latestProfiles = getLatestAnalysisProfilesPath();
    const candidateSources = [latestProfiles, 'static/output_analysis.json'].filter(
        (value): value is string => Boolean(value)
    );

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

    const fallbackTeams = readTeamsListFallback();
    if (fallbackTeams.length > 0) {
        console.log('Using team source: app_settings/teams_list.txt');
        return fallbackTeams;
    }

    throw new Error(
        'No team source found. Run analysis stage 06 or provide app_settings/teams_list.txt.'
    );
}

const teams = loadTeamNumbers();
const teamInfo: TeamData = {};

console.log('Getting team colors...');
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
        teamInfo[team]!.avatar = avatarJson.find(item => item.type === 'avatar')?.details.base64Image;
    }
}

console.log('Getting team info...');
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

console.log(`Successfully downloaded information for ${teams.length} teams`);
