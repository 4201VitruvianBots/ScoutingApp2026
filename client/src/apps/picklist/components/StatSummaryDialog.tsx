import { Dispatch, useState } from 'react';
import { AnalysisEntry, StatSummaryData } from '../data';
import TextInput from '../../../components/TextInput';
import SelectSearch from 'react-select-search';
import camelToSpaced from '../../../lib/camelCaseConvert';
import { MaterialSymbol } from 'react-material-symbols';
import { getNumericMetricColumns } from '../analysis';

function StatSummaryDialog({
    onSubmit,
    onClose,
    data,
}: {
    onSubmit: Dispatch<StatSummaryData>;
    onClose?: () => void;
    data: AnalysisEntry[] | undefined;
}) {
    const columns = getNumericMetricColumns(data ?? []);
    const [title, setTitle] = useState('');
    const [column, setColumn] = useState<string>();

    const handleSubmit = () => {
        if (!column) return;
        onSubmit({
            title: title || camelToSpaced(column),
            column,
            type: 'StatSummary',
        });
        onClose?.();
    };

    return (
        <div className='space-y-3 rounded-xl border border-white/15 bg-[#202736] p-3 text-white'>
            <div className='flex items-center justify-between'>
                <h2 className='text-lg font-semibold'>Stat Summary</h2>
                <button
                    onClick={onClose}
                    className='rounded-full p-1 text-gray-300 transition hover:bg-white/10 hover:text-white'>
                    <MaterialSymbol icon='close' />
                </button>
            </div>

            <label className='block text-sm font-medium text-gray-200'>
                Metric
                <SelectSearch
                    options={columns.map(metric => ({
                        value: metric,
                        name: camelToSpaced(metric),
                    }))}
                    value={column}
                    placeholder='Select metric'
                    onChange={value => setColumn(value as string)}
                    search
                />
            </label>

            <label className='block text-sm font-medium text-gray-200'>
                Title
                <TextInput
                    value={title}
                    onChange={setTitle}
                    placeholder={camelToSpaced(column || '')}
                    className='mt-1 w-full rounded border border-white/20 bg-[#0f1420] p-2 text-white'
                />
            </label>

            <button
                onClick={handleSubmit}
                className='rounded bg-[#48c55c] px-3 py-2 font-semibold text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50'
                disabled={!column}>
                Create
            </button>
        </div>
    );
}

export default StatSummaryDialog;
