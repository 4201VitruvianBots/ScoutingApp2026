import { ScouterData } from 'requests';

function StatRow({
    rank,
    scouter,
}: {
    rank: number;
    scouter: ScouterData;
}) {
    const rankTone =
        rank === 1
            ? 'text-amber-300'
            : rank === 2
              ? 'text-slate-200'
              : rank === 3
                ? 'text-amber-500'
                : 'text-white';
    const accuracyText = Number.isFinite(scouter.accuracy)
        ? scouter.accuracy.toFixed(2)
        : 'N/A';

    return (
        <tr className='border-b border-white/5 last:border-b-0 hover:bg-white/5'>
            <td className={`px-4 py-3 font-semibold tabular-nums ${rankTone}`}>
                {rank}
            </td>
            <td className='px-4 py-3'>{scouter?.scouterName}</td>
            <td
                className={`px-4 py-3 text-right font-semibold tabular-nums ${rankTone}`}>
                {accuracyText}
            </td>
        </tr>
    );
}



export { StatRow };
