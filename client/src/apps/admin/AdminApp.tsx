import { useEffect, useMemo, useState } from 'react';
import { MaterialSymbol } from 'react-material-symbols';
import {
    AllianceColor,
    AutoFieldOrientationSetting,
    BallsPerSecondSetting,
    FieldOrientation,
    MatchSchedule,
    RobotPosition,
    TabletAssignmentSetting,
} from 'requests';
import LinkButton from '../../components/LinkButton';
import NumberInput from '../../components/NumberInput';
import TextInput from '../../components/TextInput';
import { useStatusRecieve } from '../../lib/useStatus';
import { useFetchJson } from '../../lib/useFetch';
import { MatchTable } from './components/MatchTable';
import { ScouterTable } from './components/ScouterTable';
import scheduleFile from '../../assets/matchSchedule.json';
import { getAlliancePositions } from '../../lib/gameConfig';

const DEFAULT_BALLS_PER_SECOND = 5;
const defaultOrientationMap: Record<AllianceColor, FieldOrientation> = {
    red: 'orientation1',
    blue: 'orientation1',
};
const fieldPreviewImageBySide: Record<AllianceColor, string> = {
    red: '/redsidematch.png',
    blue: '/bluesidematch.png',
};

type MatchScheduleMap = MatchSchedule;

function keyFor(matchNumber: number, robotTeam: number) {
    return `${matchNumber}-${robotTeam}`;
}

function AdminApp() {
    const status = useStatusRecieve();
    const [configRows, reloadConfigRows] = useFetchJson<BallsPerSecondSetting[]>(
        '/config/balls-per-second',
        []
    );
    const [orientationRows, reloadOrientationRows] = useFetchJson<
        AutoFieldOrientationSetting[]
    >('/config/auto-field-orientation', []);
    const [tabletAssignmentRows, reloadTabletAssignmentRows] = useFetchJson<
        TabletAssignmentSetting[]
    >('/config/tablet-assignments', []);

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
    const [orientationSaving, setOrientationSaving] = useState<
        Partial<Record<AllianceColor, boolean>>
    >({});
    const [assignmentDraftByPosition, setAssignmentDraftByPosition] = useState<
        Partial<Record<RobotPosition, string>>
    >({});
    const [assignmentSaving, setAssignmentSaving] = useState(false);
    const [assignmentError, setAssignmentError] = useState<string | undefined>();
    const [assignmentNotice, setAssignmentNotice] = useState<string | undefined>();
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
    const orientationMap = useMemo(() => {
        const next = { ...defaultOrientationMap };
        orientationRows.forEach(row => {
            if (row.side === 'red' || row.side === 'blue') {
                if (
                    row.orientation === 'orientation1' ||
                    row.orientation === 'orientation2'
                ) {
                    next[row.side] = row.orientation;
                }
            }
        });
        return next;
    }, [orientationRows]);

    const orderedPositions = useMemo(
        () =>
            [
                ...getAlliancePositions('red'),
                ...getAlliancePositions('blue'),
            ] satisfies RobotPosition[],
        []
    );
    const orderedPositionSet = useMemo(
        () => new Set<RobotPosition>(orderedPositions),
        [orderedPositions]
    );

    const selectedTeams = useMemo(() => {
        if (selectedMatch == undefined) return [];
        return orderedPositions
            .map(position => ({
                position,
                robotTeam: schedule[selectedMatch]?.[position],
            }))
            .filter(entry => entry.robotTeam != undefined) as Array<{
            position: RobotPosition;
            robotTeam: number;
        }>;
    }, [orderedPositions, schedule, selectedMatch]);

    useEffect(() => {
        const next: Partial<Record<RobotPosition, string>> = {};
        tabletAssignmentRows.forEach(row => {
            if (
                row.tabletId &&
                row.robotPosition &&
                orderedPositionSet.has(row.robotPosition)
            ) {
                next[row.robotPosition] = row.tabletId;
            }
        });
        setAssignmentDraftByPosition(next);
    }, [orderedPositionSet, tabletAssignmentRows]);

    const connectedTabletIds = useMemo(
        () =>
            [
                ...new Set(
                    status.scouters
                        .map(row => String(row.tabletId ?? '').trim())
                        .filter(Boolean)
                ),
            ].sort((a, b) => a.localeCompare(b)),
        [status.scouters]
    );

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

    const saveOrientation = async (
        side: AllianceColor,
        orientation: FieldOrientation
    ) => {
        setOrientationSaving(prev => ({ ...prev, [side]: true }));
        try {
            await fetch('/config/auto-field-orientation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ side, orientation }),
            });
            reloadOrientationRows();
        } finally {
            setOrientationSaving(prev => ({ ...prev, [side]: false }));
        }
    };

    const positionLabel = (position: RobotPosition) => {
        const [alliance, slot] = position.split('_');
        return `${alliance.charAt(0).toUpperCase()}${alliance.slice(1)} ${slot}`;
    };

    const saveTabletAssignments = async () => {
        setAssignmentError(undefined);
        setAssignmentNotice(undefined);

        const payload = orderedPositions
            .map(position => ({
                robotPosition: position,
                tabletId: (assignmentDraftByPosition[position] ?? '').trim(),
            }))
            .filter(row => row.tabletId !== '');

        const seen = new Set<string>();
        for (const row of payload) {
            if (seen.has(row.tabletId)) {
                setAssignmentError(
                    `Tablet "${row.tabletId}" is assigned more than once.`
                );
                return;
            }
            seen.add(row.tabletId);
        }

        setAssignmentSaving(true);
        try {
            const response = await fetch('/config/tablet-assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const message = (await response.text()) || 'Failed to save tablet assignments';
                throw new Error(message);
            }

            reloadTabletAssignmentRows();
            setAssignmentNotice('Tablet assignments saved.');
        } catch (error) {
            setAssignmentError(
                error instanceof Error
                    ? error.message
                    : 'Failed to save tablet assignments.'
            );
        } finally {
            setAssignmentSaving(false);
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
                                reloadOrientationRows();
                                reloadTabletAssignmentRows();
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
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                        <h2 className='text-lg font-semibold text-[#48c55c]'>
                            Tablet Slot Assignment
                        </h2>
                        <p className='text-xs text-gray-300'>
                            Assign tablet IDs to Red 1-3 and Blue 1-3.
                        </p>
                    </div>
                    <datalist id='tablet-id-suggestions'>
                        {connectedTabletIds.map(tabletId => (
                            <option key={tabletId} value={tabletId} />
                        ))}
                    </datalist>
                    <div className='mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3'>
                        {orderedPositions.map(position => {
                            const liveScouters = status.scouters.filter(
                                row => row.robotPosition === position
                            );
                            return (
                                <div
                                    key={`assignment-${position}`}
                                    className='rounded-lg border border-white/10 bg-[#131b2a] p-3'>
                                    <p className='text-xs uppercase tracking-wide text-gray-400'>
                                        {positionLabel(position)}
                                    </p>
                                    <TextInput
                                        value={assignmentDraftByPosition[position] ?? ''}
                                        onChange={value => {
                                            setAssignmentNotice(undefined);
                                            setAssignmentError(undefined);
                                            setAssignmentDraftByPosition(prev => ({
                                                ...prev,
                                                [position]: value,
                                            }));
                                        }}
                                        list='tablet-id-suggestions'
                                        placeholder='tablet-id'
                                        className='mt-2 w-full rounded border border-white/20 bg-[#0f1522] px-2 py-1.5 text-sm text-white'
                                    />
                                    <p className='mt-2 text-[11px] text-gray-300'>
                                        Live: {liveScouters.length === 0
                                            ? 'None'
                                            : liveScouters
                                                  .map(row => row.tabletId || 'unknown')
                                                  .join(', ')}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                    <div className='mt-4 flex flex-wrap items-center justify-between gap-2'>
                        <div className='text-xs'>
                            {assignmentError && (
                                <p className='text-red-300'>{assignmentError}</p>
                            )}
                            {!assignmentError && assignmentNotice && (
                                <p className='text-[#7fe28e]'>{assignmentNotice}</p>
                            )}
                            {connectedTabletIds.length > 0 && (
                                <p className='text-gray-300'>
                                    Connected IDs: {connectedTabletIds.join(', ')}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={saveTabletAssignments}
                            disabled={assignmentSaving}
                            className='rounded-lg bg-[#48c55c] px-4 py-2 font-semibold text-black transition hover:brightness-105 disabled:opacity-40'>
                            {assignmentSaving ? 'Saving...' : 'Save Tablet Assignments'}
                        </button>
                    </div>
                </section>

                <section className='rounded-xl border border-white/10 bg-[#1c2434] p-4'>
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                        <h2 className='text-lg font-semibold text-[#48c55c]'>
                            Auto Field Orientation
                        </h2>
                        <p className='text-xs text-gray-300'>
                            Orientation 1 = current image, Orientation 2 = horizontal flip
                        </p>
                    </div>
                    <div className='mt-4 grid gap-4 lg:grid-cols-2'>
                        {(['red', 'blue'] as const).map(side => {
                            const orientation = orientationMap[side];
                            const flipped = orientation === 'orientation2';
                            const savingSide = orientationSaving[side] === true;
                            return (
                                <div
                                    key={side}
                                    className='rounded-lg border border-white/10 bg-[#131b2a] p-3'>
                                    <div className='flex items-center justify-between gap-2'>
                                        <p className='text-sm font-semibold text-white'>
                                            {side.toUpperCase()} Scouter Side
                                        </p>
                                        <p className='text-xs text-gray-300'>
                                            Active: {orientation}
                                        </p>
                                    </div>
                                    <div className='mt-2 flex flex-wrap gap-2'>
                                        {(['orientation1', 'orientation2'] as const).map(
                                            option => (
                                                <button
                                                    key={`${side}-${option}`}
                                                    onClick={() =>
                                                        saveOrientation(side, option)
                                                    }
                                                    disabled={savingSide}
                                                    className={`rounded px-3 py-1.5 text-xs font-semibold ${
                                                        orientation === option
                                                            ? 'bg-[#48c55c] text-black'
                                                            : 'bg-[#2c374d] text-white'
                                                    }`}>
                                                    {option === 'orientation1'
                                                        ? 'Orientation 1'
                                                        : 'Orientation 2'}
                                                </button>
                                            )
                                        )}
                                    </div>
                                    <div className='mt-3 overflow-hidden rounded border border-white/10 bg-[#0f1522] p-2'>
                                        <img
                                            src={fieldPreviewImageBySide[side]}
                                            alt={`${side} auto field preview`}
                                            className='w-full select-none rounded'
                                            draggable={false}
                                            style={{
                                                transform: flipped
                                                    ? 'scaleX(-1)'
                                                    : 'scaleX(1)',
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
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
