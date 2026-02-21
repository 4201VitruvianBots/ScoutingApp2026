import { Dispatch, useMemo, useState } from 'react';
import { AnalysisEntry, BarGraphData } from '../data';
import TextInput from '../../../components/TextInput';
import SelectSearch from 'react-select-search';
import camelToSpaced from '../../../lib/camelCaseConvert';
import { MaterialSymbol } from 'react-material-symbols';
import Checkbox from '../../../components/Checkbox';
import { getNumericMetricColumns } from '../analysis';

function BarGraphDialog({
    onSubmit,
    onClose,
    data,
}: {
    onSubmit: Dispatch<BarGraphData>;
    onClose?: () => void;
    data: AnalysisEntry[] | undefined;
}) {
    const columns = getNumericMetricColumns(data ?? []);
    const teamNumbers = useMemo(
        () =>
            (data ?? [])
                .map(entry => entry.teamNumber)
                .sort((a, b) => a - b),
        [data]
    );

    const [title, setTitle] = useState('');
    const [column, setColumn] = useState<string>();
    const [bins, setBins] = useState('10');
    const [highlightedTeams, setHighlightedTeams] = useState<number[]>([]);
    const [highlightAllTop, setHighlightAllTop] = useState(true);
    const [topCount, setTopCount] = useState('5');

    const toggleTeam = (teamNumber: number) => {
        setHighlightedTeams(current =>
            current.includes(teamNumber)
                ? current.filter(value => value !== teamNumber)
                : [...current, teamNumber]
        );
    };

    const handleSubmit = () => {
        if (!column) return;
        const parsedBins = Number.parseInt(bins, 10);
        const parsedTopCount = Number.parseInt(topCount, 10);
        const validBins =
            Number.isFinite(parsedBins) && parsedBins > 1
                ? Math.min(30, parsedBins)
                : 10;

        const autoHighlights =
            highlightAllTop && Number.isFinite(parsedTopCount) && parsedTopCount > 0
                ? [...(data ?? [])]
                      .filter(
                          entry =>
                              typeof entry[column] === 'number' &&
                              Number.isFinite(entry[column] as number)
                      )
                      .sort(
                          (a, b) =>
                              (b[column] as number) - (a[column] as number)
                      )
                      .slice(0, parsedTopCount)
                      .map(entry => entry.teamNumber)
                : [];

        onSubmit({
            title:
                title ||
                `${camelToSpaced(column)} Distribution`,
            column,
            highlightedTeams: highlightAllTop ? autoHighlights : highlightedTeams,
            bins: validBins,
            type: 'BarGraph',
        });
        onClose?.();
    };

    return (
        <div className='space-y-3 rounded-xl border border-white/15 bg-[#202736] p-3 text-white'>
            <div className='flex items-center justify-between'>
                <h2 className='text-lg font-semibold'>Distribution Chart</h2>
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
                    placeholder={
                        column ? `${camelToSpaced(column)} Distribution` : ''
                    }
                    className='mt-1 w-full rounded border border-white/20 bg-[#0f1420] p-2 text-white'
                />
            </label>

            <label className='block text-sm font-medium text-gray-200'>
                Histogram bins
                <TextInput
                    value={bins}
                    onChange={setBins}
                    className='mt-1 w-28 rounded border border-white/20 bg-[#0f1420] p-2 text-white'
                    placeholder='10'
                />
            </label>

            <Checkbox checked={highlightAllTop} onChange={setHighlightAllTop}>
                Auto-highlight top teams by this metric
            </Checkbox>

            {highlightAllTop ? (
                <label className='block text-sm font-medium text-gray-200'>
                    Number of top teams
                    <TextInput
                        value={topCount}
                        onChange={setTopCount}
                        className='mt-1 w-28 rounded border border-white/20 bg-[#0f1420] p-2 text-white'
                        placeholder='5'
                    />
                </label>
            ) : (
                <div>
                    <p className='mb-1 text-sm font-medium text-gray-200'>
                        Highlighted teams
                    </p>
                    <div className='max-h-36 space-y-1 overflow-y-auto rounded border border-white/10 bg-[#141a26] p-2 text-sm'>
                        {teamNumbers.map(teamNumber => (
                            <Checkbox
                                key={teamNumber}
                                checked={highlightedTeams.includes(teamNumber)}
                                onChange={() => toggleTeam(teamNumber)}>
                                Team {teamNumber}
                            </Checkbox>
                        ))}
                    </div>
                </div>
            )}

            <button
                onClick={handleSubmit}
                className='rounded bg-[#48c55c] px-3 py-2 font-semibold text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50'
                disabled={!column}>
                Create
            </button>
        </div>
    );
}

export default BarGraphDialog;
