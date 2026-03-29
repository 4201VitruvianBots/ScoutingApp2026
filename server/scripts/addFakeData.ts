import fs from 'fs';
import path from 'path';
import { startDockerContainer } from 'database';
import mongoose from 'mongoose';
import { ballsPerSecondApp, leaderboardApp, matchApp, pitApp } from '../src/Schema.js';
import {
    ActionKind,
    Drivebase,
    MatchData,
    OtherSwerveModuleType,
    PitFile,
    PreferredScoringSpot,
    RobotMaintain,
    ScoringMethod,
    ScouterData,
    SDSSwerveModuleType,
    TowerCapabilityClaimed,
    WPCSwerveModuleType,
} from 'requests';
import { dotenvLoad } from 'dotenv-mono';

dotenvLoad({ path: '.env' });
dotenvLoad({ path: '.env.local' });

function randint(max: number, min = 0) {
    return Math.floor((max - min) * Math.random()) + min;
}

function randfloat(max: number, min = 0) {
    return (max - min) * Math.random() + min;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function choose<T>(array: T[]) {
    return array[randint(array.length)]!;
}

function chance(probability: number) {
    return Math.random() < probability;
}

function shuffle<T>(array: T[]) {
    return [...array].sort(() => Math.random() - 0.5);
}

function parseBoolean(value: string | undefined, fallback: boolean) {
    if (!value) return fallback;
    return ['1', 'true', 'yes', 'y'].includes(value.toLowerCase());
}

function parseNumber(value: string | undefined, fallback: number) {
    const parsed = Number.parseFloat(value ?? '');
    return Number.isFinite(parsed) ? parsed : fallback;
}

function weightedChoice<T>(choices: Array<[T, number]>) {
    const total = choices.reduce((sum, [, weight]) => sum + weight, 0);
    const roll = Math.random() * total;
    let cursor = 0;
    for (const [value, weight] of choices) {
        cursor += weight;
        if (roll <= cursor) return value;
    }
    return choices[choices.length - 1]![0];
}

function roundToHundredth(value: number) {
    return Math.round(value * 100) / 100;
}

function hashString(input: string) {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index++) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

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

const mongoUrl = process.env.MONGO_URL ?? 'mongodb://0.0.0.0:27017/';
const matchCount = parseNumber(process.env.FAKE_MATCH_COUNT, 60);
const teamCount = parseNumber(process.env.FAKE_TEAM_COUNT, 36);
const teamStart = parseNumber(process.env.FAKE_TEAM_START, 1000);
const scouterCount = parseNumber(process.env.FAKE_SCOUTER_COUNT, 12);
const shouldClear = parseBoolean(process.env.FAKE_CLEAR, true);
const includePit = parseBoolean(process.env.FAKE_INCLUDE_PIT, true);
const includeLeaderboard = parseBoolean(
    process.env.FAKE_INCLUDE_LEADERBOARD,
    true
);
const includeAutoPath = parseBoolean(process.env.FAKE_INCLUDE_AUTO_PATH, true);
const autoPathVariance = clamp(
    parseNumber(process.env.FAKE_AUTO_PATH_VARIANCE, 0.11),
    0,
    0.25
);

const robotPositions = [
    'red_1',
    'red_2',
    'red_3',
    'red_4',
    'blue_1',
    'blue_2',
    'blue_3',
    'blue_4',
] as const;

const segmentWeights = [0.15, 0.15, 0.18, 0.17, 0.15, 0.12, 0.08];
const MATCH_TOTAL_SEC = 163;
const AUTO_END_SEC = 20;
const DELAY_END_SEC = 23;
const matchTimelineSegments: Array<{
    id: keyof MatchData['shootTimeBySegment'];
    startSec: number;
    endSec: number;
}> = [
    { id: 'auto', startSec: 0, endSec: AUTO_END_SEC },
    { id: 'transition', startSec: AUTO_END_SEC, endSec: DELAY_END_SEC },
    { id: 'shift1', startSec: DELAY_END_SEC, endSec: 50.5 },
    { id: 'shift2', startSec: 50.5, endSec: 78 },
    { id: 'shift3', startSec: 78, endSec: 105.5 },
    { id: 'shift4', startSec: 105.5, endSec: 133 },
    { id: 'endgame', startSec: 133, endSec: MATCH_TOTAL_SEC },
];

const scouterNamesBase = [
    'Vanessa',
    'Crisanto',
    'Christian',
    'Nathan',
    'Ashreeya',
    'Tica',
    'Jim',
    'Ari',
    'Jordan',
    'Sam',
];

const drivebases: Drivebase[] = ['tank', 'swerve', 'other'];
const sdsSwerveTypes: SDSSwerveModuleType[] = ['mk4' , 'mk4i' , 'mk4n' , 'mk4c' , 'mk5n' , 'mk5i'];
const wpcSwerveTypes: WPCSwerveModuleType[] = ['lNonFlipped', 'lFlippedBelt', 'lFlippedGear', 'swerveX' , 'swerveXF' , 'x2x2' , 'x2Sx2S'];
const otherSwerveType: OtherSwerveModuleType[] = ['other'];
const scoringMethods: ScoringMethod[] = ['dump', 'low-shot', 'high-shot', 'other'];
const preferredScoringSpots: PreferredScoringSpot[] = [
    'nearHub',
    'backOfZone',
    'varies',
];
const robotMaintain: RobotMaintain[] = [
    'easyMaintain',
    'hardMaintain',
];
const towerCapabilities: TowerCapabilityClaimed[] = [
    'level1',
    'level2',
    'level3',
    'unknown',
];

type TeamProfile = {
    auto: number;
    tele: number;
    climb: number;
    defense: number;
    discipline: number;
    reliability: number;
};

function loadTeams() {
    const fromEnv = (process.env.FAKE_TEAMS ?? '')
        .split(/[,\s]+/)
        .map(value => Number.parseInt(value, 10))
        .filter(value => Number.isFinite(value));
    if (fromEnv.length) {
        return Array.from(new Set(fromEnv)).sort((a, b) => a - b);
    }

    const teamInfoPath = path.resolve('static/team_info.json');
    if (fs.existsSync(teamInfoPath)) {
        const raw = JSON.parse(fs.readFileSync(teamInfoPath, 'utf-8')) as Record<
            string,
            unknown
        >;
        const teamNumbers = Object.keys(raw)
            .map(value => Number.parseInt(value, 10))
            .filter(value => Number.isFinite(value));
        if (teamNumbers.length) {
            return teamNumbers.sort((a, b) => a - b);
        }
    }

    return Array.from({ length: teamCount }, (_, index) => teamStart + index);
}

function createProfile(): TeamProfile {
    return {
        auto: randfloat(1, 0.2),
        tele: randfloat(1, 0.2),
        climb: randfloat(1, 0.2),
        defense: randfloat(1, 0.2),
        discipline: randfloat(1, 0.2),
        reliability: randfloat(1, 0.2),
    };
}

function buildScouterNames(count: number) {
    if (count <= scouterNamesBase.length) return scouterNamesBase.slice(0, count);
    const names = [...scouterNamesBase];
    while (names.length < count) {
        names.push(`Scout ${names.length + 1}`);
    }
    return names;
}

function buildAutoPath(
    robotPosition: MatchData['metadata']['robotPosition'],
    startPosition: MatchData['autoStartingPosition'],
    matchNumber: number
): MatchData['autoPath'] {
    if (!includeAutoPath || !startPosition) return null;

    const alliance = robotPosition.startsWith('red') ? 'red' : 'blue';
    const startX = alliance === 'red' ? 0.69 : 0.34;
    const startY =
        startPosition === 'left' ? 0.33 : startPosition === 'center' ? 0.5 : 0.67;
    const direction = alliance === 'red' ? -1 : 1;
    const pointCount = randint(13, 9);
    const points = Array.from({ length: pointCount }, (_, index) => {
        const progress = pointCount === 1 ? 1 : index / (pointCount - 1);
        const wobbleX = randfloat(autoPathVariance, -autoPathVariance) * 0.6;
        const wobbleY = randfloat(autoPathVariance, -autoPathVariance);
        return {
            x: roundToHundredth(
                clamp(startX + direction * progress * 0.26 + wobbleX, 0, 1)
            ),
            y: roundToHundredth(
                clamp(startY + Math.sin(progress * Math.PI) * 0.14 + wobbleY, 0, 1)
            ),
            tSec: roundToHundredth(progress * 20),
        };
    });

    const shotMarkers = points
        .filter((_, index) => index > 2 && index < points.length - 1 && chance(0.24))
        .slice(0, 3)
        .map(point => ({
            x: point.x,
            y: point.y,
            tSec: point.tSec,
        }));

    const fingerprint = hashString(
        `${alliance};${startPosition};${matchNumber};${points
            .map(point => `${point.x},${point.y}`)
            .join('|')}`
    );

    return {
        alliance,
        startPosition,
        points,
        shotMarkers,
        fingerprint,
    };
}

function computeFuelFromShootTime(
    shootTimeBySegment: MatchData['shootTimeBySegment'],
    ballsPerSecondUsed: number
) {
    const autoFuelScored = roundToHundredth(
        shootTimeBySegment.auto * ballsPerSecondUsed
    );
    const teleFuelBySegment = {
        transition: roundToHundredth(
            shootTimeBySegment.transition * ballsPerSecondUsed
        ),
        shift1: roundToHundredth(shootTimeBySegment.shift1 * ballsPerSecondUsed),
        shift2: roundToHundredth(shootTimeBySegment.shift2 * ballsPerSecondUsed),
        shift3: roundToHundredth(shootTimeBySegment.shift3 * ballsPerSecondUsed),
        shift4: roundToHundredth(shootTimeBySegment.shift4 * ballsPerSecondUsed),
        endgame: roundToHundredth(shootTimeBySegment.endgame * ballsPerSecondUsed),
    };
    return { autoFuelScored, teleFuelBySegment };
}

function buildActionIntervalsFromSegmentTotals(
    action: ActionKind,
    totals: MatchData['shootTimeBySegment']
) {
    const intervals: NonNullable<MatchData['actionTimeline']>['intervals'] = [];

    matchTimelineSegments.forEach(segment => {
        let remaining = totals[segment.id];
        if (remaining <= 0.03) {
            return;
        }

        const segmentLength = segment.endSec - segment.startSec;
        const intervalCount = Math.max(
            1,
            Math.min(4, Math.round(remaining / 0.7))
        );
        let cursor = segment.startSec + randfloat(Math.min(0.35, segmentLength * 0.2), 0);

        for (
            let intervalIndex = 0;
            intervalIndex < intervalCount && remaining > 0.03;
            intervalIndex++
        ) {
            const intervalsLeft = intervalCount - intervalIndex;
            const maxDuration = Math.min(
                1.8,
                remaining - 0.03 * (intervalsLeft - 1)
            );
            if (maxDuration <= 0.03) break;
            const minDuration = Math.min(maxDuration, 0.12);
            const duration = roundToHundredth(
                clamp(randfloat(maxDuration, minDuration), 0.05, maxDuration)
            );
            const latestStart = segment.endSec - duration;
            if (latestStart <= segment.startSec) break;

            const startSec = roundToHundredth(
                clamp(cursor, segment.startSec, latestStart)
            );
            const endSec = roundToHundredth(clamp(startSec + duration, startSec, segment.endSec));
            const durationSec = roundToHundredth(endSec - startSec);
            if (durationSec <= 0) break;

            intervals.push({
                action,
                startSec,
                endSec,
                durationSec,
            });

            remaining = roundToHundredth(Math.max(0, remaining - durationSec));
            cursor = endSec + randfloat(0.6, 0.08);
            if (cursor >= segment.endSec) break;
        }

        if (remaining > 0.03) {
            const durationSec = roundToHundredth(
                Math.min(remaining, segment.endSec - segment.startSec)
            );
            const endSec = roundToHundredth(
                clamp(segment.endSec - randfloat(0.06, 0), segment.startSec, segment.endSec)
            );
            const startSec = roundToHundredth(
                clamp(endSec - durationSec, segment.startSec, endSec)
            );
            const finalDurationSec = roundToHundredth(endSec - startSec);
            if (finalDurationSec > 0) {
                intervals.push({
                    action,
                    startSec,
                    endSec,
                    durationSec: finalDurationSec,
                });
            }
        }
    });

    return intervals.sort((a, b) => a.startSec - b.startSec);
}

function buildActionTimeline(
    shootTimeBySegment: MatchData['shootTimeBySegment'],
    passTimeBySegment: MatchData['passTimeBySegment']
): MatchData['actionTimeline'] {
    const intervals = [
        ...buildActionIntervalsFromSegmentTotals('shoot', shootTimeBySegment),
        ...buildActionIntervalsFromSegmentTotals('pass', passTimeBySegment),
    ].sort((a, b) => a.startSec - b.startSec || a.action.localeCompare(b.action));

    return {
        totalSec: MATCH_TOTAL_SEC,
        autoEndSec: AUTO_END_SEC,
        delayEndSec: DELAY_END_SEC,
        intervals,
    };
}

await startDockerContainer(process.env.CONTAINER_NAME);
await mongoose.connect(mongoUrl);

if (shouldClear) {
    await matchApp.deleteMany({});
    await pitApp.deleteMany({});
    await leaderboardApp.deleteMany({});
    await ballsPerSecondApp.deleteMany({});
}

const teams = loadTeams();
const scouterNames = buildScouterNames(scouterCount);
const profiles = new Map<number, TeamProfile>();
teams.forEach(team => profiles.set(team, createProfile()));

for (let matchNumber = 1; matchNumber <= matchCount; matchNumber++) {
    const matchTeams = shuffle(teams).slice(0, robotPositions.length);

    for (const [index, robotPosition] of robotPositions.entries()) {
        const team = matchTeams[index] ?? choose(teams);
        const profile = profiles.get(team) ?? createProfile();

        const robotAbsent = chance(0.03 + (1 - profile.reliability) * 0.08);
        const ballsPerSecondUsed = roundToHundredth(
            clamp(4.6 + profile.tele * 1.9 + randfloat(0.7, -0.6), 3, 8)
        );
        const shootTotal = robotAbsent
            ? 0
            : clamp(profile.auto * 2 + profile.tele * 9 + randfloat(2, -1), 0, 15);
        const passTotal = robotAbsent
            ? 0
            : clamp(profile.tele * 2.4 + randfloat(1, -0.6), 0, 5);
        const weighted = segmentWeights.map(weight =>
            roundToHundredth(shootTotal * weight)
        );
        const weightedPass = segmentWeights.map(weight =>
            roundToHundredth(passTotal * weight)
        );
        const shootTimeBySegment: MatchData['shootTimeBySegment'] = {
            auto: weighted[0]!,
            transition: weighted[1]!,
            shift1: weighted[2]!,
            shift2: weighted[3]!,
            shift3: weighted[4]!,
            shift4: weighted[5]!,
            endgame: weighted[6]!,
        };
        const passTimeBySegment: MatchData['passTimeBySegment'] = {
            auto: weightedPass[0]!,
            transition: weightedPass[1]!,
            shift1: weightedPass[2]!,
            shift2: weightedPass[3]!,
            shift3: weightedPass[4]!,
            shift4: weightedPass[5]!,
            endgame: weightedPass[6]!,
        };
        const actionTimeline = buildActionTimeline(
            shootTimeBySegment,
            passTimeBySegment
        );
        const fuel = computeFuelFromShootTime(shootTimeBySegment, ballsPerSecondUsed);
        const autoStartingPosition = robotAbsent
            ? null
            : choose(['left', 'center', 'right'] as const);
        const teleTower = robotAbsent
            ? 'None'
            : weightedChoice<MatchData['teleTower']>([
                  ['None', 0.2],
                  ['level1', 0.22],
                  ['level2', 0.28],
                  ['level3', 0.2],
                  ['Failed', 0.1],
              ]);

        const matchData: MatchData = {
            metadata: {
                robotPosition,
                robotTeam: team,
                scouterName: choose(scouterNames),
                matchNumber,
            },
            robotAbsent,
            autoStartingPosition,
            autoPath: buildAutoPath(robotPosition, autoStartingPosition, matchNumber),
            shootTimeBySegment: robotAbsent ? emptyActionTimeBySegment : shootTimeBySegment,
            passTimeBySegment: robotAbsent ? emptyActionTimeBySegment : passTimeBySegment,
            actionTimeline: robotAbsent
                ? {
                      totalSec: MATCH_TOTAL_SEC,
                      autoEndSec: AUTO_END_SEC,
                      delayEndSec: DELAY_END_SEC,
                      intervals: [],
                  }
                : actionTimeline,
            ballsPerSecondUsed,
            autoFuelScored: robotAbsent ? 0 : fuel.autoFuelScored,
            teleFuelBySegment: robotAbsent
                ? {
                      transition: 0,
                      shift1: 0,
                      shift2: 0,
                      shift3: 0,
                      shift4: 0,
                      endgame: 0,
                  }
                : fuel.teleFuelBySegment,
            teleTower,
            breakdown: robotAbsent
                ? 'None'
                : chance(0.03 + (1 - profile.reliability) * 0.09)
                  ? choose(['stuck', 'tipped', 'comms', 'mechanism', 'other'])
                  : 'None',
            driverQuality: weightedChoice([
                ['great', 0.2 + profile.tele * 0.35],
                ['good', 0.35],
                ['ok', 0.3],
                ['rough', 0.15 + (1 - profile.tele) * 0.2],
            ]),
            defenseProvided: weightedChoice([
                ['None', 0.45],
                ['some', 0.35],
                ['heavy', 0.2 + profile.defense * 0.2],
            ]),
            defenseReceived: chance(0.3 + profile.defense * 0.4),
            fouls: {
                ...emptyFouls,
                pinning: randint(2 - Math.floor(profile.discipline * 2)),
                towerContactInEndgame: randint(2 - Math.floor(profile.discipline * 2)),
                outOfZoneShooting: randint(2 - Math.floor(profile.discipline * 2)),
                ejectedFuel: randint(2 - Math.floor(profile.discipline * 2)),
                other: randint(2 - Math.floor(profile.discipline * 2)),
            },
            breaks: {
                ...emptyBreaks,
                mechanism: randint(2 - Math.floor(profile.reliability * 2)),
                battery: randint(2 - Math.floor(profile.reliability * 2)),
                comms: randint(2 - Math.floor(profile.reliability * 2)),
                bumper: randint(2 - Math.floor(profile.reliability * 2)),
            },
            freeText: chance(0.2) ? 'Fake match note' : '',
        };

        await matchApp
            .replaceOne(
                {
                    'metadata.robotTeam': team,
                    'metadata.matchNumber': matchNumber,
                },
                matchData
            )
            .setOptions({ upsert: true });

        await ballsPerSecondApp
            .replaceOne(
                { matchNumber, robotTeam: team },
                { matchNumber, robotTeam: team, ballsPerSecond: ballsPerSecondUsed }
            )
            .setOptions({ upsert: true });
    }
}

if (includePit) {
    for (const team of teams) {
        const profile = profiles.get(team) ?? createProfile();
        const pitEntry: Omit<PitFile, 'photo'> & { photo: Buffer } = {
            scouterName: choose(scouterNames),
            teamNumber: team,
            drivebase: choose(drivebases),
            sdsSwerveType: choose(sdsSwerveTypes),
            wpcSwerveType: choose(wpcSwerveTypes),
            otherSwerveType: choose(otherSwerveType),
            maxFuelStorageEstimate: chance(0.15)
                ? null
                : clamp(Math.round(profile.tele * 40 + randfloat(12, 4)), 0, 60),
            intakeSources: {
                depot: chance(0.75),
                outpostCorral: chance(0.5),
                floorNeutral: chance(0.6),
            },
            scoringMethod: choose(scoringMethods),
            preferredScoringSpot: choose(preferredScoringSpots),
            robotMaintain: choose(robotMaintain),
            towerCapabilityClaimed: choose(towerCapabilities),
            batteryCount: clamp(randint(7), 0, 6),
            photo: Buffer.from([]),
            notes: includeAutoPath
                ? 'Auto path fake traces enabled'
                : 'Auto path fake traces disabled',
        };

        await pitApp
            .replaceOne({ teamNumber: team }, pitEntry)
            .setOptions({ upsert: true });
    }
}

if (includeLeaderboard) {
    const leaderboardEntries: ScouterData[] = scouterNames.map(name => ({
        scouterName: name,
        accuracy: clamp(Math.round(randfloat(100, 55)), 40, 100),
    }));
    await leaderboardApp.insertMany(leaderboardEntries);
}

await mongoose.disconnect();
