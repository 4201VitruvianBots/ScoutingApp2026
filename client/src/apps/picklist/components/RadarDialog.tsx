import { Dispatch, useMemo, useState } from 'react';
import TextInput from '../../../components/TextInput';
import { MaterialSymbol } from 'react-material-symbols';
import Checkbox from '../../../components/Checkbox';
import { AnalysisEntry, RadarGraphData } from '../data';
import camelToSpaced from '../../../lib/camelCaseConvert';
import { getNumericMetricColumns } from '../analysis';

function RadarGraphDialog({
    onSubmit,
    onClose,
    data,
}: {
    onSubmit: Dispatch<RadarGraphData>;
    onClose?: () => void;
    data: AnalysisEntry[] | undefined;
}) {
    const metrics = getNumericMetricColumns(data ?? []);
    const teamNumbers = useMemo(
        () =>
            (data ?? [])
                .map(entry => entry.teamNumber)
                .sort((a, b) => a - b),
        [data]
    );

    const defaultMetrics = useMemo(() => {
        const preferred = [
            'selectionScore',
            'expectedPointsAvg',
            'consistencyScore',
            'defenseImpactScore',
            'reliabilityScore',
            'disciplineScore',
        ];
        const defaults = preferred.filter(metric => metrics.includes(metric));
        if (defaults.length >= 3) return defaults.slice(0, 5);
        return metrics.slice(0, 5);
    }, [metrics]);

    const defaultTeams = useMemo(() => {
        return [...(data ?? [])]
            .sort(
                (a, b) =>
                    ((b.selectionScore as number | undefined) ?? 0) -
                    ((a.selectionScore as number | undefined) ?? 0)
            )
            .slice(0, 3)
            .map(entry => entry.teamNumber);
    }, [data]);

    const [title, setTitle] = useState('Radar Comparison');
    const [selectedMetrics, setSelectedMetrics] = useState<string[]>(defaultMetrics);
    const [selectedTeams, setSelectedTeams] = useState<number[]>(defaultTeams);
    const [normalize, setNormalize] = useState(true);

    const toggleMetric = (metric: string) => {
        setSelectedMetrics(current =>
            current.includes(metric)
                ? current.filter(item => item !== metric)
                : [...current, metric]
        );
    };

    const toggleTeam = (teamNumber: number) => {
        setSelectedTeams(current =>
            current.includes(teamNumber)
                ? current.filter(item => item !== teamNumber)
                : [...current, teamNumber]
        );
    };

    const handleSubmit = () => {
        if (selectedMetrics.length < 3 || selectedTeams.length === 0) return;
        onSubmit({
            title: title || 'Radar Comparison',
            columns: selectedMetrics,
            teamNumbers: selectedTeams,
            normalize,
            type: 'RadarGraph',
        });
        onClose?.();
    };

    return (
        <div className='space-y-3 rounded-xl border border-white/15 bg-[#202736] p-3 text-white'>
            <div className='flex items-center justify-between'>
                <h2 className='text-lg font-semibold'>Radar Chart</h2>
                <button
                    onClick={onClose}
                    className='rounded-full p-1 text-gray-300 transition hover:bg-white/10 hover:text-white'>
                    <MaterialSymbol icon='close' />
                </button>
            </div>

            <label className='block text-sm font-medium text-gray-200'>
                Title
                <TextInput
                    value={title}
                    onChange={setTitle}
                    className='mt-1 w-full rounded border border-white/20 bg-[#0f1420] p-2 text-white'
                    placeholder='Radar Comparison'
                />
            </label>

            <Checkbox checked={normalize} onChange={setNormalize}>
                Normalize each metric to percentage scale
            </Checkbox>

            <div>
                <p className='mb-1 text-sm font-medium text-gray-200'>
                    Metrics (pick at least 3)
                </p>
                <div className='max-h-40 space-y-1 overflow-y-auto rounded border border-white/10 bg-[#141a26] p-2 text-sm'>
                    {metrics.map(metric => (
                        <Checkbox
                            key={metric}
                            checked={selectedMetrics.includes(metric)}
                            onChange={() => toggleMetric(metric)}>
                            {camelToSpaced(metric)}
                        </Checkbox>
                    ))}
                </div>
            </div>

            <div>
                <p className='mb-1 text-sm font-medium text-gray-200'>Teams to overlay</p>
                <div className='max-h-36 space-y-1 overflow-y-auto rounded border border-white/10 bg-[#141a26] p-2 text-sm'>
                    {teamNumbers.map(teamNumber => (
                        <Checkbox
                            key={teamNumber}
                            checked={selectedTeams.includes(teamNumber)}
                            onChange={() => toggleTeam(teamNumber)}>
                            Team {teamNumber}
                        </Checkbox>
                    ))}
                </div>
            </div>

            <button
                onClick={handleSubmit}
                className='rounded bg-[#48c55c] px-3 py-2 font-semibold text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50'
                disabled={selectedMetrics.length < 3 || selectedTeams.length === 0}>
                Create
            </button>
        </div>
    );
}

export default RadarGraphDialog;
