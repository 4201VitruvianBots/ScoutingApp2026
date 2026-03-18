import { Dispatch, useEffect, useState } from 'react';
import { RobotPosition } from 'requests';
import MultiButton from './MultiButton';
import TextInput from './TextInput';
import { getRobotPositions } from '../lib/gameConfig';

function SignIn({
    scouterName,
    onChangeScouterName,
    robotPosition,
    onChangeRobotPosition,
    pitScouting,
    onSubmit,
}: {
    scouterName: string;
    onChangeScouterName: Dispatch<string>;
    onSubmit: () => void;
} & (
    | {
          pitScouting: true;
          robotPosition?: undefined;
          onChangeRobotPosition?: undefined;
      }
    | {
          pitScouting?: false;
          robotPosition: RobotPosition | undefined;
          onChangeRobotPosition: Dispatch<RobotPosition>;
      }
)) {
    const [showCheck, setShowCheck] = useState(false);

    const handleSubmit = () => {
        setShowCheck(true);
        onSubmit();
    };

    useEffect(() => {
        setShowCheck(false);
    }, [scouterName, robotPosition]);

    const positions = getRobotPositions();
    const labels = positions.map(position => {
        const [alliance, slot] = position.split('_');
        return `${alliance.charAt(0).toUpperCase()}${alliance.slice(1)} ${slot}`;
    });
    const unSelectedClassName = positions.map(position =>
        position.startsWith('blue')
            ? 'text-blue-500 bg-gray-300'
            : 'text-red-500 bg-gray-300'
    );
    const selectedClassName = positions.map(position =>
        position.startsWith('blue')
            ? 'bg-blue-500 text-white'
            : 'bg-red-500 text-white'
    );

    return (
        <div
            className={`grid w-[400px] grid-cols-2 selection:box-border ${
                pitScouting
                    ? 'grid-rows-[auto_auto_auto]'
                    : 'grid-rows-[auto_auto_1fr_1fr_1fr_1fr_1fr]'
            } justify-center gap-3`}>
            <p className='col-span-2 justify-self-center p-1 text-2xl font-medium text-green-600'>
                Sign-In
            </p>

            <TextInput
                className={`required col-span-2 h-[40px] justify-center text-xl text-black outline-double outline-sky-300 ${
                    pitScouting ? 'row-span-1' : 'row-span-2'
                }`}
                value={scouterName}
                onChange={onChangeScouterName}
                placeholder='Name'
            />

            {pitScouting ? undefined : (
                <MultiButton
                    onChange={onChangeRobotPosition}
                    value={robotPosition}
                    labels={labels}
                    values={positions}
                    className='text-xl'
                    unSelectedClassName={unSelectedClassName}
                    selectedClassName={selectedClassName}
                />
            )}

            <div
                className={`col-span-2 col-start-1 flex flex-row justify-self-center ${
                    pitScouting ? 'row-start-3' : 'row-start-7'
                }`}>
                <button
                    onClick={handleSubmit}
                    className={`m-3 justify-center rounded-md px-5 py-3 text-xl ${
                        showCheck ? 'bg-green-500' : 'bg-gray-300 hover:bg-green-500'
                    }`}>
                    Submit
                </button>
            </div>
        </div>
    );
}

export default SignIn;
