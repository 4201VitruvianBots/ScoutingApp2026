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
        <div className={bgClass}>
            <div className='mx-auto flex flex-col content-center items-center justify-center p-5'>
                <p className='pt-3 text-lg text-zinc-100 underline'>
                    Team Number
                </p>
                <TeamDropdown
                    value={teamState.teamNumber}
                    onChange={handleChangeTeam}
                    allowAbsent
                />

                <p className='pt-3 text-lg text-zinc-100 underline'>Notes</p>
                <CannedCommentBox
                    value={teamState.comments}
                    onChange={handleAddComment}
                />
            </div>

            <p className='mt-5 text-2xl text-zinc-100 underline'>Defense</p>
            <MultiButton
                onChange={handleDefense}
                value={teamState.defenseProvided}
                labels={['None', 'Some', 'Heavy']}
                values={['none', 'some', 'heavy']}
                className='my-2 w-full text-black'
                selectedClassName='bg-[#48c55c] text-black'
                unSelectedClassName='bg-gray-300 text-black'
            />
            <div>
                <Checkbox
                    className='text-lg text-white'
                    boxClassName='size-5'
                    checked={teamState.defenseReceived}
                    onChange={handleWasDefended}>
                    Was Defended?
                </Checkbox>
            </div>

            <p className='mt-6 text-2xl text-zinc-100 underline'>Fouls</p>
            {foulLabels.map(foul => (
                <div className='flex justify-center gap-2 py-2' key={foul.key}>
                    <button
                        className='rounded-md border bg-red-400 px-3 py-2 text-lg text-zinc-100'
                        onClick={() => handleDecreaseFoul(foul.key)}>
                        -
                    </button>
                    <button
                        className='w-64 rounded-md border bg-slate-600 px-3 py-2 text-left text-lg text-zinc-100'
                        onClick={() => handleIncreaseFoul(foul.key)}>
                        + {foul.label}: {teamState.fouls[foul.key]}
                    </button>
                </div>
            ))}

            <p className='mt-6 text-2xl text-zinc-100 underline'>Breaks</p>
            {breakLabels.map(breakEntry => (
                <div
                    className='flex justify-center gap-2 py-2'
                    key={breakEntry.key}>
                    <button
                        className='rounded-md border bg-red-400 px-3 py-2 text-lg text-zinc-100'
                        onClick={() => handleDecreaseBreak(breakEntry.key)}>
                        -
                    </button>
                    <button
                        className='w-64 rounded-md border bg-slate-600 px-3 py-2 text-left text-lg text-zinc-100'
                        onClick={() => handleIncreaseBreak(breakEntry.key)}>
                        + {breakEntry.label}: {teamState.breaks[breakEntry.key]}
                    </button>
                </div>
            ))}
        </div>
    );
}

export default SuperTeam;
