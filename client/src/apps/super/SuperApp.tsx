import { MaterialSymbol } from 'react-material-symbols';
import LinkButton from '../../components/LinkButton';
import SignIn from '../../components/SignIn';
import { useEffect, useMemo, useState } from 'react';
import Dialog from '../../components/Dialog';
import { MatchSchedule, SuperData, SuperPosition } from 'requests';
import SuperTeam, { SuperTeamState } from './components/SuperTeam';
import NumberInput from '../../components/NumberInput';
import MultiButton from '../../components/MultiButton';
import HoldButton from '../../components/HoldButton';
import { useStatus } from '../../lib/useStatus';
import { useQueue } from '../../lib/useQueue';
import scheduleFile from '../../assets/matchSchedule.json';
import { usePreventUnload } from '../../lib/usePreventUnload';
import { gameConfig, getAlliancePositions } from '../../lib/gameConfig';

const schedule = scheduleFile as MatchSchedule;

const defaultSuperTeamState: SuperTeamState = {
    fouls: {
        pinning: 0,
        towerContactInEndgame: 0,
        outOfZoneShooting: 0,
        ejectedFuel: 0,
        other: 0,
    },
    breaks: {
        mechanism: 0,
        battery: 0,
        comms: 0,
        bumper: 0,
    },
    defenseProvided: 'None',
    defenseReceived: false,
    teamNumber: undefined,
    comments: [],
};

function cloneTeamState(team: SuperTeamState): SuperTeamState {
    return {
        ...team,
        fouls: { ...team.fouls },
        breaks: { ...team.breaks },
        comments: [...team.comments],
    };
}

function SuperApp() {
    usePreventUnload();
    const [scouterName, setScouterName] = useState('');
    const [superPosition, setSuperPosition] = useState<SuperPosition>();
    const [matchNumber, setMatchNumber] = useState<number>();
    const [showCheck, setShowCheck] = useState(false);
    const [sendQueue, sendAll, queue, sending] = useQueue();

    const allianceSize = gameConfig.allianceSizeRobots.default;
    const [teams, setTeams] = useState<SuperTeamState[]>(
        Array.from({ length: allianceSize }, () => cloneTeamState(defaultSuperTeamState))
    );
    const [humanPlayerFuelScored, setHumanPlayerFuelScored] = useState(0);
    const [humanPlayerIndex, setHumanPlayerIndex] = useState<number | null>(null);
    const [history, setHistory] = useState<
        Array<{
            teams: SuperTeamState[];
            humanPlayerFuelScored: number;
            humanPlayerIndex: number | null;
        }>
    >([]);
    const sectionClass =
        'rounded-xl border border-white/10 bg-[#2f3646] p-4 shadow-lg shadow-black/20';

    useStatus(superPosition, matchNumber, scouterName);

    const alliancePositions = useMemo(() => {
        if (!superPosition) return [];
        return getAlliancePositions(
            superPosition === 'blue_ss' ? 'blue' : 'red'
        );
    }, [superPosition]);

    const saveHistory = () => {
        setHistory(prev => [
            ...prev,
            {
                teams: teams.map(cloneTeamState),
                humanPlayerFuelScored,
                humanPlayerIndex,
            },
        ]);
    };

    const updateTeam = (index: number, nextState: SuperTeamState) => {
        saveHistory();
        setTeams(prev => {
            const updated = [...prev];
            updated[index] = nextState;
            return updated;
        });
    };

    const handleHumanFuelChange = (delta: number) => {
        saveHistory();
        setHumanPlayerFuelScored(prev => Math.max(0, prev + delta));
    };

    const handleSubmit = async () => {
        if (!scouterName || !superPosition || matchNumber == undefined) {
            alert('Missing scouter name, position, or match number.');
            return;
        }
        if (teams.some(team => team.teamNumber === undefined)) {
            alert('Missing team numbers.');
            return;
        }

        const humanTeamNumber =
            humanPlayerIndex != null ? teams[humanPlayerIndex]?.teamNumber : undefined;

        const data = teams.map(
            (team, index) =>
                ({
                    metadata: {
                        scouterName,
                        matchNumber,
                        robotTeam: team.teamNumber!,
                        robotPosition: alliancePositions[index],
                    },
                    fouls: team.fouls,
                    breaks: team.breaks,
                    defenseProvided: team.defenseProvided,
                    defenseReceived: team.defenseReceived,
                    comments: team.comments.map(option => option.value),
                    humanPlayerFuelScored:
                        team.teamNumber === humanTeamNumber
                            ? humanPlayerFuelScored
                            : 0,
                }) satisfies SuperData
        );

        data.forEach(entry => sendQueue('/data/super', entry));
        setTeams(
            Array.from({ length: allianceSize }, () =>
                cloneTeamState(defaultSuperTeamState)
            )
        );
        setHumanPlayerFuelScored(0);
        setHumanPlayerIndex(null);
        setHistory([]);
        setMatchNumber(matchNumber + 1);
        setShowCheck(true);
        setTimeout(() => {
            setShowCheck(false);
        }, 3000);
    };

    useEffect(() => {
        if (!schedule || !superPosition || !matchNumber) {
            setTeams(prev =>
                prev.map(team => ({ ...team, teamNumber: undefined }))
            );
            return;
        }
        const blueAlliance = superPosition === 'blue_ss';
        const positions = getAlliancePositions(blueAlliance ? 'blue' : 'red');
        setTeams(prev =>
            prev.map((team, index) => ({
                ...team,
                teamNumber: schedule[matchNumber]?.[positions[index]],
            }))
        );
    }, [matchNumber, superPosition]);

    const undoHistoryCount = () => {
        if (history.length === 0) return;
        const last = history.at(-1)!;
        setTeams(last.teams.map(cloneTeamState));
        setHumanPlayerFuelScored(last.humanPlayerFuelScored);
        setHumanPlayerIndex(last.humanPlayerIndex);
        setHistory(prev => prev.slice(0, -1));
    };

    return (
        <div className='min-h-screen bg-[#171c26] text-white'>
            {showCheck && (
                <MaterialSymbol
                    icon='check'
                    size={120}
                    fill
                    grade={200}
                    color='#48c55c'
                    className='fixed right-6 top-6 z-30'
                />
            )}
            <main className='mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-12 pt-8'>
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
                                            scouterName && superPosition
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
                                    robotPosition={superPosition}
                                    onChangeRobotPosition={setSuperPosition}
                                    superScouting
                                    onSubmit={close}
                                />
                            )}
                        </Dialog>

                        <button
                            onClick={undoHistoryCount}
                            className='rounded-lg bg-[#f07800] px-3 py-2 text-black transition hover:brightness-105 active:scale-[0.98]'>
                            <MaterialSymbol
                                icon='undo'
                                size={32}
                                fill
                                grade={200}
                                color='black'
                            />
                        </button>
                    </div>
                    <div className='text-right'>
                        <h1 className='text-2xl font-semibold text-[#48c55c]'>
                            Super Scouting App
                        </h1>
                        <p className='text-sm text-gray-300'>
                            {scouterName || 'Scouter'}{' '}
                            {superPosition ? `(${superPosition})` : ''}
                        </p>
                    </div>
                </div>

                <section className={sectionClass}>
                    <p className='text-sm uppercase tracking-wide text-gray-300'>
                        Match Number
                    </p>
                    <NumberInput
                        onChange={setMatchNumber}
                        value={matchNumber}
                        min={0}
                        className='mt-2 w-40 rounded-lg border border-gray-700 bg-white px-3 py-2 text-black focus:border-[#48c55c] focus:outline-none focus:ring-2 focus:ring-[#48c55c]/30'
                    />
                </section>

                <section className={sectionClass}>
                    <div className='grid gap-4 md:grid-cols-2'>
                        <div>
                            <p className='text-sm uppercase tracking-wide text-gray-300'>
                                Human Player Fuel
                            </p>
                            <div className='mt-2 flex gap-2'>
                                <HoldButton
                                    onHold={() => handleHumanFuelChange(-1)}
                                    ariaLabel='Decrease human player fuel'
                                    className='flex-1 rounded-lg bg-gray-700 px-4 py-3 text-lg font-semibold text-white transition hover:bg-gray-600 active:scale-[0.98]'
                                >
                                    -1
                                </HoldButton>
                                <HoldButton
                                    onHold={() => handleHumanFuelChange(1)}
                                    ariaLabel='Increase human player fuel'
                                    className='flex-1 rounded-lg bg-[#48c55c] px-4 py-3 text-lg font-semibold text-black transition hover:brightness-105 active:scale-[0.98]'
                                >
                                    +1
                                </HoldButton>
                            </div>
                            <p className='mt-2 text-sm text-gray-300'>
                                Total:{' '}
                                <span className='font-semibold text-white tabular-nums'>
                                    {humanPlayerFuelScored}
                                </span>
                            </p>
                        </div>

                        <div>
                            <p className='text-sm uppercase tracking-wide text-gray-300'>
                                Human Player Team
                            </p>
                            <div className='mt-2 flex flex-wrap gap-2'>
                                <MultiButton
                                    className='w-full max-w-40'
                                    onChange={setHumanPlayerIndex}
                                    values={teams.map((_team, index) => index)}
                                    labels={teams
                                        .map(
                                            (team, index) =>
                                                team.teamNumber ?? `Team ${index + 1}`
                                        )
                                        .map(label => label.toString())}
                                    value={humanPlayerIndex ?? undefined}
                                    selectedClassName='bg-[#48c55c] text-black'
                                    unSelectedClassName='bg-gray-700 text-white'
                                />
                            </div>
                        </div>
                    </div>
                </section>

                <section className='grid gap-6 md:grid-cols-3'>
                    {teams.map((team, index) => (
                        <SuperTeam
                            key={index}
                            teamState={team}
                            setTeamState={value => updateTeam(index, value)}
                        />
                    ))}
                </section>

                <section className={sectionClass}>
                    <button
                        onClick={handleSubmit}
                        className='w-full rounded-lg bg-[#48c55c] px-4 py-3 text-lg font-semibold text-black shadow-lg shadow-black/30 transition hover:brightness-105 active:scale-[0.98]'>
                        Submit
                    </button>
                    <div className='mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-300'>
                        <span>Queue: {queue.length}</span>
                        <button
                            onClick={sendAll}
                            className='rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-black transition hover:brightness-105 active:scale-[0.98]'>
                            {sending ? 'Sending...' : 'Resend All'}
                        </button>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default SuperApp;
