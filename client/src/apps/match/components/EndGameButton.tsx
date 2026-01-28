import { Dispatch, SetStateAction } from 'react';
import { TeleTowerResult } from 'requests';
import MultiButton from '../../../components/MultiButton';

function EndgameButton({
    setClimb,
    climbPosition,
}: {
    setClimb: Dispatch<SetStateAction<TeleTowerResult>>;
    climbPosition: TeleTowerResult;
}) {
    // const [alliance, setAlliance] = useState(false); //false=red, true=blue, null=hollow purple

    const handleClimb = (newClimb: TeleTowerResult) => {
        setClimb(newClimb);
    };

    return (
        <>
            

                <div
                className={`relative justify-center flex flex-row gap-2 bg-cover bg-center py-2`}>
                <MultiButton
                    onChange={handleClimb}
                    value={climbPosition}
                    labels={['Level 1', 'Level 2', 'Level 3']}
                    values={['level1', 'level2', 'level3']}
                    className={[
                        'h-[60px] w-[217px] text-3xl ',
                        'h-[60px] w-[217px] text-3xl ',
                        'h-[60px] w-[217px] text-3xl ',
                    ]}
                />
                </div>
                <br/>
                <div className={`relative justify-center flex flex-row gap-2 bg-cover bg-center py-2`}>
                <MultiButton
                    onChange={handleClimb}
                    value={climbPosition}
                    labels={['Failed', 'None']}
                    values={['failed', 'none']}
                    className={[
                        'h-[60px] w-[217px] text-3xl ',
                        'h-[60px] w-[217px] text-3xl ',
                    ]}
                />
            </div>
            <br/>
        </>
    );
}

export default EndgameButton;
