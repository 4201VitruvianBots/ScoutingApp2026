import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent,
} from 'react';
import { MaterialSymbol } from 'react-material-symbols';
import 'react-material-symbols/rounded';
import {
    AllianceColor,
    AutoFieldOrientationSetting,
    AutoStartingPosition,
    BreakdownType,
    DriverQuality,
    FieldOrientation,
    MatchData,
    MatchSchedule,
    RobotPosition,
    TeleTowerResult,
} from 'requests';
import LinkButton from '../../components/LinkButton';
import SignIn from '../../components/SignIn';
import Dialog from '../../components/Dialog';
import NumberInput from '../../components/NumberInput';
import TeamDropdown from '../../components/TeamDropdown';
import MultiButton from '../../components/MultiButton';
import Checkbox from '../../components/Checkbox';
import TextInput from '../../components/TextInput';
import HoldButton from '../../components/HoldButton';
import { useStatus } from '../../lib/useStatus';
import { useQueue } from '../../lib/useQueue';
import { usePreventUnload } from '../../lib/usePreventUnload';
import scheduleFile from '../../assets/matchSchedule.json';
import { formatMatchTime } from '../../lib/gameConfig';

const DEFAULT_BALLS_PER_SECOND = 5;
const TIMER_INTERVAL_MS = 50;
const AUTO_COUNTDOWN_SEC = 20;
const TRANSITION_COUNTDOWN_SEC = 3;
const TELEOP_COUNTDOWN_SEC = 140;
const ENDGAME_SEC = 30;
const SHIFT_SEC = (TELEOP_COUNTDOWN_SEC - ENDGAME_SEC) / 4;
const MATCH_TOTAL_SEC = AUTO_COUNTDOWN_SEC + TRANSITION_COUNTDOWN_SEC + TELEOP_COUNTDOWN_SEC;
const INTERVAL_MERGE_GAP_SEC = 0.08;
const HOLD_INTERVAL_MS = 100;
const AUTO_POINT_MIN_DISTANCE = 0.008;

type ActionKind = 'shoot' | 'pass';
type FullSegmentId = keyof MatchData['shootTimeBySegment'];
type AutoPathPoint = NonNullable<MatchData['autoPath']>['points'][number];
type AutoShotMarker = NonNullable<MatchData['autoPath']>['shotMarkers'][number];

type ActionTick = {
    id: number;
    groupId: number;
    action: ActionKind;
    segment: FullSegmentId;
    startSec: number;
    endSec: number;
    durationSec: number;
};

type ActionInterval = {
    action: ActionKind;
    startSec: number;
    endSec: number;
};

type MatchTimelineSegment = {
    id: FullSegmentId;
    label: string;
    startSec: number;
    endSec: number;
};

type ActiveHold = {
    action: ActionKind;
    startSec: number;
    startMs: number;
};

const matchTimelineSegments: MatchTimelineSegment[] = [
    { id: 'auto', label: 'AUTO', startSec: 0, endSec: AUTO_COUNTDOWN_SEC },
    {
        id: 'transition',
        label: 'DELAY',
        startSec: AUTO_COUNTDOWN_SEC,
        endSec: AUTO_COUNTDOWN_SEC + TRANSITION_COUNTDOWN_SEC,
    },
    {
        id: 'shift1',
        label: 'SHIFT 1',
        startSec: AUTO_COUNTDOWN_SEC + TRANSITION_COUNTDOWN_SEC,
        endSec: AUTO_COUNTDOWN_SEC + TRANSITION_COUNTDOWN_SEC + SHIFT_SEC,
    },
    {
        id: 'shift2',
        label: 'SHIFT 2',
        startSec: AUTO_COUNTDOWN_SEC + TRANSITION_COUNTDOWN_SEC + SHIFT_SEC,
        endSec: AUTO_COUNTDOWN_SEC + TRANSITION_COUNTDOWN_SEC + SHIFT_SEC * 2,
    },
    {
        id: 'shift3',
        label: 'SHIFT 3',
        startSec: AUTO_COUNTDOWN_SEC + TRANSITION_COUNTDOWN_SEC + SHIFT_SEC * 2,
        endSec: AUTO_COUNTDOWN_SEC + TRANSITION_COUNTDOWN_SEC + SHIFT_SEC * 3,
    },
    {
        id: 'shift4',
        label: 'SHIFT 4',
        startSec: AUTO_COUNTDOWN_SEC + TRANSITION_COUNTDOWN_SEC + SHIFT_SEC * 3,
        endSec: MATCH_TOTAL_SEC - ENDGAME_SEC,
    },
    {
        id: 'endgame',
        label: 'ENDGAME',
        startSec: MATCH_TOTAL_SEC - ENDGAME_SEC,
        endSec: MATCH_TOTAL_SEC,
    },
];

const schedule = scheduleFile as MatchSchedule;

const autoStartingOptions: Array<{ label: string; value: AutoStartingPosition | null }> = [
    { label: 'Left', value: 'left' },
    { label: 'Center', value: 'center' },
    { label: 'Right', value: 'right' },
    { label: 'N/A', value: null },
];

const teleTowerOptions: TeleTowerResult[] = ['None', 'Failed', 'level1', 'level2', 'level3'];
const driverQualityOptions: DriverQuality[] = ['great', 'good', 'ok', 'rough'];
const breakdownOptions: BreakdownType[] = ['None', 'stuck', 'tipped', 'comms', 'mechanism', 'other'];

const foulLabels: Array<{ key: keyof MatchData['fouls']; label: string }> = [
    { key: 'pinning', label: 'Pinning' },
    { key: 'towerContactInEndgame', label: 'Tower Contact (Endgame)' },
    { key: 'outOfZoneShooting', label: 'Out-of-Zone Shooting' },
    { key: 'ejectedFuel', label: 'Ejected Fuel' },
    { key: 'other', label: 'Other' },
];

const breakLabels: Array<{ key: keyof MatchData['breaks']; label: string }> = [
    { key: 'mechanism', label: 'Mechanism' },
    { key: 'battery', label: 'Battery' },
    { key: 'comms', label: 'Comms' },
    { key: 'bumper', label: 'Bumper' },
];

const autoFieldImageByAlliance: Record<AllianceColor, string> = {
    red: '/redsidematch.png',
    blue: '/bluesidematch.png',
};
const defaultFieldOrientationBySide: Record<AllianceColor, FieldOrientation> = {
    red: 'orientation1',
    blue: 'orientation1',
};

const autoStartDotByAlliance: Record<
    AllianceColor,
    Record<AutoStartingPosition, { x: number; y: number }>
> = {
    red: {
        left: { x: 0.69, y: 0.33 },
        center: { x: 0.69, y: 0.5 },
        right: { x: 0.69, y: 0.67 },
    },
    blue: {
        right: { x: 0.34, y: 0.33 },
        center: { x: 0.34, y: 0.5 },
        left: { x: 0.34, y: 0.67 },
    },
};

function makeEmptyActionTimeBySegment(): MatchData['shootTimeBySegment'] {
    return {
        auto: 0,
        transition: 0,
        shift1: 0,
        shift2: 0,
        shift3: 0,
        shift4: 0,
        endgame: 0,
    };
}

function makeEmptyFouls(): MatchData['fouls'] {
    return { pinning: 0, towerContactInEndgame: 0, outOfZoneShooting: 0, ejectedFuel: 0, other: 0 };
}

function makeEmptyBreaks(): MatchData['breaks'] {
    return { mechanism: 0, battery: 0, comms: 0, bumper: 0 };
}

function roundToHundredth(value: number) {
    return Math.round(value * 100) / 100;
}

function clamp(value: number, minValue: number, maxValue: number) {
    return Math.max(minValue, Math.min(value, maxValue));
}

function roundToTenThousandth(value: number) {
    return Math.round(value * 10000) / 10000;
}

function getAllianceFromRobotPosition(
    robotPosition: RobotPosition | undefined
): AllianceColor {
    return robotPosition?.startsWith('red') ? 'red' : 'blue';
}

function getDistance(
    a: { x: number; y: number },
    b: { x: number; y: number }
) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function makeSmoothPath(points: Array<{ x: number; y: number }>) {
    if (points.length === 0) return '';
    const smoothed = points.map((point, index) => {
        const previous = points[index - 1];
        const next = points[index + 1];
        if (!previous || !next) return point;
        return {
            x: previous.x * 0.2 + point.x * 0.6 + next.x * 0.2,
            y: previous.y * 0.2 + point.y * 0.6 + next.y * 0.2,
        };
    });

    let path = `M ${smoothed[0]!.x} ${smoothed[0]!.y}`;
    for (let index = 1; index < smoothed.length; index++) {
        const point = smoothed[index]!;
        path += ` L ${point.x} ${point.y}`;
    }
    return path;
}

function getSegmentForElapsed(elapsedSec: number): FullSegmentId {
    const clamped = clamp(elapsedSec, 0, MATCH_TOTAL_SEC);
    const segment = matchTimelineSegments.find(
        entry => clamped >= entry.startSec && clamped < entry.endSec
    );
    return segment?.id ?? 'endgame';
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
                startSec: overlapStart,
                endSec: overlapEnd,
                durationSec: roundToHundredth(overlapEnd - overlapStart),
            };
        })
        .filter(
            (entry): entry is {
                segment: FullSegmentId;
                startSec: number;
                endSec: number;
                durationSec: number;
            } => entry !== null
        );
}

function formatMatchTimerDisplay(remainingSec: number): string {
    const elapsedSec = clamp(MATCH_TOTAL_SEC - remainingSec, 0, MATCH_TOTAL_SEC);

    if (elapsedSec < AUTO_COUNTDOWN_SEC) {
        return `${Math.max(0, Math.ceil(AUTO_COUNTDOWN_SEC - elapsedSec))}`;
    }

    if (elapsedSec < AUTO_COUNTDOWN_SEC + TRANSITION_COUNTDOWN_SEC) {
        return `${Math.max(
            0,
            Math.ceil(AUTO_COUNTDOWN_SEC + TRANSITION_COUNTDOWN_SEC - elapsedSec)
        )}`;
    }

    const teleElapsed = elapsedSec - AUTO_COUNTDOWN_SEC - TRANSITION_COUNTDOWN_SEC;
    const teleRemaining = clamp(
        TELEOP_COUNTDOWN_SEC - teleElapsed,
        0,
        TELEOP_COUNTDOWN_SEC
    );
    return formatMatchTime(teleRemaining);
}

function mergeActionTicks(ticks: ActionTick[]): ActionInterval[] {
    if (ticks.length === 0) return [];
    const sorted = [...ticks].sort((a, b) => a.startSec - b.startSec);
    const output: ActionInterval[] = [];
    sorted.forEach(tick => {
        const last = output[output.length - 1];
        if (
            last &&
            last.action === tick.action &&
            Math.abs(last.endSec - tick.startSec) <= INTERVAL_MERGE_GAP_SEC
        ) {
            last.endSec = Math.max(last.endSec, tick.endSec);
            return;
        }
        output.push({ action: tick.action, startSec: tick.startSec, endSec: tick.endSec });
    });
    return output;
}

function getActionTimeBySegmentFromTicks(
    ticks: ActionTick[],
    action: ActionKind
): MatchData['shootTimeBySegment'] {
    const totals = makeEmptyActionTimeBySegment();
    ticks.forEach(tick => {
        if (tick.action === action) totals[tick.segment] += tick.durationSec;
    });
    (Object.keys(totals) as FullSegmentId[]).forEach(segment => {
        totals[segment] = roundToHundredth(totals[segment]);
    });
    return totals;
}

function MatchApp() {
    usePreventUnload();
    const [sendQueue, sendAll, queue, sending] = useQueue();
    const [teamNumber, setTeamNumber] = useState<number>();
    const [matchNumber, setMatchNumber] = useState<number>();
    const [scouterName, setScouterName] = useState('');
    const [robotPosition, setRobotPosition] = useState<RobotPosition>();
    const [showCheck, setShowCheck] = useState(false);

    const [robotAbsent, setRobotAbsent] = useState(false);
    const [autoStartingPosition, setAutoStartingPosition] = useState<AutoStartingPosition | null>(null);
    const [teleTower, setTeleTower] = useState<TeleTowerResult>('None');
    const [driverQuality, setDriverQuality] = useState<DriverQuality>('ok');
    const [breakdown, setBreakdown] = useState<BreakdownType>('None');
    const [defenseProvided, setDefenseProvided] = useState<MatchData['defenseProvided']>('None');
    const [defenseReceived, setDefenseReceived] = useState(false);
    const [fouls, setFouls] = useState<MatchData['fouls']>(makeEmptyFouls());
    const [breaks, setBreaks] = useState<MatchData['breaks']>(makeEmptyBreaks());
    const [freeText, setFreeText] = useState('');
    const [actionTicks, setActionTicks] = useState<ActionTick[]>([]);
    const nextTickIdRef = useRef(1);
    const nextGroupIdRef = useRef(1);
    const [activeHolds, setActiveHolds] = useState<Partial<Record<ActionKind, ActiveHold>>>({});
    const activeHoldsRef = useRef<Partial<Record<ActionKind, ActiveHold>>>({});
    const [ballsPerSecondUsed, setBallsPerSecondUsed] = useState(DEFAULT_BALLS_PER_SECOND);
    const [remainingSec, setRemainingSec] = useState(MATCH_TOTAL_SEC);
    const [isRunning, setIsRunning] = useState(false);
    const [scrubbingTimeline, setScrubbingTimeline] = useState(false);
    const timelineRef = useRef<HTMLDivElement>(null);
    const autoFieldRef = useRef<HTMLDivElement>(null);
    const autoFieldImageRef = useRef<HTMLImageElement>(null);
    const autoDrawingPointerIdRef = useRef<number | null>(null);
    const [autoPanelManualOverride, setAutoPanelManualOverride] = useState<boolean | null>(null);
    const [autoPathPoints, setAutoPathPoints] = useState<AutoPathPoint[]>([]);
    const [autoShotMarkers, setAutoShotMarkers] = useState<AutoShotMarker[]>([]);
    const [autoResumePoint, setAutoResumePoint] = useState<AutoPathPoint | null>(null);
    const [autoDrawing, setAutoDrawing] = useState(false);
    const [fieldOrientationBySide, setFieldOrientationBySide] = useState<
        Record<AllianceColor, FieldOrientation>
    >(defaultFieldOrientationBySide);
    const [autoFieldSize, setAutoFieldSize] = useState({ width: 1000, height: 1000 });

    const elapsedSec = clamp(MATCH_TOTAL_SEC - remainingSec, 0, MATCH_TOTAL_SEC);
    const currentSegment = getSegmentForElapsed(elapsedSec);
    const currentSegmentLabel =
        matchTimelineSegments.find(segment => segment.id === currentSegment)?.label ?? 'AUTO';
    const allianceColor = getAllianceFromRobotPosition(robotPosition);
    const autoFieldImage = autoFieldImageByAlliance[allianceColor];
    const fieldOrientation = fieldOrientationBySide[allianceColor];
    const fieldIsFlipped = fieldOrientation === 'orientation2';
    const autoPanelOpen = autoPanelManualOverride ?? currentSegment === 'auto';
    const autoStartDots = autoStartDotByAlliance[allianceColor];
    const canDrawAutoPath = isRunning && currentSegment === 'auto' && !robotAbsent;
    const autoDrawingTip = autoPathPoints[autoPathPoints.length - 1] ?? null;
    const autoPathTrace: MatchData['autoPath'] =
        autoPathPoints.length || autoShotMarkers.length
            ? {
                  alliance: allianceColor,
                  startPosition: autoStartingPosition,
                  points: autoPathPoints,
                  shotMarkers: autoShotMarkers,
                  fingerprint: '',
              }
            : null;
    const autoPathViewPoints = useMemo(
        () =>
            autoPathPoints.map(point => ({
                x: point.x * autoFieldSize.width,
                y: point.y * autoFieldSize.height,
            })),
        [autoFieldSize.height, autoFieldSize.width, autoPathPoints]
    );
    const autoPathSvg = useMemo(
        () => makeSmoothPath(autoPathViewPoints),
        [autoPathViewPoints]
    );
    const elapsedPercent = clamp((elapsedSec / MATCH_TOTAL_SEC) * 100, 0, 100);
    const displayTimer = formatMatchTimerDisplay(remainingSec);
    const shootTimeBySegment = useMemo(() => getActionTimeBySegmentFromTicks(actionTicks, 'shoot'), [actionTicks]);
    const passTimeBySegment = useMemo(() => getActionTimeBySegmentFromTicks(actionTicks, 'pass'), [actionTicks]);
    const timelineIntervals = useMemo(() => {
        const pendingTicks = [...actionTicks];
        (Object.values(activeHolds) as Array<ActiveHold | undefined>).forEach(hold => {
            if (!hold) return;
            const safeEnd = clamp(Math.max(elapsedSec, hold.startSec), hold.startSec, MATCH_TOTAL_SEC);
            pendingTicks.push({
                id: -1,
                groupId: -1,
                action: hold.action,
                segment: getSegmentForElapsed(hold.startSec),
                startSec: hold.startSec,
                endSec: safeEnd,
                durationSec: roundToHundredth(safeEnd - hold.startSec),
            });
        });
        return mergeActionTicks(pendingTicks);
    }, [actionTicks, activeHolds, elapsedSec]);
    const totalShootTime = useMemo(
        () => roundToHundredth(Object.values(shootTimeBySegment).reduce((sum, value) => sum + value, 0)),
        [shootTimeBySegment]
    );
    const totalPassTime = useMemo(
        () => roundToHundredth(Object.values(passTimeBySegment).reduce((sum, value) => sum + value, 0)),
        [passTimeBySegment]
    );
    const liveShootHoldSec = activeHolds.shoot
        ? roundToHundredth(
              clamp(
                  Math.max(elapsedSec - activeHolds.shoot.startSec, 0),
                  0,
                  MATCH_TOTAL_SEC
              )
          )
        : 0;
    const livePassHoldSec = activeHolds.pass
        ? roundToHundredth(
              clamp(
                  Math.max(elapsedSec - activeHolds.pass.startSec, 0),
                  0,
                  MATCH_TOTAL_SEC
              )
          )
        : 0;
    const totalShootTimeDisplay = roundToHundredth(totalShootTime + liveShootHoldSec);
    const totalPassTimeDisplay = roundToHundredth(totalPassTime + livePassHoldSec);
    const shootTickCount = useMemo(
        () => actionTicks.reduce((count, tick) => count + (tick.action === 'shoot' ? 1 : 0), 0),
        [actionTicks]
    );
    const passTickCount = useMemo(
        () => actionTicks.reduce((count, tick) => count + (tick.action === 'pass' ? 1 : 0), 0),
        [actionTicks]
    );

    const signInRequired = scouterName.trim() === '' || robotPosition == undefined;
    const canTrackActions = isRunning && !robotAbsent && remainingSec > 0;
    const sectionClass = 'rounded-2xl border border-white/10 bg-[#1d2433]/95 p-4 shadow-lg shadow-black/25';
    const inputClass =
        'mt-1 w-full rounded-lg border border-white/15 bg-[#0f1522] px-3 py-2 text-sm text-white outline-none focus:border-[#48c55c]/60 focus:ring-2 focus:ring-[#48c55c]/30';
    const syncAutoFieldSize = () => {
        const image = autoFieldImageRef.current;
        if (!image) return;
        const width = image.naturalWidth || image.clientWidth || 1000;
        const height = image.naturalHeight || image.clientHeight || 1000;
        setAutoFieldSize(prev =>
            prev.width === width && prev.height === height
                ? prev
                : { width, height }
        );
    };

    useStatus(robotPosition, matchNumber, scouterName);

    useEffect(() => {
        if (!schedule || !robotPosition || matchNumber == undefined) {
            setTeamNumber(undefined);
            return;
        }
        setTeamNumber(schedule[matchNumber]?.[robotPosition]);
    }, [matchNumber, robotPosition]);

    useEffect(() => {
        let cancelled = false;
        const loadBallsPerSecond = async () => {
            if (matchNumber == undefined || teamNumber == undefined) {
                setBallsPerSecondUsed(DEFAULT_BALLS_PER_SECOND);
                return;
            }
            try {
                const response = await fetch(
                    `/config/balls-per-second?matchNumber=${matchNumber}&teamNumber=${teamNumber}`
                );
                if (!response.ok) throw new Error('Failed to load balls/sec');
                const payload = (await response.json()) as { ballsPerSecond?: number };
                if (!cancelled) {
                    const nextValue = Number(payload.ballsPerSecond);
                    setBallsPerSecondUsed(
                        Number.isFinite(nextValue) && nextValue >= 0 ? nextValue : DEFAULT_BALLS_PER_SECOND
                    );
                }
            } catch {
                if (!cancelled) setBallsPerSecondUsed(DEFAULT_BALLS_PER_SECOND);
            }
        };
        loadBallsPerSecond();
        return () => {
            cancelled = true;
        };
    }, [matchNumber, teamNumber]);

    useEffect(() => {
        let cancelled = false;
        const loadOrientationConfig = async () => {
            try {
                const response = await fetch('/config/auto-field-orientation');
                if (!response.ok) throw new Error('Failed to load orientation config');
                const payload = (await response.json()) as AutoFieldOrientationSetting[];
                if (cancelled || !Array.isArray(payload)) return;

                const next = { ...defaultFieldOrientationBySide };
                payload.forEach(entry => {
                    if (
                        (entry.side === 'red' || entry.side === 'blue') &&
                        (entry.orientation === 'orientation1' ||
                            entry.orientation === 'orientation2')
                    ) {
                        next[entry.side] = entry.orientation;
                    }
                });
                setFieldOrientationBySide(next);
            } catch {
                if (!cancelled) {
                    setFieldOrientationBySide(defaultFieldOrientationBySide);
                }
            }
        };
        loadOrientationConfig();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        syncAutoFieldSize();
    }, [autoFieldImage]);

    useEffect(() => {
        if (!isRunning) return;
        const interval = window.setInterval(() => {
            setRemainingSec(prev => {
                const next = roundToHundredth(prev - TIMER_INTERVAL_MS / 1000);
                if (next <= 0) {
                    setIsRunning(false);
                    return 0;
                }
                return next;
            });
        }, TIMER_INTERVAL_MS);
        return () => window.clearInterval(interval);
    }, [isRunning]);

    useEffect(() => {
        if (canDrawAutoPath || !autoDrawing) return;
        const pointerId = autoDrawingPointerIdRef.current;
        const field = autoFieldRef.current;
        if (
            field &&
            pointerId != null &&
            field.hasPointerCapture(pointerId)
        ) {
            field.releasePointerCapture(pointerId);
        }
        autoDrawingPointerIdRef.current = null;
        setAutoDrawing(false);
        setAutoResumePoint(autoDrawingTip);
    }, [autoDrawing, autoDrawingTip, canDrawAutoPath]);

    const setMatchTimeFromElapsed = (elapsed: number) => {
        const clampedElapsed = clamp(elapsed, 0, MATCH_TOTAL_SEC);
        setRemainingSec(roundToHundredth(MATCH_TOTAL_SEC - clampedElapsed));
    };

    const updateElapsedFromPointer = (clientX: number) => {
        const timeline = timelineRef.current;
        if (!timeline) return;
        const rect = timeline.getBoundingClientRect();
        if (rect.width <= 0) return;
        const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
        setMatchTimeFromElapsed(ratio * MATCH_TOTAL_SEC);
    };

    const handleTimelinePointerDown = (
        event: ReactPointerEvent<HTMLDivElement>
    ) => {
        setScrubbingTimeline(true);
        event.currentTarget.setPointerCapture(event.pointerId);
        updateElapsedFromPointer(event.clientX);
    };

    const handleTimelinePointerMove = (
        event: ReactPointerEvent<HTMLDivElement>
    ) => {
        if (!scrubbingTimeline) return;
        updateElapsedFromPointer(event.clientX);
    };

    const stopTimelineScrub = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!scrubbingTimeline) return;
        setScrubbingTimeline(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    const getAutoPointFromClient = (clientX: number, clientY: number) => {
        const field = autoFieldImageRef.current;
        if (!field) return null;
        const rect = field.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        const rawX = clamp((clientX - rect.left) / rect.width, 0, 1);
        const x = roundToTenThousandth(fieldIsFlipped ? 1 - rawX : rawX);
        const y = roundToTenThousandth(clamp((clientY - rect.top) / rect.height, 0, 1));
        return { x, y };
    };

    const appendAutoPoint = (point: AutoPathPoint) => {
        setAutoPathPoints(prev => {
            const last = prev[prev.length - 1];
            if (last && getDistance(last, point) < AUTO_POINT_MIN_DISTANCE) {
                return prev;
            }
            if (!last) return [...prev, point];
            const blendedPoint: AutoPathPoint = {
                x: roundToTenThousandth(last.x * 0.12 + point.x * 0.88),
                y: roundToTenThousandth(last.y * 0.12 + point.y * 0.88),
                tSec: point.tSec,
            };
            return [...prev, blendedPoint];
        });
    };

    const beginAutoDrawing = (
        event: ReactPointerEvent<HTMLElement>,
        seedPoint: { x: number; y: number },
        resetPath: boolean
    ) => {
        if (!canDrawAutoPath) return;
        event.preventDefault();
        event.stopPropagation();

        const basePoint: AutoPathPoint = {
            x: seedPoint.x,
            y: seedPoint.y,
            tSec: elapsedSec,
        };

        if (resetPath) {
            setAutoPathPoints([basePoint]);
            setAutoShotMarkers([]);
        } else {
            appendAutoPoint(basePoint);
        }
        setAutoResumePoint(null);
        setAutoDrawing(true);
        autoDrawingPointerIdRef.current = event.pointerId;

        const field = autoFieldRef.current;
        if (field) {
            try {
                field.setPointerCapture(event.pointerId);
            } catch {
                // noop: capture can fail on some browsers if pointer is unavailable.
            }
        }
    };

    const stopAutoDrawing = (event?: ReactPointerEvent<HTMLElement>) => {
        if (!autoDrawing) return;

        const pointerId = event?.pointerId ?? autoDrawingPointerIdRef.current;
        let nextResumePoint = autoDrawingTip;
        if (event) {
            const normalized = getAutoPointFromClient(event.clientX, event.clientY);
            if (normalized) {
                nextResumePoint = {
                    x: normalized.x,
                    y: normalized.y,
                    tSec: elapsedSec,
                };
                appendAutoPoint(nextResumePoint);
            }
        }
        const field = autoFieldRef.current;
        if (
            field &&
            pointerId != null &&
            field.hasPointerCapture(pointerId)
        ) {
            field.releasePointerCapture(pointerId);
        }

        autoDrawingPointerIdRef.current = null;
        setAutoDrawing(false);
        setAutoResumePoint(nextResumePoint);
    };

    const handleAutoFieldPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!autoDrawing) return;
        event.preventDefault();
        if (
            autoDrawingPointerIdRef.current != null &&
            event.pointerId !== autoDrawingPointerIdRef.current
        ) {
            return;
        }
        const normalized = getAutoPointFromClient(event.clientX, event.clientY);
        if (!normalized) return;
        appendAutoPoint({
            x: normalized.x,
            y: normalized.y,
            tSec: elapsedSec,
        });
    };

    const handleStartDotPointerDown = (
        position: AutoStartingPosition,
        event: ReactPointerEvent<HTMLButtonElement>
    ) => {
        const seed = autoStartDots[position];
        setAutoStartingPosition(position);
        beginAutoDrawing(event, seed, true);
    };

    const handleResumeDotPointerDown = (
        event: ReactPointerEvent<HTMLButtonElement>
    ) => {
        if (!autoResumePoint) return;
        beginAutoDrawing(event, autoResumePoint, false);
    };

    const handleMarkShot = () => {
        const tip = autoDrawingTip ?? autoResumePoint;
        if (!tip) return;
        const marker: AutoShotMarker = {
            x: tip.x,
            y: tip.y,
            tSec: elapsedSec,
        };
        setAutoShotMarkers(prev => {
            const last = prev[prev.length - 1];
            if (last && getDistance(last, marker) < AUTO_POINT_MIN_DISTANCE) {
                return prev;
            }
            return [...prev, marker];
        });
    };

    const clearAutoPath = () => {
        stopAutoDrawing();
        setAutoPathPoints([]);
        setAutoShotMarkers([]);
        setAutoResumePoint(null);
    };

    const commitActionInterval = (action: ActionKind, startSec: number, endSec: number) => {
        const intervalSlices = splitIntervalAcrossSegments(startSec, endSec);
        if (intervalSlices.length === 0) return;

        const groupId = nextGroupIdRef.current++;
        const nextTicks: ActionTick[] = intervalSlices.map(slice => ({
            id: nextTickIdRef.current++,
            groupId,
            action,
            segment: slice.segment,
            startSec: slice.startSec,
            endSec: slice.endSec,
            durationSec: slice.durationSec,
        }));
        setActionTicks(prev => [...prev, ...nextTicks]);
    };

    const beginActionHold = (action: ActionKind) => {
        if (!canTrackActions) return;
        if (activeHoldsRef.current[action]) return;

        const hold: ActiveHold = {
            action,
            startSec: elapsedSec,
            startMs: performance.now(),
        };
        activeHoldsRef.current = {
            ...activeHoldsRef.current,
            [action]: hold,
        };
        setActiveHolds(activeHoldsRef.current);
    };

    const endActionHold = (action: ActionKind) => {
        const hold = activeHoldsRef.current[action];
        if (!hold) return;

        const elapsedByClock = hold.startSec + (performance.now() - hold.startMs) / 1000;
        const endSec = clamp(
            Math.max(elapsedSec, elapsedByClock),
            hold.startSec,
            MATCH_TOTAL_SEC
        );

        commitActionInterval(action, hold.startSec, endSec);

        const next = { ...activeHoldsRef.current };
        delete next[action];
        activeHoldsRef.current = next;
        setActiveHolds(next);
    };

    const undoLastActionTick = (action: ActionKind) => {
        setActionTicks(prev => {
            const removeIndex = [...prev]
                .reverse()
                .findIndex(tick => tick.action === action);
            if (removeIndex < 0) return prev;
            const tick = prev[prev.length - 1 - removeIndex];
            return prev.filter(
                entry =>
                    !(entry.action === action && entry.groupId === tick?.groupId)
            );
        });
    };

    const adjustFoul = (key: keyof MatchData['fouls'], delta: number) => {
        setFouls(prev => ({ ...prev, [key]: Math.max(0, prev[key] + delta) }));
    };

    const adjustBreak = (key: keyof MatchData['breaks'], delta: number) => {
        setBreaks(prev => ({ ...prev, [key]: Math.max(0, prev[key] + delta) }));
    };

    const resetScoutingFields = () => {
        setRobotAbsent(false);
        setAutoStartingPosition(null);
        setAutoPanelManualOverride(null);
        setAutoPathPoints([]);
        setAutoShotMarkers([]);
        setAutoResumePoint(null);
        setAutoDrawing(false);
        if (
            autoFieldRef.current &&
            autoDrawingPointerIdRef.current != null &&
            autoFieldRef.current.hasPointerCapture(autoDrawingPointerIdRef.current)
        ) {
            autoFieldRef.current.releasePointerCapture(autoDrawingPointerIdRef.current);
        }
        autoDrawingPointerIdRef.current = null;
        setTeleTower('None');
        setDriverQuality('ok');
        setBreakdown('None');
        setDefenseProvided('None');
        setDefenseReceived(false);
        setFouls(makeEmptyFouls());
        setBreaks(makeEmptyBreaks());
        setFreeText('');
        setActionTicks([]);
        nextTickIdRef.current = 1;
        nextGroupIdRef.current = 1;
        activeHoldsRef.current = {};
        setActiveHolds({});
        setRemainingSec(MATCH_TOTAL_SEC);
        setScrubbingTimeline(false);
    };

    const handleStartNewMatch = () => {
        resetScoutingFields();
        setIsRunning(true);
    };

    const handleResetMatch = () => {
        resetScoutingFields();
        setIsRunning(false);
    };

    const handlePauseResume = () => {
        if (isRunning) {
            endActionHold('shoot');
            endActionHold('pass');
            setIsRunning(false);
            return;
        }
        if (remainingSec > 0) setIsRunning(true);
    };

    const handleSubmit = () => {
        if (robotPosition == undefined || matchNumber == undefined || teamNumber == undefined) {
            alert('Check sign-in, match number, and team number');
            return;
        }
        if (activeHoldsRef.current.shoot || activeHoldsRef.current.pass) {
            alert('Release shooting/passing hold buttons before submitting.');
            return;
        }

        const data: MatchData = {
            metadata: { scouterName, robotPosition, matchNumber, robotTeam: teamNumber },
            robotAbsent,
            autoStartingPosition,
            autoPath: autoPathTrace,
            autoMoved: false,
            shootTimeBySegment,
            passTimeBySegment,
            ballsPerSecondUsed,
            autoFuelScored: 0,
            autoTower: 'None',
            autoFuelWinner: 'unknown',
            shift1ActiveHubIfTie: null,
            teleFuelBySegment: {
                transition: 0,
                shift1: 0,
                shift2: 0,
                shift3: 0,
                shift4: 0,
                endgame: 0,
            },
            teleTower,
            climbTimeBucket: null,
            breakdown,
            driverQuality,
            defenseProvided,
            defenseReceived,
            fouls,
            breaks,
            comments: [],
            freeText,
        };

        sendQueue('/data/match', data);
        setShowCheck(true);
        setTimeout(() => setShowCheck(false), 1800);
        setMatchNumber(prev => (prev == undefined ? prev : prev + 1));
        handleResetMatch();
    };

    return (
        <div className='min-h-screen bg-gradient-to-b from-[#151a25] via-[#111722] to-[#0b111a] pb-8 text-sm text-white'>
            {showCheck && (
                <MaterialSymbol
                    icon='check'
                    size={78}
                    fill
                    grade={200}
                    color='#48c55c'
                    className='fixed right-5 top-5 z-30 drop-shadow-[0_0_10px_rgba(72,197,92,0.5)]'
                />
            )}

            <main className='mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-10 pt-5 md:px-6'>
                <header className={`${sectionClass} flex flex-wrap items-center justify-between gap-3`}>
                    <div>
                        <h1 className='text-xl font-semibold text-[#48c55c]'>Match Scouting</h1>
                        <p className='mt-1 text-xs text-gray-400'>
                            {scouterName || 'Scouter not set'} {robotPosition ? `(${robotPosition})` : ''}
                        </p>
                    </div>

                    <div className='flex items-center gap-2'>
                        <LinkButton link='/' className='snap-none'>
                            <MaterialSymbol icon='home' size={38} fill grade={200} color='green' />
                        </LinkButton>
                        <Dialog
                            open={signInRequired}
                            trigger={open => (
                                <button onClick={open} aria-label='Scout sign-in'>
                                    <MaterialSymbol
                                        icon='account_circle'
                                        size={38}
                                        fill
                                        grade={200}
                                        className={signInRequired ? 'text-gray-400' : 'text-green-400'}
                                    />
                                </button>
                            )}>
                            {close => (
                                <SignIn
                                    scouterName={scouterName}
                                    onChangeScouterName={setScouterName}
                                    robotPosition={robotPosition}
                                    onChangeRobotPosition={setRobotPosition}
                                    onSubmit={close}
                                />
                            )}
                        </Dialog>
                    </div>
                </header>

                <section className={sectionClass}>
                    <h2 className='text-base font-semibold text-[#48c55c]'>Overview</h2>
                    <div className='mt-3 grid gap-3 md:grid-cols-2'>
                        <div>
                            <p className='text-xs uppercase tracking-wide text-gray-300'>Match Number</p>
                            <NumberInput
                                value={matchNumber}
                                onChange={setMatchNumber}
                                min={1}
                                step={1}
                                placeholder='Match #'
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <p className='text-xs uppercase tracking-wide text-gray-300'>Team Number</p>
                            <div className='mt-1 rounded-lg border border-white/10 bg-[#0f1522] px-2 py-2'>
                                <TeamDropdown value={teamNumber} onChange={setTeamNumber} />
                            </div>
                        </div>
                    </div>

                    <div className='mt-3'>
                        <p className='text-xs uppercase tracking-wide text-gray-300'>Starting Position</p>
                        <div className='mt-1 flex flex-wrap gap-2'>
                            <MultiButton
                                onChange={setAutoStartingPosition}
                                value={autoStartingPosition}
                                labels={autoStartingOptions.map(option => option.label)}
                                values={autoStartingOptions.map(option => option.value)}
                                selectedClassName='bg-[#48c55c] text-black'
                                unSelectedClassName='bg-[#3a4254] text-white'
                            />
                        </div>
                    </div>

                    <div className='mt-3 flex flex-wrap items-center gap-4 text-xs'>
                        <Checkbox
                            checked={robotAbsent}
                            onChange={setRobotAbsent}
                            className='text-gray-200'
                            boxClassName='size-4'>
                            <span className='ml-1.5'>Robot Absent</span>
                        </Checkbox>
                        <p className='text-gray-400'>Team auto-fills from schedule when match/position are set.</p>
                    </div>
                </section>

                <section className={sectionClass}>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-[#48c55c]'>Auto Path</h2>
                            <p className='text-xs text-gray-300'>
                                {autoPanelManualOverride == null
                                    ? 'Panel mode: automatic by phase'
                                    : `Panel mode: manual (${autoPanelOpen ? 'open' : 'closed'})`}
                            </p>
                        </div>
                        <div className='flex items-center gap-2'>
                            {autoPanelManualOverride != null && (
                                <button
                                    type='button'
                                    onClick={() => setAutoPanelManualOverride(null)}
                                    className='rounded bg-[#4d5568] px-2 py-1 text-xs font-semibold text-white'>
                                    Use Auto Mode
                                </button>
                            )}
                            <button
                                type='button'
                                onClick={() => setAutoPanelManualOverride(!autoPanelOpen)}
                                className='rounded bg-[#48c55c] px-3 py-1 text-xs font-semibold text-black'>
                                {autoPanelOpen ? 'Collapse' : 'Expand'}
                            </button>
                        </div>
                    </div>

                    {autoPanelOpen && (
                        <div className='mt-3 space-y-3'>
                            <div className='flex flex-wrap items-center gap-2 text-xs text-gray-300'>
                                <span className='rounded border border-white/15 bg-[#111827] px-2 py-1'>
                                    Alliance: {allianceColor.toUpperCase()}
                                </span>
                                <span className='rounded border border-white/15 bg-[#111827] px-2 py-1'>
                                    Field: {fieldOrientation === 'orientation1' ? 'Orientation 1' : 'Orientation 2'}
                                </span>
                                <span className='rounded border border-white/15 bg-[#111827] px-2 py-1'>
                                    Draw: {canDrawAutoPath ? 'Enabled (AUTO phase)' : 'Disabled'}
                                </span>
                                <span className='rounded border border-white/15 bg-[#111827] px-2 py-1'>
                                    Paths: {autoPathPoints.length}
                                </span>
                                <span className='rounded border border-white/15 bg-[#111827] px-2 py-1'>
                                    Shots: {autoShotMarkers.length}
                                </span>
                            </div>

                            <div
                                ref={autoFieldRef}
                                onPointerMove={handleAutoFieldPointerMove}
                                onPointerUp={event => stopAutoDrawing(event)}
                                onPointerCancel={event => stopAutoDrawing(event)}
                                className='relative mx-auto w-full max-w-xl touch-none overflow-hidden rounded-xl border border-white/15 bg-[#0f1522]'>
                                <div
                                    className='relative'
                                    style={{
                                        transform: fieldIsFlipped ? 'scaleX(-1)' : 'scaleX(1)',
                                        transformOrigin: 'center',
                                    }}>
                                    <img
                                        ref={autoFieldImageRef}
                                        src={autoFieldImage}
                                        alt={`${allianceColor} auto field`}
                                        className='block w-full select-none'
                                        draggable={false}
                                        onLoad={syncAutoFieldSize}
                                    />
                                    <svg
                                        viewBox={`0 0 ${autoFieldSize.width} ${autoFieldSize.height}`}
                                        preserveAspectRatio='none'
                                        className='pointer-events-none absolute inset-0'>
                                        {autoPathSvg && (
                                            <path
                                                d={autoPathSvg}
                                                fill='none'
                                                stroke='rgba(72,197,92,0.95)'
                                                strokeWidth='10'
                                                strokeLinecap='round'
                                                strokeLinejoin='round'
                                            />
                                        )}

                                        {autoShotMarkers.map((marker, index) => (
                                            <circle
                                                key={`shot-${index}`}
                                                cx={marker.x * autoFieldSize.width}
                                                cy={marker.y * autoFieldSize.height}
                                                r='12'
                                                fill='rgba(245, 158, 11, 0.95)'
                                                stroke='rgba(0, 0, 0, 0.6)'
                                                strokeWidth='4'
                                            />
                                        ))}
                                    </svg>

                                    {autoPathPoints.length === 0 &&
                                        (Object.keys(autoStartDots) as AutoStartingPosition[]).map(
                                            position => {
                                                const dot = autoStartDots[position];
                                                const selected = autoStartingPosition === position;
                                                return (
                                                    <button
                                                        key={`start-dot-${position}`}
                                                        type='button'
                                                        onPointerDown={event =>
                                                            handleStartDotPointerDown(position, event)
                                                        }
                                                        className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
                                                            selected
                                                                ? 'h-6 w-6 border-white bg-[#48c55c]'
                                                                : 'h-5 w-5 border-white/80 bg-[#4aa3ff]'
                                                        } ${canDrawAutoPath ? '' : 'cursor-not-allowed opacity-70'}`}
                                                        style={{
                                                            left: `${dot.x * 100}%`,
                                                            top: `${dot.y * 100}%`,
                                                        }}
                                                        disabled={!canDrawAutoPath}
                                                        aria-label={`Auto start ${position}`}
                                                    />
                                                );
                                            }
                                        )}

                                    {autoResumePoint && !autoDrawing && (
                                        <button
                                            type='button'
                                            onPointerDown={handleResumeDotPointerDown}
                                            className={`absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#f59e0b] ${
                                                canDrawAutoPath ? '' : 'cursor-not-allowed opacity-70'
                                            }`}
                                            style={{
                                                left: `${autoResumePoint.x * 100}%`,
                                                top: `${autoResumePoint.y * 100}%`,
                                            }}
                                            disabled={!canDrawAutoPath}
                                            aria-label='Resume auto path'
                                        />
                                    )}
                                </div>
                            </div>

                            <div className='grid gap-2 sm:grid-cols-2'>
                                <button
                                    type='button'
                                    onClick={handleMarkShot}
                                    className='rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-black'
                                    disabled={!autoDrawingTip && !autoResumePoint}>
                                    Mark Shot Position
                                </button>
                                <button
                                    type='button'
                                    onClick={clearAutoPath}
                                    className='rounded-lg bg-[#4b5568] px-3 py-2 text-xs font-semibold text-white'
                                    disabled={autoPathPoints.length === 0 && autoShotMarkers.length === 0}>
                                    Clear Auto Path
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                <section className={sectionClass}>
                    <div className='flex items-end justify-between gap-3'>
                        <div>
                            <p className='text-xs uppercase tracking-wide text-gray-300'>Match Timer</p>
                            <p className='font-mono text-4xl font-semibold text-[#48c55c]'>
                                {displayTimer}
                            </p>
                            <p className='text-xs text-gray-300'>
                                Phase: <span className='font-semibold text-white'>{currentSegmentLabel}</span>
                            </p>
                        </div>
                        <div className='text-right text-xs text-gray-300'>
                            <p>
                                Shooting:{' '}
                                <span className='font-semibold text-white'>
                                    {totalShootTimeDisplay.toFixed(1)}s
                                </span>
                            </p>
                            <p>
                                Passing:{' '}
                                <span className='font-semibold text-white'>
                                    {totalPassTimeDisplay.toFixed(1)}s
                                </span>
                            </p>
                        </div>
                    </div>

                    <div className='mt-3 grid gap-2 sm:grid-cols-3'>
                        <button
                            type='button'
                            onClick={handleStartNewMatch}
                            className='rounded-lg bg-[#48c55c] px-3 py-2 text-sm font-semibold text-black'>
                            Start Match
                        </button>
                        <button
                            type='button'
                            onClick={handlePauseResume}
                            disabled={remainingSec <= 0}
                            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                                remainingSec <= 0
                                    ? 'cursor-not-allowed bg-[#324056] text-gray-400'
                                    : 'bg-sky-500 text-black'
                            }`}>
                            {isRunning ? 'Pause Timer' : 'Resume Timer'}
                        </button>
                        <button
                            type='button'
                            onClick={handleResetMatch}
                            className='rounded-lg bg-[#d15858] px-3 py-2 text-sm font-semibold text-white'>
                            Reset Match
                        </button>
                    </div>

                    <div className='mt-4 grid gap-3 md:grid-cols-2'>
                        {(
                            [
                                { action: 'shoot', label: 'HOLD TO TRACK SHOOTING', color: 'bg-emerald-400', ticks: shootTickCount },
                                { action: 'pass', label: 'HOLD TO TRACK PASSING', color: 'bg-sky-400', ticks: passTickCount },
                            ] as Array<{ action: ActionKind; label: string; color: string; ticks: number }>
                        ).map(item => (
                            <div key={item.action} className='rounded-xl border border-white/10 bg-[#121a28] p-3'>
                                <HoldButton
                                    onHold={() => {}}
                                    triggerOnPress={false}
                                    onHoldStart={() => beginActionHold(item.action)}
                                    onHoldEnd={() => endActionHold(item.action)}
                                    disabled={!canTrackActions}
                                    ariaLabel={item.label}
                                    className={`w-full rounded-lg px-4 py-3 text-sm font-bold text-black ${
                                        canTrackActions ? item.color : 'cursor-not-allowed bg-[#404958] text-gray-300'
                                    }`}>
                                    {item.label}
                                </HoldButton>
                                <HoldButton
                                    onHold={() => undoLastActionTick(item.action)}
                                    repeatDelay={HOLD_INTERVAL_MS}
                                    repeatInterval={HOLD_INTERVAL_MS}
                                    disabled={item.ticks === 0}
                                    ariaLabel={`Undo ${item.action}`}
                                    className={`mt-2 w-full rounded-lg px-3 py-2 text-xs font-semibold ${
                                        item.ticks === 0
                                            ? 'cursor-not-allowed bg-[#434955] text-gray-400'
                                            : 'bg-[#586177] text-white'
                                    }`}>
                                    {`Undo Last ${item.action === 'shoot' ? 'Shooting' : 'Passing'} Hold`}
                                </HoldButton>
                            </div>
                        ))}
                    </div>
                </section>

                <section className={sectionClass}>
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                        <h2 className='text-base font-semibold text-[#48c55c]'>Timeline</h2>
                        <p className='text-xs text-gray-300'>
                            Elapsed {elapsedSec.toFixed(1)}s / {MATCH_TOTAL_SEC}s
                        </p>
                    </div>

                    <div
                        ref={timelineRef}
                        onPointerDown={handleTimelinePointerDown}
                        onPointerMove={handleTimelinePointerMove}
                        onPointerUp={stopTimelineScrub}
                        onPointerCancel={stopTimelineScrub}
                        className={`relative mt-2 h-24 cursor-ew-resize overflow-hidden rounded-xl border border-white/15 bg-[#0f1522] ${
                            scrubbingTimeline ? 'ring-2 ring-[#48c55c]/60' : ''
                        }`}>
                        <div className='absolute inset-0 bg-gradient-to-r from-[#141b2a] via-[#101826] to-[#0c1320]' />

                        {matchTimelineSegments.map((segment, index) => {
                            const left = (segment.startSec / MATCH_TOTAL_SEC) * 100;
                            const width = ((segment.endSec - segment.startSec) / MATCH_TOTAL_SEC) * 100;
                            return (
                                <div
                                    key={`segment-bg-${segment.id}`}
                                    className='absolute inset-y-0 border-r border-white/10'
                                    style={{
                                        left: `${left}%`,
                                        width: `${width}%`,
                                        background: index % 2 === 0 ? 'rgba(148,163,184,0.11)' : 'rgba(71,85,105,0.18)',
                                    }}
                                />
                            );
                        })}

                        {timelineIntervals.map((interval, index) => {
                            const start = clamp(interval.startSec, 0, MATCH_TOTAL_SEC);
                            const end = clamp(interval.endSec, 0, MATCH_TOTAL_SEC);
                            const width = ((end - start) / MATCH_TOTAL_SEC) * 100;
                            if (width <= 0) return null;
                            const left = (start / MATCH_TOTAL_SEC) * 100;
                            return (
                                <div
                                    key={`interval-${interval.action}-${index}`}
                                    className={`absolute inset-y-0 ${
                                        interval.action === 'shoot' ? 'bg-emerald-400/50' : 'bg-sky-400/50'
                                    }`}
                                    style={{ left: `${left}%`, width: `${width}%` }}
                                />
                            );
                        })}

                        <div className='absolute inset-y-0 left-0 bg-white/5' style={{ width: `${elapsedPercent}%` }} />

                        {matchTimelineSegments.map(segment => {
                            const left = (segment.startSec / MATCH_TOTAL_SEC) * 100;
                            const width = ((segment.endSec - segment.startSec) / MATCH_TOTAL_SEC) * 100;
                            return (
                                <div
                                    key={`segment-label-${segment.id}`}
                                    className='pointer-events-none absolute inset-y-0 z-10 flex items-start'
                                    style={{ left: `${left}%`, width: `${width}%` }}>
                                    <span className='mt-1 block w-full truncate px-1 text-[10px] font-semibold uppercase tracking-wide text-white/55'>
                                        {segment.label}
                                    </span>
                                </div>
                            );
                        })}

                        <div
                            className='absolute inset-y-0 z-20 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.65)]'
                            style={{ left: `${elapsedPercent}%` }}
                        />
                    </div>

                    <div className='mt-2 flex flex-wrap items-center gap-4 text-[11px] text-gray-300'>
                        <p>Drag timeline to jump to any time.</p>
                        <p className='flex items-center gap-1.5'>
                            <span className='inline-block size-2 rounded-sm bg-emerald-400/90' />
                            Shooting
                        </p>
                        <p className='flex items-center gap-1.5'>
                            <span className='inline-block size-2 rounded-sm bg-sky-400/90' />
                            Passing
                        </p>
                    </div>
                </section>
                <section className={sectionClass}>
                    <h2 className='text-base font-semibold text-[#48c55c]'>Endgame</h2>
                    <p className='mt-1 text-xs text-gray-300'>Climbing Result</p>
                    <div className='mt-2 flex flex-wrap gap-2'>
                        <MultiButton
                            onChange={setTeleTower}
                            value={teleTower}
                            labels={['None', 'Failed', 'L1', 'L2', 'L3']}
                            values={teleTowerOptions}
                            selectedClassName='bg-[#48c55c] text-black'
                            unSelectedClassName='bg-[#3a4254] text-white'
                        />
                    </div>
                </section>
                <details className={sectionClass}>
                    <summary className='cursor-pointer select-none text-base font-semibold text-[#48c55c]'>
                        Expanded Match Content
                    </summary>

                    <div className='mt-4 grid gap-4 md:grid-cols-2'>
                        <div>
                            <p className='text-xs uppercase tracking-wide text-gray-300'>Driver Quality</p>
                            <div className='mt-1 flex flex-wrap gap-2'>
                                <MultiButton
                                    onChange={setDriverQuality}
                                    value={driverQuality}
                                    labels={driverQualityOptions.map(option => option.toUpperCase())}
                                    values={driverQualityOptions}
                                    selectedClassName='bg-[#48c55c] text-black'
                                    unSelectedClassName='bg-[#3a4254] text-white'
                                />
                            </div>
                        </div>
                        <div>
                            <p className='text-xs uppercase tracking-wide text-gray-300'>Breakdown</p>
                            <div className='mt-1 flex flex-wrap gap-2'>
                                <MultiButton
                                    onChange={setBreakdown}
                                    value={breakdown}
                                    labels={['None', 'Stuck', 'Tipped', 'Comms', 'Mech', 'Other']}
                                    values={breakdownOptions}
                                    selectedClassName='bg-[#48c55c] text-black'
                                    unSelectedClassName='bg-[#3a4254] text-white'
                                />
                            </div>
                        </div>
                        <div>
                            <p className='text-xs uppercase tracking-wide text-gray-300'>Defense Provided</p>
                            <div className='mt-1 flex flex-wrap gap-2'>
                                <MultiButton
                                    onChange={setDefenseProvided}
                                    value={defenseProvided}
                                    labels={['None', 'Some', 'Heavy']}
                                    values={['None', 'some', 'heavy']}
                                    selectedClassName='bg-[#48c55c] text-black'
                                    unSelectedClassName='bg-[#3a4254] text-white'
                                />
                            </div>
                            <Checkbox
                                checked={defenseReceived}
                                onChange={setDefenseReceived}
                                className='mt-2 text-xs text-white'
                                boxClassName='size-4'>
                                <span className='ml-1.5'>Was Defended</span>
                            </Checkbox>
                        </div>
                        <div>
                            <p className='text-xs uppercase tracking-wide text-gray-300'>Notes</p>
                            <TextInput
                                value={freeText}
                                onChange={setFreeText}
                                placeholder='Short notes...'
                                className={inputClass}
                            />
                        </div>
                    </div>

                    <div className='mt-4 grid gap-4 md:grid-cols-2'>
                        <div>
                            <p className='text-xs font-semibold uppercase tracking-wide text-gray-300'>
                                Fouls
                            </p>
                            <div className='mt-2 grid gap-2'>
                                {foulLabels.map(entry => (
                                    <div
                                        key={entry.key}
                                        className='flex items-center gap-2 rounded-lg border border-white/10 bg-[#121a28] px-2 py-2'>
                                        <HoldButton
                                            onHold={() => adjustFoul(entry.key, -1)}
                                            repeatDelay={120}
                                            repeatInterval={90}
                                            className='rounded bg-[#c44e4e] px-2 py-1 text-xs font-semibold text-white'>
                                            -
                                        </HoldButton>
                                        <span className='flex-1 text-xs text-gray-200'>{entry.label}</span>
                                        <span className='w-8 text-right text-sm font-semibold tabular-nums text-white'>
                                            {fouls[entry.key]}
                                        </span>
                                        <HoldButton
                                            onHold={() => adjustFoul(entry.key, 1)}
                                            repeatDelay={120}
                                            repeatInterval={90}
                                            className='rounded bg-[#48c55c] px-2 py-1 text-xs font-semibold text-black'>
                                            +
                                        </HoldButton>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className='text-xs font-semibold uppercase tracking-wide text-gray-300'>
                                Breaks
                            </p>
                            <div className='mt-2 grid gap-2'>
                                {breakLabels.map(entry => (
                                    <div
                                        key={entry.key}
                                        className='flex items-center gap-2 rounded-lg border border-white/10 bg-[#121a28] px-2 py-2'>
                                        <HoldButton
                                            onHold={() => adjustBreak(entry.key, -1)}
                                            repeatDelay={120}
                                            repeatInterval={90}
                                            className='rounded bg-[#c44e4e] px-2 py-1 text-xs font-semibold text-white'>
                                            -
                                        </HoldButton>
                                        <span className='flex-1 text-xs text-gray-200'>{entry.label}</span>
                                        <span className='w-8 text-right text-sm font-semibold tabular-nums text-white'>
                                            {breaks[entry.key]}
                                        </span>
                                        <HoldButton
                                            onHold={() => adjustBreak(entry.key, 1)}
                                            repeatDelay={120}
                                            repeatInterval={90}
                                            className='rounded bg-[#48c55c] px-2 py-1 text-xs font-semibold text-black'>
                                            +
                                        </HoldButton>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </details>
                <section className={`${sectionClass} flex flex-col gap-2`}>
                    <button
                        type='button'
                        onClick={handleSubmit}
                        className='rounded-lg bg-[#48c55c] px-4 py-3 text-sm font-semibold text-black'>
                        Submit Match
                    </button>
                    <p className='text-xs text-gray-300'>
                        Queue: <span className='font-semibold text-white'>{queue.length}</span>
                    </p>
                    <button
                        type='button'
                        onClick={sendAll}
                        className='rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-black'>
                        {sending ? 'Sending...' : 'Resend All'}
                    </button>
                </section>
            </main>
        </div>
    );
}

export default MatchApp;
