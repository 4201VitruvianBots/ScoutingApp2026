import { RobotPosition, SuperPosition } from 'requests';
import PositionCell from './PositionCell';
import { getAlliancePositions } from '../../../lib/gameConfig';

function MatchRow({
    matchNumber,
    scouters,
}: {
    matchNumber: string;
    scouters: Record<RobotPosition, { schedule: number | undefined; real: number[] }> &
        Record<SuperPosition, boolean>;
}) {
    const redPositions = getAlliancePositions('red');
    const bluePositions = getAlliancePositions('blue');
    return (
        <tr>
            <th>{matchNumber}</th>
            {redPositions.map(position => (
                <PositionCell key={position} scouter={scouters[position]} />
            ))}
            <PositionCell scouter={scouters.red_ss} />
            {bluePositions.map(position => (
                <PositionCell key={position} scouter={scouters[position]} />
            ))}
            <PositionCell scouter={scouters.blue_ss} />
        </tr>
    );
}

export default MatchRow;
