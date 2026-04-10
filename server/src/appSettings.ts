import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MatchSchedule, RobotPosition } from 'requests';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..', '..');
const appSettingsDir = path.resolve(repoRoot, 'app_settings');
const settingsPath = path.resolve(appSettingsDir, 'settings.json');
const schedulePath = path.resolve(appSettingsDir, 'match_schedule.json');
const teamsPath = path.resolve(appSettingsDir, 'teams_list.txt');
const robotPositions: RobotPosition[] = [
    'red_1',
    'red_2',
    'red_3',
    'red_4',
    'blue_1',
    'blue_2',
    'blue_3',
    'blue_4',
];
const robotPositionSet = new Set<RobotPosition>(robotPositions);

type AppSettings = {
    paths: {
        raw_runs_root: string;
        analysis_runs_root: string;
        raw_run_base_name: string;
        analysis_run_base_name: string;
        raw_run_folder?: string;
        analysis_run_folder?: string;
    };
    mongo: Record<string, unknown>;
    fake_data: Record<string, unknown>;
    analysis: Record<string, unknown>;
};

function readJsonFile<T>(filePath: string): T {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Missing required file: ${filePath}`);
    }
    const raw = fs.readFileSync(filePath, { encoding: 'utf8' });
    const normalized = raw.replace(/^\uFEFF/, '');
    return JSON.parse(normalized) as T;
}

function loadAppSettings(): AppSettings {
    const settings = readJsonFile<AppSettings>(settingsPath);
    if (!settings?.paths?.analysis_runs_root || !settings?.paths?.raw_runs_root) {
        throw new Error(`Invalid settings file: ${settingsPath}`);
    }
    return settings;
}

function resolveFromRepo(pathLike: string) {
    return path.isAbsolute(pathLike) ? pathLike : path.resolve(repoRoot, pathLike);
}

function getAnalysisRunsRoot() {
    const settings = loadAppSettings();
    return resolveFromRepo(settings.paths.analysis_runs_root);
}

function getRawRunsRoot() {
    const settings = loadAppSettings();
    return resolveFromRepo(settings.paths.raw_runs_root);
}

function parsePositiveInteger(value: unknown) {
    if (typeof value === 'number') {
        return Number.isInteger(value) && value > 0 ? value : undefined;
    }
    if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
    }
    return undefined;
}

function normalizeMatchSchedule(raw: unknown): MatchSchedule {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error(`Invalid match schedule file format: ${schedulePath}`);
    }

    const output: MatchSchedule = {};
    Object.entries(raw as Record<string, unknown>).forEach(
        ([matchKey, assignmentsRaw]) => {
            const matchNumber = parsePositiveInteger(matchKey);
            if (matchNumber == undefined) return;
            if (
                !assignmentsRaw ||
                typeof assignmentsRaw !== 'object' ||
                Array.isArray(assignmentsRaw)
            ) {
                return;
            }

            const normalizedAssignments: Partial<Record<RobotPosition, number>> =
                {};
            Object.entries(assignmentsRaw as Record<string, unknown>).forEach(
                ([position, teamRaw]) => {
                    if (!robotPositionSet.has(position as RobotPosition)) return;
                    const teamNumber = parsePositiveInteger(teamRaw);
                    if (teamNumber == undefined) return;
                    normalizedAssignments[position as RobotPosition] = teamNumber;
                }
            );

            if (Object.keys(normalizedAssignments).length === 0) return;
            output[matchNumber] = normalizedAssignments;
        }
    );

    return output;
}

function readMatchSchedule(): MatchSchedule {
    const raw = readJsonFile<unknown>(schedulePath);
    return normalizeMatchSchedule(raw);
}

function readTeamsList(): number[] {
    if (!fs.existsSync(teamsPath)) {
        throw new Error(`Missing teams list: ${teamsPath}`);
    }

    const teams = fs
        .readFileSync(teamsPath, { encoding: 'utf8' })
        .split(/\r?\n/g)
        .map(line => Number.parseInt(line.trim(), 10))
        .filter(team => Number.isFinite(team) && team > 0);

    return Array.from(new Set(teams));
}

function resolveConfiguredRunDir(
    runRoot: string,
    runFolder: string | undefined,
    runBaseName: string | undefined
): string | null {
    const configuredFolder = (runFolder ?? '').trim();
    const configuredBaseName = (runBaseName ?? '').trim();
    const selected = configuredFolder || configuredBaseName;
    if (!selected) return null;

    const resolved = path.isAbsolute(selected)
        ? path.resolve(selected)
        : path.resolve(runRoot, selected);
    if (!fs.existsSync(resolved)) return null;

    const stats = fs.statSync(resolved);
    return stats.isDirectory() ? resolved : null;
}

function getConfiguredAnalysisRunDir(): string | null {
    const settings = loadAppSettings();
    const analysisRoot = resolveFromRepo(settings.paths.analysis_runs_root);
    return resolveConfiguredRunDir(
        analysisRoot,
        settings.paths.analysis_run_folder,
        settings.paths.analysis_run_base_name
    );
}

function getConfiguredRawRunDir(): string | null {
    const settings = loadAppSettings();
    const rawRoot = resolveFromRepo(settings.paths.raw_runs_root);
    return resolveConfiguredRunDir(
        rawRoot,
        settings.paths.raw_run_folder,
        settings.paths.raw_run_base_name
    );
}

export {
    appSettingsDir,
    repoRoot,
    settingsPath,
    schedulePath,
    teamsPath,
    loadAppSettings,
    getAnalysisRunsRoot,
    getRawRunsRoot,
    readMatchSchedule,
    readTeamsList,
    getConfiguredAnalysisRunDir,
    getConfiguredRawRunDir,
};
