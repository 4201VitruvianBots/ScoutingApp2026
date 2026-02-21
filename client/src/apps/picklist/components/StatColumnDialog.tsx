import { Dispatch, useState } from 'react';
import { AnalysisEntry } from '../data';
import SelectSearch from 'react-select-search';
import camelToSpaced from '../../../lib/camelCaseConvert';
import { MaterialSymbol } from 'react-material-symbols';
import { getNumericMetricColumns } from '../analysis';

function StatColumnDialog({
    onSubmit,
    onClose,
    data,
}: {
    onSubmit: Dispatch<string>;
    onClose?: () => void;
    data: AnalysisEntry[] | undefined;
}) {
    const columns = [...getNumericMetricColumns(data ?? []), 'robotImages'];
    const [column, setColumn] = useState<string>();

    const handleSubmit = () => {
        if (!column) return;
        onSubmit(column);
        onClose?.();
    };

    return (
        <div className='space-y-3 rounded-xl border border-white/15 bg-[#202736] p-3 text-white'>
            <div className='flex items-center justify-between'>
                <h2 className='text-lg font-semibold'>Add Column</h2>
                <button
                    onClick={onClose}
                    className='rounded-full p-1 text-gray-300 transition hover:bg-white/10 hover:text-white'>
                    <MaterialSymbol icon='close' />
                </button>
            </div>

            <label className='block text-sm font-medium text-gray-200'>
                Column
                <SelectSearch
                    options={columns.map(metric => ({
                        value: metric,
                        name: camelToSpaced(metric),
                    }))}
                    value={column}
                    placeholder='Select stat'
                    onChange={value => setColumn(value as string)}
                    search
                />
            </label>

            <button
                onClick={handleSubmit}
                className='rounded bg-[#48c55c] px-3 py-2 font-semibold text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50'
                disabled={!column}>
                Add
            </button>
        </div>
    );
}

export default StatColumnDialog;
