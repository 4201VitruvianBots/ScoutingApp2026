import { useEffect, useState } from 'react';
import {
    Drivebase,
    PitFile,
    PreferredScoringSpot,
    ScoringMethod,
    TowerCapabilityClaimed,
} from 'requests';
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
import Checkbox from '../../components/Checkbox';
import MultiButton from '../../components/MultiButton';
import TextInput from '../../components/TextInput';

function PitApp() {
    usePreventUnload();

    const [scoutedTeams, refreshScoutedTeams] = useFetchJson<number[]>(
        '/data/pit/scouted-teams'
    );
    const [sendQueuePit, sendAllPit, queuePit, sendingPit] = useQueue();

    const [scouterName, setScouterName] = useState('');
    const [teamNumber, setTeamNumber] = useState<number>();
    const [batteryCount, setBatteryCount] = useState(0);
    const [drivebase, setDrivebase] = useState<Drivebase>('tank');
    const [maxFuelStorageEstimate, setMaxFuelStorageEstimate] = useState<
        number | null
    >(null);
    const [intakeSources, setIntakeSources] = useState({
        depot: false,
        outpostCorral: false,
        floorNeutral: false,
    });
    const [scoringMethod, setScoringMethod] =
        useState<ScoringMethod>('dump');
    const [preferredScoringSpot, setPreferredScoringSpot] =
        useState<PreferredScoringSpot>('nearHub');
    const [towerCapabilityClaimed, setTowerCapabilityClaimed] =
        useState<TowerCapabilityClaimed>('unknown');
    const [robotImage, setRobotImage] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        const timeout = setInterval(refreshScoutedTeams, 60 * 1000);
        return () => clearInterval(timeout);
    }, [refreshScoutedTeams]);

    const handleSubmit = async () => {
        if (sendingPit) return;
        if (!teamNumber) {
            alert('Select a team number.');
            return;
        }

        const data: PitFile = {
            scouterName,
            teamNumber,
            drivebase,
            maxFuelStorageEstimate,
            intakeSources,
            scoringMethod,
            preferredScoringSpot,
            towerCapabilityClaimed,
            batteryCount,
            photo: robotImage,
            notes,
        };

        sendQueuePit('/data/pit', data);
        refreshScoutedTeams();
        setBatteryCount(0);
        setNotes('');
        setTeamNumber(undefined);
        setDrivebase('tank');
        setMaxFuelStorageEstimate(null);
        setIntakeSources({
            depot: false,
            outpostCorral: false,
            floorNeutral: false,
        });
        setScoringMethod('dump');
        setPreferredScoringSpot('nearHub');
        setTowerCapabilityClaimed('unknown');
        setRobotImage('');
    };

    return (
        <div className='min-h-screen bg-[#171c26] pb-10 text-white'>
            <div className='mx-auto max-w-5xl px-6'>
                <div className='mb-7 rounded-lg bg-[#2f3646] p-6'>
                    <h1 className='mb-4 text-center text-3xl font-bold text-[#48c55c]'>
                        Pit Scouting
                    </h1>
                    <p className='text-center text-sm text-gray-200'>
                        Be friendly, ask about robot capabilities, and keep notes
                        short and clear.
                    </p>
                </div>

                <div className='fixed left-4 top-4 z-20 flex flex-col gap-2 rounded-md bg-slate-200 p-2'>
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
                                    className={`${
                                        scouterName
                                            ? 'text-green-400'
                                            : 'text-gray-400'
                                    } snap-none`}
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
                </div>

                <section className='mb-6 rounded-lg bg-[#2f3646] p-6'>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>
                        Team
                    </h2>
                    <TeamDropdown
                        onChange={setTeamNumber}
                        value={teamNumber}
                        disabledOptions={scoutedTeams}
                    />
                </section>

                <section className='mb-6 rounded-lg bg-[#2f3646] p-6'>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>
                        Drivebase
                    </h2>
                    <div className='mt-3 flex flex-wrap gap-2'>
                        <MultiButton
                            onChange={setDrivebase}
                            value={drivebase}
                            labels={['Tank', 'Swerve', 'Other']}
                            values={['tank', 'swerve', 'other']}
                            selectedClassName='bg-[#48c55c] text-black'
                            unSelectedClassName='bg-gray-700 text-white'
                        />
                    </div>
                </section>

                <section className='mb-6 rounded-lg bg-[#2f3646] p-6'>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>
                        Fuel Storage Estimate
                    </h2>
                    <input
                        min={0}
                        onChange={event => {
                            const value = event.target.value;
                            setMaxFuelStorageEstimate(
                                value === '' ? null : parseInt(value, 10)
                            );
                        }}
                        value={maxFuelStorageEstimate ?? ''}
                        className='mt-3 w-40 rounded border border-gray-700 px-3 py-2 text-black'
                        type='number'
                        placeholder='0'
                    />
                </section>

                <section className='mb-6 rounded-lg bg-[#2f3646] p-6'>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>
                        Intake Sources
                    </h2>
                    <div className='mt-3 grid gap-3 sm:grid-cols-3'>
                        <Checkbox
                            checked={intakeSources.depot}
                            onChange={value =>
                                setIntakeSources(prev => ({
                                    ...prev,
                                    depot: value,
                                }))
                            }
                            className='text-base'>
                            Depot
                        </Checkbox>
                        <Checkbox
                            checked={intakeSources.outpostCorral}
                            onChange={value =>
                                setIntakeSources(prev => ({
                                    ...prev,
                                    outpostCorral: value,
                                }))
                            }
                            className='text-base'>
                            Outpost Corral
                        </Checkbox>
                        <Checkbox
                            checked={intakeSources.floorNeutral}
                            onChange={value =>
                                setIntakeSources(prev => ({
                                    ...prev,
                                    floorNeutral: value,
                                }))
                            }
                            className='text-base'>
                            Floor (Neutral)
                        </Checkbox>
                    </div>
                </section>

                <section className='mb-6 rounded-lg bg-[#2f3646] p-6'>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>
                        Scoring Method
                    </h2>
                    <div className='mt-3 flex flex-wrap gap-2'>
                        <MultiButton
                            onChange={setScoringMethod}
                            value={scoringMethod}
                            labels={['Dump', 'Low Shot', 'High Shot', 'Other']}
                            values={['dump', 'low-shot', 'high-shot', 'other']}
                            selectedClassName='bg-[#48c55c] text-black'
                            unSelectedClassName='bg-gray-700 text-white'
                        />
                    </div>
                </section>

                <section className='mb-6 rounded-lg bg-[#2f3646] p-6'>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>
                        Preferred Scoring Spot
                    </h2>
                    <div className='mt-3 flex flex-wrap gap-2'>
                        <MultiButton
                            onChange={setPreferredScoringSpot}
                            value={preferredScoringSpot}
                            labels={['Near Hub', 'Back of Zone', 'Varies']}
                            values={['nearHub', 'backOfZone', 'varies']}
                            selectedClassName='bg-[#48c55c] text-black'
                            unSelectedClassName='bg-gray-700 text-white'
                        />
                    </div>
                </section>

                <section className='mb-6 rounded-lg bg-[#2f3646] p-6'>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>
                        Tower Capability (Claimed)
                    </h2>
                    <div className='mt-3 flex flex-wrap gap-2'>
                        <MultiButton
                            onChange={setTowerCapabilityClaimed}
                            value={towerCapabilityClaimed}
                            labels={['Level 1', 'Level 2', 'Level 3', 'Unknown']}
                            values={['level1', 'level2', 'level3', 'unknown']}
                            selectedClassName='bg-[#48c55c] text-black'
                            unSelectedClassName='bg-gray-700 text-white'
                        />
                    </div>
                </section>

                <section className='mb-6 rounded-lg bg-[#2f3646] p-6'>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>
                        Battery Count
                    </h2>
                    <input
                        min={0}
                        onChange={event =>
                            setBatteryCount(parseInt(event.target.value, 10) || 0)
                        }
                        value={batteryCount}
                        className='mt-3 w-40 rounded border border-gray-700 px-3 py-2 text-black'
                        type='number'
                        placeholder='0'
                    />
                </section>

                <section className='mb-6 rounded-lg bg-[#2f3646] p-6'>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>
                        Robot Photo
                    </h2>
                    <ImageUploader value={robotImage} onChange={setRobotImage} />
                </section>

                <section className='mb-6 rounded-lg bg-[#2f3646] p-6'>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>
                        Notes
                    </h2>
                    <TextInput
                        className='w-full text-black'
                        value={notes}
                        onChange={setNotes}
                        placeholder='Short notes...'
                    />
                </section>

                <section className='rounded-lg bg-[#2f3646] p-6 text-center'>
                    <button
                        onClick={handleSubmit}
                        className='rounded bg-[#48c55c] px-4 py-3 text-lg font-semibold text-black'>
                        {sendingPit ? 'Sending...' : 'Submit'}
                    </button>

                    <div className='mt-4 text-sm text-gray-300'>
                        Queue: {queuePit.length}
                    </div>
                    <button
                        onClick={sendAllPit}
                        className='mt-2 rounded bg-amber-500 px-4 py-2 text-sm font-semibold text-black'>
                        {sendingPit ? 'Sending...' : 'Resend All'}
                    </button>
                </section>
            </div>
        </div>
    );
}

export default PitApp;
