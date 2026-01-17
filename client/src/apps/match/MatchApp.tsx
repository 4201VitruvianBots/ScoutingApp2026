import LinkButton from '../../components/LinkButton';
import {
    MatchData,
    MatchSchedule,
    RobotPosition,
    // ScouterPosition,
} from 'requests';
import { useEffect, useState } from 'react';
import { MaterialSymbol } from 'react-material-symbols';
import 'react-material-symbols/rounded';
import SignIn from '../../components/SignIn';
import Dialog from '../../components/Dialog';
import NumberInput from '../../components/NumberInput';
import { useStatus } from '../../lib/useStatus';
import TeamDropdown from '../../components/TeamDropdown';
import { useQueue } from '../../lib/useQueue';
import scheduleFile from '../../assets/matchSchedule.json';
import { usePreventUnload } from '../../lib/usePreventUnload';
import ToggleButton from '../../components/LightVDarkMode';

const schedule = scheduleFile as MatchSchedule;

interface MatchScores {

}
const defaultScores: MatchScores = {

};

function MatchApp() {
    usePreventUnload();
    const [sendQueue, sendAll, queue, sending] = useQueue();
    const [teamNumber, setTeamNumber] = useState<number>();
    const [matchNumber, setMatchNumber] = useState<number>();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [count, setCount] = useState<MatchScores>(defaultScores);
    const [start1, setStart1] = useState(false);
    const [start2, setStart2] = useState(false);
    const [start3, setStart3] = useState(false);
    const [countHistory, setCountHistory] = useState<MatchScores[]>([]);
    const [showCheck, setShowCheck] = useState(false);
    const [scouterName, setScouterName] = useState('');
    const [robotPosition, setRobotPosition] = useState<RobotPosition>();
    const [toggleState, setToggleState] = useState(false);
    // const [scouterPosition, setScouterPosition] = useState<ScouterPosition>();

    // const blueAlliance = (
    //     ['blue_1', 'blue_2', 'blue_3'] as (string | undefined)[]
    // ).includes(robotPosition);

    const handleAbsentRobot = async () => {
        if (robotPosition == undefined || matchNumber == undefined) {
            alert('Check if your signed in, and you have the match number');
            return;
        }
    

        const data: MatchData = {
            metadata: {
                scouterName,
                robotPosition,
                matchNumber,
                robotTeam: undefined,
            },
            startingZone: {
                start1: start1,
                start2: start2,
                start3: start3,
            }
        };

        sendQueue('/data/match', data);
        setCount(defaultScores);
        setMatchNumber(matchNumber + 1);
        setCountHistory([]);

        // temporary, remove these later
        setStart1(false);
        setStart2(false);
        setStart3(false);
        
        setShowCheck(true);

        setTimeout(() => {
            setShowCheck(false);
        }, 3000);
    };

    const handleSubmit = async () => {
        if (
            robotPosition == undefined ||
            matchNumber == undefined ||
            teamNumber == undefined
        ) {
            alert('data is missing! :(');
            return;
        }

        const data: MatchData = {
            metadata: {
                scouterName,
                robotPosition,
                matchNumber,
                robotTeam: teamNumber,
            },
            startingZone: {
                start1: start1,
                start2: start2,
                start3: start3,
            },
        };
        
        sendQueue('/data/match', data);
        setCount(defaultScores);
        setMatchNumber(matchNumber + 1);
        setCountHistory([]);

        setShowCheck(true);

        setTimeout(() => {
            setShowCheck(false);
        }, 3000);
    };

    const showConfirmationDialog = () => {
        if (window.confirm('Are you sure you want to mark as absent?')) {
            // User confirmed, call the action
            handleAbsentRobot();
            // Optionally, you can also scroll to the top
            scrollTo(0, 0);
        }
    };

    const undoCount = () => {
        if (countHistory.length > 0) {
            setCountHistory(prevHistory => prevHistory.slice(0, -1));
            setCount(countHistory.at(-1)!);
        }
    };
    // const handleSetCount = (newCount: SetStateAction<MatchScores>) => {
    //     setCountHistory([...countHistory, count]);
    //     setCount(newCount);
    // };

    useEffect(() => {
        setTeamNumber(
            schedule && robotPosition && matchNumber
                ? schedule[matchNumber]?.[robotPosition]
                : undefined
        );
    }, [matchNumber, robotPosition]);

    useStatus(robotPosition, matchNumber, scouterName);

    function buttonToggle() {
        if (toggleState == false) {
            setToggleState(true);
        } else {
            setToggleState(false);
        }
    }


    return (
       <div className= {`${ toggleState ? 'bg-[#171c26]' : 'bg-white'}`}> 
        <main className='mx-auto flex w-min grid-flow-row flex-col content-center items-center justify-center '>
            {showCheck && (
                <MaterialSymbol
                    icon='check'
                    size={150}
                    fill
                    grade={200}
                    color="#48c55c"
                    className='absolute right-10 top-0 ml-10'
                />
            )}
            <h1 className='my-8 mt-10 text-center font-semibold text-[#48c55c] text-3xl'>Match Scouting App</h1>

            <div className='fixed left-4 top-4 z-30 flex flex-row gap-3 rounded-md bg-slate-200 p-1'>
                <LinkButton link='/' className='snap-none'>
                    <MaterialSymbol
                        icon='home'
                        size={60}
                        fill
                        grade={200}
                        color='green'
                        className='snap-none'
                    />
                </LinkButton>

                <Dialog
                    open
                    trigger={open => (
                        <button onClick={open}>
                            <MaterialSymbol
                                icon='account_circle'
                                size={60}
                                fill
                                grade={200}
                                className={` ${scouterName && robotPosition ? 'text-green-400' : 'text-gray-400'} snap-none`}
                            />
                        </button>
                    )}>
                    {close => (
                        <SignIn
                            scouterName={scouterName}
                            onChangeScouterName={setScouterName}
                            robotPosition={robotPosition}
                            onChangeRobotPosition={setRobotPosition}
                            // scouterPosition={scouterPosition}
                            // onChangeScouterPosition={setScouterPosition}
                            onSubmit={close}
                        />
                    )}
                </Dialog>
                <button
                    onClick={undoCount}
                    className='z-10 aspect-square snap-none rounded bg-[#f07800]  font-bold text-black '>
                    <MaterialSymbol
                        icon='undo'
                        size={60}
                        fill
                        grade={200}
                        color='black'
                        className='snap-none'
                    />
</button>

                <div className={`fixed right-4 top-4 z-20 flex flex-row gap-3 rounded-md p-1`}>
                    <ToggleButton
                    className='' 
                    buttonClassName=''
                    onClick={buttonToggle}>
                    <MaterialSymbol
                        icon={`${toggleState ? 'dark_mode' : 'light_mode'}`}
                        size={60}
                        fill
                        grade={200}
                        color='#48c55c'
                        className='snap-none'
                    />
                    </ToggleButton>
                </div>

            </div>

            <p className={`mb-2 mt-2 text-2xl ${ toggleState ? 'text-white' : 'text-[#171c26]'}`}>Match Number</p>
            <NumberInput
                className='border border-black'
                onChange={setMatchNumber}
                value={matchNumber}
            />
            <p className={`mb-2 mt-8 text-2xl ${toggleState ? 'text-white' : 'text-[#171c26]'}`}>Team Number</p>
            <TeamDropdown onChange={setTeamNumber} value={teamNumber} />

            <div>
                <button
                    onClick={showConfirmationDialog}
                    style={{ fontSize: '20px' }}
                    className='mb-2 mt-14 rounded-md bg-green-500 px-2 py-1 text-center'>
                    Robot Absent
                </button>
            </div>

            <div className='relative'>
                <h2 className='mb-5 mt-12 text-center text-5xl font-semibold text-green-600'>
                    Autonomous
                </h2>
                
                <h2 className='my-6 mt-12 text-center text-5xl font-semibold text-green-600'>
                    Tele-Op
                </h2>
               
                <h2 className='my-6 mt-12 text-center text-5xl font-semibold text-green-600'>
                    Endgame
                </h2>
                
                <div className='mb-5 mt-20 flex flex-col justify-center'>
                    <button
                        onClick={() => {
                            handleSubmit();
                            scrollTo(0, 0);
                        }}
                        style={{ fontSize: '30px' }}
                        className='rounded-md bg-green-500 px-2 py-1 text-center'>
                        Submit
                    </button>
                </div>
            </div>

            <div>
                <div className={`${toggleState ? 'text-white' : 'text-[#171c26]'} justify-center text-center`}>
                Queue: {queue.length}</div>
                <button
                    onClick={sendAll}
                    className='rounded-md bg-amber-500 px-2 py-1 text-center mb-5'>
                    {sending ? 'Sending...' : 'Resend All'}
                </button>
            </div>
        </main>
        </div> 
    );
}

export type { MatchScores };

export default MatchApp;