import { Dispatch } from 'react';
import {
    CommentValues,
    DefenseProvided,
    SuperBreaks,
    SuperFouls,
} from 'requests';
import MultiButton from '../../../components/MultiButton';
import Checkbox from '../../../components/Checkbox';
import TeamDropdown from '../../../components/TeamDropdown';
import CannedCommentBox, { SelectOption } from './CannedComments';
import HoldButton from '../../../components/HoldButton';

export interface SuperTeamState {
    fouls: SuperFouls;
    breaks: SuperBreaks;
    defenseProvided: DefenseProvided;
    defenseReceived: boolean;
    teamNumber: number | undefined;
    comments: SelectOption<CommentValues>[];
}

const foulLabels: Array<{ key: keyof SuperFouls; label: string }> = [
    { key: 'pinning', label: 'Pinning' },
    { key: 'towerContactInEndgame', label: 'Tower Contact (Endgame)' },
    { key: 'outOfZoneShooting', label: 'Out-of-Zone Shooting' },
    { key: 'ejectedFuel', label: 'Ejected Fuel' },
    { key: 'other', label: 'Other' },
];

const breakLabels: Array<{ key: keyof SuperBreaks; label: string }> = [
    { key: 'mechanism', label: 'Mechanism' },
    { key: 'battery', label: 'Battery' },
    { key: 'comms', label: 'Comms' },
    { key: 'bumper', label: 'Bumper' },
];

function SuperTeam({
    teamState,
    setTeamState,
    bgClass,
}: {
    teamState: SuperTeamState;
    setTeamState: Dispatch<SuperTeamState>;
    bgClass?: string;
}) {
    const cardClass =
        bgClass ??
        'rounded-xl border border-white/10 bg-[#2f3646] p-5 shadow-lg shadow-black/20';

    const handleDefense = (newDefense: DefenseProvided) => {
        setTeamState({ ...teamState, defenseProvided: newDefense });
    };

    const handleWasDefended = (newDefended: boolean) => {
        setTeamState({ ...teamState, defenseReceived: newDefended });
    };

    const handleChangeTeam = (newChangeTeam: number) => {
        setTeamState({ ...teamState, teamNumber: newChangeTeam });
    };

    const handleAddComment = (comments: SelectOption<CommentValues>[]) => {
        setTeamState({ ...teamState, comments });
    };

    const handleIncreaseFoul = (foulType: keyof SuperFouls) => {
        setTeamState({
            ...teamState,
            fouls: {
                ...teamState.fouls,
                [foulType]: teamState.fouls[foulType] + 1,
            },
        });
    };

    const handleDecreaseFoul = (foulType: keyof SuperFouls) => {
        if (teamState.fouls[foulType] === 0) return;
        setTeamState({
            ...teamState,
            fouls: {
                ...teamState.fouls,
                [foulType]: teamState.fouls[foulType] - 1,
            },
        });
    };

    const handleIncreaseBreak = (breakType: keyof SuperBreaks) => {
        setTeamState({
            ...teamState,
            breaks: {
                ...teamState.breaks,
                [breakType]: teamState.breaks[breakType] + 1,
            },
        });
    };

    const handleDecreaseBreak = (breakType: keyof SuperBreaks) => {
        if (teamState.breaks[breakType] === 0) return;
        setTeamState({
            ...teamState,
            breaks: {
                ...teamState.breaks,
                [breakType]: teamState.breaks[breakType] - 1,
            },
        });
    };

    return (
        <section className={cardClass}>
            <div className='flex flex-col gap-4'>
                <div>
                    <p className='text-xs uppercase tracking-wide text-gray-300'>
                        Team Number
                    </p>
                    <div className='mt-2'>
                        <TeamDropdown
                            value={teamState.teamNumber}
                            onChange={handleChangeTeam}
                            allowAbsent
                        />
                    </div>
                </div>
                <div>
                    <p className='text-xs uppercase tracking-wide text-gray-300'>
                        Notes
                    </p>
                    <div className='mt-2'>
                        <CannedCommentBox
                            value={teamState.comments}
                            onChange={handleAddComment}
                        />
                    </div>
                </div>
            </div>

            <div className='mt-5'>
                <p className='text-xs uppercase tracking-wide text-gray-300'>
                    Defense
                </p>
                <div className='mt-2 flex flex-wrap gap-2'>
                    <MultiButton
                        onChange={handleDefense}
                        value={teamState.defenseProvided}
                        labels={['None', 'Some', 'Heavy']}
                        values={['None', 'some', 'heavy']}
                        className='w-full sm:w-auto'
                        selectedClassName='bg-[#48c55c] text-black'
                        unSelectedClassName='bg-gray-700 text-white'
                    />
                </div>
                <div className='mt-2'>
                    <Checkbox
                        className='text-sm text-white'
                        boxClassName='size-5'
                        checked={teamState.defenseReceived}
                        onChange={handleWasDefended}>
                        <span className='absolute ml-1 botton-1'>Was Defended?</span>
                    </Checkbox>
                </div>
            </div>

            <div className='mt-6'>
                <p className='text-xs uppercase tracking-wide text-gray-300'>
                    Fouls
                </p>
                <div className='mt-2 grid gap-2'>
                    {foulLabels.map(foul => (
                        <div className='flex items-center gap-2' key={foul.key}>
                            <HoldButton
                                onHold={() => handleDecreaseFoul(foul.key)}
                                ariaLabel={`Decrease ${foul.label}`}
                                className='rounded-lg border border-white/10 bg-red-500/80 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-500 active:scale-[0.98]'
                            >
                                -
                            </HoldButton>
                            <HoldButton
                                onHold={() => handleIncreaseFoul(foul.key)}
                                ariaLabel={`Increase ${foul.label}`}
                                className='flex-1 rounded-lg border border-white/10 bg-slate-700 px-3 py-2 text-left text-sm text-white transition hover:bg-slate-600 active:scale-[0.98]'
                            >
                                + {foul.label}:{' '}
                                <span className='ml-1 font-semibold tabular-nums'>
                                    {teamState.fouls[foul.key]}
                                </span>
                            </HoldButton>
                        </div>
                    ))}
                </div>
            </div>

            <div className='mt-6'>
                <p className='text-xs uppercase tracking-wide text-gray-300'>
                    Breaks
                </p>
                <div className='mt-2 grid gap-2'>
                    {breakLabels.map(breakEntry => (
                        <div className='flex items-center gap-2' key={breakEntry.key}>
                            <HoldButton
                                onHold={() => handleDecreaseBreak(breakEntry.key)}
                                ariaLabel={`Decrease ${breakEntry.label}`}
                                className='rounded-lg border border-white/10 bg-red-500/80 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-500 active:scale-[0.98]'
                            >
                                -
                            </HoldButton>
                            <HoldButton
                                onHold={() => handleIncreaseBreak(breakEntry.key)}
                                ariaLabel={`Increase ${breakEntry.label}`}
                                className='flex-1 rounded-lg border border-white/10 bg-slate-700 px-3 py-2 text-left text-sm text-white transition hover:bg-slate-600 active:scale-[0.98]'
                            >
                                + {breakEntry.label}:{' '}
                                <span className='ml-1 font-semibold tabular-nums'>
                                    {teamState.breaks[breakEntry.key]}
                                </span>
                            </HoldButton>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default SuperTeam;
