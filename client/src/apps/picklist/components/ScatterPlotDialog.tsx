import { Dispatch, useState } from 'react';
import { AnalysisEntry, ScatterPlotGraphData } from '../data';
import TextInput from '../../../components/TextInput';
import SelectSearch from 'react-select-search';
import camelToSpaced from '../../../lib/camelCaseConvert';
import { MaterialSymbol } from 'react-material-symbols';
import Checkbox from '../../../components/Checkbox';
import { getNumericMetricColumns } from '../analysis';

function ScatterPlotDialog({
    onSubmit,
    onClose,
    data,
}: {
    onSubmit: Dispatch<ScatterPlotGraphData>;
    onClose?: () => void;
    data: AnalysisEntry[] | undefined;
}) {
    const columns = getNumericMetricColumns(data ?? []);
    const [title, setTitle] = useState('');
    const [xColumn, setXColumn] = useState<string>();
    const [yColumn, setYColumn] = useState<string>();
    const [showLabels, setShowLabels] = useState(false);

    const handleSubmit = () => {
        if (!xColumn || !yColumn) return;
        onSubmit({
            title:
                title ||
                `${camelToSpaced(xColumn)}/${camelToSpaced(yColumn)}`,
            xColumn,
            yColumn,
            showLabels,
            type: 'ScatterPlotGraph',
        });
        onClose?.();
    };

    return (
        <div className='space-y-3 rounded-xl border border-white/15 bg-[#202736] p-3 text-white'>
            <div className='flex items-center justify-between'>
                <h2 className='text-lg font-semibold'>Scatter Plot</h2>
                <button
                    onClick={onClose}
                    className='rounded-full p-1 text-gray-300 transition hover:bg-white/10 hover:text-white'>
                    <MaterialSymbol icon='close' />
                </button>
            </div>

            <label className='block text-sm font-medium text-gray-200'>
                X-axis metric
                <SelectSearch
                    options={columns.map(metric => ({
                        value: metric,
                        name: camelToSpaced(metric),
                    }))}
                    value={xColumn}
                    placeholder='Select X axis metric'
                    onChange={value => setXColumn(value as string)}
                    search
                />
            </label>

            <label className='block text-sm font-medium text-gray-200'>
                Y-axis metric
                <SelectSearch
                    options={columns.map(metric => ({
                        value: metric,
                        name: camelToSpaced(metric),
                    }))}
                    value={yColumn}
                    placeholder='Select Y axis metric'
                    onChange={value => setYColumn(value as string)}
                    search
                />
            </label>

            <label className='block text-sm font-medium text-gray-200'>
                Title
                <TextInput
                    value={title}
                    onChange={setTitle}
                    placeholder={
                        xColumn && yColumn
                            ? `${camelToSpaced(xColumn)}/${camelToSpaced(yColumn)}`
                            : ''
                    }
                    className='mt-1 w-full rounded border border-white/20 bg-[#0f1420] p-2 text-white'
                />
            </label>

            <Checkbox checked={showLabels} onChange={setShowLabels}>
                Show team labels on points
            </Checkbox>

            <button
                onClick={handleSubmit}
                className='rounded bg-[#48c55c] px-3 py-2 font-semibold text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50'
                disabled={!xColumn || !yColumn}>
                Create
            </button>
        </div>
    );
}

export default ScatterPlotDialog;
