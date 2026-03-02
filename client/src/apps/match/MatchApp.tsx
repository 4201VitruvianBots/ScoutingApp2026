import LinkButton from '../../components/LinkButton';
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
import { useEffect, useRef, useState } from 'react';
import { MaterialSymbol } from 'react-material-symbols';
import 'react-material-symbols/rounded';
import SignIn from '../../components/SignIn';
import Dialog from '../../components/Dialog';
import NumberInput from '../../components/NumberInput';
import { useStatus } from '../../lib/useStatus';
import TeamDropdown from '../../components/TeamDropdown';
import { useQueue } from '../../lib/useQueue';
import scheduleFile from '../../assets/matchSchedule.json';
import { usePreventUnload } from '../../lib/usePreventUnload';
import MultiButton from '../../components/MultiButton';
import Checkbox from '../../components/Checkbox';
import TextInput from '../../components/TextInput';
import HoldButton from '../../components/HoldButton';
import {
    formatMatchTime,
    gameConfig,
    getSegmentForRemaining,
    makeEmptyTeleFuelBySegment,
} from '../../lib/gameConfig';

//import { useEffect, useState } from 'react';
function useScrollValue(threshold = 86) {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => {
            setScrolled(window.scrollY >= threshold);
        };

        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, [threshold]);


    return scrolled;
}

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

const autoTowerOptions: AutoTowerResult[] = ['none', 'level1', 'failed'];
const teleTowerOptions: TeleTowerResult[] = [
    'none',
    'level1',
    'level2',
    'level3',
    'failed',
];
const autoFuelWinnerOptions: AutoFuelWinner[] = ['red', 'blue', 'tie', 'unknown'];
const allianceOptions: AllianceColor[] = ['red', 'blue'];

const breakdownOptions: BreakdownType[] = [
    'none',
    'stuck',
    'tipped',
    'comms',
    'mechanism',
    'other',
];

const driverQualityOptions: DriverQuality[] = [
    'great',
    'good',
    'ok',
    'rough',
];

const climbTimeOptions: Array<{ label: string; value: MatchData['climbTimeBucket'] }> = [
    { label: 'Early', value: 'early' },
    { label: 'Mid', value: 'mid' },
    { label: 'Late', value: 'late' },
    { label: 'N/A', value: null },
];

function MatchApp() {
    usePreventUnload();
    const [sendQueue, sendAll, queue, sending] = useQueue();
    const [teamNumber, setTeamNumber] = useState<number>();
    const [matchNumber, setMatchNumber] = useState<number>();
    //const [fakeMatchNumber, setFakeMatchNumber] = useState<number>();
    //const [fakeTeamNumber, setFakeTeamNumber] = useState<number>();
    const [showCheck, setShowCheck] = useState(false);
    const [scouterName, setScouterName] = useState('');
    const [robotPosition, setRobotPosition] = useState<RobotPosition>();

    const [robotAbsent, setRobotAbsent] = useState(false);
    const [autoStartingPosition, setAutoStartingPosition] =
        useState<AutoStartingPosition | null>(null);
    const [autoMoved, setAutoMoved] = useState(false);
    const [autoFuelScored, setAutoFuelScored] = useState(0);
    const [autoTower, setAutoTower] = useState<AutoTowerResult>('none');
    const [autoFuelWinner, setAutoFuelWinner] =
        useState<AutoFuelWinner>('unknown');
    const [shift1ActiveHubIfTie, setShift1ActiveHubIfTie] =
        useState<MatchData['shift1ActiveHubIfTie']>(null);
    const [teleFuelBySegment, setTeleFuelBySegment] = useState(
        makeEmptyTeleFuelBySegment()
    );
    const [teleTower, setTeleTower] = useState<TeleTowerResult>('none');
    const [climbTimeBucket, setClimbTimeBucket] =
        useState<MatchData['climbTimeBucket']>(null);
    const [breakdown, setBreakdown] = useState<BreakdownType>('none');
    const [driverQuality, setDriverQuality] =
        useState<DriverQuality>('ok');
    const [freeText, setFreeText] = useState('');

    const [remainingSec, setRemainingSec] = useState(
        gameConfig.matchDurationSec
    );
    const [isRunning, setIsRunning] = useState(false);
    const [manualSegment, setManualSegment] =
        useState<'auto' | TeleSegmentId>('auto');
    const [showAutoWinnerPrompt, setShowAutoWinnerPrompt] = useState(false);
    const [showShift1Prompt, setShowShift1Prompt] = useState(false);
    const fuelHistory = useRef<{ segment: 'auto' | TeleSegmentId; amount: number }[]>(
        []
    );
    const sectionClass =
        'rounded-xl border border-white/10 bg-[#2f3646] p-4 shadow-lg shadow-black/20';

    const currentSegment = getSegmentForRemaining(remainingSec);
    const activeSegment = isRunning ? currentSegment : manualSegment;
    const previousSegment = useRef(currentSegment);

    const RNGenerator = (min: number, max: number) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    };
    const segmentArr = ['auto', 'transition', 'shift1', 'shift2', 'shift3', 'shift4', 'endgame'];

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
        setTeamNumber(
            schedule && robotPosition && matchNumber
                ? schedule[matchNumber]?.[robotPosition]
                : undefined
        );
    }, [matchNumber, robotPosition]);

    useStatus(robotPosition, matchNumber, scouterName);

    const handleFuelAdd = (amount: number) => {
        const segment = activeSegment;
        if (segment === 'auto') {
            setAutoFuelScored(prev => prev + amount);
        } else {
            setTeleFuelBySegment(prev => ({
                ...prev,
                [segment]: prev[segment] + amount,
            }));
        }
        fuelHistory.current = [
            ...fuelHistory.current,
            { segment, amount },
        ];
    };

    const handleUndoFuel = () => {
        const last = fuelHistory.current.at(-1);
        if (!last) return;
        const segment = last.segment;
        fuelHistory.current = fuelHistory.current.slice(0, -1);
        if (segment === 'auto') {
            setAutoFuelScored(prev => Math.max(0, prev - last.amount));
        } else {
            setTeleFuelBySegment(prev => ({
                ...prev,
                [segment]: Math.max(0, prev[segment] - last.amount),
            }));
        }
    };

    const handleAutoEnd = () => {
        setShowAutoWinnerPrompt(true);
        if (!isRunning) {
            setManualSegment('transition');
        }
    };

    const resetMatchState = () => {
        setRobotAbsent(false);
        setAutoStartingPosition(null);
        setAutoMoved(false);
        setAutoFuelScored(0);
        setAutoTower('none');
        setAutoFuelWinner('unknown');
        setShift1ActiveHubIfTie(null);
        setTeleFuelBySegment(makeEmptyTeleFuelBySegment());
        setTeleTower('none');
        setClimbTimeBucket(null);
        setBreakdown('none');
        setDriverQuality('ok');
        setFreeText('');
        fuelHistory.current = [];
        setShowAutoWinnerPrompt(false);
        setShowShift1Prompt(false);
    };

    const handleSubmit = async (absentOverride = false) => {
        if (
            robotPosition == undefined ||
            matchNumber == undefined ||
            (teamNumber == undefined && !absentOverride)
        ) {
            alert('Check sign-in, match number, and team number');
            return;
        }

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
            autoFuelScored,
            autoTower,
            autoFuelWinner,
            shift1ActiveHubIfTie,
            teleFuelBySegment,
            teleTower,
            climbTimeBucket,
            breakdown,
            driverQuality,
            freeText,
        };

        sendQueue('/data/match', data);
        setMatchNumber(matchNumber + 1);
        resetMatchState();
        setShowCheck(true);
        setTimeout(() => {
            setShowCheck(false);
        }, 3000);
    };

    const genFakeFuel = () => {
        //setFakeMatchNumber(-1);
        //setFakeTeamNumber(0);
        for (let segArrIndex = 0; segArrIndex < segmentArr.length; segArrIndex++) {
            const segment = segmentArr[segArrIndex];
            if (segment === 'auto') {
                setAutoFuelScored(0);
                handleFuelAdd(RNGenerator(1, 150));
            }
            else if (segment === 'transition' || segment === 'shift1' || segment === 'shift2' || segment === 'shift3' || segment === 'shift4' || segment === 'endgame') {
                setTeleFuelBySegment(prev => ({
                    ...prev,
                    [segment]: RNGenerator(1, 200),
                }));
            }
        }
    };

    const handleAbsentRobot = async () => {
        if (robotPosition == undefined || matchNumber == undefined) {
            alert('Check sign-in and match number');
            return;
        }

        if (window.confirm('Mark robot as absent?')) {
            setRobotAbsent(true);
            handleSubmit(true);
            scrollTo(0, 0);
        }
    };

    return (
        <div className='min-h-screen bg-gradient-to-b from-[#171c26] via-[#161b22] to-[#12151d] pb-10 text-white'>
            <main className='mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 pb-16 pt-8'>
                {showCheck && (
                    <MaterialSymbol
                        icon='check'
                        size={120}
                        fill
                        grade={200}
                        color='#48c55c'
                        className='fixed right-6 top-6 drop-shadow-[0_0_12px_rgba(72,197,92,0.5)]'
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
                                        className={`${
                                            scouterName && robotPosition
                                                ? 'text-green-400'
                                                : 'text-gray-400'
                                        }`}
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

                        
                        <div className={
                            useScrollValue()
                                ? 'fixed flex justify-end right-2 top-[1%] bg-gradient-to-bl from-black to-black/50 w-[54px] h-[54px] mr-2 mt-2 rounded-lg'
                                : '' }
                                id="undoShadow"> 
                            <button
                            //the button has a width & height of 56 px
                                onClick={handleUndoFuel}
                                className={
                                    useScrollValue()
                                    ? 'fixed right-2 top-[1%] max-w-[56px] max-h-[56px] rounded-lg bg-[#f07800] px-3 py-2 text-black transition hover:brightness-105 active:scale-[0.98]' // if scrolled past 86 px
                                    : 'rounded-lg bg-[#f07800] px-3 py-2 text-black transition hover:brightness-105 active:scale-[0.98]' //if not scrolled past 86 px
                                }
                                id="undoButton">
                                <MaterialSymbol
                                    icon='undo'
                                    size={32}
                                    fill
                                    grade={200}
                                    color='black'
                                />
                            </button>
                        </div>


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
                            <p className='text-sm uppercase text-gray-300'>
                                Match Timer
                            </p>
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
                        </div>
                        <div className='flex flex-wrap gap-2'>
                            <button
                                onClick={() => {
                                    genFakeFuel();
                                }}
                                className="rounded-lg bg-orange-500 px-4 py-2 font-semibold text-black shadow-lg shadow-black/20 transition hover:brightness-105 active:scale-[0.98]">
                                Fake Data
                            </button>
                            <button
                                onClick={() => {
                                    setRemainingSec(gameConfig.matchDurationSec);
                                    setIsRunning(true);
                                    setManualSegment('auto');
                                    previousSegment.current = 'auto';
                                }}
                                className='rounded-lg bg-[#48c55c] px-4 py-2 font-semibold text-black shadow-lg shadow-black/20 transition hover:brightness-105 active:scale-[0.98]'>
                                Start Match
                            </button>
                            <button
                                onClick={() => setIsRunning(false)}
                                className='rounded-lg bg-gray-600 px-4 py-2 font-semibold text-white transition hover:bg-gray-500 active:scale-[0.98]'>
                                Pause
                            </button>
                            <button
                                onClick={() => {
                                    setIsRunning(false);
                                    setRemainingSec(gameConfig.matchDurationSec);
                                    setManualSegment('auto');
                                }}
                                className='rounded-lg border border-white/20 px-4 py-2 font-semibold text-white transition hover:border-white/40 hover:bg-white/5 active:scale-[0.98]'>
                                Reset Timer
                            </button>
                        </div>
                    </div>
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
                                }}
                                className={`rounded-full px-3 py-1 text-sm ${
                                    activeSegment === segment.id
                                        ? 'bg-[#48c55c] text-black shadow shadow-black/30'
                                        : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                                } font-medium transition`}
                            >
                                {segment.label}
                            </button>
                        ))}
                    </div>
                </section>

                <section className={`${sectionClass} grid gap-4 sm:grid-cols-2`}>
                    <div>
                        <p className='text-sm uppercase text-gray-300'>
                            Match Number
                        </p>
                        <NumberInput
                            onChange={setMatchNumber}
                            value={matchNumber}
                            min={0}
                            className='mt-2 w-40 rounded-lg border border-gray-700 bg-white px-3 py-2 text-black focus:border-[#48c55c] focus:outline-none focus:ring-2 focus:ring-[#48c55c]/30'
                        />
                    </div>
                    <div>
                        <p className='text-sm uppercase text-gray-300'>
                            Team Number
                        </p>
                        <div className='mt-2'>
                            <TeamDropdown
                                onChange={setTeamNumber}
                                value={teamNumber}
                            />
                        </div>
                    </div>
                    <div className='sm:col-span-2'>
                        <button
                            onClick={handleAbsentRobot}
                            className='rounded-lg bg-green-500 px-3 py-2 font-semibold text-black transition hover:brightness-105 active:scale-[0.98]'>
                            Robot Absent
                        </button>
                    </div>
                </section>

                <section className={sectionClass}>
                    <h2 className='text-xl font-semibold text-[#48c55c]'>Fuel</h2>
                    <p className='text-sm text-gray-300'>
                        Tap to add fuel to the active segment. (Auto adds to
                        Auto fuel; Tele adds by segment.)
                    </p>
                    <div className='mt-3 flex flex-wrap gap-3'>
                        <HoldButton
                            onHold={() => handleFuelAdd(1)}
                            ariaLabel='Add 1 fuel'
                            repeatInterval={100}
                            className='rounded-lg bg-[#48c55c] px-6 py-3 text-lg font-bold text-black shadow-lg shadow-black/20 transition hover:brightness-105 active:scale-[0.98]'>
                            +1
                        </HoldButton>
                        <HoldButton
                            onHold={() => handleFuelAdd(5)}
                            ariaLabel='Add 5 fuel'
                            repeatInterval={100}
                            className='rounded-lg bg-gray-700 px-6 py-3 text-lg font-bold text-white transition hover:bg-gray-600 active:scale-[0.98]'>
                            +5
                        </HoldButton>
                        <HoldButton
                            onHold={() => handleFuelAdd(10)}
                            ariaLabel='Add 10 fuel'
                            repeatInterval={100}
                            className='rounded-lg bg-gray-700 px-6 py-3 text-lg font-bold text-white transition hover:bg-gray-600 active:scale-[0.98]'>
                            +10
                        </HoldButton>
                    </div>
                    <div className='mt-4 grid gap-2 text-sm text-gray-200 sm:grid-cols-2'>
                        <div>
                            Auto Fuel:{' '}
                            <span className='font-semibold tabular-nums'>
                                {autoFuelScored}
                            </span>
                        </div>
                        <div>
                            Transition:{' '}
                            <span className='font-semibold tabular-nums'>
                                {teleFuelBySegment.transition}
                            </span>
                        </div>
                        <div>
                            Shift 1:{' '}
                            <span className='font-semibold tabular-nums'>
                                {teleFuelBySegment.shift1}
                            </span>
                        </div>
                        <div>
                            Shift 2:{' '}
                            <span className='font-semibold tabular-nums'>
                                {teleFuelBySegment.shift2}
                            </span>
                        </div>
                        <div>
                            Shift 3:{' '}
                            <span className='font-semibold tabular-nums'>
                                {teleFuelBySegment.shift3}
                            </span>
                        </div>
                        <div>
                            Shift 4:{' '}
                            <span className='font-semibold tabular-nums'>
                                {teleFuelBySegment.shift4}
                            </span>
                        </div>
                        <div>
                            Endgame:{' '}
                            <span className='font-semibold tabular-nums'>
                                {teleFuelBySegment.endgame}
                            </span>
                        </div>
                    </div>
                </section>

                <section className={sectionClass}>
                    <div className='flex flex-wrap items-center justify-between gap-4'>
                        <h2 className='text-xl font-semibold text-[#48c55c]'>
                            AUTO
                        </h2>
                        <button
                            onClick={handleAutoEnd}
                            className='rounded-lg border border-white/20 px-3 py-2 text-sm transition hover:border-white/40 hover:bg-white/5 active:scale-[0.98]'>
                            AUTO End
                        </button>
                    </div>
                    <div className='mt-4 grid gap-4 sm:grid-cols-2'>
                        <div>
                            <p className='text-sm text-gray-300'>
                                Starting Position
                            </p>
                            <div className='flex flex-wrap gap-2'>
                                <MultiButton
                                    onChange={setAutoStartingPosition}
                                    value={autoStartingPosition}
                                    labels={autoStartingOptions.map(option => option.label)}
                                    values={autoStartingOptions.map(option => option.value)}
                                    selectedClassName='bg-[#48c55c] text-black'
                                    unSelectedClassName='bg-gray-700 text-white'
                                />
                            </div>
                        </div>
                        <div>
                            <p className='text-sm text-gray-300'>Auto Move</p>
                            <Checkbox
                                className='text-base'
                                boxClassName='size-5'
                                checked={autoMoved}
                                onChange={setAutoMoved}>
                                Moved off the line
                            </Checkbox>
                        </div>
                        <div>
                            <p className='text-sm text-gray-300'>Auto Tower</p>
                            <div className='flex flex-wrap gap-2'>
                                <MultiButton
                                    onChange={setAutoTower}
                                    value={autoTower}
                                    labels={autoTowerOptions.map(option =>
                                        option.replace('level', 'Level ')
                                    )}
                                    values={autoTowerOptions}
                                    selectedClassName='bg-[#48c55c] text-black'
                                    unSelectedClassName='bg-gray-700 text-white'
                                />
                            </div>
                        </div>
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
                            className='rounded-lg border border-white/20 px-2 py-1 text-xs transition hover:border-white/40 hover:bg-white/5'>
                            Edit
                        </button>
                    </div>

                    {showAutoWinnerPrompt && (
                        <div className='mt-6 rounded-lg border border-[#48c55c] bg-[#1f2432] p-4 shadow-lg shadow-black/20'>
                            <p className='text-sm text-gray-300'>
                                Who won AUTO fuel?
                            </p>
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
                                selectedClassName={[
                                    'bg-red-500 text-white',
                                    'bg-blue-500 text-white',
                                ]}
                                unSelectedClassName='bg-gray-700 text-white'
                            />
                        </div>
                    </section>
                )}

                <section className={sectionClass}>
                    <h2 className='text-xl font-semibold text-[#48c55c]'>
                        TELEOP / ENDGAME
                    </h2>
                    <div className='mt-4 grid gap-4 sm:grid-cols-2'>
                        <div>
                            <p className='text-sm text-gray-300'>Tele Tower</p>
                            <div className='flex flex-wrap gap-2'>
                                <MultiButton
                                    onChange={setTeleTower}
                                    value={teleTower}
                                    labels={teleTowerOptions.map(option =>
                                        option.replace('level', 'Level ')
                                    )}
                                    values={teleTowerOptions}
                                    selectedClassName='bg-[#48c55c] text-black'
                                    unSelectedClassName='bg-gray-700 text-white'
                                />
                            </div>
                        </div>
                        <div>
                            <p className='text-sm text-gray-300'>Climb Time</p>
                            <div className='flex flex-wrap gap-2'>
                                <MultiButton
                                    onChange={setClimbTimeBucket}
                                    value={climbTimeBucket}
                                    labels={climbTimeOptions.map(option => option.label)}
                                    values={climbTimeOptions.map(option => option.value)}
                                    selectedClassName='bg-[#48c55c] text-black'
                                    unSelectedClassName='bg-gray-700 text-white'
                                />
                            </div>
                        </div>
                        <div>
                            <p className='text-sm text-gray-300'>Breakdown</p>
                            <div className='flex flex-wrap gap-2'>
                                <MultiButton
                                    onChange={setBreakdown}
                                    value={breakdown}
                                    labels={breakdownOptions.map(option =>
                                        option === 'none'
                                            ? 'None'
                                            : option.charAt(0).toUpperCase() +
                                              option.slice(1)
                                    )}
                                    values={breakdownOptions}
                                    selectedClassName='bg-[#48c55c] text-black'
                                    unSelectedClassName='bg-gray-700 text-white'
                                />
                            </div>
                        </div>
                        <div>
                            <p className='text-sm text-gray-300'>
                                Driver Quality
                            </p>
                            <div className='flex flex-wrap gap-2'>
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
                    </div>
                </section>

                <section className={sectionClass}>
                    <h2 className='text-xl font-semibold text-[#48c55c]'>
                        Notes
                    </h2>
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
                        className='rounded-lg bg-[#48c55c] px-4 py-3 text-lg font-semibold text-black shadow-lg shadow-black/20 transition hover:brightness-105 active:scale-[0.98]'>
                        Submit
                    </button>
                    <div className='text-sm text-gray-300'>
                        Queue: <span className='font-semibold text-white'>{queue.length}</span>
                    </div>
                    <button
                        onClick={sendAll}
                        className='rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:brightness-105 active:scale-[0.98]'>
                        {sending ? 'Sending...' : 'Resend All'}
                    </button>
                </section>
            </main>
        </div>
    );
}

export default MatchApp;