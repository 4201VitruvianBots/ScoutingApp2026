import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MatchSchedule } from 'requests';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..', '..');
const appSettingsDir = path.resolve(repoRoot, 'app_settings');
const settingsPath = path.resolve(appSettingsDir, 'settings.json');
const schedulePath = path.resolve(appSettingsDir, 'match_schedule.json');
const teamsPath = path.resolve(appSettingsDir, 'teams_list.txt');

type AppSettings = {
    paths: {
        raw_runs_root: string;
        analysis_runs_root: string;
        raw_run_base_name: string;
        analysis_run_base_name: string;
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

function readMatchSchedule(): MatchSchedule {
    const schedule = readJsonFile<MatchSchedule>(schedulePath);
    return schedule;
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

function getLatestRunDir(runRoot: string): string | null {
    const pointerPath = path.resolve(runRoot, 'latest_run.json');
    if (!fs.existsSync(pointerPath)) {
        return null;
    }

    const pointer = readJsonFile<{ path?: string; relativePath?: string }>(pointerPath);
    const resolved = pointer.path
        ? path.resolve(pointer.path)
        : pointer.relativePath
          ? path.resolve(repoRoot, pointer.relativePath)
          : null;

    if (!resolved) {
        return null;
    }

    if (!fs.existsSync(resolved)) {
        return null;
    }
    return resolved;
}

function getLatestAnalysisRunDir(): string | null {
    return getLatestRunDir(getAnalysisRunsRoot());
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
    getLatestAnalysisRunDir,
};
