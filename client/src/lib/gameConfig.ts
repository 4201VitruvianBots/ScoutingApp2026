import type {
    AllianceColor,
    GameConfig2026,
    MatchSegmentId,
    RobotPosition,
    TeleFuelBySegment,
    TeleSegmentId,
} from 'requests';
import configJson from '../assets/game_config_2026.json';

const gameConfig = configJson as GameConfig2026;

const redPositionsAll: RobotPosition[] = ['red_1', 'red_2', 'red_3', 'red_4'];
const bluePositionsAll: RobotPosition[] = [
    'blue_1',
    'blue_2',
    'blue_3',
    'blue_4',
];

const teleSegmentIds: TeleSegmentId[] = [
    'transition',
    'shift1',
    'shift2',
    'shift3',
    'shift4',
    'endgame',
];

function getSegmentForElapsed(elapsedSec: number): MatchSegmentId {
    const clamped = Math.max(0, Math.min(elapsedSec, gameConfig.matchDurationSec));
    const segment = gameConfig.segments.find(
        entry => clamped >= entry.startSec && clamped < entry.endSec
    );
    return segment?.id ?? 'endgame';
}

function getSegmentForRemaining(remainingSec: number): MatchSegmentId {
    return getSegmentForElapsed(gameConfig.matchDurationSec - remainingSec);
}

function formatMatchTime(remainingSec: number): string {
    const clamped = Math.max(0, Math.min(remainingSec, gameConfig.matchDurationSec));
    const minutes = Math.floor(clamped / 60);
    const seconds = Math.floor(clamped % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getRobotPositions(size = gameConfig.allianceSizeRobots.default): RobotPosition[] {
    return [
        ...bluePositionsAll.slice(0, size),
        ...redPositionsAll.slice(0, size),
    ];
}

function getAlliancePositions(
    alliance: AllianceColor,
    size = gameConfig.allianceSizeRobots.default
): RobotPosition[] {
    return (alliance === 'red' ? redPositionsAll : bluePositionsAll).slice(
        0,
        size
    );
}

function makeEmptyTeleFuelBySegment(): TeleFuelBySegment {
    return {
        transition: 0,
        pause: 0,
        shift1: 0,
        shift2: 0,
        shift3: 0,
        shift4: 0,
        endgame: 0,
    };
}

export {
    gameConfig,
    teleSegmentIds,
    getSegmentForElapsed,
    getSegmentForRemaining,
    formatMatchTime,
    getRobotPositions,
    getAlliancePositions,
    makeEmptyTeleFuelBySegment,
};
