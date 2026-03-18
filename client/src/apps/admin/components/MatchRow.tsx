import { RobotPosition } from 'requests';
import PositionCell from './PositionCell';
import { getAlliancePositions } from '../../../lib/gameConfig';

function MatchRow({
    matchNumber,
    scouters,
}: {
    matchNumber: string;
    scouters: Partial<Record<RobotPosition, { schedule: number | undefined; real: number[] }>>;
}) {
    const redPositions = getAlliancePositions('red');
    const bluePositions = getAlliancePositions('blue');
    return (
        <tr>
            <th className='border border-white/10 bg-[#1b2331] px-2 py-1 text-center text-white'>
                {matchNumber}
            </th>
            {redPositions.map(position => (
                <PositionCell key={position} scouter={scouters[position]} />
            ))}
            {bluePositions.map(position => (
                <PositionCell key={position} scouter={scouters[position]} />
            ))}
        </tr>
    );
}

export default MatchRow;
