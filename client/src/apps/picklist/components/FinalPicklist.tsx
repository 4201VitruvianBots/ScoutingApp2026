import { Dispatch, useMemo, useState } from 'react';
import { MaterialSymbol } from 'react-material-symbols';
import { AnalysisEntry, WindowData } from '../data';
import { TeamData } from 'requests';
import TeamItem from './TeamItem';
import SelectSearch from 'react-select-search';

function FinalPicklist({
    teamInfoJson,
    onSubmit,
    data,
    picklist,
    setPicklist,
}: {
    teamInfoJson: TeamData;
    onSubmit: Dispatch<WindowData>;
    data: AnalysisEntry[] | undefined;
    picklist: number[];
    setPicklist: Dispatch<number[]>;
}) {
    const [expanded, setExpanded] = useState(false);
    const [newTeamNumber, setNewTeamNumber] = useState<string>();

    const teamNumbers = useMemo(
        () => (data ?? []).map(entry => entry.teamNumber.toString()),
        [data]
    );

    function handleRemoveTeam(index: number) {
        setPicklist(picklist.filter((_, pickIndex) => pickIndex !== index));
    }

    function moveTeamNumber(index: number, up: boolean) {
        if (up && index > 0) {
            setPicklist(
                picklist
                    .slice(0, index - 1)
                    .concat(
                        picklist[index]!,
                        picklist[index - 1]!,
                        picklist.slice(index + 1)
                    )
            );
        } else if (!up && index < picklist.length - 1) {
            setPicklist(
                picklist
                    .slice(0, index)
                    .concat(
                        picklist[index + 1]!,
                        picklist[index]!,
                        picklist.slice(index + 2)
                    )
            );
        }
    }

    function addNewTeamNumber(teamNumber: string) {
        if (!teamNumber) return;
        const parsed = Number(teamNumber);
        if (Number.isNaN(parsed) || picklist.includes(parsed)) return;
        setPicklist([...picklist, parsed]);
        setNewTeamNumber(undefined);
    }

    return (
        <div
            className={`absolute bottom-2 right-2 z-30 w-[min(100vw-1rem,420px)] rounded-xl border border-white/20 bg-[#111723]/95 p-2 text-white shadow-xl shadow-black/40 backdrop-blur transition-all ${
                expanded ? 'max-h-[80vh]' : 'max-h-14'
            }`}>
            <button
                onClick={() => setExpanded(value => !value)}
                className='flex w-full items-center justify-between rounded-lg px-2 py-1 transition hover:bg-white/10'>
                <div className='text-left'>
                    <p className='text-sm uppercase tracking-wide text-gray-400'>
                        Final Picklist
                    </p>
                    <p className='text-lg font-semibold'>{picklist.length} teams</p>
                </div>
                <MaterialSymbol
                    icon={expanded ? 'expand_more' : 'expand_less'}
                    size={28}
                />
            </button>

            {expanded && (
                <div className='mt-2 space-y-2'>
                    <div className='max-h-[54vh] space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-[#171d2a] p-2'>
                        {picklist.map((team, index) => (
                            <div
                                key={`${team}-${index}`}
                                className='flex items-center justify-between rounded bg-[#101520] px-1 py-1'>
                                <div className='flex items-center gap-1'>
                                    <button
                                        onClick={() => moveTeamNumber(index, true)}
                                        className='rounded p-1 text-gray-300 hover:bg-white/10 hover:text-white'>
                                        <MaterialSymbol icon='arrow_drop_up' />
                                    </button>
                                    <button
                                        onClick={() => moveTeamNumber(index, false)}
                                        className='rounded p-1 text-gray-300 hover:bg-white/10 hover:text-white'>
                                        <MaterialSymbol icon='arrow_drop_down' />
                                    </button>
                                </div>

                                <table>
                                    <tbody>
                                        <tr>
                                            <TeamItem
                                                teamNumber={team}
                                                teamInfoJson={teamInfoJson}
                                                onSubmit={onSubmit}
                                            />
                                        </tr>
                                    </tbody>
                                </table>

                                <button
                                    onClick={() => handleRemoveTeam(index)}
                                    className='rounded p-1 text-gray-300 hover:bg-white/10 hover:text-white'
                                    title='Remove team'>
                                    <MaterialSymbol icon='close' />
                                </button>
                            </div>
                        ))}
                        {picklist.length === 0 && (
                            <p className='p-2 text-sm text-gray-400'>
                                No teams in final picklist yet.
                            </p>
                        )}
                    </div>

                    <div className='rounded-lg border border-white/10 bg-[#171d2a] p-2'>
                        <p className='mb-1 text-sm font-medium text-gray-200'>Add team</p>
                        <SelectSearch
                            options={teamNumbers.map(team => ({
                                value: team,
                                name: team,
                            }))}
                            value={newTeamNumber}
                            onChange={value => addNewTeamNumber(value as string)}
                            placeholder='Select Team'
                            search
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default FinalPicklist;
