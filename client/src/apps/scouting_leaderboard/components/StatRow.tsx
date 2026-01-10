import { ScouterData } from 'requests';

function StatRow({
    rank,
    scouter,
}: {
    rank: number;
    scouter: ScouterData;
}) {
   
    return (
        <tr>
            <td className=' border-4 border-slate-700 px-16 py-2'>
                {rank}
            </td>
           
                <td
                    className={`w-16 overflow-auto border-4 border-slate-700 text-center`}>
                    {scouter && scouter.scouterName}
                </td>
            
                <td
                    className={`w-16 overflow-auto border-4 border-slate-700 text-center`}>
                    {scouter && scouter.accuracy}
                </td>
        </tr>
    );
}



export { StatRow };
