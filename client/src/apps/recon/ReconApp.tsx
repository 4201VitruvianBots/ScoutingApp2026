import {
    MatchDataAggregations,
    MatchIndividualDataAggregations,
    SuperDataAggregations,
} from 'requests';
import LinkButton from '../../components/LinkButton';
import { useFetchJson } from '../../lib/useFetch';
import { useState } from 'react';
import { MaterialSymbol } from 'react-material-symbols';
import TeamDropdown from '../../components/TeamDropdown';
import CheckBoxRecon from './components/CheckDisplayRecon';
import BarChartWIP from './components/BarchartWIP';

function ReconApp() {
    const [retrieveMatch, reloadRetrieveMatch] =
        useFetchJson<MatchDataAggregations[]>('/data/retrieve');
    const [retrieveSuper, reloadRetrieveSuper] = useFetchJson<
        SuperDataAggregations[]
    >('/data/retrieve/super');
    const [retrieveIndividualMatch, reloadRetrieveIndividualMatch] =
        useFetchJson<MatchIndividualDataAggregations[]>(
            '/data/retrieve/individualMatch'
        );
    const [teamNumber, setTeamNumber] = useState<number>();

    const matchAgg = retrieveMatch?.find(
        entry => entry._id.teamNumber === teamNumber
    );
    const superAgg = retrieveSuper?.find(
        entry => entry._id.teamNumber === teamNumber
    );

    const hasLevel3 = (matchAgg?.climbRateLevel3 ?? 0) > 0;
    const scoresActiveFuel = (matchAgg?.avgTeleFuelActiveComputed ?? 0) >= 10;
    const lowBreakdowns = (matchAgg?.breakdownRate ?? 1) <= 0.1;
    const lowFouls = (superAgg?.avgFoulsTotal ?? 99) <= 1;

    return (
        <div className='min-h-screen bg-[#171c26] px-6 pb-10 text-white'>
            <main className='mx-auto flex w-full max-w-6xl flex-col gap-6 pt-8'>
                <div className='flex items-center justify-between'>
                    <h1 className='text-3xl font-bold text-[#48c55c]'>
                        Recon Dashboard
                    </h1>
                    <div className='flex items-center gap-2'>
                        <LinkButton link='/' className='snap-none'>
                            <MaterialSymbol
                                icon='home'
                                size={50}
                                fill
                                grade={200}
                                color='green'
                                className='snap-none'
                            />
                        </LinkButton>
                        <button
                            className='rounded bg-gray-700 px-3 py-2 text-sm'
                            onClick={() => {
                                reloadRetrieveMatch();
                                reloadRetrieveSuper();
                                reloadRetrieveIndividualMatch();
                            }}>
                            Reload Data
                        </button>
                    </div>
                </div>

                <section className='rounded-lg bg-[#2f3646] p-4'>
                    <p className='text-sm uppercase text-gray-300'>Team</p>
                    <TeamDropdown onChange={setTeamNumber} value={teamNumber} />
                </section>

                <div className='grid gap-6 md:grid-cols-2'>
                    <section className='rounded-lg bg-[#2f3646] p-4'>
                        <h2 className='text-lg font-semibold text-[#48c55c]'>
                            Team Photo
                        </h2>
                        <div className='mt-4 flex items-center justify-center'>
                            <img
                                src={`/image/${teamNumber}.jpeg`}
                                alt=''
                                className='h-[240px] w-full max-w-[420px] rounded border border-gray-700 object-contain'
                            />
                        </div>
                    </section>

                    <section className='rounded-lg bg-[#2f3646] p-4'>
                        <h2 className='text-lg font-semibold text-[#48c55c]'>
                            Fuel Per Match
                        </h2>
                        <BarChartWIP
                            data={retrieveIndividualMatch || []}
                            teamNumber={teamNumber ?? -1}
                        />
                    </section>
                </div>

                <div className='grid gap-6 md:grid-cols-2'>
                    <section className='rounded-lg bg-[#2f3646] p-4'>
                        <h2 className='text-lg font-semibold text-[#48c55c]'>
                            Match Averages
                        </h2>
                        <div className='mt-3 grid gap-2 text-sm text-gray-200'>
                            <p>Auto Fuel: {matchAgg?.avgAutoFuel?.toFixed(2) ?? 'N/A'}</p>
                            <p>
                                Tele Active Fuel:{' '}
                                {matchAgg?.avgTeleFuelActiveComputed?.toFixed(2) ?? 'N/A'}
                            </p>
                            <p>
                                Tele Wasted Fuel:{' '}
                                {matchAgg?.avgTeleFuelWastedComputed?.toFixed(2) ?? 'N/A'}
                            </p>
                            <p>Climb L1 Rate: {matchAgg ? (matchAgg.climbRateLevel1 * 100).toFixed(1) + '%' : 'N/A'}</p>
                            <p>Climb L2 Rate: {matchAgg ? (matchAgg.climbRateLevel2 * 100).toFixed(1) + '%' : 'N/A'}</p>
                            <p>Climb L3 Rate: {matchAgg ? (matchAgg.climbRateLevel3 * 100).toFixed(1) + '%' : 'N/A'}</p>
                            <p>Breakdown Rate: {matchAgg ? (matchAgg.breakdownRate * 100).toFixed(1) + '%' : 'N/A'}</p>
                        </div>
                    </section>

                    <section className='rounded-lg bg-[#2f3646] p-4'>
                        <h2 className='text-lg font-semibold text-[#48c55c]'>
                            Super Scout Averages
                        </h2>
                        <div className='mt-3 grid gap-2 text-sm text-gray-200'>
                            <p>Avg Fouls: {superAgg?.avgFoulsTotal?.toFixed(2) ?? 'N/A'}</p>
                            <p>Pinning Rate: {superAgg ? superAgg.foulRatePinning.toFixed(2) : 'N/A'}</p>
                            <p>Tower Contact Rate: {superAgg ? superAgg.foulRateTowerContactInEndgame.toFixed(2) : 'N/A'}</p>
                            <p>Out-of-Zone Rate: {superAgg ? superAgg.foulRateOutOfZoneShooting.toFixed(2) : 'N/A'}</p>
                            <p>Ejected Fuel Rate: {superAgg ? superAgg.foulRateEjectedFuel.toFixed(2) : 'N/A'}</p>
                            <p>Defense Heavy Rate: {superAgg ? (superAgg.defenseHeavyRate * 100).toFixed(1) + '%' : 'N/A'}</p>
                        </div>
                    </section>
                </div>

                <section className='rounded-lg bg-[#2f3646] p-4'>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>
                        Capability Checklist
                    </h2>
                    <div className='mt-3 grid gap-3 text-sm text-gray-200 sm:grid-cols-2'>
                        <CheckBoxRecon
                            ischecked={hasLevel3}
                            label='Has Level 3 climb'
                        />
                        <CheckBoxRecon
                            ischecked={scoresActiveFuel}
                            label='Scores lots of active-hub fuel'
                        />
                        <CheckBoxRecon
                            ischecked={lowBreakdowns}
                            label='Low breakdown rate'
                        />
                        <CheckBoxRecon
                            ischecked={lowFouls}
                            label='Low foul rate'
                        />
                    </div>
                </section>
            </main>
        </div>
    );
}

export default ReconApp;
