import { StatusRecieve } from 'requests';
import MatchRow from './MatchRow';
import { getAlliancePositions } from '../../../lib/gameConfig';

function MatchTable({ matches }: { matches: StatusRecieve['matches'] }) {
    const redPositions = getAlliancePositions('red');
    const bluePositions = getAlliancePositions('blue');
    return (
        <table className='match-status h-72 overflow-auto'>
            <thead>
                <tr>
                    <th>Match</th>
                    {redPositions.map((_, index) => (
                        <th
                            key={`red-${index}`}
                            className='status-red col-span-1'>
                            Red {index + 1}
                        </th>
                    ))}
                    <th className='status-red col-span-1'>Red SS</th>
                    {bluePositions.map((_, index) => (
                        <th
                            key={`blue-${index}`}
                            className='status-blue col-span-1'>
                            Blue {index + 1}
                        </th>
                    ))}
                    <th className='status-blue col-span-1'>Blue SS</th>
                </tr>
            </thead>
            <tbody>
                {Object.entries(matches).map(([matchNumber, scouters]) => (
                    <MatchRow matchNumber={matchNumber} scouters={scouters} />
                ))}
            </tbody>
        </table>
    );
}

export { MatchTable };
