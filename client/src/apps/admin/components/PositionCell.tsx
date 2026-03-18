import { MaterialSymbol } from 'react-material-symbols';

function PositionCell({
    scouter,
}: {
    scouter?: { schedule: number | undefined; real: number[] };
}) {
    if (!scouter) {
        return (
            <td className='border border-white/10 bg-[#141a25] px-2 py-2 text-center text-gray-500'>
                -
            </td>
        );
    }
    const hasSubmission = scouter.real.length > 0;
    return (
        <td
            className={`border border-white/10 px-2 py-2 text-center ${
                hasSubmission ? 'bg-amber-400/90 text-black' : 'bg-[#141a25] text-white'
            }`}>
            {scouter.real.length === 0 ? (
                scouter.schedule
            ) : scouter.real.length === 1 ? (
                scouter.real[0]
            ) : (
                <MaterialSymbol icon='warning' className='text-yellow-200' />
            )}
        </td>
    );
}
export default PositionCell;
