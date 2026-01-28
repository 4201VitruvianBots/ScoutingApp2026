import { MaterialSymbol } from 'react-material-symbols';
import LinkButton from '../../components/LinkButton';
import SignIn from '../../components/SignIn';
import { useEffect, useMemo, useState } from 'react';
import Dialog from '../../components/Dialog';
import { MatchSchedule, SuperData, SuperPosition } from 'requests';
import SuperTeam, { SuperTeamState } from './components/SuperTeam';
import NumberInput from '../../components/NumberInput';
import MultiButton from '../../components/MultiButton';
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
    defenseProvided: 'none',
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
        <main className='min-h-screen bg-[#171c26] text-center text-white'>
            {showCheck && (
                <MaterialSymbol
                    icon='check'
                    size={150}
                    fill
                    grade={200}
                    color='green'
                    className='absolute right-10 top-0 ml-10'
                />
            )}
            <h1 className='col-span-3 p-5 text-3xl font-bold text-[#48c55c]'>
                Super Scouting App
            </h1>

            <div className='fixed left-4 top-4 z-20 flex flex-row gap-3 rounded-md bg-slate-200 p-1'>
                <LinkButton link='/'>
                    <MaterialSymbol
                        icon='home'
                        size={60}
                        fill
                        grade={200}
                        color='green'
                    />
                </LinkButton>

                <Dialog
                    open
                    trigger={open => (
                        <button onClick={open} className='col-span-3'>
                            <MaterialSymbol
                                icon='account_circle'
                                size={60}
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
                    className='z-10 aspect-square rounded bg-[#f07800] p-1 font-bold text-black'>
                    <MaterialSymbol
                        icon='undo'
                        size={60}
                        fill
                        grade={200}
                        color='black'
                    />
                </button>
            </div>

            <div>
                <p className='text-xl text-white'>Match Number</p>
                <NumberInput
                    onChange={setMatchNumber}
                    value={matchNumber}
                    className='m-2 p-2 text-xl text-black'
                />
            </div>

            <p className='mt-10 text-2xl text-white'>Human Player Fuel</p>
            <div className='mx-auto mt-4 flex w-full max-w-md flex-col gap-3 rounded-lg bg-[#2f3646] p-4'>
                <div className='flex justify-between gap-2'>
                    <button
                        className='flex-1 rounded bg-gray-600 px-4 py-3 text-2xl'
                        onClick={() => handleHumanFuelChange(-1)}>
                        -1
                    </button>
                    <button
                        className='flex-1 rounded bg-[#48c55c] px-4 py-3 text-2xl text-black'
                        onClick={() => handleHumanFuelChange(1)}>
                        +1
                    </button>
                </div>
                <p className='text-xl'>Total: {humanPlayerFuelScored}</p>
            </div>

            <p className='pt-5 text-2xl text-white'>Human Player Team</p>
            <div className='mx-auto mt-2 flex flex-wrap justify-center gap-2'>
                <MultiButton
                    className='w-full max-w-40'
                    onChange={setHumanPlayerIndex}
                    values={teams.map((_team, index) => index)}
                    labels={teams.map(
                        (team, index) =>
                            team.teamNumber ?? `Team ${index + 1}`
                    ).map(label => label.toString())}
                    value={humanPlayerIndex ?? undefined}
                    selectedClassName='bg-[#48c55c] text-black'
                    unSelectedClassName='bg-white text-black'
                />
            </div>

            <div className='grid grid-cols-1 gap-10 px-6 py-6 md:grid-cols-3'>
                {teams.map((team, index) => (
                    <SuperTeam
                        key={index}
                        teamState={team}
                        setTeamState={value => updateTeam(index, value)}
                    />
                ))}
            </div>

            <button
                onClick={handleSubmit}
                className='m-5 w-full max-w-80 rounded-md bg-[#48c55c] px-4 py-2 text-lg text-black'>
                Submit
            </button>

            <div>
                <div className='text-white'>Queue: {queue.length}</div>
                <button
                    onClick={sendAll}
                    className='rounded-md bg-amber-500 px-2 py-1 text-center'>
                    {sending ? 'Sending...' : 'Resend All'}
                </button>
            </div>
        </main>
    );
}

export default SuperApp;
