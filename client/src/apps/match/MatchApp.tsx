import { useEffect, useRef, useState } from 'react';
import { MaterialSymbol } from 'react-material-symbols';
import 'react-material-symbols/rounded';
import {
    AllianceColor,
    AutoFuelWinner,
    AutoStartingPosition,
    AutoTowerResult,
    BreakdownType,
    DriverQuality,
    MatchData,
    MatchSchedule,
    RobotPosition,
    TeleSegmentId,
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
import CannedComments, { SelectOption } from '../../components/CannedComments';
import { useStatus } from '../../lib/useStatus';
import { useQueue } from '../../lib/useQueue';
import { usePreventUnload } from '../../lib/usePreventUnload';
import scheduleFile from '../../assets/matchSchedule.json';
import { formatMatchTime, gameConfig, getSegmentForRemaining } from '../../lib/gameConfig';

const DEFAULT_BALLS_PER_SECOND = 5;
const HOLD_INTERVAL_MS = 100;
const HOLD_INTERVAL_SEC = HOLD_INTERVAL_MS / 1000;

type ActionKind = 'shoot' | 'pass';
type FullSegmentId = keyof MatchData['shootTimeBySegment'];

type ActionInterval = {
    action: ActionKind;
    startSec: number;
    endSec: number;
};

const schedule = scheduleFile as MatchSchedule;

const autoStartingOptions: Array<{
    label: string;
    value: AutoStartingPosition | null;
}> = [
    { label: 'Left', value: 'left' },
    { label: 'Center', value: 'center' },
    { label: 'Right', value: 'right' },
    { label: 'N/A', value: null },
];

const autoTowerOptions: AutoTowerResult[] = ['None', 'Failed', 'level1'];
const teleTowerOptions: TeleTowerResult[] = [
    'None',
    'Failed',
    'level1',
    'level2',
    'level3',
];
const autoFuelWinnerOptions: AutoFuelWinner[] = ['red', 'blue', 'tie', 'unknown'];
const allianceOptions: AllianceColor[] = ['red', 'blue'];
const breakdownOptions: BreakdownType[] = [
    'None',
    'stuck',
    'tipped',
    'comms',
    'mechanism',
    'other',
];
const driverQualityOptions: DriverQuality[] = ['great', 'good', 'ok', 'rough'];

const climbTimeOptions: Array<{ label: string; value: MatchData['climbTimeBucket'] }> = [
    { label: 'Early', value: 'early' },
    { label: 'Mid', value: 'mid' },
    { label: 'Late', value: 'late' },
    { label: 'N/A', value: null },
];

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
    return {
        pinning: 0,
        towerContactInEndgame: 0,
        outOfZoneShooting: 0,
        ejectedFuel: 0,
        other: 0,
    };
}

function makeEmptyBreaks(): MatchData['breaks'] {
    return {
        mechanism: 0,
        battery: 0,
        comms: 0,
        bumper: 0,
    };
}

function roundToHundredth(value: number) {
    return Math.round(value * 100) / 100;
}

function sumSegmentTimes(values: MatchData['shootTimeBySegment']) {
    return roundToHundredth(
        values.auto +
            values.transition +
            values.shift1 +
            values.shift2 +
            values.shift3 +
            values.shift4 +
            values.endgame
    );
}

function formatSeconds(value: number) {
    return `${roundToHundredth(value).toFixed(1)}s`;
}

function formatBalls(value: number) {
    const rounded = roundToHundredth(value);
    return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2);
}

function clamp(value: number, minValue: number, maxValue: number) {
    return Math.max(minValue, Math.min(value, maxValue));
}

function computeEstimatedFuel(
    shootTimeBySegment: MatchData['shootTimeBySegment'],
    ballsPerSecond: number
) {
    return {
        autoFuelScored: roundToHundredth(shootTimeBySegment.auto * ballsPerSecond),
        teleFuelBySegment: {
            transition: roundToHundredth(
                shootTimeBySegment.transition * ballsPerSecond
            ),
            shift1: roundToHundredth(shootTimeBySegment.shift1 * ballsPerSecond),
            shift2: roundToHundredth(shootTimeBySegment.shift2 * ballsPerSecond),
            shift3: roundToHundredth(shootTimeBySegment.shift3 * ballsPerSecond),
            shift4: roundToHundredth(shootTimeBySegment.shift4 * ballsPerSecond),
            endgame: roundToHundredth(shootTimeBySegment.endgame * ballsPerSecond),
        } satisfies MatchData['teleFuelBySegment'],
    };
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
    const [autoStartingPosition, setAutoStartingPosition] =
        useState<AutoStartingPosition | null>(null);
    const [autoMoved, setAutoMoved] = useState(false);
    const [autoTower, setAutoTower] = useState<AutoTowerResult>('None');
    const [autoFuelWinner, setAutoFuelWinner] = useState<AutoFuelWinner>('unknown');
    const [shift1ActiveHubIfTie, setShift1ActiveHubIfTie] =
        useState<MatchData['shift1ActiveHubIfTie']>(null);

    const [shootTimeBySegment, setShootTimeBySegment] = useState(
        makeEmptyActionTimeBySegment()
    );
    const [passTimeBySegment, setPassTimeBySegment] = useState(
        makeEmptyActionTimeBySegment()
    );
    const [ballsPerSecondUsed, setBallsPerSecondUsed] = useState(
        DEFAULT_BALLS_PER_SECOND
    );

    const [teleTower, setTeleTower] = useState<TeleTowerResult>('None');
    const [climbTimeBucket, setClimbTimeBucket] =
        useState<MatchData['climbTimeBucket']>(null);
    const [breakdown, setBreakdown] = useState<BreakdownType>('None');
    const [driverQuality, setDriverQuality] = useState<DriverQuality>('ok');

    const [defenseProvided, setDefenseProvided] =
        useState<MatchData['defenseProvided']>('None');
    const [defenseReceived, setDefenseReceived] = useState(false);
    const [fouls, setFouls] = useState<MatchData['fouls']>(makeEmptyFouls());
    const [breaks, setBreaks] = useState<MatchData['breaks']>(makeEmptyBreaks());
    const [comments, setComments] = useState<SelectOption<MatchData['comments'][number]>[]>(
        []
    );
    const [freeText, setFreeText] = useState('');

    const [remainingSec, setRemainingSec] = useState(gameConfig.matchDurationSec);
    const [isRunning, setIsRunning] = useState(false);
    const [manualSegment, setManualSegment] = useState<'auto' | TeleSegmentId>('auto');
    const [showAutoWinnerPrompt, setShowAutoWinnerPrompt] = useState(false);
    const [showShift1Prompt, setShowShift1Prompt] = useState(false);

    const [actionIntervals, setActionIntervals] = useState<ActionInterval[]>([]);
    const activeHoldRef = useRef<{ action: ActionKind; startSec: number } | null>(null);
    const [activeHoldAction, setActiveHoldAction] = useState<ActionKind | null>(null);

    const timelineRef = useRef<HTMLDivElement>(null);
    const [scrubbingTimeline, setScrubbingTimeline] = useState(false);

    const currentSegment = getSegmentForRemaining(remainingSec);
    const activeSegment = isRunning ? currentSegment : manualSegment;
    const previousSegment = useRef(currentSegment);
    const elapsedSec = gameConfig.matchDurationSec - remainingSec;
    const elapsedPercent = clamp(
        (elapsedSec / gameConfig.matchDurationSec) * 100,
        0,
        100
    );
    const sectionClass =
        'rounded-xl border border-white/10 bg-[#2f3646] p-4 shadow-lg shadow-black/20';

    const totalShootSec = sumSegmentTimes(shootTimeBySegment);
    const totalPassSec = sumSegmentTimes(passTimeBySegment);
    const estimatedBallsScored = roundToHundredth(totalShootSec * ballsPerSecondUsed);

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
                if (!response.ok) throw new Error('Failed to load balls/second');
                const payload = (await response.json()) as { ballsPerSecond?: number };
                if (!cancelled) {
                    const nextValue = Number(payload.ballsPerSecond);
                    setBallsPerSecondUsed(
                        Number.isFinite(nextValue) && nextValue >= 0
                            ? nextValue
                            : DEFAULT_BALLS_PER_SECOND
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
        if (!isRunning) return;
        const interval = setInterval(() => {
            setRemainingSec(prev => {
                if (prev <= 1) {
                    setIsRunning(false);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [isRunning]);

    useEffect(() => {
        if (!isRunning) return;
        if (previousSegment.current !== currentSegment) {
            if (
                previousSegment.current === 'auto' &&
                currentSegment !== 'auto' &&
                autoFuelWinner === 'unknown'
            ) {
                setShowAutoWinnerPrompt(true);
            }
            if (
                currentSegment === 'shift1' &&
                autoFuelWinner === 'tie' &&
                shift1ActiveHubIfTie === null
            ) {
                setShowShift1Prompt(true);
            }
            previousSegment.current = currentSegment;
        }
    }, [autoFuelWinner, currentSegment, isRunning, shift1ActiveHubIfTie]);

    useEffect(() => {
        if (!isRunning) {
            previousSegment.current = currentSegment;
        }
    }, [currentSegment, isRunning]);

    const endHoldAction = () => {
        const activeHold = activeHoldRef.current;
        if (!activeHold) return;
        const safeEnd = clamp(elapsedSec, 0, gameConfig.matchDurationSec);
        if (safeEnd > activeHold.startSec) {
            setActionIntervals(prev => [
                ...prev,
                {
                    action: activeHold.action,
                    startSec: activeHold.startSec,
                    endSec: safeEnd,
                },
            ]);
        }
        activeHoldRef.current = null;
        setActiveHoldAction(null);
    };

    const beginHoldAction = (action: ActionKind) => {
        if (activeHoldRef.current?.action === action) return;
        endHoldAction();
        activeHoldRef.current = {
            action,
            startSec: clamp(elapsedSec, 0, gameConfig.matchDurationSec),
        };
        setActiveHoldAction(action);
    };

    const addActionTime = (action: ActionKind, durationSec: number) => {
        const segment: FullSegmentId = activeSegment;
        const update = (current: MatchData['shootTimeBySegment']) => ({
            ...current,
            [segment]: roundToHundredth(Math.max(0, current[segment] + durationSec)),
        });
        if (action === 'shoot') {
            setShootTimeBySegment(update);
        } else {
            setPassTimeBySegment(update);
        }
    };

    const setMatchTimeFromElapsed = (elapsed: number) => {
        const clampedElapsed = clamp(elapsed, 0, gameConfig.matchDurationSec);
        const nextRemaining = gameConfig.matchDurationSec - clampedElapsed;
        const nextSegment = getSegmentForRemaining(nextRemaining);
        setRemainingSec(nextRemaining);
        if (!isRunning) {
            setManualSegment(nextSegment === 'auto' ? 'auto' : (nextSegment as TeleSegmentId));
            previousSegment.current = nextSegment;
        }
    };

    const updateElapsedFromPointer = (clientX: number) => {
        const timeline = timelineRef.current;
        if (!timeline) return;
        const rect = timeline.getBoundingClientRect();
        if (rect.width <= 0) return;
        const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
        setMatchTimeFromElapsed(Math.round(ratio * gameConfig.matchDurationSec));
    };

    const handleAutoEnd = () => {
        setShowAutoWinnerPrompt(true);
        if (!isRunning) {
            setManualSegment('transition');
        }
    };

    const adjustFoul = (key: keyof MatchData['fouls'], delta: number) => {
        setFouls(prev => ({
            ...prev,
            [key]: Math.max(0, prev[key] + delta),
        }));
    };

    const adjustBreak = (key: keyof MatchData['breaks'], delta: number) => {
        setBreaks(prev => ({
            ...prev,
            [key]: Math.max(0, prev[key] + delta),
        }));
    };

    const resetMatchState = () => {
        setRobotAbsent(false);
        setAutoStartingPosition(null);
        setAutoMoved(false);
        setAutoTower('None');
        setAutoFuelWinner('unknown');
        setShift1ActiveHubIfTie(null);
        setShootTimeBySegment(makeEmptyActionTimeBySegment());
        setPassTimeBySegment(makeEmptyActionTimeBySegment());
        setTeleTower('None');
        setClimbTimeBucket(null);
        setBreakdown('None');
        setDriverQuality('ok');
        setDefenseProvided('None');
        setDefenseReceived(false);
        setFouls(makeEmptyFouls());
        setBreaks(makeEmptyBreaks());
        setComments([]);
        setFreeText('');
        setActionIntervals([]);
        activeHoldRef.current = null;
        setActiveHoldAction(null);
        setShowAutoWinnerPrompt(false);
        setShowShift1Prompt(false);
    };

    const handleSubmit = async (absentOverride = false) => {
        endHoldAction();
        if (
            robotPosition == undefined ||
            matchNumber == undefined ||
            (teamNumber == undefined && !absentOverride)
        ) {
            alert('Check sign-in, match number, and team number');
            return;
        }

        const estimatedFromShootTime = computeEstimatedFuel(
            shootTimeBySegment,
            ballsPerSecondUsed
        );

        const data: MatchData = {
            metadata: {
                scouterName,
                robotPosition,
                matchNumber,
                robotTeam: teamNumber,
            },
            robotAbsent: absentOverride || robotAbsent,
            autoStartingPosition,
            autoMoved,
            shootTimeBySegment,
            passTimeBySegment,
            ballsPerSecondUsed,
            autoFuelScored: estimatedFromShootTime.autoFuelScored,
            autoTower,
            autoFuelWinner,
            shift1ActiveHubIfTie,
            teleFuelBySegment: estimatedFromShootTime.teleFuelBySegment,
            teleTower,
            climbTimeBucket,
            breakdown,
            driverQuality,
            defenseProvided,
            defenseReceived,
            fouls,
            breaks,
            comments: comments.map(comment => comment.value),
            freeText,
        };

        sendQueue('/data/match', data);
        setMatchNumber(matchNumber + 1);
        resetMatchState();
        setShowCheck(true);
        setTimeout(() => setShowCheck(false), 2500);
    };

    const handleAbsentRobot = async () => {
        if (robotPosition == undefined || matchNumber == undefined) {
            alert('Check sign-in and match number');
            return;
        }
        if (!window.confirm('Mark robot as absent?')) return;
        setRobotAbsent(true);
        await handleSubmit(true);
        scrollTo(0, 0);
    };

    const renderIntervals = () => {
        const activeHold = activeHoldRef.current;
        const liveIntervals = [...actionIntervals];
        if (activeHold) {
            liveIntervals.push({
                action: activeHold.action,
                startSec: activeHold.startSec,
                endSec: clamp(elapsedSec, 0, gameConfig.matchDurationSec),
            });
        }

        return liveIntervals
            .map((interval, index) => {
                const start = clamp(interval.startSec, 0, gameConfig.matchDurationSec);
                const end = clamp(interval.endSec, 0, gameConfig.matchDurationSec);
                const width = ((end - start) / gameConfig.matchDurationSec) * 100;
                if (width <= 0) return null;
                const left = (start / gameConfig.matchDurationSec) * 100;
                return (
                    <div
                        key={`interval-${index}-${interval.action}`}
                        className={`absolute inset-y-0 ${
                            interval.action === 'shoot'
                                ? 'bg-emerald-400/45'
                                : 'bg-sky-400/45'
                        }`}
                        style={{
                            left: `${left}%`,
                            width: `${width}%`,
                        }}
                    />
                );
            })
            .filter(Boolean);
    };

    return (
        <div className='min-h-screen bg-gradient-to-b from-[#171c26] via-[#161b22] to-[#12151d] pb-10 text-white'>
            <main className='mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-16 pt-8'>
                {showCheck && (
                    <MaterialSymbol
                        icon='check'
                        size={96}
                        fill
                        grade={200}
                        color='#48c55c'
                        className='fixed right-6 top-6 z-30 drop-shadow-[0_0_12px_rgba(72,197,92,0.5)]'
                    />
                )}

                <div className='flex flex-wrap items-center justify-between gap-4'>
                    <div className='flex items-center gap-3'>
                        <LinkButton link='/' className='snap-none'>
                            <MaterialSymbol
                                icon='home'
                                size={46}
                                fill
                                grade={200}
                                color='green'
                                className='snap-none'
                            />
                        </LinkButton>
                        <Dialog
                            open
                            trigger={open => (
                                <button onClick={open}>
                                    <MaterialSymbol
                                        icon='account_circle'
                                        size={46}
                                        fill
                                        grade={200}
                                        className={
                                            scouterName && robotPosition
                                                ? 'text-green-400'
                                                : 'text-gray-400'
                                        }
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
                    <div className='text-right'>
                        <h1 className='text-2xl font-semibold text-[#48c55c]'>
                            Match Scouting App
                        </h1>
                        <p className='text-sm text-gray-300'>
                            {scouterName || 'Scouter'}{' '}
                            {robotPosition ? `(${robotPosition})` : ''}
                        </p>
                    </div>
                </div>

                <section className={sectionClass}>
                    <div className='flex flex-wrap items-center justify-between gap-4'>
                        <div>
                            <p className='text-sm uppercase text-gray-300'>Match Timer</p>
                            <p className='text-4xl font-bold text-[#48c55c]'>
                                {formatMatchTime(remainingSec)}
                            </p>
                            <p className='text-sm text-gray-300'>
                                Segment:{' '}
                                <span className='font-semibold text-white'>
                                    {gameConfig.segments.find(
                                        segment => segment.id === activeSegment
                                    )?.label || 'AUTO'}
                                </span>
                            </p>
                            <p className='mt-2 text-sm text-gray-300'>
                                Balls/sec from admin:{' '}
                                <span className='font-semibold text-white'>
                                    {formatBalls(ballsPerSecondUsed)}
                                </span>
                            </p>
                        </div>
                        <div className='flex flex-wrap gap-2'>
                            <button
                                onClick={() => {
                                    endHoldAction();
                                    setRemainingSec(gameConfig.matchDurationSec);
                                    setIsRunning(true);
                                    setManualSegment('auto');
                                    previousSegment.current = 'auto';
                                }}
                                className='select-none rounded-lg bg-[#48c55c] px-4 py-2 font-semibold text-black shadow-lg shadow-black/20 transition hover:brightness-105 active:scale-[0.98]'>
                                Start Match
                            </button>
                            <button
                                onClick={() => {
                                    endHoldAction();
                                    setIsRunning(false);
                                }}
                                className='select-none rounded-lg bg-gray-600 px-4 py-2 font-semibold text-white transition hover:bg-gray-500 active:scale-[0.98]'>
                                Pause
                            </button>
                            <button
                                onClick={() => {
                                    endHoldAction();
                                    setIsRunning(false);
                                    setRemainingSec(gameConfig.matchDurationSec);
                                    setManualSegment('auto');
                                }}
                                className='select-none rounded-lg border border-white/20 px-4 py-2 font-semibold text-white transition hover:border-white/40 hover:bg-white/5 active:scale-[0.98]'>
                                Reset Timer
                            </button>
                        </div>
                    </div>

                    <div className='mt-4 space-y-3'>
                        <div
                            ref={timelineRef}
                            className='relative h-14 overflow-hidden rounded-xl border border-white/10 bg-[#1b2030] shadow-inner'
                            onPointerDown={event => {
                                setScrubbingTimeline(true);
                                updateElapsedFromPointer(event.clientX);
                                event.currentTarget.setPointerCapture(event.pointerId);
                            }}
                            onPointerMove={event => {
                                if (!scrubbingTimeline) return;
                                updateElapsedFromPointer(event.clientX);
                            }}
                            onPointerUp={event => {
                                setScrubbingTimeline(false);
                                event.currentTarget.releasePointerCapture(event.pointerId);
                            }}
                            onPointerCancel={() => setScrubbingTimeline(false)}>
                            {renderIntervals()}
                            {gameConfig.segments.map(segment => {
                                const width =
                                    ((segment.endSec - segment.startSec) /
                                        gameConfig.matchDurationSec) *
                                    100;
                                const left =
                                    (segment.startSec / gameConfig.matchDurationSec) * 100;
                                const segmentIsActive =
                                    elapsedSec >= segment.startSec &&
                                    (elapsedSec < segment.endSec ||
                                        segment.id === 'endgame');
                                return (
                                    <div
                                        key={`phase-${segment.id}`}
                                        className={`pointer-events-none absolute inset-y-0 border-r border-black/25 ${
                                            segmentIsActive
                                                ? 'bg-[#48c55c]/30'
                                                : 'bg-[#2a3144]/70'
                                        }`}
                                        style={{ left: `${left}%`, width: `${width}%` }}>
                                        <p className='truncate px-1 py-4 text-center text-[clamp(0.5rem,1.6vw,0.75rem)] font-semibold uppercase tracking-wide text-white/80'>
                                            {segment.label}
                                        </p>
                                    </div>
                                );
                            })}
                            <div
                                className='pointer-events-none absolute inset-y-0 z-20 w-[2px] bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]'
                                style={{ left: `calc(${elapsedPercent}% - 1px)` }}
                            />
                        </div>

                        <div className='grid gap-2 text-xs text-gray-200 sm:grid-cols-4'>
                            <p>Elapsed: {elapsedSec}s</p>
                            <p>Remaining: {remainingSec}s</p>
                            <p className='flex items-center gap-2'>
                                <span className='inline-block h-2.5 w-2.5 rounded bg-emerald-400/90' />
                                Shooting Time
                            </p>
                            <p className='flex items-center gap-2'>
                                <span className='inline-block h-2.5 w-2.5 rounded bg-sky-400/90' />
                                Passing Time
                            </p>
                        </div>
                    </div>

                    <input
                        type='range'
                        min={0}
                        max={gameConfig.matchDurationSec}
                        step={1}
                        value={elapsedSec}
                        onChange={event =>
                            setMatchTimeFromElapsed(
                                Number.parseInt(event.target.value, 10)
                            )
                        }
                        className='mt-3 w-full accent-[#48c55c]'
                        aria-label='Match elapsed seconds'
                    />

                    <div className='mt-4 flex flex-wrap gap-2'>
                        {gameConfig.segments.map(segment => (
                            <button
                                key={segment.id}
                                onClick={() => {
                                    if (!isRunning) {
                                        setManualSegment(
                                            segment.id === 'auto'
                                                ? 'auto'
                                                : (segment.id as TeleSegmentId)
                                        );
                                    }
                                    setMatchTimeFromElapsed(segment.startSec);
                                }}
                                className={`select-none rounded-full px-3 py-1 text-sm font-medium transition ${
                                    activeSegment === segment.id
                                        ? 'bg-[#48c55c] text-black shadow shadow-black/30'
                                        : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                                }`}>
                                {segment.label}
                            </button>
                        ))}
                    </div>
                </section>

                <section className={`${sectionClass} grid gap-4 sm:grid-cols-2`}>
                    <div>
                        <p className='text-sm uppercase text-gray-300'>Match Number</p>
                        <NumberInput
                            onChange={setMatchNumber}
                            value={matchNumber}
                            min={0}
                            className='mt-2 w-40 rounded-lg border border-gray-700 bg-white px-3 py-2 text-black focus:border-[#48c55c] focus:outline-none focus:ring-2 focus:ring-[#48c55c]/30'
                        />
                    </div>
                    <div>
                        <p className='text-sm uppercase text-gray-300'>Team Number</p>
                        <div className='mt-2'>
                            <TeamDropdown onChange={setTeamNumber} value={teamNumber} />
                        </div>
                    </div>
                    <div className='sm:col-span-2'>
                        <button
                            onClick={handleAbsentRobot}
                            className='select-none rounded-lg bg-green-500 px-3 py-2 font-semibold text-black transition hover:brightness-105 active:scale-[0.98]'>
                            Robot Absent
                        </button>
                    </div>
                </section>

                <section className={sectionClass}>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <h2 className='text-xl font-semibold text-[#48c55c]'>
                            Shooting And Passing
                        </h2>
                        <p className='text-sm text-gray-300'>
                            Active:{' '}
                            <span className='font-semibold text-white'>
                                {activeHoldAction ? activeHoldAction.toUpperCase() : 'NONE'}
                            </span>
                        </p>
                    </div>
                    <p className='mt-1 text-sm text-gray-300'>
                        Hold each button while the robot performs that action.
                        Shooting time is converted into estimated scored balls on submit.
                    </p>
                    <div className='mt-4 grid gap-3 sm:grid-cols-2'>
                        <HoldButton
                            onHold={() => addActionTime('shoot', HOLD_INTERVAL_SEC)}
                            onHoldStart={() => beginHoldAction('shoot')}
                            onHoldEnd={endHoldAction}
                            ariaLabel='Hold to track shooting'
                            triggerOnPress={true}
                            repeatDelay={HOLD_INTERVAL_MS}
                            repeatInterval={HOLD_INTERVAL_MS}
                            className='select-none rounded-lg bg-emerald-400 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-black/20 transition hover:brightness-105 active:scale-[0.98]'>
                            HOLD FOR SHOOTING
                        </HoldButton>
                        <HoldButton
                            onHold={() => addActionTime('pass', HOLD_INTERVAL_SEC)}
                            onHoldStart={() => beginHoldAction('pass')}
                            onHoldEnd={endHoldAction}
                            ariaLabel='Hold to track passing'
                            triggerOnPress={true}
                            repeatDelay={HOLD_INTERVAL_MS}
                            repeatInterval={HOLD_INTERVAL_MS}
                            className='select-none rounded-lg bg-sky-400 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-black/20 transition hover:brightness-105 active:scale-[0.98]'>
                            HOLD FOR PASSING
                        </HoldButton>
                    </div>

                    <div className='mt-4 grid gap-2 text-sm text-gray-200 sm:grid-cols-3'>
                        <div>
                            Shooting Time:{' '}
                            <span className='font-semibold text-white'>
                                {formatSeconds(totalShootSec)}
                            </span>
                        </div>
                        <div>
                            Passing Time:{' '}
                            <span className='font-semibold text-white'>
                                {formatSeconds(totalPassSec)}
                            </span>
                        </div>
                        <div>
                            Estimated Balls Scored:{' '}
                            <span className='font-semibold text-white'>
                                {formatBalls(estimatedBallsScored)}
                            </span>
                        </div>
                    </div>

                    <div className='mt-4 grid gap-3 text-sm text-gray-200 md:grid-cols-2'>
                        {(
                            [
                                ['auto', 'Auto'],
                                ['transition', 'Transition'],
                                ['shift1', 'Shift 1'],
                                ['shift2', 'Shift 2'],
                                ['shift3', 'Shift 3'],
                                ['shift4', 'Shift 4'],
                                ['endgame', 'Endgame'],
                            ] as Array<[FullSegmentId, string]>
                        ).map(([segmentKey, label]) => (
                            <div
                                key={segmentKey}
                                className='rounded-lg border border-white/10 bg-[#1b2230] px-3 py-2'>
                                <p className='font-semibold text-white'>{label}</p>
                                <p>
                                    Shoot: {formatSeconds(shootTimeBySegment[segmentKey])}
                                </p>
                                <p>
                                    Pass: {formatSeconds(passTimeBySegment[segmentKey])}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className={sectionClass}>
                    <div className='flex flex-wrap items-center justify-between gap-4'>
                        <h2 className='text-xl font-semibold text-[#48c55c]'>AUTO</h2>
                        <button
                            onClick={handleAutoEnd}
                            className='select-none rounded-lg border border-white/20 px-3 py-2 text-sm transition hover:border-white/40 hover:bg-white/5 active:scale-[0.98]'>
                            AUTO End
                        </button>
                    </div>
                    <div className='mt-4 grid gap-4 sm:grid-cols-2'>
                        <div>
                            <p className='text-sm text-gray-300'>Starting Position</p>
                            <div className='mt-2 flex flex-wrap gap-2'>
                                <MultiButton
                                    onChange={setAutoStartingPosition}
                                    value={autoStartingPosition}
                                    labels={autoStartingOptions.map(option => option.label)}
                                    values={autoStartingOptions.map(option => option.value)}
                                    selectedClassName='select-none bg-[#48c55c] text-black'
                                    unSelectedClassName='select-none bg-gray-700 text-white'
                                />
                            </div>
                        </div>
                        <div>
                            <p className='text-sm text-gray-300'>Auto Tower</p>
                            <div className='mt-2 flex flex-wrap gap-2'>
                                <MultiButton
                                    onChange={setAutoTower}
                                    value={autoTower}
                                    labels={['None', 'Failed', 'L1']}
                                    values={autoTowerOptions}
                                    selectedClassName='select-none bg-[#48c55c] text-black'
                                    unSelectedClassName='select-none bg-gray-700 text-white'
                                />
                            </div>
                        </div>
                    </div>
                    <div className='mt-4'>
                        <Checkbox
                            checked={autoMoved}
                            onChange={setAutoMoved}
                            className='text-sm text-white'
                            boxClassName='size-4'>
                            <span className='ml-2'>Auto Moved</span>
                        </Checkbox>
                    </div>
                    <div className='mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-300'>
                        <span>
                            Auto Fuel Winner:{' '}
                            <span className='font-semibold text-white'>
                                {autoFuelWinner.toUpperCase()}
                            </span>
                        </span>
                        <button
                            onClick={() => setShowAutoWinnerPrompt(true)}
                            className='select-none rounded-lg border border-white/20 px-2 py-1 text-xs transition hover:border-white/40 hover:bg-white/5'>
                            Edit
                        </button>
                    </div>

                    {showAutoWinnerPrompt && (
                        <div className='mt-5 rounded-lg border border-[#48c55c] bg-[#1f2432] p-4 shadow-lg shadow-black/20'>
                            <p className='text-sm text-gray-300'>Who won AUTO fuel?</p>
                            <div className='mt-2 flex flex-wrap gap-2'>
                                <MultiButton
                                    onChange={value => {
                                        setAutoFuelWinner(value);
                                        setShowAutoWinnerPrompt(false);
                                        if (value !== 'tie') {
                                            setShift1ActiveHubIfTie(null);
                                        }
                                    }}
                                    value={autoFuelWinner}
                                    labels={['Red', 'Blue', 'Tie', 'Unknown']}
                                    values={autoFuelWinnerOptions}
                                    selectedClassName={[
                                        'bg-red-500 text-white',
                                        'bg-blue-500 text-white',
                                        'bg-[#48c55c] text-black',
                                        'bg-gray-500 text-white',
                                    ]}
                                    unSelectedClassName='bg-gray-700 text-white'
                                />
                            </div>
                        </div>
                    )}
                </section>

                {autoFuelWinner === 'tie' && (
                    <section
                        className={`${sectionClass} ${
                            showShift1Prompt ? 'ring-2 ring-[#48c55c]/60' : ''
                        }`}>
                        <p className='text-sm text-gray-300'>
                            Tie in AUTO: Which HUB is active in Shift 1?
                        </p>
                        <div className='mt-2 flex flex-wrap gap-2'>
                            <MultiButton
                                onChange={value => {
                                    setShift1ActiveHubIfTie(value);
                                    setShowShift1Prompt(false);
                                }}
                                value={shift1ActiveHubIfTie ?? undefined}
                                labels={['Red', 'Blue']}
                                values={allianceOptions}
                                selectedClassName={['bg-red-500 text-white', 'bg-blue-500 text-white']}
                                unSelectedClassName='bg-gray-700 text-white'
                            />
                        </div>
                    </section>
                )}

                <section className={sectionClass}>
                    <h2 className='text-xl font-semibold text-[#48c55c]'>TELEOP / ENDGAME</h2>
                    <div className='mt-4 grid gap-4 lg:grid-cols-2'>
                        <div>
                            <p className='text-sm text-gray-300'>Driver Quality</p>
                            <div className='mt-2 flex flex-wrap gap-2'>
                                <MultiButton
                                    onChange={setDriverQuality}
                                    value={driverQuality}
                                    labels={driverQualityOptions.map(option =>
                                        option.toUpperCase()
                                    )}
                                    values={driverQualityOptions}
                                    selectedClassName='bg-[#48c55c] text-black'
                                    unSelectedClassName='bg-gray-700 text-white'
                                />
                            </div>
                        </div>
                        <div>
                            <p className='text-sm text-gray-300'>Breakdown</p>
                            <div className='mt-2 flex flex-wrap gap-2'>
                                <MultiButton
                                    onChange={setBreakdown}
                                    value={breakdown}
                                    labels={['None', 'Stuck', 'Tipped', 'Comms', 'Mech', 'Other']}
                                    values={breakdownOptions}
                                    selectedClassName='bg-[#48c55c] text-black'
                                    unSelectedClassName='bg-gray-700 text-white'
                                />
                            </div>
                        </div>
                        <div>
                            <p className='text-sm text-gray-300'>Climbing Result</p>
                            <div className='mt-2 flex flex-wrap gap-2'>
                                <MultiButton
                                    onChange={setTeleTower}
                                    value={teleTower}
                                    labels={['None', 'Failed', 'L1', 'L2', 'L3']}
                                    values={teleTowerOptions}
                                    selectedClassName='bg-[#48c55c] text-black'
                                    unSelectedClassName='bg-gray-700 text-white'
                                />
                            </div>
                        </div>
                        <div>
                            <p className='text-sm text-gray-300'>Climb Timing</p>
                            <div className='mt-2 flex flex-wrap gap-2'>
                                <MultiButton
                                    onChange={setClimbTimeBucket}
                                    value={climbTimeBucket ?? undefined}
                                    labels={climbTimeOptions.map(option => option.label)}
                                    values={climbTimeOptions.map(option => option.value)}
                                    selectedClassName='bg-[#48c55c] text-black'
                                    unSelectedClassName='bg-gray-700 text-white'
                                />
                            </div>
                        </div>
                    </div>
                </section>

                <details className={sectionClass} open>
                    <summary className='cursor-pointer select-none text-xl font-semibold text-[#48c55c]'>
                        Expanded Match Context
                    </summary>
                    <p className='mt-2 text-sm text-gray-300'>
                        Former super-scouting inputs are now captured here.
                    </p>

                    <div className='mt-4 grid gap-4 lg:grid-cols-2'>
                        <div>
                            <p className='text-sm text-gray-300'>Defense Provided</p>
                            <div className='mt-2 flex flex-wrap gap-2'>
                                <MultiButton
                                    onChange={setDefenseProvided}
                                    value={defenseProvided}
                                    labels={['None', 'Some', 'Heavy']}
                                    values={['None', 'some', 'heavy']}
                                    selectedClassName='bg-[#48c55c] text-black'
                                    unSelectedClassName='bg-gray-700 text-white'
                                />
                            </div>
                            <div className='mt-3'>
                                <Checkbox
                                    checked={defenseReceived}
                                    onChange={setDefenseReceived}
                                    className='text-sm text-white'
                                    boxClassName='size-4'>
                                    <span className='ml-2'>Was Defended?</span>
                                </Checkbox>
                            </div>
                        </div>
                        <div>
                            <p className='text-sm text-gray-300'>Canned Comments</p>
                            <div className='mt-2'>
                                <CannedComments value={comments} onChange={setComments} />
                            </div>
                        </div>
                    </div>

                    <div className='mt-5 grid gap-5 lg:grid-cols-2'>
                        <div>
                            <p className='text-sm font-semibold text-gray-200'>Fouls</p>
                            <div className='mt-2 grid gap-2'>
                                {foulLabels.map(foul => (
                                    <div
                                        key={foul.key}
                                        className='flex items-center gap-2 rounded-lg border border-white/10 bg-[#1b2230] px-2 py-2'>
                                        <HoldButton
                                            onHold={() => adjustFoul(foul.key, -1)}
                                            ariaLabel={`Decrease ${foul.label}`}
                                            className='rounded bg-red-500 px-3 py-1 text-white'>
                                            -
                                        </HoldButton>
                                        <span className='flex-1 text-sm text-gray-100'>
                                            {foul.label}
                                        </span>
                                        <span className='w-8 text-right font-semibold tabular-nums text-white'>
                                            {fouls[foul.key]}
                                        </span>
                                        <HoldButton
                                            onHold={() => adjustFoul(foul.key, 1)}
                                            ariaLabel={`Increase ${foul.label}`}
                                            className='rounded bg-[#48c55c] px-3 py-1 text-black'>
                                            +
                                        </HoldButton>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className='text-sm font-semibold text-gray-200'>Breaks</p>
                            <div className='mt-2 grid gap-2'>
                                {breakLabels.map(breakEntry => (
                                    <div
                                        key={breakEntry.key}
                                        className='flex items-center gap-2 rounded-lg border border-white/10 bg-[#1b2230] px-2 py-2'>
                                        <HoldButton
                                            onHold={() => adjustBreak(breakEntry.key, -1)}
                                            ariaLabel={`Decrease ${breakEntry.label}`}
                                            className='rounded bg-red-500 px-3 py-1 text-white'>
                                            -
                                        </HoldButton>
                                        <span className='flex-1 text-sm text-gray-100'>
                                            {breakEntry.label}
                                        </span>
                                        <span className='w-8 text-right font-semibold tabular-nums text-white'>
                                            {breaks[breakEntry.key]}
                                        </span>
                                        <HoldButton
                                            onHold={() => adjustBreak(breakEntry.key, 1)}
                                            ariaLabel={`Increase ${breakEntry.label}`}
                                            className='rounded bg-[#48c55c] px-3 py-1 text-black'>
                                            +
                                        </HoldButton>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </details>

                <section className={sectionClass}>
                    <h2 className='text-xl font-semibold text-[#48c55c]'>Notes</h2>
                    <TextInput
                        className='mt-2 w-full rounded-lg border border-gray-700 bg-white px-3 py-2 text-black focus:border-[#48c55c] focus:outline-none focus:ring-2 focus:ring-[#48c55c]/30'
                        value={freeText}
                        onChange={setFreeText}
                        placeholder='Short notes...'
                    />
                </section>

                <section className={`${sectionClass} flex flex-col gap-3`}>
                    <button
                        onClick={() => {
                            handleSubmit();
                            scrollTo(0, 0);
                        }}
                        className='select-none rounded-lg bg-[#48c55c] px-4 py-3 text-lg font-semibold text-black shadow-lg shadow-black/20 transition hover:brightness-105 active:scale-[0.98]'>
                        Submit
                    </button>
                    <div className='text-sm text-gray-300'>
                        Queue: <span className='font-semibold text-white'>{queue.length}</span>
                    </div>
                    <button
                        onClick={sendAll}
                        className='select-none rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:brightness-105 active:scale-[0.98]'>
                        {sending ? 'Sending...' : 'Resend All'}
                    </button>
                </section>
            </main>
        </div>
    );
}

export default MatchApp;
