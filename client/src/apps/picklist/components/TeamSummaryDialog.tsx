import { Dispatch, useState } from 'react';
import { AnalysisEntry, TeamSummaryData } from '../data';
import TextInput from '../../../components/TextInput';
import SelectSearch from 'react-select-search';
import { MaterialSymbol } from 'react-material-symbols';

function TeamSummaryDialog({
    onSubmit,
    onClose,
    data,
}: {
    onSubmit: Dispatch<TeamSummaryData>;
    onClose?: () => void;
    data: AnalysisEntry[] | undefined;
}) {
    const teamNumbers = (data ?? [])
        .map(entry => entry.teamNumber.toString())
        .sort((a, b) => Number(a) - Number(b));

    const [title, setTitle] = useState('');
    const [teamNumber, setTeamNumber] = useState<string>();

    const handleSubmit = () => {
        if (!teamNumber) return;
        onSubmit({
            title: title || `Team ${teamNumber} Summary`,
            teamNumber: Number(teamNumber),
            type: 'TeamSummary',
        });
        onClose?.();
    };

    return (
        <div className='space-y-3 rounded-xl border border-white/15 bg-[#202736] p-3 text-white'>
            <div className='flex items-center justify-between'>
                <h2 className='text-lg font-semibold'>Team Summary</h2>
                <button
                    onClick={onClose}
                    className='rounded-full p-1 text-gray-300 transition hover:bg-white/10 hover:text-white'>
                    <MaterialSymbol icon='close' />
                </button>
            </div>

            <label className='block text-sm font-medium text-gray-200'>
                Team
                <SelectSearch
                    options={teamNumbers.map(team => ({
                        value: team,
                        name: team,
                    }))}
                    value={teamNumber}
                    placeholder='Select team'
                    onChange={value => setTeamNumber(value as string)}
                    search
                />
            </label>

            <label className='block text-sm font-medium text-gray-200'>
                Title
                <TextInput
                    value={title}
                    onChange={setTitle}
                    placeholder={
                        teamNumber ? `Team ${teamNumber} Summary` : 'Team Summary'
                    }
                    className='mt-1 w-full rounded border border-white/20 bg-[#0f1420] p-2 text-white'
                />
            </label>

            <button
                onClick={handleSubmit}
                className='rounded bg-[#48c55c] px-3 py-2 font-semibold text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50'
                disabled={!teamNumber}>
                Create
            </button>
        </div>
    );
}

export default TeamSummaryDialog;
