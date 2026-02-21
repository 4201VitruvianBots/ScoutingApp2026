import { Dispatch, useState } from 'react';
import { StatTableData } from '../data';
import TextInput from '../../../components/TextInput';
import { MaterialSymbol } from 'react-material-symbols';
import Checkbox from '../../../components/Checkbox';

function StatDialog({
    onSubmit,
    onClose,
}: {
    onSubmit: Dispatch<StatTableData>;
    onClose?: () => void;
}) {
    const [title, setTitle] = useState('');
    const [weighted, setWeighted] = useState(false);

    const handleSubmit = () => {
        onSubmit({
            title: title || 'Stat Table',
            type: 'StatTable',
            columns: [],
            ascending: false,
            weighted,
            weights: [],
        });
        onClose?.();
    };

    return (
        <div className='space-y-3 rounded-xl border border-white/15 bg-[#202736] p-3 text-white'>
            <div className='flex items-center justify-between'>
                <h2 className='text-lg font-semibold'>New Stat Table</h2>
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
                    placeholder='Stat Table'
                    className='mt-1 w-full rounded border border-white/20 bg-[#0f1420] p-2 text-white'
                />
            </label>

            <Checkbox checked={weighted} onChange={setWeighted}>
                Weighted ranking table
            </Checkbox>

            <button
                onClick={handleSubmit}
                className='rounded bg-[#48c55c] px-3 py-2 font-semibold text-black transition hover:brightness-105'>
                Create
            </button>
        </div>
    );
}

export default StatDialog;
