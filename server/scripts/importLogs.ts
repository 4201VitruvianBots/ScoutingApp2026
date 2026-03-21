import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { BallsPerSecondSetting, MatchData, PitFile } from 'requests';

type SectionName = 'ballsPerSecondSettings' | 'matchLogs' | 'pitLogs';

type ImportError = {
    section: SectionName | 'bundle';
    index?: number;
    type: 'validation' | 'request';
    message: string;
    status?: number;
};

type SectionCounts = {
    input: number;
    valid: number;
    sent: number;
    success: number;
    failed: number;
};

type ImportReport = {
    startedAt: string;
    finishedAt: string;
    sourceFile: string;
    serverUrl: string;
    dryRun: boolean;
    failFast: boolean;
    counts: Record<SectionName, SectionCounts>;
    errors: ImportError[];
    success: boolean;
};

type CanonicalImportBundle = {
    ballsPerSecondSettings: BallsPerSecondSetting[];
    matchLogs: MatchData[];
    pitLogs: PitFile[];
};

type CliArgs = {
    filePath: string;
    serverUrl: string;
    dryRun: boolean;
    failFast: boolean;
    reportPath?: string;
};

function parseEnvBool(value: string | undefined): boolean | undefined {
    if (value === undefined) return undefined;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off', ''].includes(normalized)) return false;
    return true;
}

function usage() {
    return [
        'Usage:',
        '  npm run --workspace server import:logs -- --file <bundle.json> [--server-url http://localhost:8080] [--dry-run] [--fail-fast] [--report [path]]',
        '  npm run import:logs -- <bundle.json> [reportPath]',
        '',
        'Canonical JSON format:',
        '  {',
        '    "ballsPerSecondSettings": [{ "matchNumber": 1, "robotTeam": 1234, "ballsPerSecond": 5.7 }],',
        '    "matchLogs": [ ...MatchData... ],',
        '    "pitLogs": [ ...PitFile... ]',
        '  }',
    ].join('\n');
}

function parseArgs(argv: string[]): CliArgs {
    let filePath = '';
    let serverUrl = 'http://localhost:8080';
    let dryRun = false;
    let failFast = false;
    let reportPath: string | undefined;
    const positional: string[] = [];

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--file') {
            const value = argv[i + 1];
            if (!value || value.startsWith('--')) {
                throw new Error('--file requires a value');
            }
            filePath = value;
            i += 1;
            continue;
        }
        if (arg === '--server-url') {
            const value = argv[i + 1];
            if (!value || value.startsWith('--')) {
                throw new Error('--server-url requires a value');
            }
            serverUrl = value;
            i += 1;
            continue;
        }
        if (arg === '--dry-run') {
            dryRun = true;
            continue;
        }
        if (arg === '--fail-fast') {
            failFast = true;
            continue;
        }
        if (arg === '--report') {
            const value = argv[i + 1];
            if (value && !value.startsWith('--')) {
                reportPath = value;
                i += 1;
            } else {
                reportPath = 'static/import_logs_report.json';
            }
            continue;
        }
        if (arg === '--help' || arg === '-h') {
            throw new Error(usage());
        }
        if (!arg.startsWith('--')) {
            positional.push(arg);
            continue;
        }
        throw new Error(`Unknown argument: ${arg}`);
    }

    if (!filePath && positional.length >= 1) {
        filePath = positional[0]!;
    }
    if (!reportPath && positional.length >= 2) {
        reportPath = positional[1]!;
    }
    if (positional.length > 2) {
        throw new Error(
            'Too many positional arguments. Use [file] [reportPath] at most.\n\n' +
                usage()
        );
    }

    if (!filePath && process.env.npm_config_file) {
        filePath = process.env.npm_config_file;
    }
    if (!reportPath && process.env.npm_config_report) {
        reportPath = process.env.npm_config_report;
    }
    if (serverUrl === 'http://localhost:8080') {
        const envServerUrl =
            process.env.npm_config_server_url ?? process.env.npm_config_serverurl;
        if (envServerUrl) {
            serverUrl = envServerUrl;
        }
    }
    const envDryRun = parseEnvBool(process.env.npm_config_dry_run);
    const envFailFast = parseEnvBool(
        process.env.npm_config_fail_fast ?? process.env.npm_config_failfast
    );
    if (envDryRun === true) dryRun = true;
    if (envFailFast === true) failFast = true;

    if (!filePath) {
        throw new Error('--file is required\n\n' + usage());
    }

    return {
        filePath,
        serverUrl: serverUrl.replace(/\/+$/, ''),
        dryRun,
        failFast,
        reportPath,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function asArray(
    bundle: Record<string, unknown>,
    key: SectionName,
    errors: ImportError[]
) {
    const raw = bundle[key];
    if (raw === undefined) return [];
    if (!Array.isArray(raw)) {
        errors.push({
            section: key,
            type: 'validation',
            message: `Field '${key}' must be an array.`,
        });
        return [];
    }
    return raw;
}

function validateBps(
    input: unknown
): { ok: true; value: BallsPerSecondSetting } | { ok: false; message: string } {
    if (!isRecord(input)) {
        return { ok: false, message: 'Entry must be an object.' };
    }
    const matchNumber = Number(input.matchNumber);
    const robotTeam = Number(input.robotTeam);
    const ballsPerSecond = Number(input.ballsPerSecond);

    if (!Number.isFinite(matchNumber) || matchNumber <= 0) {
        return { ok: false, message: 'matchNumber must be a positive number.' };
    }
    if (!Number.isFinite(robotTeam) || robotTeam <= 0) {
        return { ok: false, message: 'robotTeam must be a positive number.' };
    }
    if (!Number.isFinite(ballsPerSecond) || ballsPerSecond < 0) {
        return { ok: false, message: 'ballsPerSecond must be >= 0.' };
    }

    return {
        ok: true,
        value: {
            matchNumber,
            robotTeam,
            ballsPerSecond,
        },
    };
}

function validateMatch(
    input: unknown
): { ok: true; value: MatchData } | { ok: false; message: string } {
    if (!isRecord(input)) {
        return { ok: false, message: 'Entry must be an object.' };
    }

    const metadata = input.metadata;
    if (!isRecord(metadata)) {
        return { ok: false, message: 'metadata is required and must be an object.' };
    }

    const matchNumber = Number(metadata.matchNumber);
    const robotTeam = Number(metadata.robotTeam);
    const robotPosition = metadata.robotPosition;
    const scouterName =
        typeof metadata.scouterName === 'string' && metadata.scouterName.trim()
            ? metadata.scouterName.trim()
            : 'Unknown';

    if (!Number.isFinite(matchNumber) || matchNumber <= 0) {
        return { ok: false, message: 'metadata.matchNumber must be a positive number.' };
    }
    if (!Number.isFinite(robotTeam) || robotTeam <= 0) {
        return { ok: false, message: 'metadata.robotTeam must be a positive number.' };
    }
    if (typeof robotPosition !== 'string' || robotPosition.length === 0) {
        return { ok: false, message: 'metadata.robotPosition must be a non-empty string.' };
    }

    return {
        ok: true,
        value: {
            ...(input as MatchData),
            metadata: {
                ...(metadata as MatchData['metadata']),
                scouterName,
                matchNumber,
                robotTeam,
            },
        },
    };
}

function validatePit(
    input: unknown
): { ok: true; value: PitFile } | { ok: false; message: string } {
    if (!isRecord(input)) {
        return { ok: false, message: 'Entry must be an object.' };
    }

    const teamNumber = Number(input.teamNumber);
    if (!Number.isFinite(teamNumber) || teamNumber <= 0) {
        return { ok: false, message: 'teamNumber must be a positive number.' };
    }

    const scouterName =
        typeof input.scouterName === 'string' && input.scouterName.trim()
            ? input.scouterName.trim()
            : 'Unknown';
    const photo = typeof input.photo === 'string' ? input.photo : '';

    return {
        ok: true,
        value: {
            ...(input as PitFile),
            teamNumber,
            scouterName,
            photo,
        },
    };
}

function loadBundle(filePath: string, errors: ImportError[]): CanonicalImportBundle {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
        errors.push({
            section: 'bundle',
            type: 'validation',
            message: `File not found: ${absolutePath}`,
        });
        return { ballsPerSecondSettings: [], matchLogs: [], pitLogs: [] };
    }

    let rawText = '';
    try {
        rawText = fs.readFileSync(absolutePath, 'utf-8');
    } catch (error) {
        errors.push({
            section: 'bundle',
            type: 'validation',
            message: `Unable to read file: ${(error as Error).message}`,
        });
        return { ballsPerSecondSettings: [], matchLogs: [], pitLogs: [] };
    }

    if (rawText.charCodeAt(0) === 0xfeff) {
        rawText = rawText.slice(1);
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(rawText);
    } catch (error) {
        errors.push({
            section: 'bundle',
            type: 'validation',
            message: `Invalid JSON: ${(error as Error).message}`,
        });
        return { ballsPerSecondSettings: [], matchLogs: [], pitLogs: [] };
    }

    if (!isRecord(parsed)) {
        errors.push({
            section: 'bundle',
            type: 'validation',
            message: 'Root JSON must be an object.',
        });
        return { ballsPerSecondSettings: [], matchLogs: [], pitLogs: [] };
    }

    const bpsRaw = asArray(parsed, 'ballsPerSecondSettings', errors);
    const matchRaw = asArray(parsed, 'matchLogs', errors);
    const pitRaw = asArray(parsed, 'pitLogs', errors);

    const ballsPerSecondSettings: BallsPerSecondSetting[] = [];
    bpsRaw.forEach((entry, index) => {
        const validated = validateBps(entry);
        if (!validated.ok) {
            errors.push({
                section: 'ballsPerSecondSettings',
                index,
                type: 'validation',
                message: validated.message,
            });
            return;
        }
        ballsPerSecondSettings.push(validated.value);
    });

    const matchLogs: MatchData[] = [];
    matchRaw.forEach((entry, index) => {
        const validated = validateMatch(entry);
        if (!validated.ok) {
            errors.push({
                section: 'matchLogs',
                index,
                type: 'validation',
                message: validated.message,
            });
            return;
        }
        matchLogs.push(validated.value);
    });

    const pitLogs: PitFile[] = [];
    pitRaw.forEach((entry, index) => {
        const validated = validatePit(entry);
        if (!validated.ok) {
            errors.push({
                section: 'pitLogs',
                index,
                type: 'validation',
                message: validated.message,
            });
            return;
        }
        pitLogs.push(validated.value);
    });

    return { ballsPerSecondSettings, matchLogs, pitLogs };
}

async function postEntry(
    serverUrl: string,
    route: string,
    payload: unknown
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
    try {
        const response = await fetch(`${serverUrl}${route}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const text = await response.text();
            return {
                ok: false,
                status: response.status,
                message: text || response.statusText,
            };
        }
        return { ok: true };
    } catch (error) {
        return {
            ok: false,
            status: 0,
            message: (error as Error).message,
        };
    }
}

async function processSection<T>(
    sectionName: SectionName,
    route: string,
    rows: T[],
    args: CliArgs,
    report: ImportReport
) {
    const counters = report.counts[sectionName];
    counters.input = rows.length;
    counters.valid = rows.length;

    if (args.dryRun) {
        return;
    }

    for (let index = 0; index < rows.length; index++) {
        const row = rows[index]!;
        counters.sent += 1;

        const result = await postEntry(args.serverUrl, route, row);
        if (result.ok) {
            counters.success += 1;
            continue;
        }

        counters.failed += 1;
        report.errors.push({
            section: sectionName,
            index,
            type: 'request',
            status: result.status,
            message: result.message,
        });

        if (args.failFast) {
            return;
        }
    }
}

function buildEmptySectionCounts(): SectionCounts {
    return {
        input: 0,
        valid: 0,
        sent: 0,
        success: 0,
        failed: 0,
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    const report: ImportReport = {
        startedAt: new Date().toISOString(),
        finishedAt: '',
        sourceFile: path.resolve(args.filePath),
        serverUrl: args.serverUrl,
        dryRun: args.dryRun,
        failFast: args.failFast,
        counts: {
            ballsPerSecondSettings: buildEmptySectionCounts(),
            matchLogs: buildEmptySectionCounts(),
            pitLogs: buildEmptySectionCounts(),
        },
        errors: [],
        success: false,
    };

    const bundle = loadBundle(args.filePath, report.errors);
    report.counts.ballsPerSecondSettings.input = bundle.ballsPerSecondSettings.length;
    report.counts.ballsPerSecondSettings.valid = bundle.ballsPerSecondSettings.length;
    report.counts.matchLogs.input = bundle.matchLogs.length;
    report.counts.matchLogs.valid = bundle.matchLogs.length;
    report.counts.pitLogs.input = bundle.pitLogs.length;
    report.counts.pitLogs.valid = bundle.pitLogs.length;

    if (report.errors.length === 0 || !args.failFast) {
        await processSection(
            'ballsPerSecondSettings',
            '/config/balls-per-second',
            bundle.ballsPerSecondSettings,
            args,
            report
        );
    }
    if (
        (report.errors.length === 0 || !args.failFast) &&
        (!args.failFast || report.errors.length === 0)
    ) {
        await processSection('matchLogs', '/data/match', bundle.matchLogs, args, report);
    }
    if (
        (report.errors.length === 0 || !args.failFast) &&
        (!args.failFast || report.errors.length === 0)
    ) {
        await processSection('pitLogs', '/data/pit', bundle.pitLogs, args, report);
    }

    report.finishedAt = new Date().toISOString();
    report.success = report.errors.length === 0;

    if (args.reportPath) {
        const absoluteReportPath = path.resolve(args.reportPath);
        fs.mkdirSync(path.dirname(absoluteReportPath), { recursive: true });
        fs.writeFileSync(absoluteReportPath, JSON.stringify(report, null, 2));
        console.log(`Report written: ${absoluteReportPath}`);
    }

    console.log(
        [
            `Import complete (dryRun=${args.dryRun})`,
            `BPS: ${report.counts.ballsPerSecondSettings.success}/${report.counts.ballsPerSecondSettings.sent} sent`,
            `Match: ${report.counts.matchLogs.success}/${report.counts.matchLogs.sent} sent`,
            `Pit: ${report.counts.pitLogs.success}/${report.counts.pitLogs.sent} sent`,
            `Errors: ${report.errors.length}`,
        ].join(' | ')
    );

    if (report.errors.length) {
        report.errors.slice(0, 20).forEach(error => {
            const location =
                error.index === undefined
                    ? `${error.section}`
                    : `${error.section}[${error.index}]`;
            const status = isFiniteNumber(error.status) ? ` status=${error.status}` : '';
            console.error(`- ${location} (${error.type})${status}: ${error.message}`);
        });
        process.exit(1);
    }
}

main().catch(error => {
    console.error((error as Error).message);
    process.exit(1);
});
