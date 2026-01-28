import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import LinkButton from '../../components/LinkButton';
import { MaterialSymbol } from 'react-material-symbols';
import { gameConfig } from '../../lib/gameConfig';

function Counter({
    value,
    onChange,
    label,
    min = 0,
    max,
}: {
    value: number;
    onChange: Dispatch<SetStateAction<number>>;
    label: string;
    min?: number;
    max?: number;
}) {
    const holdTimeoutRef = useRef<number | null>(null);
    const holdIntervalRef = useRef<number | null>(null);
    const ignoreClickRef = useRef(false);

    useEffect(() => {
        return () => {
            if (holdTimeoutRef.current !== null) {
                window.clearTimeout(holdTimeoutRef.current);
            }
            if (holdIntervalRef.current !== null) {
                window.clearInterval(holdIntervalRef.current);
            }
        };
    }, []);

    const clampValue = (next: number) => {
        const clamped = Math.max(min, next);
        return max != undefined ? Math.min(max, clamped) : clamped;
    };

    const applyDelta = (delta: number) => {
        onChange(prev => clampValue(prev + delta));
    };

    const clearHoldTimers = () => {
        if (holdTimeoutRef.current !== null) {
            window.clearTimeout(holdTimeoutRef.current);
            holdTimeoutRef.current = null;
        }
        if (holdIntervalRef.current !== null) {
            window.clearInterval(holdIntervalRef.current);
            holdIntervalRef.current = null;
        }
    };

    const startHold = (delta: number) => {
        ignoreClickRef.current = true;
        applyDelta(delta);
        clearHoldTimers();
        holdTimeoutRef.current = window.setTimeout(() => {
            holdIntervalRef.current = window.setInterval(() => {
                applyDelta(delta);
            }, 70);
        }, 300);
    };

    const stopHold = () => {
        clearHoldTimers();
        window.setTimeout(() => {
            ignoreClickRef.current = false;
        }, 0);
    };

    const handleClick = (delta: number) => {
        if (ignoreClickRef.current) {
            ignoreClickRef.current = false;
            return;
        }
        applyDelta(delta);
    };

    return (
        <div className='flex flex-col items-center gap-2 rounded-lg bg-[#2f3646] p-4'>
            <p className='text-sm text-gray-200'>{label}</p>
            <div className='flex items-center gap-2'>
                <button
                    className='rounded bg-red-400 px-4 py-2 text-lg text-white'
                    type='button'
                    onPointerDown={() => startHold(-1)}
                    onPointerUp={stopHold}
                    onPointerLeave={stopHold}
                    onPointerCancel={stopHold}
                    onClick={() => handleClick(-1)}>
                    -
                </button>
                <div className='min-w-[50px] text-center text-2xl font-bold text-white'>
                    {value}
                </div>
                <button
                    className='rounded bg-[#48c55c] px-4 py-2 text-lg text-black'
                    type='button'
                    onPointerDown={() => startHold(1)}
                    onPointerUp={stopHold}
                    onPointerLeave={stopHold}
                    onPointerCancel={stopHold}
                    onClick={() => handleClick(1)}>
                    +
                </button>
            </div>
        </div>
    );
}

function ScoreCalculator() {
    const [autoFuelActive, setAutoFuelActive] = useState(0);
    const [autoTowerL1, setAutoTowerL1] = useState(0);
    const [teleFuelActive, setTeleFuelActive] = useState(0);
    const [teleTowerL1, setTeleTowerL1] = useState(0);
    const [teleTowerL2, setTeleTowerL2] = useState(0);
    const [teleTowerL3, setTeleTowerL3] = useState(0);
    const [foulsMinor, setFoulsMinor] = useState(0);
    const [foulsMajor, setFoulsMajor] = useState(0);

    const fuelPoints = gameConfig.scoring.fuelPointsActive;
    const autoTowerPoints = gameConfig.scoring.towerAuto.level1;
    const teleTowerPoints = gameConfig.scoring.towerTele;

    const autoFuelScore = autoFuelActive * fuelPoints;
    const autoTowerScore = autoTowerL1 * autoTowerPoints;
    const teleFuelScore = teleFuelActive * fuelPoints;
    const teleTowerScore =
        teleTowerL1 * teleTowerPoints.level1 +
        teleTowerL2 * teleTowerPoints.level2 +
        teleTowerL3 * teleTowerPoints.level3;
    const foulScore = foulsMinor * 2 + foulsMajor * 5;

    const totalScore =
        autoFuelScore + autoTowerScore + teleFuelScore + teleTowerScore + foulScore;

    const { rpThresholds } = gameConfig.scoring;
    const energized = totalScore >= rpThresholds.energized;
    const supercharged = totalScore >= rpThresholds.supercharged;
    const traversal = totalScore >= rpThresholds.traversal;

    const resetAll = () => {
        setAutoFuelActive(0);
        setAutoTowerL1(0);
        setTeleFuelActive(0);
        setTeleTowerL1(0);
        setTeleTowerL2(0);
        setTeleTowerL3(0);
        setFoulsMinor(0);
        setFoulsMajor(0);
    };

    return (
        <div className='min-h-screen bg-[#171c26] text-white'>
            <div className='flex items-center justify-between bg-[#2f3646] px-6 py-4'>
                <LinkButton link='/' className='flex items-center'>
                    <MaterialSymbol icon='home' size={40} fill grade={200} color='white' />
                </LinkButton>
                <h1 className='text-2xl font-bold text-[#48c55c]'>
                    Score Calculator
                </h1>
                <button
                    onClick={resetAll}
                    className='rounded bg-gray-600 px-4 py-2 text-sm text-white'>
                    Reset
                </button>
            </div>

            <div className='mx-auto grid w-full max-w-5xl gap-6 px-6 py-8'>
                <section>
                    <h2 className='mb-3 text-xl font-semibold text-[#48c55c]'>
                        AUTO
                    </h2>
                    <div className='grid gap-4 md:grid-cols-2'>
                        <Counter
                            value={autoFuelActive}
                            onChange={setAutoFuelActive}
                            label='Auto Fuel (Active Hub)'
                        />
                        <Counter
                            value={autoTowerL1}
                            onChange={setAutoTowerL1}
                            label='Auto Tower Level 1 (max 2)'
                            max={gameConfig.scoring.towerAuto.maxRobots}
                        />
                    </div>
                </section>

                <section>
                    <h2 className='mb-3 text-xl font-semibold text-[#48c55c]'>
                        TELEOP
                    </h2>
                    <div className='grid gap-4 md:grid-cols-2'>
                        <Counter
                            value={teleFuelActive}
                            onChange={setTeleFuelActive}
                            label='Tele Fuel (Active Hub)'
                        />
                        <Counter
                            value={teleTowerL1}
                            onChange={setTeleTowerL1}
                            label='Tele Tower Level 1'
                        />
                        <Counter
                            value={teleTowerL2}
                            onChange={setTeleTowerL2}
                            label='Tele Tower Level 2'
                        />
                        <Counter
                            value={teleTowerL3}
                            onChange={setTeleTowerL3}
                            label='Tele Tower Level 3'
                        />
                    </div>
                </section>

                <section>
                    <h2 className='mb-3 text-xl font-semibold text-[#48c55c]'>
                        FOULS (What-if)
                    </h2>
                    <div className='grid gap-4 md:grid-cols-2'>
                        <Counter
                            value={foulsMinor}
                            onChange={setFoulsMinor}
                            label='Minor Fouls (2 pts)'
                        />
                        <Counter
                            value={foulsMajor}
                            onChange={setFoulsMajor}
                            label='Major Fouls (5 pts)'
                        />
                    </div>
                </section>

                <section className='rounded-lg bg-[#2f3646] p-6'>
                    <h2 className='text-xl font-semibold text-[#48c55c]'>
                        Totals
                    </h2>
                    <div className='mt-3 grid gap-2 text-sm text-gray-200'>
                        <p>Auto Fuel Points: {autoFuelScore}</p>
                        <p>Auto Tower Points: {autoTowerScore}</p>
                        <p>Tele Fuel Points: {teleFuelScore}</p>
                        <p>Tele Tower Points: {teleTowerScore}</p>
                        <p>Foul Points: {foulScore}</p>
                        <p className='mt-2 text-lg font-semibold text-white'>
                            Total Score: {totalScore}
                        </p>
                    </div>
                    <div className='mt-4 grid gap-2 text-sm text-gray-200'>
                        <p>
                            Energized RP ({rpThresholds.energized}):{' '}
                            <span className={energized ? 'text-[#48c55c]' : 'text-red-300'}>
                                {energized ? 'Yes' : 'No'}
                            </span>
                        </p>
                        <p>
                            Supercharged RP ({rpThresholds.supercharged}):{' '}
                            <span
                                className={supercharged ? 'text-[#48c55c]' : 'text-red-300'}>
                                {supercharged ? 'Yes' : 'No'}
                            </span>
                        </p>
                        <p>
                            Traversal RP ({rpThresholds.traversal}):{' '}
                            <span className={traversal ? 'text-[#48c55c]' : 'text-red-300'}>
                                {traversal ? 'Yes' : 'No'}
                            </span>
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
}

export default ScoreCalculator;
