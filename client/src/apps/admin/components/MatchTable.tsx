import { StatusRecieve } from 'requests';
import MatchRow from './MatchRow';
import { getAlliancePositions } from '../../../lib/gameConfig';

function MatchTable({ matches }: { matches: StatusRecieve['matches'] }) {
    const redPositions = getAlliancePositions('red');
    const bluePositions = getAlliancePositions('blue');
    return (
        <table className='w-full min-w-[760px] table-auto border-collapse'>
            <thead>
                <tr>
                    <th className='border border-white/10 bg-[#1b2331] px-2 py-2'>Match</th>
                    {redPositions.map((_, index) => (
                        <th
                            key={`red-${index}`}
                            className='border border-white/10 bg-red-500/40 px-2 py-2'>
                            Red {index + 1}
                        </th>
                    ))}
                    {bluePositions.map((_, index) => (
                        <th
                            key={`blue-${index}`}
                            className='border border-white/10 bg-blue-500/40 px-2 py-2'>
                            Blue {index + 1}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {Object.entries(matches)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([matchNumber, scouters]) => (
                        <MatchRow
                            key={matchNumber}
                            matchNumber={matchNumber}
                            scouters={scouters}
                        />
                    ))}
            </tbody>
        </table>
    );
}

export { MatchTable };
