import { Dispatch, SetStateAction } from 'react';
import { MatchScores } from '../MatchApp';
import { ClimbPosition } from 'requests';
import MultiButton from '../../../components/MultiButton';

function EndgameButton({
    setClimb,
    climbPosition,
}: {
    setClimb: Dispatch<SetStateAction<ClimbPosition>>;
    setCount: Dispatch<SetStateAction<MatchScores>>;
    climbPosition: ClimbPosition;
    count: MatchScores;
}) {
    // const [alliance, setAlliance] = useState(false); //false=red, true=blue, null=hollow purple

    const handleClimb = (newClimb: ClimbPosition) => {
        setClimb(newClimb);
    };

    return (
        <>
            

                <div
                className={`relative justify-center flex flex-row gap-2 bg-cover bg-center py-2`}>
                <MultiButton
                    onChange={handleClimb}
                    value={climbPosition}
                    labels={['Deep', 'Shallow']}
                    values={['deep', 'shallow']}
                    className={[
                        'h-[60px] w-[217px] text-4xl ',
                        'h-[60px] w-[217px] text-4xl ',
                    ]}
                />
                </div>
                <br/>
                <div className={`relative justify-center flex flex-row gap-2 bg-cover bg-center py-2`}>
                <MultiButton
                    onChange={handleClimb}
                    value={climbPosition}
                    labels={['Failed', 'None', 'Parked']}
                    values={['failed', 'none', 'park']}
                    className={[
                        'h-[60px] w-[217px] text-4xl ',
                        'h-[60px] w-[217px] text-4xl ',
                        'flex-column h-[60px] w-[200px] gap-4 text-4xl  ',
                    ]}
                />
            </div>
            <br/>
        </>
    );
}

export default EndgameButton;
