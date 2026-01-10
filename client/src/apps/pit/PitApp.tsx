import React, { useEffect, useState } from 'react';
import { PitFile } from 'requests';
import LinkButton from '../../components/LinkButton';
import { MaterialSymbol } from 'react-material-symbols';
import TeamDropdown from '../../components/TeamDropdown';
import Dialog from '../../components/Dialog';
import SignIn from '../../components/SignIn';
import ConeStacker from '../../components/ConeStacker';
import { usePreventUnload } from '../../lib/usePreventUnload';
import ImageUploader from './components/ImageUploader';
import { useFetchJson } from '../../lib/useFetch';
import { useQueue } from '../../lib/useQueue';
import ToggleButton from '../../components/LightVDarkMode';

function PitApp() {
    usePreventUnload();

    const [scoutedTeams, refreshScoutedTeams] = useFetchJson<number[]>(
        '/data/pit/scouted-teams'
    );

    const [additionalNotes, setAdditionalNotes] = useState('');
    const [batteryNumber, setBatteryNumber] = useState(Number);
    const [teamNumber, setTeamNumber] = useState(Number);
    const [toggleState, setToggleState] = useState(false);
    const [hopper, setHopper] = useState(false);
    const [sendQueuePit, sendAllPit, queuePit, sendingPit] = useQueue();
    const [scouterName, setScouterName] = useState('');
    const [robotImage, setRobotImage] = useState('');
    useEffect(() => {
        const timeout = setInterval(refreshScoutedTeams, 60 * 1000);
        return () => clearInterval(timeout);
    }, [refreshScoutedTeams]);

    const handleSubmit = async () => {
        if (sendingPit) return;  

        const data: PitFile = {
            scouterName: 'bogos',
            teamNumber,
            pitBatteryCount: batteryNumber,
            hopperIntake: hopper,
            photo: robotImage,
            comments: additionalNotes,
        };
            sendQueuePit('/data/pit', data);
            refreshScoutedTeams();
            setBatteryNumber(0);
            setAdditionalNotes('');
            setTeamNumber(0);
            setHopper(false);
            setRobotImage('');
    };

    const inputBattery = {
        width: '150px',
        height: '50px',
    };
    function buttonToggle() {
        if (toggleState == false) {
            setToggleState(true);
        } else {
            setToggleState(false);
        }
    }

    return (
        <>
            <div className={`${toggleState ? 'bg-[#171c26]' : 'bg-white'}`}>
                <div className={`${toggleState ? 'border-neutral-900 bg-gray-800' : 'bg-slate-300'} mb-7 border `} >
                    <br />
                    <h1 className='mb-4 text-center text-3xl font-bold text-[#48c55c]'>
                        Pit App
                    </h1>
                    
                  <h1 className='text-center text-3x1 text-white'>Pit Scouting Guide!</h1>
                  <p className='text-center text-md text-white'>1. Introduce yourself to the team! <br/> 
                  Ex: "Hi I'm {scouterName} and I'm from Team 4201. <br/> 
                  What are you guys working on?" <br/>
                  2. Be curious! Engage with the members and <br/>
                  don't treat them as if you're just surveying them. <br/>
                  3. Compliment their robot and be friendly. <br/> 
                  Ease into questions about the robot. <br/>
                  4. Be confident and uphold Gracious Professionalism.<br/>
                  Good luck!!</p>
                </div>

                <div className='fixed left-4 top-4 z-20  flex flex-col gap-2 rounded-md bg-slate-200 p-2'>
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
                                    className={` ${scouterName ? 'text-green-400' : 'text-gray-400'} snap-none`}
                                />
                            </button>
                        )}>
                        {close => (
                            <SignIn
                                scouterName={scouterName}
                                onChangeScouterName={setScouterName}
                                pitScouting
                                onSubmit={close}
                            />
                        )}
                    </Dialog>
                    <ConeStacker />
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
                <div className='mb-2 flex items-center justify-center'>
                    <div className={`${toggleState ? 'bg-[#2f3646] border-[#2f3646]' : 'bg-slate-200 border-slate-200'} flex h-72 w-2/4 flex-col items-center justify-center rounded-lg border-4`}>
                        <h1 className={`${toggleState ? 'text-white' : 'text-[#171c26]'} text-center`}>Team Number</h1>
                        <TeamDropdown
                            onChange={setTeamNumber}
                            value={teamNumber}
                            disabledOptions={scoutedTeams}
                        />
                    </div>
                </div>
                
                <div className='mb-8 flex items-center justify-center'>
                    <div className={`${toggleState ? 'bg-[#2f3646] border-[#2f3646]' : 'bg-slate-200 border-slate-200'} flex h-72 w-2/4 flex-col items-center justify-center rounded-lg border-4`} >
                        <h1 className={`${toggleState ? 'text-white' : 'text-[#171c26]'} text-center`}>

                            Number of Batteries?
                        </h1>
                        <input
                            min={0}
                            onChange={event =>
                                setBatteryNumber(parseInt(event.target.value))
                            }
                            value={batteryNumber}
                            style={inputBattery}
                            className='border-1 mx-auto !flex w-min place-content-center rounded-lg border border-gray-700 text-center text-4xl'
                            type='number'
                            placeholder='0'></input>
                    </div>
                </div>
                <div className='mb-8 flex items-center justify-center'>  
                    
                    <div className='grid h-72 w-2/4 grid-cols-4 items-center justify-center rounded-lg border-4 border-[#2f3646] bg-[#2f3646] text-3xl'>
                    <div className='col-span-4'>
                    <h1 className='text-center text-4xl text-white font-bold'>
                            Intake
                        </h1>
                    </div>
                    
                    <div className='col-span-2 place-items-center justify-center'>
                        <h1 className='text-left text-white justify-center'>
                            Hopper/Funnel Coral Intakes
                        </h1>
                        <input type='checkbox' checked={hopper} className='form-checkbox h-12 w-12 text-blue-600'/>
                    </div>
                       
                    </div>
                   
                </div>

                <h1 className={`${toggleState ? 'text-white' : 'text-[#171c26]'} my-2 text-center`}>Robot Image</h1>
                <ImageUploader value={robotImage} onChange={setRobotImage} />

                <h1 className={`${toggleState ? 'text-white' : 'text-[#171c26]'} pt-6 text-center`}>
                    Additional Notes?
                </h1>
                <input
                    className='border-1 mx-auto mb-3 !flex w-5/6 place-content-center rounded-lg border border-gray-700 text-center text-4xl'
                    onChange={event => setAdditionalNotes(event.target.value)}
                    value={additionalNotes}
                    type='text'></input>

                <button
                    onClick={handleSubmit}
                    className='border-1 pad mx-auto !flex w-min place-content-center rounded-lg border border-gray-700 bg-[#48c55c] px-4 py-4 font-sans text-4xl font-semibold text-black shadow-xl md:bg-opacity-50 '>
                    {sendingPit ? 'Sending...' : 'Submit'}
                </button>
                <br/>
                <div>
                <div className={`${toggleState ? 'text-white' : 'text-[#171c26]'} justify-center text-center`}>
                Queue: {queuePit.length}</div>
                <div className='flex justify-center items-center'>
                <button
                    onClick={sendAllPit}
                    className='rounded-md bg-amber-500 px-2 py-1 text-center mb-5'>
                    {sendingPit ? 'Sending...' : 'Resend All'}
                </button>
                </div>
            </div>
            </div>
        </>
    );
}

export default PitApp;
