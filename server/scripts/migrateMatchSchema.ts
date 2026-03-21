import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { startDockerContainer } from 'database';
import { ballsPerSecondApp, matchApp } from '../src/Schema.js';
import { ActionKind, MatchData } from 'requests';
import { gameConfig } from '../src/gameConfig.js';
import { dotenvLoad } from 'dotenv-mono';

dotenvLoad({ path: '.env' });
dotenvLoad({ path: '.env.local' });

const DEFAULT_BALLS_PER_SECOND = 5;
const MATCH_TOTAL_SEC = gameConfig.matchDurationSec;
const AUTO_END_SEC =
    gameConfig.segments.find(segment => segment.id === 'auto')?.endSec ?? 20;
const DELAY_END_SEC =
    gameConfig.segments.find(segment => segment.id === 'transition')?.endSec ?? 23;
const AUTO_PATH_MIN_POINT_DISTANCE = 0.003;
const INTERVAL_MERGE_GAP_SEC = 0.08;

const matchTimelineSegments = gameConfig.segments.map(segment => ({
    id: segment.id as keyof MatchData['shootTimeBySegment'],
    startSec: segment.startSec,
    endSec: segment.endSec,
}));

const emptyActionTimeBySegment: MatchData['shootTimeBySegment'] = {
    auto: 0,
    transition: 0,
    shift1: 0,
    shift2: 0,
    shift3: 0,
    shift4: 0,
    endgame: 0,
};

const emptyFouls: MatchData['fouls'] = {
    pinning: 0,
    towerContactInEndgame: 0,
    outOfZoneShooting: 0,
    ejectedFuel: 0,
    other: 0,
};

const emptyBreaks: MatchData['breaks'] = {
    mechanism: 0,
    battery: 0,
    comms: 0,
    bumper: 0,
};

type AutoPathTrace = NonNullable<MatchData['autoPath']>;
type AutoPathPoint = AutoPathTrace['points'][number];
type ActionTimelineInterval = NonNullable<
    NonNullable<MatchData['actionTimeline']>['intervals']
>[number];

function roundToHundredth(value: number) {
    return Math.round(value * 100) / 100;
}

function roundToTenThousandth(value: number) {
    return Math.round(value * 10000) / 10000;
}

function clamp(value: number, minValue: number, maxValue: number) {
    return Math.max(minValue, Math.min(value, maxValue));
}

function getAllianceFromPosition(
    position: MatchData['metadata']['robotPosition']
): 'red' | 'blue' {
    return position.startsWith('red') ? 'red' : 'blue';
}

function normalizeAutoPoint(value: unknown): AutoPathPoint | null {
    if (!value || typeof value !== 'object') return null;
    const point = value as Partial<AutoPathPoint>;
    const x = Number(point.x);
    const y = Number(point.y);
    const tSec = Number(point.tSec);
    if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(tSec)
    ) {
        return null;
    }
    return {
        x: roundToTenThousandth(clamp(x, 0, 1)),
        y: roundToTenThousandth(clamp(y, 0, 1)),
        tSec: roundToHundredth(Math.max(tSec, 0)),
    };
}

function dedupeSequentialPoints(points: AutoPathPoint[]) {
    const deduped: AutoPathPoint[] = [];
    points.forEach(point => {
        const last = deduped[deduped.length - 1];
        if (!last) {
            deduped.push(point);
            return;
        }
        const distance = Math.hypot(point.x - last.x, point.y - last.y);
        if (
            distance < AUTO_PATH_MIN_POINT_DISTANCE &&
            Math.abs(point.tSec - last.tSec) < 0.08
        ) {
            return;
        }
        deduped.push(point);
    });
    return deduped;
}

function hashString(input: string) {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index++) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

function buildAutoPathFingerprint(
    alliance: 'red' | 'blue',
    startPosition: MatchData['autoStartingPosition'],
    points: AutoPathPoint[],
    shotMarkers: AutoPathPoint[]
) {
    const pointsKey = points
        .map(point => `${point.x},${point.y},${point.tSec}`)
        .join('|');
    const shotKey = shotMarkers
        .map(point => `${point.x},${point.y},${point.tSec}`)
        .join('|');
    return hashString(
        `${alliance};${startPosition ?? 'none'};${pointsKey};${shotKey}`
    );
}

function normalizeAutoPath(
    input: MatchData['autoPath'] | undefined,
    fallbackAlliance: 'red' | 'blue',
    fallbackStartPosition: MatchData['autoStartingPosition']
): MatchData['autoPath'] {
    if (!input) return null;

    const alliance =
        input.alliance === 'red' || input.alliance === 'blue'
            ? input.alliance
            : fallbackAlliance;

    const startPosition =
        input.startPosition === 'left' ||
        input.startPosition === 'center' ||
        input.startPosition === 'right'
            ? input.startPosition
            : fallbackStartPosition ?? null;

    const points = dedupeSequentialPoints(
        (Array.isArray(input.points) ? input.points : [])
            .map(normalizeAutoPoint)
            .filter((point): point is AutoPathPoint => point !== null)
    );
    const shotMarkers = dedupeSequentialPoints(
        (Array.isArray(input.shotMarkers) ? input.shotMarkers : [])
            .map(normalizeAutoPoint)
            .filter((point): point is AutoPathPoint => point !== null)
    );

    if (points.length === 0 && shotMarkers.length === 0) {
        return null;
    }

    return {
        alliance,
        startPosition,
        points,
        shotMarkers,
        fingerprint: buildAutoPathFingerprint(
            alliance,
            startPosition,
            points,
            shotMarkers
        ),
    };
}

function normalizeActionInterval(value: unknown): ActionTimelineInterval | null {
    if (!value || typeof value !== 'object') return null;
    const interval = value as Partial<ActionTimelineInterval>;

    if (interval.action !== 'shoot' && interval.action !== 'pass') {
        return null;
    }

    const rawStartSec = Number(interval.startSec);
    const rawEndSec = Number(interval.endSec);
    if (!Number.isFinite(rawStartSec) || !Number.isFinite(rawEndSec)) {
        return null;
    }

    const startSec = roundToHundredth(clamp(rawStartSec, 0, MATCH_TOTAL_SEC));
    const endSec = roundToHundredth(clamp(rawEndSec, 0, MATCH_TOTAL_SEC));
    if (endSec <= startSec) {
        return null;
    }

    return {
        action: interval.action,
        startSec,
        endSec,
        durationSec: roundToHundredth(endSec - startSec),
    };
}

function mergeActionIntervalsByAction(
    intervals: ActionTimelineInterval[],
    action: ActionKind
) {
    const sorted = intervals
        .filter(interval => interval.action === action)
        .sort((a, b) => a.startSec - b.startSec);

    const merged: ActionTimelineInterval[] = [];
    sorted.forEach(interval => {
        const last = merged[merged.length - 1];
        if (last && interval.startSec - last.endSec <= INTERVAL_MERGE_GAP_SEC) {
            const nextEnd = Math.max(last.endSec, interval.endSec);
            last.endSec = nextEnd;
            last.durationSec = roundToHundredth(last.endSec - last.startSec);
            return;
        }
        merged.push({
            action,
            startSec: interval.startSec,
            endSec: interval.endSec,
            durationSec: interval.durationSec,
        });
    });

    return merged;
}

function normalizeActionTimeline(
    input: MatchData['actionTimeline'] | undefined | null
): MatchData['actionTimeline'] {
    if (!input || !Array.isArray(input.intervals)) {
        return null;
    }

    const normalizedIntervals = input.intervals
        .map(normalizeActionInterval)
        .filter(
            (interval): interval is ActionTimelineInterval => interval !== null
        );

    const mergedIntervals = [
        ...mergeActionIntervalsByAction(normalizedIntervals, 'shoot'),
        ...mergeActionIntervalsByAction(normalizedIntervals, 'pass'),
    ].sort((a, b) => a.startSec - b.startSec || a.action.localeCompare(b.action));

    return {
        totalSec: MATCH_TOTAL_SEC,
        autoEndSec: AUTO_END_SEC,
        delayEndSec: DELAY_END_SEC,
        intervals: mergedIntervals,
    };
}

function splitIntervalAcrossSegments(startSec: number, endSec: number) {
    const clampedStart = clamp(startSec, 0, MATCH_TOTAL_SEC);
    const clampedEnd = clamp(endSec, 0, MATCH_TOTAL_SEC);
    if (clampedEnd <= clampedStart) return [];

    return matchTimelineSegments
        .map(segment => {
            const overlapStart = Math.max(clampedStart, segment.startSec);
            const overlapEnd = Math.min(clampedEnd, segment.endSec);
            if (overlapEnd <= overlapStart) return null;
            return {
                segment: segment.id,
                durationSec: roundToHundredth(overlapEnd - overlapStart),
            };
        })
        .filter(
            (
                segment
            ): segment is {
                segment: keyof MatchData['shootTimeBySegment'];
                durationSec: number;
            } => segment !== null
        );
}

function getActionTimeBySegmentFromTimeline(
    timeline: MatchData['actionTimeline'],
    action: ActionKind
): MatchData['shootTimeBySegment'] {
    const totals = { ...emptyActionTimeBySegment };

    if (!timeline) {
        return totals;
    }

    timeline.intervals.forEach(interval => {
        if (interval.action !== action) return;
        splitIntervalAcrossSegments(interval.startSec, interval.endSec).forEach(
            segmentSlice => {
                totals[segmentSlice.segment] += segmentSlice.durationSec;
            }
        );
    });

    (Object.keys(totals) as Array<keyof MatchData['shootTimeBySegment']>).forEach(
        segment => {
            totals[segment] = roundToHundredth(totals[segment]);
        }
    );

    return totals;
}

function getActionTimeBySegment(
    value: MatchData['shootTimeBySegment'] | undefined
) {
    return {
        ...emptyActionTimeBySegment,
        ...(value ?? {}),
    };
}

function computeFuelFromShootTime(
    shootTimeBySegment: MatchData['shootTimeBySegment'],
    ballsPerSecond: number
) {
    const autoFuelScored = roundToHundredth(
        shootTimeBySegment.auto * ballsPerSecond
    );
    const teleFuelBySegment: MatchData['teleFuelBySegment'] = {
        transition: roundToHundredth(
            shootTimeBySegment.transition * ballsPerSecond
        ),
        shift1: roundToHundredth(shootTimeBySegment.shift1 * ballsPerSecond),
        shift2: roundToHundredth(shootTimeBySegment.shift2 * ballsPerSecond),
        shift3: roundToHundredth(shootTimeBySegment.shift3 * ballsPerSecond),
        shift4: roundToHundredth(shootTimeBySegment.shift4 * ballsPerSecond),
        endgame: roundToHundredth(shootTimeBySegment.endgame * ballsPerSecond),
    };
    return { autoFuelScored, teleFuelBySegment };
}

async function getBallsPerSecond(
    matchNumber: number,
    robotTeam: number
) {
    const saved = await ballsPerSecondApp
        .findOne({ matchNumber, robotTeam })
        .lean();
    return saved?.ballsPerSecond ?? DEFAULT_BALLS_PER_SECOND;
}

function asEnum<T extends string>(
    value: unknown,
    allowed: readonly T[],
    fallback: T
): T {
    return typeof value === 'string' && allowed.includes(value as T)
        ? (value as T)
        : fallback;
}

type MigrationReport = {
    generatedAt: string;
    readCount: number;
    migratedCount: number;
    skippedCount: number;
    duplicateKeysBeforeMigration: string[];
    invalidRows: Array<{ id: string; reason: string }>;
    validation: {
        documentsAfterMigration: number;
        duplicateKeyCount: number;
        invalidEnumCount: number;
    };
};

function getMeta(raw: Record<string, unknown>) {
    const metadata = (raw.metadata ?? {}) as Record<string, unknown>;
    const matchNumber = Number(metadata.matchNumber);
    const robotTeam = Number(metadata.robotTeam);
    const robotPosition = metadata.robotPosition;
    const scouterName = String(metadata.scouterName ?? '').trim();

    const validRobotPosition =
        robotPosition === 'red_1' ||
        robotPosition === 'red_2' ||
        robotPosition === 'red_3' ||
        robotPosition === 'red_4' ||
        robotPosition === 'blue_1' ||
        robotPosition === 'blue_2' ||
        robotPosition === 'blue_3' ||
        robotPosition === 'blue_4';

    if (!Number.isFinite(matchNumber) || !Number.isFinite(robotTeam) || !validRobotPosition) {
        return null;
    }

    return {
        scouterName: scouterName || 'Unknown',
        matchNumber,
        robotTeam,
        robotPosition,
    } satisfies MatchData['metadata'];
}

function toMatchData(raw: Record<string, unknown>, ballsPerSecondUsed: number): MatchData | null {
    const metadata = getMeta(raw);
    if (!metadata) return null;

    const timeline = normalizeActionTimeline(
        (raw.actionTimeline ?? null) as MatchData['actionTimeline']
    );
    const shootTimeBySegment = timeline
        ? getActionTimeBySegmentFromTimeline(timeline, 'shoot')
        : getActionTimeBySegment(
              (raw.shootTimeBySegment ?? undefined) as MatchData['shootTimeBySegment']
          );
    const passTimeBySegment = timeline
        ? getActionTimeBySegmentFromTimeline(timeline, 'pass')
        : getActionTimeBySegment(
              (raw.passTimeBySegment ?? undefined) as MatchData['passTimeBySegment']
          );

    const autoStartingPositionRaw = raw.autoStartingPosition;
    const autoStartingPosition =
        autoStartingPositionRaw === 'left' ||
        autoStartingPositionRaw === 'center' ||
        autoStartingPositionRaw === 'right'
            ? autoStartingPositionRaw
            : null;

    const autoPath = normalizeAutoPath(
        (raw.autoPath ?? undefined) as MatchData['autoPath'],
        getAllianceFromPosition(metadata.robotPosition),
        autoStartingPosition
    );

    const fuel = computeFuelFromShootTime(shootTimeBySegment, ballsPerSecondUsed);
    const foulsRaw = (raw.fouls ?? {}) as Partial<MatchData['fouls']>;
    const breaksRaw = (raw.breaks ?? {}) as Partial<MatchData['breaks']>;

    return {
        metadata,
        robotAbsent: Boolean(raw.robotAbsent ?? false),
        autoStartingPosition,
        autoPath,
        shootTimeBySegment,
        passTimeBySegment,
        actionTimeline: timeline,
        ballsPerSecondUsed,
        autoFuelScored: fuel.autoFuelScored,
        teleFuelBySegment: fuel.teleFuelBySegment,
        teleTower: asEnum(raw.teleTower, ['None', 'level1', 'level2', 'level3', 'Failed'] as const, 'None'),
        breakdown: asEnum(raw.breakdown, ['None', 'stuck', 'tipped', 'comms', 'mechanism', 'other'] as const, 'None'),
        driverQuality: asEnum(raw.driverQuality, ['great', 'good', 'ok', 'rough'] as const, 'ok'),
        defenseProvided: asEnum(raw.defenseProvided, ['None', 'some', 'heavy'] as const, 'None'),
        defenseReceived: Boolean(raw.defenseReceived ?? false),
        fouls: {
            ...emptyFouls,
            ...foulsRaw,
        },
        breaks: {
            ...emptyBreaks,
            ...breaksRaw,
        },
        freeText: String(raw.freeText ?? ''),
    };
}

async function main() {
    await startDockerContainer(process.env.CONTAINER_NAME);
    await mongoose.connect(process.env.MONGO_URL ?? 'mongodb://0.0.0.0:27017/');

    const report: MigrationReport = {
        generatedAt: new Date().toISOString(),
        readCount: 0,
        migratedCount: 0,
        skippedCount: 0,
        duplicateKeysBeforeMigration: [],
        invalidRows: [],
        validation: {
            documentsAfterMigration: 0,
            duplicateKeyCount: 0,
            invalidEnumCount: 0,
        },
    };

    const rows = (await matchApp.find().lean()) as Array<Record<string, unknown>>;
    report.readCount = rows.length;

    const seen = new Map<string, number>();
    rows.forEach(row => {
        const meta = getMeta(row);
        if (!meta) return;
        const key = `${meta.robotTeam}-${meta.matchNumber}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
    });
    report.duplicateKeysBeforeMigration = Array.from(seen.entries())
        .filter(([, count]) => count > 1)
        .map(([key]) => key)
        .sort();

    for (const row of rows) {
        const meta = getMeta(row);
        if (!meta) {
            report.skippedCount += 1;
            report.invalidRows.push({
                id: String((row as { _id?: unknown })._id ?? 'unknown'),
                reason: 'Missing or invalid metadata',
            });
            continue;
        }

        const ballsPerSecondUsed = await getBallsPerSecond(
            meta.matchNumber,
            meta.robotTeam
        );
        const normalized = toMatchData(row, ballsPerSecondUsed);
        if (!normalized) {
            report.skippedCount += 1;
            report.invalidRows.push({
                id: String((row as { _id?: unknown })._id ?? 'unknown'),
                reason: 'Normalization returned null',
            });
            continue;
        }

        await matchApp
            .replaceOne(
                {
                    'metadata.robotTeam': normalized.metadata.robotTeam,
                    'metadata.matchNumber': normalized.metadata.matchNumber,
                },
                normalized
            )
            .setOptions({ upsert: true });

        report.migratedCount += 1;
    }

    report.validation.documentsAfterMigration = await matchApp.countDocuments({});

    const duplicates = await matchApp.aggregate([
        {
            $group: {
                _id: {
                    team: '$metadata.robotTeam',
                    match: '$metadata.matchNumber',
                },
                count: { $sum: 1 },
            },
        },
        {
            $match: {
                count: { $gt: 1 },
            },
        },
        { $count: 'duplicateCount' },
    ]);

    report.validation.duplicateKeyCount =
        Number(duplicates[0]?.duplicateCount ?? 0) || 0;

    const invalidEnumCount = await matchApp.countDocuments({
        $or: [
            { teleTower: { $nin: ['None', 'level1', 'level2', 'level3', 'Failed'] } },
            { breakdown: { $nin: ['None', 'stuck', 'tipped', 'comms', 'mechanism', 'other'] } },
            { driverQuality: { $nin: ['great', 'good', 'ok', 'rough'] } },
            { defenseProvided: { $nin: ['None', 'some', 'heavy'] } },
        ],
    });
    report.validation.invalidEnumCount = invalidEnumCount;

    const reportPath = path.resolve('static/match-schema-migration-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(
        `Migration complete. Migrated ${report.migratedCount}/${report.readCount} rows. Report: ${reportPath}`
    );

    await mongoose.disconnect();
}

main().catch(async error => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
});
