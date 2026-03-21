import express from 'express';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { createProxyMiddleware } from 'http-proxy-middleware';
import {
    autoFieldOrientationApp,
    ballsPerSecondApp,
    matchApp,
    pitApp,
    tabletAssignmentApp,
} from './Schema.js';
import {
    averageAndMax,
    robotImageDisplay,
    scouterRankings,
    maxIndividual,
    matchOutlier,
} from './aggregate.js';
import { setUpSocket, updateMatchStatus } from './status.js';
import {
    ActionKind,
    AllianceColor,
    AutoFieldOrientationSetting,
    BallsPerSecondSetting,
    FieldOrientation,
    MatchData,
    PitFile,
    PitResult,
    RobotPosition,
    TabletAssignmentSetting,
} from 'requests';
import { dataUriToBuffer } from 'data-uri-to-buffer';
import { gameConfig } from './gameConfig.js';

// import { MatchData } from 'requests';

// If DEV is true then the app should forward requests to localhost:5173 instead of serving from /static
const DEV = process.env.NODE_ENV === 'dev';
const DEFAULT_BALLS_PER_SECOND = 5;
const defaultAutoFieldOrientation: Record<AllianceColor, FieldOrientation> = {
    red: 'orientation1',
    blue: 'orientation1',
};
const assignmentRobotPositions: RobotPosition[] = [
    'red_1',
    'red_2',
    'red_3',
    'blue_1',
    'blue_2',
    'blue_3',
];
const assignmentRobotPositionSet = new Set<RobotPosition>(
    assignmentRobotPositions
);

const app = express();

app.use(express.json({ limit: '200mb' }));

setUpSocket(app);

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
const AUTO_PATH_MIN_POINT_DISTANCE = 0.003;
const INTERVAL_MERGE_GAP_SEC = 0.08;
const MATCH_TOTAL_SEC = gameConfig.matchDurationSec;
const AUTO_END_SEC =
    gameConfig.segments.find(segment => segment.id === 'auto')?.endSec ?? 20;
const DELAY_END_SEC =
    gameConfig.segments.find(segment => segment.id === 'transition')?.endSec ?? 23;
const matchTimelineSegments = gameConfig.segments.map(segment => ({
    id: segment.id as keyof MatchData['shootTimeBySegment'],
    startSec: segment.startSec,
    endSec: segment.endSec,
}));

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
): AllianceColor {
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
        const dx = point.x - last.x;
        const dy = point.y - last.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
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
    alliance: AllianceColor,
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
    fallbackAlliance: AllianceColor,
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
        if (
            last &&
            interval.startSec - last.endSec <= INTERVAL_MERGE_GAP_SEC
        ) {
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
    robotTeam: number | undefined
) {
    if (robotTeam === undefined) return DEFAULT_BALLS_PER_SECOND;
    const saved = await ballsPerSecondApp
        .findOne({ matchNumber, robotTeam })
        .lean();
    return saved?.ballsPerSecond ?? DEFAULT_BALLS_PER_SECOND;
}

async function getAutoFieldOrientationMap() {
    const rows = await autoFieldOrientationApp.find().lean();
    const next = { ...defaultAutoFieldOrientation };
    rows.forEach(row => {
        if (
            (row.side === 'red' || row.side === 'blue') &&
            (row.orientation === 'orientation1' ||
                row.orientation === 'orientation2')
        ) {
            next[row.side] = row.orientation;
        }
    });
    return next;
}

app.post('/data/match', async (req, res) => {
    const body = req.body as MatchData;
    if (
        !body?.metadata ||
        !Number.isFinite(body.metadata.matchNumber) ||
        !Number.isFinite(body.metadata.robotTeam) ||
        !body.metadata.robotPosition
    ) {
        res.status(400).send('Invalid match payload metadata');
        return;
    }

    const normalizedActionTimeline = normalizeActionTimeline(body.actionTimeline);
    const shootTimeBySegment = normalizedActionTimeline
        ? getActionTimeBySegmentFromTimeline(normalizedActionTimeline, 'shoot')
        : getActionTimeBySegment(body.shootTimeBySegment);
    const passTimeBySegment = normalizedActionTimeline
        ? getActionTimeBySegmentFromTimeline(normalizedActionTimeline, 'pass')
        : getActionTimeBySegment(body.passTimeBySegment);
    const fallbackAlliance = getAllianceFromPosition(body.metadata.robotPosition);
    const normalizedAutoPath = normalizeAutoPath(
        body.autoPath,
        fallbackAlliance,
        body.autoStartingPosition ?? null
    );
    const ballsPerSecondUsed = await getBallsPerSecond(
        body.metadata.matchNumber,
        body.metadata.robotTeam
    );
    const estimatedFuel = computeFuelFromShootTime(
        shootTimeBySegment,
        ballsPerSecondUsed
    );

    const normalizedBody: MatchData = {
        ...body,
        autoStartingPosition: body.autoStartingPosition ?? null,
        autoPath: normalizedAutoPath,
        shootTimeBySegment,
        passTimeBySegment,
        actionTimeline: normalizedActionTimeline,
        ballsPerSecondUsed,
        autoFuelScored: estimatedFuel.autoFuelScored,
        teleFuelBySegment: estimatedFuel.teleFuelBySegment,
        defenseProvided: body.defenseProvided ?? 'None',
        defenseReceived: body.defenseReceived ?? false,
        fouls: {
            ...emptyFouls,
            ...(body.fouls ?? {}),
        },
        breaks: {
            ...emptyBreaks,
            ...(body.breaks ?? {}),
        },
        freeText: body.freeText ?? '',
    };

    await matchApp
        .replaceOne(
            {
                'metadata.robotTeam': body.metadata.robotTeam,
                'metadata.matchNumber': body.metadata.matchNumber,
            },
            normalizedBody
        )
        .setOptions({ upsert: true });

    updateMatchStatus();
    console.log(
        chalk.gray(
            `Match data received for team ${body.metadata.robotTeam} match ${body.metadata.matchNumber}`
        )
    );

    res.end();
});

app.get('/config/balls-per-second', async (req, res) => {
    const matchNumber = Number.parseInt(String(req.query.matchNumber), 10);
    const teamRaw = req.query.teamNumber ?? req.query.robotTeam;
    const robotTeam = Number.parseInt(String(teamRaw), 10);

    if (Number.isFinite(matchNumber) && Number.isFinite(robotTeam)) {
        const ballsPerSecond = await getBallsPerSecond(matchNumber, robotTeam);
        res.send({
            matchNumber,
            robotTeam,
            ballsPerSecond,
        } satisfies BallsPerSecondSetting);
        return;
    }

    const entries = await ballsPerSecondApp.find().select('-_id -__v').lean();
    res.send(entries);
});

app.post('/config/balls-per-second', async (req, res) => {
    const body = req.body as Partial<BallsPerSecondSetting>;
    const matchNumber = Number(body.matchNumber);
    const robotTeam = Number(body.robotTeam);
    const ballsPerSecond = Number(body.ballsPerSecond);

    if (
        !Number.isFinite(matchNumber) ||
        !Number.isFinite(robotTeam) ||
        !Number.isFinite(ballsPerSecond) ||
        ballsPerSecond < 0
    ) {
        res.status(400).send('Invalid balls per second config payload');
        return;
    }

    await ballsPerSecondApp
        .replaceOne(
            { matchNumber, robotTeam },
            { matchNumber, robotTeam, ballsPerSecond }
        )
        .setOptions({ upsert: true });

    res.send({
        matchNumber,
        robotTeam,
        ballsPerSecond,
    } satisfies BallsPerSecondSetting);
});

app.get('/config/auto-field-orientation', async (req, res) => {
    const side = String(req.query.side ?? '');
    const map = await getAutoFieldOrientationMap();

    if (side === 'red' || side === 'blue') {
        res.send({
            side,
            orientation: map[side],
        } satisfies AutoFieldOrientationSetting);
        return;
    }

    res.send(
        (['red', 'blue'] as const).map(currentSide => ({
            side: currentSide,
            orientation: map[currentSide],
        } satisfies AutoFieldOrientationSetting))
    );
});

app.post('/config/auto-field-orientation', async (req, res) => {
    const body = req.body as Partial<AutoFieldOrientationSetting>;
    const side = body.side;
    const orientation = body.orientation;

    if (
        (side !== 'red' && side !== 'blue') ||
        (orientation !== 'orientation1' && orientation !== 'orientation2')
    ) {
        res.status(400).send('Invalid auto field orientation payload');
        return;
    }

    await autoFieldOrientationApp
        .replaceOne({ side }, { side, orientation })
        .setOptions({ upsert: true });

    res.send({
        side,
        orientation,
    } satisfies AutoFieldOrientationSetting);
});

app.get('/config/tablet-assignments', async (req, res) => {
    const tabletIdQuery = String(req.query.tabletId ?? '').trim();
    const entries = (await tabletAssignmentApp
        .find()
        .select('-_id -__v')
        .lean()) as TabletAssignmentSetting[];

    if (tabletIdQuery) {
        const entry =
            entries.find(current => current.tabletId === tabletIdQuery) ?? null;
        res.send(entry);
        return;
    }

    res.send(entries);
});

app.post('/config/tablet-assignments', async (req, res) => {
    if (!Array.isArray(req.body)) {
        res.status(400).send('Tablet assignments payload must be an array');
        return;
    }

    const normalized: TabletAssignmentSetting[] = [];
    const tabletIds = new Set<string>();
    const robotPositions = new Set<RobotPosition>();

    for (const row of req.body as Partial<TabletAssignmentSetting>[]) {
        const tabletId = String(row.tabletId ?? '').trim();
        const robotPosition = row.robotPosition;

        if (!tabletId) {
            res.status(400).send('Tablet assignment tabletId cannot be empty');
            return;
        }

        if (!robotPosition || !assignmentRobotPositionSet.has(robotPosition)) {
            res.status(400).send('Tablet assignment robotPosition is invalid');
            return;
        }

        if (tabletIds.has(tabletId)) {
            res.status(400).send(`Duplicate tabletId: ${tabletId}`);
            return;
        }

        if (robotPositions.has(robotPosition)) {
            res.status(400).send(`Duplicate robotPosition: ${robotPosition}`);
            return;
        }

        tabletIds.add(tabletId);
        robotPositions.add(robotPosition);
        normalized.push({ tabletId, robotPosition });
    }

    await tabletAssignmentApp.deleteMany({});
    if (normalized.length > 0) {
        await tabletAssignmentApp.insertMany(normalized, { ordered: true });
    }

    res.send(normalized);
});

app.post('/data/pit', async (req, res) => {
    const body = req.body as PitFile;
    try {
        const photo =
            body.photo === ''
                ? Buffer.from([])
                : Buffer.from(dataUriToBuffer(body.photo).buffer);

        await pitApp
            .replaceOne({ teamNumber: body.teamNumber }, { ...body, photo })
            .setOptions({ upsert: true });

        console.log(chalk.gray(`Pit data recieved for ${body.teamNumber}`));

        res.end();
    } catch (e) {
        res.status(500);
        res.end();
    }
});

app.get('/data/retrieve', async (req, res) => {
    res.send(await averageAndMax());
});

app.get('/data/retrieve/individualMatch', async (req, res) => {
    res.send(await maxIndividual());
});

app.get('/data/retrieve/matchOutlier', async (req, res) => {
    res.send(await matchOutlier());
});

app.get('/data/retrieve/analyzed', async (_req, res) => {
    const payloadPath = path.resolve('../data-analysis/output/06_picklist_payload.json');
    try {
        const payloadRaw = await fs.promises.readFile(payloadPath, 'utf8');
        res.type('application/json').send(payloadRaw);
    } catch {
        res.status(404).send({
            message: 'Analyzed payload not found. Run data-analysis/run_pipeline.py first.',
            path: payloadPath,
        });
    }
});

app.get('/data/retrieve/scouter', async (req, res) => {
    res.send(await scouterRankings());
});

app.get('/data/pit/scouted-teams', async (req, res) => {
    res.send((await pitApp.find({}, { teamNumber: 1 })).map(e => e.teamNumber));
});

app.get('/image/:teamId.jpeg', async (req, res) => {
    const { teamId } = req.params;

    //Search the pit scouting database for info on this teamId
    const teamNumber = parseInt(teamId);

    if (isNaN(teamNumber)) {
        res.status(400);
        res.send('Query was not a number');
        return;
    }

    const imageData = await robotImageDisplay(teamNumber);

    //If the Image data DOES NOT exists:
    if (!imageData) {
        //  Return a 404 response
        res.status(404);
        res.sendFile(path.resolve('static/fallback.png'));
        return;
    }

    res.contentType('image/jpeg');
    //  Return the image data
    res.send(imageData);
});

app.get('/data/pit', async (req, res) => {
    const entries = await pitApp.find({}, { photo: 0 });

    const result: PitResult = {};

    entries.forEach(entry => (result[entry.teamNumber] = entry));

    res.send(result);
});

app.use(express.static('static'));

// Since this is the fallback is must go after all other routes
if (DEV) {
    app.use('/', createProxyMiddleware('http://localhost:5173', { ws: true }));
} else {
    app.use(express.static('../client/dist'));

    app.get('*', (_, res) => {
        res.sendFile(path.resolve('../client/dist/index.html'));
    });
}

export { app };
