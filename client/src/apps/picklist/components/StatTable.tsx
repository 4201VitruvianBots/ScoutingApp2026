import { Dispatch } from 'react';
import { AnalysisEntry, StatTableData, WindowData } from '../data';
import { TeamData } from 'requests';
import Dialog from '../../../components/Dialog';
import StatColumnDialog from './StatColumnDialog';
import { MaterialSymbol } from 'react-material-symbols';
import camelToSpaced from '../../../lib/camelCaseConvert';
import RobotPhotoDialog from './RobotPhotoDialog';
import TeamItem from './TeamItem';

function toDisplayValue(value: unknown) {
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return 'N/A';
        return Math.abs(value) >= 100 ? value.toFixed(1) : value.toFixed(3);
    }
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'string') return value;
    return '';
}

function weightedScore(entry: AnalysisEntry, table: StatTableData) {
    return table.columns.reduce((sum, column, index) => {
        const value = entry[column];
        const weight = table.weights[index] ?? 0;
        if (typeof value !== 'number' || !Number.isFinite(value)) return sum;
        return sum + value * weight;
    }, 0);
}

function StatTable({
    table,
    setTable,
    data,
    teamInfoJson,
    onSubmit,
    onSetFinal,
}: {
    table: StatTableData;
    data: AnalysisEntry[];
    setTable: Dispatch<StatTableData>;
    teamInfoJson: TeamData;
    onSubmit: Dispatch<WindowData>;
    onSetFinal: Dispatch<number[]>;
}) {
    const sortedData = [...data].sort((a, b) => {
        if (table.weighted) {
            const delta = weightedScore(a, table) - weightedScore(b, table);
            return delta * (table.ascending ? 1 : -1);
        }

        if (!table.sortColumn) {
            return a.teamNumber - b.teamNumber;
        }

        const aValue = a[table.sortColumn];
        const bValue = b[table.sortColumn];
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            return (aValue - bValue) * (table.ascending ? 1 : -1);
        }
        return String(aValue ?? '').localeCompare(String(bValue ?? ''));
    });

    function handleClickColumn(sortColumn: string) {
        if (sortColumn === table.sortColumn) {
            setTable({ ...table, ascending: !table.ascending });
            return;
        }
        setTable({ ...table, sortColumn, ascending: false });
    }

    function handleAddColumn(column: string) {
        setTable({
            ...table,
            columns: [...table.columns, column],
            weights: [...table.weights, 0],
        });
    }

    function handleDeleteColumn(index: number) {
        setTable({
            ...table,
            columns: table.columns.filter((_, i) => i !== index),
            weights: table.weights.filter((_, i) => i !== index),
        });
    }

    function handleWeightChange(index: number, value: string) {
        const parsed = Number.parseFloat(value);
        setTable({
            ...table,
            weights: table.weights.map((weight, i) =>
                index === i && Number.isFinite(parsed) ? parsed : weight
            ),
        });
    }

    function handleStatSummaryClick(column: string) {
        onSubmit({
            title: camelToSpaced(column),
            type: 'StatSummary',
            column,
        });
    }

    return (
        <div className='space-y-3 text-white'>
            <div className='flex flex-wrap items-center gap-2'>
                <button
                    className='rounded bg-[#48c55c] px-3 py-2 text-sm font-semibold text-black transition hover:brightness-105'
                    onClick={() =>
                        onSetFinal(sortedData.map(entry => entry.teamNumber))
                    }>
                    Set As Final Picklist
                </button>
                {table.weighted && (
                    <p className='text-sm text-gray-300'>
                        Weighted mode: adjust each column weight in header.
                    </p>
                )}
            </div>

            <div className='max-h-[70vh] overflow-auto rounded-xl border border-white/10 bg-[#171d2a]'>
                <table className='w-full min-w-[760px] border-collapse text-sm'>
                    <thead className='sticky top-0 z-10 bg-[#1f2737]'>
                        <tr>
                            <th className='border-b border-white/10 px-2 py-2 text-left'>
                                Avatar
                            </th>
                            <th className='border-b border-white/10 px-2 py-2 text-left'>
                                Team
                            </th>
                            {table.columns.map((column, index) => (
                                <th
                                    key={`${column}-${index}`}
                                    className='border-b border-white/10 px-2 py-2 text-left align-top'>
                                    <div className='space-y-1'>
                                        <div className='flex items-center gap-1'>
                                            <span>{camelToSpaced(column)}</span>
                                            {column !== 'robotImages' && (
                                                <button
                                                    onClick={() =>
                                                        handleClickColumn(column)
                                                    }
                                                    className='rounded p-0.5 text-gray-300 hover:bg-white/10 hover:text-white'>
                                                    {column === table.sortColumn ? (
                                                        table.ascending ? (
                                                            <MaterialSymbol icon='arrow_upward_alt' />
                                                        ) : (
                                                            <MaterialSymbol icon='arrow_downward_alt' />
                                                        )
                                                    ) : (
                                                        <MaterialSymbol icon='swap_vert' />
                                                    )}
                                                </button>
                                            )}
                                            {column !== 'robotImages' && (
                                                <button
                                                    onClick={() =>
                                                        handleStatSummaryClick(column)
                                                    }
                                                    className='rounded p-0.5 text-gray-300 hover:bg-white/10 hover:text-white'>
                                                    <MaterialSymbol icon='query_stats' />
                                                </button>
                                            )}
                                            <button
                                                onClick={() =>
                                                    handleDeleteColumn(index)
                                                }
                                                className='rounded p-0.5 text-gray-300 hover:bg-white/10 hover:text-white'>
                                                <MaterialSymbol icon='close' />
                                            </button>
                                        </div>
                                        {table.weighted && column !== 'robotImages' && (
                                            <input
                                                type='number'
                                                value={table.weights[index] ?? 0}
                                                onChange={event =>
                                                    handleWeightChange(
                                                        index,
                                                        event.target.value
                                                    )
                                                }
                                                className='w-20 rounded border border-white/20 bg-[#0f1420] px-1 py-0.5 text-xs text-white'
                                            />
                                        )}
                                    </div>
                                </th>
                            ))}
                            <th className='border-b border-white/10 px-2 py-2 text-center'>
                                <Dialog
                                    trigger={open => (
                                        <button
                                            className='rounded bg-white/10 p-1 transition hover:bg-white/20'
                                            onClick={open}>
                                            <MaterialSymbol icon='add' />
                                        </button>
                                    )}>
                                    {close => (
                                        <StatColumnDialog
                                            data={data}
                                            onSubmit={handleAddColumn}
                                            onClose={close}
                                        />
                                    )}
                                </Dialog>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedData.map(entry => (
                            <tr
                                key={entry.teamNumber}
                                className='border-b border-white/5 hover:bg-white/5'>
                                <TeamItem
                                    teamNumber={entry.teamNumber}
                                    teamInfoJson={teamInfoJson}
                                    onSubmit={onSubmit}
                                />
                                {table.columns.map(column => {
                                    if (column === 'robotImages') {
                                        return (
                                            <td
                                                key={`${entry.teamNumber}-${column}`}
                                                className='px-2 py-2'>
                                                <Dialog
                                                    trigger={open => (
                                                        <button
                                                            onClick={open}
                                                            className='rounded border border-white/10 bg-[#0f1420] p-1'>
                                                            <img
                                                                src={`/image/${entry.teamNumber}.jpeg`}
                                                                width='96'
                                                                height='72'
                                                                alt=''
                                                                className='rounded object-cover'
                                                            />
                                                        </button>
                                                    )}>
                                                    {close => (
                                                        <RobotPhotoDialog
                                                            teamNumber={
                                                                entry.teamNumber
                                                            }
                                                            onClose={close}
                                                        />
                                                    )}
                                                </Dialog>
                                            </td>
                                        );
                                    }
                                    return (
                                        <td
                                            key={`${entry.teamNumber}-${column}`}
                                            className='px-2 py-2 font-mono text-xs text-gray-200'>
                                            {toDisplayValue(entry[column])}
                                        </td>
                                    );
                                })}
                                <td className='px-2 py-2' />
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default StatTable;
