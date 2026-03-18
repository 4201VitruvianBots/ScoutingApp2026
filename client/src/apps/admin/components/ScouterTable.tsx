import { RobotPosition, StatusReport } from 'requests';
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
            ] satisfies RobotPosition[]
        ).map(robotPosition => [
            robotPosition,
            scouters.filter(scouter => scouter.robotPosition === robotPosition),
        ])
    ) as Partial<Record<RobotPosition, StatusReport[]>>;

    return (
        <div className='grid grid-cols-2 gap-2 lg:grid-cols-3'>
            {redPositions.map((position, index) => (
                <ScouterCard
                    key={position}
                    scouter={sortedScouter[position] ?? []}
                    title={`Red ${index + 1}`}
                    red
                />
            ))}
            {bluePositions.map((position, index) => (
                <ScouterCard
                    key={position}
                    scouter={sortedScouter[position] ?? []}
                    title={`Blue ${index + 1}`}
                />
            ))}
        </div>
    );
}

export { ScouterTable };
