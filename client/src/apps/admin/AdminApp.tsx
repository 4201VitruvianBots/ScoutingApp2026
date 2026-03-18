import { useEffect, useMemo, useState } from 'react';
import { MaterialSymbol } from 'react-material-symbols';
import { BallsPerSecondSetting } from 'requests';
import LinkButton from '../../components/LinkButton';
import NumberInput from '../../components/NumberInput';
import { useStatusRecieve } from '../../lib/useStatus';
import { useFetchJson } from '../../lib/useFetch';
import { MatchTable } from './components/MatchTable';
import { ScouterTable } from './components/ScouterTable';
import scheduleFile from '../../assets/matchSchedule.json';
import { getAlliancePositions } from '../../lib/gameConfig';

const DEFAULT_BALLS_PER_SECOND = 5;

type MatchScheduleMap = Record<number, Partial<Record<string, number>>>;

function keyFor(matchNumber: number, robotTeam: number) {
    return `${matchNumber}-${robotTeam}`;
}

function AdminApp() {
    const status = useStatusRecieve();
    const [configRows, reloadConfigRows] = useFetchJson<BallsPerSecondSetting[]>(
        '/config/balls-per-second',
        []
    );

    const schedule = scheduleFile as MatchScheduleMap;
    const matchNumbers = useMemo(
        () =>
            Object.keys(schedule)
                .map(value => Number(value))
                .filter(value => Number.isFinite(value))
                .sort((a, b) => a - b),
        [schedule]
    );

    const [selectedMatch, setSelectedMatch] = useState<number | undefined>(
        matchNumbers[0]
    );
    const [draftValues, setDraftValues] = useState<Record<string, number>>({});
    const [saving, setSaving] = useState(false);
    const [showLegacy, setShowLegacy] = useState(false);

    useEffect(() => {
        if (selectedMatch == undefined && matchNumbers.length > 0) {
            setSelectedMatch(matchNumbers[0]);
        }
    }, [matchNumbers, selectedMatch]);

    const configMap = useMemo(
        () =>
            new Map(
                configRows.map(row => [
                    keyFor(row.matchNumber, row.robotTeam),
                    row.ballsPerSecond,
                ])
            ),
        [configRows]
    );

    const orderedPositions = useMemo(
        () => [...getAlliancePositions('red'), ...getAlliancePositions('blue')],
        []
    );

    const selectedTeams = useMemo(() => {
        if (selectedMatch == undefined) return [];
        return orderedPositions
            .map(position => ({
                position,
                robotTeam: schedule[selectedMatch]?.[position],
            }))
            .filter(entry => entry.robotTeam != undefined) as Array<{
            position: string;
            robotTeam: number;
        }>;
    }, [orderedPositions, schedule, selectedMatch]);

    const getValue = (matchNumber: number, robotTeam: number) => {
        const key = keyFor(matchNumber, robotTeam);
        return draftValues[key] ?? configMap.get(key) ?? DEFAULT_BALLS_PER_SECOND;
    };

    const setValue = (matchNumber: number, robotTeam: number, value: number | undefined) => {
        const normalized =
            value == undefined || Number.isNaN(value) ? 0 : Math.max(0, value);
        const key = keyFor(matchNumber, robotTeam);
        setDraftValues(prev => ({
            ...prev,
            [key]: normalized,
        }));
    };

    const saveSelectedMatch = async () => {
        if (selectedMatch == undefined || selectedTeams.length === 0) return;
        setSaving(true);
        try {
            const payloads = selectedTeams.map(team => ({
                matchNumber: selectedMatch,
                robotTeam: team.robotTeam,
                ballsPerSecond: getValue(selectedMatch, team.robotTeam),
            }));

            await Promise.all(
                payloads.map(payload =>
                    fetch('/config/balls-per-second', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    })
                )
            );

            setDraftValues(prev => {
                const next = { ...prev };
                payloads.forEach(payload => {
                    delete next[keyFor(payload.matchNumber, payload.robotTeam)];
                });
                return next;
            });
            reloadConfigRows();
        } finally {
            setSaving(false);
        }
    };

    const selectedMatchIndex =
        selectedMatch == undefined
            ? -1
            : matchNumbers.findIndex(matchNumber => matchNumber === selectedMatch);

    if (showLegacy) {
        return (
            <main className='min-h-screen bg-[#0f1622] px-6 py-8 text-white'>
                <div className='mx-auto max-w-7xl space-y-6'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <div className='flex items-center gap-2'>
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
                            <button
                                className='rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10'
                                onClick={() => setShowLegacy(false)}>
                                Back To Modern Admin
                            </button>
                        </div>
                        <h1 className='text-2xl font-semibold text-[#48c55c]'>
                            Existing Admin Board
                        </h1>
                    </div>
                    <div className='grid gap-4 lg:grid-cols-[1fr_1.2fr]'>
                        <section className='rounded-xl border border-white/10 bg-[#1c2434] p-4'>
                            <ScouterTable scouters={status.scouters} />
                        </section>
                        <section className='rounded-xl border border-white/10 bg-[#1c2434] p-4'>
                            <div className='max-h-[72vh] overflow-auto'>
                                <MatchTable matches={status.matches} />
                            </div>
                        </section>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className='min-h-screen bg-gradient-to-b from-[#101620] via-[#0e141d] to-[#0b1018] px-6 py-8 text-white'>
            <div className='mx-auto flex w-full max-w-7xl flex-col gap-6'>
                <div className='flex flex-wrap items-center justify-between gap-4'>
                    <div className='flex items-center gap-2'>
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
                        <button
                            onClick={() => {
                                reloadConfigRows();
                            }}
                            className='rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10'>
                            Refresh Config
                        </button>
                        <button
                            onClick={() => setShowLegacy(true)}
                            className='rounded-lg border border-[#48c55c]/40 bg-[#48c55c]/10 px-3 py-2 text-sm text-[#7fe28e] hover:bg-[#48c55c]/20'>
                            View Existing Admin Board
                        </button>
                    </div>
                    <div className='text-right'>
                        <h1 className='text-3xl font-bold text-[#48c55c]'>Admin Control Center</h1>
                        <p className='text-sm text-gray-300'>
                            Live operations + balls/sec calibration
                        </p>
                    </div>
                </div>

                <section className='grid gap-4 md:grid-cols-3'>
                    <div className='rounded-xl border border-white/10 bg-[#1c2434] p-4'>
                        <p className='text-xs uppercase text-gray-400'>Connected Tablets</p>
                        <p className='text-2xl font-semibold text-white'>
                            {status.scouters.length}
                        </p>
                    </div>
                    <div className='rounded-xl border border-white/10 bg-[#1c2434] p-4'>
                        <p className='text-xs uppercase text-gray-400'>Tracked Matches</p>
                        <p className='text-2xl font-semibold text-white'>
                            {Object.keys(status.matches).length}
                        </p>
                    </div>
                    <div className='rounded-xl border border-white/10 bg-[#1c2434] p-4'>
                        <p className='text-xs uppercase text-gray-400'>Saved Balls/Sec Rows</p>
                        <p className='text-2xl font-semibold text-white'>{configRows.length}</p>
                    </div>
                </section>

                <section className='grid gap-4 lg:grid-cols-[1fr_1.2fr]'>
                    <div className='rounded-xl border border-white/10 bg-[#1c2434] p-4'>
                        <h2 className='text-lg font-semibold text-[#48c55c]'>Scouter Status</h2>
                        <div className='mt-3'>
                            <ScouterTable scouters={status.scouters} />
                        </div>
                    </div>
                    <div className='rounded-xl border border-white/10 bg-[#1c2434] p-4'>
                        <h2 className='text-lg font-semibold text-[#48c55c]'>Match Coverage</h2>
                        <div className='mt-3 max-h-[58vh] overflow-auto rounded-lg border border-white/10'>
                            <MatchTable matches={status.matches} />
                        </div>
                    </div>
                </section>

                <section className='rounded-xl border border-white/10 bg-[#1c2434] p-4'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <h2 className='text-lg font-semibold text-[#48c55c]'>
                            Balls Per Second Config
                        </h2>
                        <div className='flex items-center gap-2'>
                            <button
                                className='rounded border border-white/20 px-2 py-1 text-sm hover:bg-white/10 disabled:opacity-40'
                                disabled={selectedMatchIndex <= 0}
                                onClick={() => {
                                    if (selectedMatchIndex > 0) {
                                        setSelectedMatch(matchNumbers[selectedMatchIndex - 1]);
                                    }
                                }}>
                                Prev
                            </button>
                            <NumberInput
                                value={selectedMatch}
                                onChange={value =>
                                    setSelectedMatch(
                                        value == undefined ? undefined : Math.max(0, value)
                                    )
                                }
                                className='w-24 rounded border border-white/20 bg-[#111827] px-2 py-1 text-sm text-white'
                            />
                            <button
                                className='rounded border border-white/20 px-2 py-1 text-sm hover:bg-white/10 disabled:opacity-40'
                                disabled={
                                    selectedMatchIndex < 0 ||
                                    selectedMatchIndex >= matchNumbers.length - 1
                                }
                                onClick={() => {
                                    if (
                                        selectedMatchIndex >= 0 &&
                                        selectedMatchIndex < matchNumbers.length - 1
                                    ) {
                                        setSelectedMatch(matchNumbers[selectedMatchIndex + 1]);
                                    }
                                }}>
                                Next
                            </button>
                        </div>
                    </div>

                    <p className='mt-2 text-sm text-gray-300'>
                        Match scouts hold the shooting button; backend estimates scored balls as
                        hold-time multiplied by this value.
                    </p>

                    <div className='mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                        {selectedTeams.map(team => (
                            <div
                                key={team.position}
                                className='rounded-lg border border-white/10 bg-[#131b2a] p-3'>
                                <p className='text-xs uppercase text-gray-400'>{team.position}</p>
                                <p className='text-lg font-semibold text-white'>
                                    Team {team.robotTeam}
                                </p>
                                <div className='mt-2 flex items-center gap-2'>
                                    <span className='text-sm text-gray-300'>Balls/sec</span>
                                    <NumberInput
                                        value={getValue(selectedMatch ?? 0, team.robotTeam)}
                                        onChange={value =>
                                            setValue(selectedMatch ?? 0, team.robotTeam, value)
                                        }
                                        min={0}
                                        step={0.1}
                                        className='w-24 rounded border border-white/20 bg-[#0f1522] px-2 py-1 text-sm text-white'
                                    />
                                </div>
                            </div>
                        ))}
                        {selectedTeams.length === 0 && (
                            <p className='text-sm text-gray-300'>
                                No teams scheduled for this match.
                            </p>
                        )}
                    </div>

                    <div className='mt-4 flex justify-end'>
                        <button
                            onClick={saveSelectedMatch}
                            disabled={saving || selectedTeams.length === 0}
                            className='rounded-lg bg-[#48c55c] px-4 py-2 font-semibold text-black transition hover:brightness-105 disabled:opacity-40'>
                            {saving ? 'Saving...' : 'Save Match Config'}
                        </button>
                    </div>
                </section>
            </div>
        </main>
    );
}

export default AdminApp;
