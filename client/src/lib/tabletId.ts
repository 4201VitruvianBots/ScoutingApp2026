import type { RobotPosition } from 'requests';

const TABLET_ID_STORAGE_KEY = 'scouting-tablet-id';
const TABLET_SLOT_STORAGE_KEY = 'scouting-tablet-slot';
const assignableRobotPositions: RobotPosition[] = [
    'red_1',
    'red_2',
    'red_3',
    'blue_1',
    'blue_2',
    'blue_3',
];
const assignableRobotPositionSet = new Set<RobotPosition>(assignableRobotPositions);

function createTabletId() {
    const random = Math.random().toString(36).slice(2, 10);
    return `tablet-${random}`;
}

function getOrCreateTabletId() {
    const existing = localStorage.getItem(TABLET_ID_STORAGE_KEY)?.trim();
    if (existing) return existing;

    const generated = createTabletId();
    localStorage.setItem(TABLET_ID_STORAGE_KEY, generated);
    return generated;
}

function isAssignableRobotPosition(value: unknown): value is RobotPosition {
    if (typeof value !== 'string') return false;
    return assignableRobotPositionSet.has(value as RobotPosition);
}

function formatTabletSlotLabel(position: RobotPosition) {
    const [alliance, slot] = position.split('_');
    return `${alliance.charAt(0).toUpperCase()}${alliance.slice(1)} ${slot}`;
}

export {
    TABLET_ID_STORAGE_KEY,
    TABLET_SLOT_STORAGE_KEY,
    assignableRobotPositions,
    formatTabletSlotLabel,
    getOrCreateTabletId,
    isAssignableRobotPosition,
};
