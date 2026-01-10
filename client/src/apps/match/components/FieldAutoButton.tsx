import { useState } from "react";
import { RobotPosition } from "requests";
import CheckBoxMatch from './CheckBoxButton';
import CoralSectionButton from "./CoralSectionButton";
import bluesidematch from 'path/to/bluesidematch.png';
import redsidematch from 'path/to/redsidematch.png';

const FieldAutoButton = () => {
    const [robotPosition] = useState<RobotPosition>();
    const [ground1, setGround1] = useState(false);
    const [ground2, setGround2] = useState(false);
    const [ground3, setGround3] = useState(false);
    const [source1, setSource1] = useState(false);
    const [source2, setSource2] = useState(false);
    const [start1, setStart1] = useState(false);
    const [start2, setStart2] = useState(false);
    const [start3, setStart3] = useState(false);
    const [deposit1, setDeposit1] = useState(false);
    const [deposit2, setDeposit2] = useState(false);
    const [deposit3, setDeposit3] = useState(false);
    const [deposit4, setDeposit4] = useState(false);
    const [deposit5, setDeposit5] = useState(false);
    const [deposit6, setDeposit6] = useState(false);
    const blueAlliance = (
        ['blue_1', 'blue_2', 'blue_3'] as (string | undefined)[]
    ).includes(robotPosition);

    return (
        <>
            <img src={`${blueAlliance ? bluesidematch : redsidematch}`} width={500} height={600} className="justify-self-center my-7" />
            <CheckBoxMatch
                checked={ground1}
                onChange={setGround1}
                className={`${blueAlliance ? 'top-[660px] left-[285px]' : 'top-[675px] left-[455px]'} absolute z-20 h-10 w-10 overflow-hidden rounded-full text-left`}>
            </CheckBoxMatch>
            <CheckBoxMatch
                checked={ground2}
                onChange={setGround2}
                className={`${blueAlliance ? 'top-[740px] left-[285px]' :'top-[760px] left-[455px]' } absolute z-20 h-10 w-10 overflow-hidden rounded-full text-left`} />
            <CheckBoxMatch
                checked={ground3}
                onChange={setGround3}
                className={`${blueAlliance ? 'top-[820px] left-[285px]' :'top-[840px] left-[455px]' } absolute z-20 h-10 w-10 overflow-hidden rounded-full text-left`} />
            <CheckBoxMatch
                checked={source1}
                onChange={setSource1}
                className={`${blueAlliance? 'top-[570px] left-[250px]' :'top-[585px] left-[485px]' } absolute z-20 h-10 w-10 overflow-hidden rounded-full text-left`} />
            <CheckBoxMatch
                checked={source2}
                onChange={setSource2}
                className={`${blueAlliance? 'top-[910px] left-[250px]' :'top-[930px] left-[485px]' } absolute z-20 h-10 w-10 overflow-hidden rounded-full text-left`} />
            <CheckBoxMatch
                checked={start1}
                onChange={setStart1}
                className={`${blueAlliance? 'top-[645px] left-[565px]' :'top-[660px] left-[160px]' } absolute z-20 h-10 w-10 overflow-hidden rounded-full text-left`} />
            <CheckBoxMatch
                checked={start2}
                onChange={setStart2}
                className={`${blueAlliance? 'top-[740px] left-[565px]' :'top-[760px] left-[160px]' } absolute z-20 h-10 w-10 overflow-hidden rounded-full text-left`} />
            <CheckBoxMatch
                checked={start3}
                onChange={setStart3}
                className={`${blueAlliance? 'top-[835px] left-[565px]' :'top-[858px] left-[160px]' } absolute z-20 h-10 w-10 overflow-hidden rounded-full text-left`} />
            <CoralSectionButton
                onChange={setDeposit1}
                value={deposit1} 
                className={`absolute ${blueAlliance? 'left-[19.5em] top-[19em]':'left-[12em] top-[20em]'} h-[1em] w-[4.5em] rotate-[30deg]`}
                selectClassName='bg-green-300'
                unselectClassName='bg-red-300'>   
            </CoralSectionButton>
            <CoralSectionButton
                onChange={setDeposit2}
                value={deposit2} 
                className={`absolute ${blueAlliance? 'left-[21em] top-[21.5em]':'left-[13.5em] top-[23em]'} h-[1em] w-[4.5em] rotate-[90deg]`}
                selectClassName='bg-green-300'
                unselectClassName='bg-red-300'>
            </CoralSectionButton>
            <CoralSectionButton
                onChange={setDeposit3}
                value={deposit3} 
                className={`absolute ${blueAlliance? 'left-[19.5em] top-[24.5em]':'left-[12em] top-[26em]'} h-[1em] w-[4.5em] rotate-[-30deg]`}
                selectClassName='bg-green-300'
                unselectClassName='bg-red-300' >
            </CoralSectionButton>
            <CoralSectionButton 
                onChange={setDeposit4}
                value={deposit4}
                className={`absolute ${blueAlliance? 'left-[16em] top-[24.5em]':'left-[8.5em] top-[26em]'} h-[1em] w-[4.5em] rotate-[30deg]`}
                selectClassName='bg-green-300'
                unselectClassName='bg-red-300'>
            </CoralSectionButton>
            <CoralSectionButton 
                onChange={setDeposit5}
                value={deposit5}
                className={`absolute ${blueAlliance? 'left-[14.5em] top-[21.5em]':'left-[6.9em] top-[22.9em]'} h-[1em] w-[4.5em] rotate-[90deg]`}
                selectClassName='bg-green-300'
                unselectClassName='bg-red-300'>
            </CoralSectionButton>
            <CoralSectionButton
                onChange={setDeposit6}
                value={deposit6} 
                className={`absolute ${blueAlliance? 'left-[16em] top-[19em]':'left-[8.5em] top-[20em]'} h-[1em] w-[4.5em] rotate-[-30deg]`}
                selectClassName='bg-green-300'
                unselectClassName='bg-red-300'>
            </CoralSectionButton>
        </>
    );
};

export default FieldAutoButton;
