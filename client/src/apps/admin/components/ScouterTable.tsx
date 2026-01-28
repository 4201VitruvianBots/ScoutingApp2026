import { RobotPosition, StatusReport, SuperPosition } from 'requests';
import { ScouterCard } from './ScouterCard';
import { getAlliancePositions } from '../../../lib/gameConfig';

function ScouterTable({ scouters }: { scouters: StatusReport[] }) {
    const redPositions = getAlliancePositions('red');
    const bluePositions = getAlliancePositions('blue');
    const sortedScouter = Object.fromEntries(
        (
            [
                ...redPositions,
                ...bluePositions,
                'red_ss',
                'blue_ss',
            ] satisfies (RobotPosition | SuperPosition)[]
        ).map(robotPosition => [
            robotPosition,
            scouters.filter(scouter => scouter.robotPosition === robotPosition),
        ])
    ) as Record<RobotPosition | SuperPosition, StatusReport[]>;

    return (
        <div className='grid grid-cols-4 gap-2'>
            {redPositions.map((position, index) => (
                <ScouterCard
                    key={position}
                    scouter={sortedScouter[position]}
                    title={`Red ${index + 1}`}
                    red
                />
            ))}
            <ScouterCard scouter={sortedScouter.red_ss} title='Red SS' red />
            {bluePositions.map((position, index) => (
                <ScouterCard
                    key={position}
                    scouter={sortedScouter[position]}
                    title={`Blue ${index + 1}`}
                />
            ))}
            <ScouterCard scouter={sortedScouter.blue_ss} title='Blue SS' />
        </div>
    );
}

export { ScouterTable };
