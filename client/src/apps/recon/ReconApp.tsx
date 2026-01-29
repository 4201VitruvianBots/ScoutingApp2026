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
    const sectionClass =
        'rounded-xl border border-white/10 bg-[#2f3646] p-4 shadow-lg shadow-black/20';

    const matchAgg = retrieveMatch?.find(
        entry => entry._id.teamNumber === teamNumber
    );
    const superAgg = retrieveSuper?.find(
        entry => entry._id.teamNumber === teamNumber
    );
    const teamPhotoSrc = teamNumber ? `/image/${teamNumber}.jpeg` : null;

    const hasLevel3 = (matchAgg?.climbRateLevel3 ?? 0) > 0;
    const scoresActiveFuel = (matchAgg?.avgTeleFuelActiveComputed ?? 0) >= 10;
    const lowBreakdowns = (matchAgg?.breakdownRate ?? 1) <= 0.1;
    const lowFouls = (superAgg?.avgFoulsTotal ?? 99) <= 1;

    return (
        <div className='min-h-screen bg-gradient-to-b from-[#171c26] via-[#161b22] to-[#12151d] px-6 pb-10 text-white'>
            <main className='mx-auto flex w-full max-w-6xl flex-col gap-6 pt-8'>
                <div className='flex flex-wrap items-center justify-between gap-4'>
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
                            className='rounded-lg bg-gray-700 px-3 py-2 text-sm transition hover:bg-gray-600 active:scale-[0.98]'
                            onClick={() => {
                                reloadRetrieveMatch();
                                reloadRetrieveSuper();
                                reloadRetrieveIndividualMatch();
                            }}>
                            Reload Data
                        </button>
                    </div>
                </div>

                <section className={sectionClass}>
                    <p className='text-sm uppercase text-gray-300'>Team</p>
                    <div className='mt-2'>
                        <TeamDropdown onChange={setTeamNumber} value={teamNumber} />
                    </div>
                </section>

                <div className='grid gap-6 md:grid-cols-2'>
                    <section className={sectionClass}>
                        <h2 className='text-lg font-semibold text-[#48c55c]'>
                            Team Photo
                        </h2>
                        <div className='mt-4 flex items-center justify-center'>
                            {teamPhotoSrc ? (
                                <img
                                    src={teamPhotoSrc}
                                    alt={`Team ${teamNumber} robot`}
                                    className='h-[240px] w-full max-w-[420px] rounded-lg border border-gray-700 object-contain bg-[#1f2432]'
                                />
                            ) : (
                                <div className='flex h-[240px] w-full max-w-[420px] items-center justify-center rounded-lg border border-dashed border-gray-600 text-sm text-gray-400'>
                                    Select a team to view a photo
                                </div>
                            )}
                        </div>
                    </section>

                    <section className={sectionClass}>
                        <h2 className='text-lg font-semibold text-[#48c55c]'>
                            Fuel Per Match
                        </h2>
                        <BarChartWIP
                            data={retrieveIndividualMatch || []}
                            teamNumber={teamNumber ?? -1}
                        />
                        {!teamNumber && (
                            <p className='mt-2 text-xs text-gray-400'>
                                Select a team to view match-level fuel trends.
                            </p>
                        )}
                    </section>
                </div>

                <div className='grid gap-6 md:grid-cols-2'>
                    <section className={sectionClass}>
                        <h2 className='text-lg font-semibold text-[#48c55c]'>
                            Match Averages
                        </h2>
                        <div className='mt-3 grid gap-2 text-sm text-gray-200'>
                            <p>
                                Auto Fuel:{' '}
                                <span className='font-semibold text-white'>
                                    {matchAgg?.avgAutoFuel?.toFixed(2) ?? 'N/A'}
                                </span>
                            </p>
                            <p>
                                Tele Active Fuel:{' '}
                                <span className='font-semibold text-white'>
                                    {matchAgg?.avgTeleFuelActiveComputed?.toFixed(2) ??
                                        'N/A'}
                                </span>
                            </p>
                            <p>
                                Tele Wasted Fuel:{' '}
                                <span className='font-semibold text-white'>
                                    {matchAgg?.avgTeleFuelWastedComputed?.toFixed(2) ??
                                        'N/A'}
                                </span>
                            </p>
                            <p>
                                Climb L1 Rate:{' '}
                                <span className='font-semibold text-white'>
                                    {matchAgg
                                        ? (matchAgg.climbRateLevel1 * 100).toFixed(1) +
                                          '%'
                                        : 'N/A'}
                                </span>
                            </p>
                            <p>
                                Climb L2 Rate:{' '}
                                <span className='font-semibold text-white'>
                                    {matchAgg
                                        ? (matchAgg.climbRateLevel2 * 100).toFixed(1) +
                                          '%'
                                        : 'N/A'}
                                </span>
                            </p>
                            <p>
                                Climb L3 Rate:{' '}
                                <span className='font-semibold text-white'>
                                    {matchAgg
                                        ? (matchAgg.climbRateLevel3 * 100).toFixed(1) +
                                          '%'
                                        : 'N/A'}
                                </span>
                            </p>
                            <p>
                                Breakdown Rate:{' '}
                                <span className='font-semibold text-white'>
                                    {matchAgg
                                        ? (matchAgg.breakdownRate * 100).toFixed(1) +
                                          '%'
                                        : 'N/A'}
                                </span>
                            </p>
                        </div>
                    </section>

                    <section className={sectionClass}>
                        <h2 className='text-lg font-semibold text-[#48c55c]'>
                            Super Scout Averages
                        </h2>
                        <div className='mt-3 grid gap-2 text-sm text-gray-200'>
                            <p>
                                Avg Fouls:{' '}
                                <span className='font-semibold text-white'>
                                    {superAgg?.avgFoulsTotal?.toFixed(2) ?? 'N/A'}
                                </span>
                            </p>
                            <p>
                                Pinning Rate:{' '}
                                <span className='font-semibold text-white'>
                                    {superAgg
                                        ? superAgg.foulRatePinning.toFixed(2)
                                        : 'N/A'}
                                </span>
                            </p>
                            <p>
                                Tower Contact Rate:{' '}
                                <span className='font-semibold text-white'>
                                    {superAgg
                                        ? superAgg.foulRateTowerContactInEndgame.toFixed(
                                              2
                                          )
                                        : 'N/A'}
                                </span>
                            </p>
                            <p>
                                Out-of-Zone Rate:{' '}
                                <span className='font-semibold text-white'>
                                    {superAgg
                                        ? superAgg.foulRateOutOfZoneShooting.toFixed(2)
                                        : 'N/A'}
                                </span>
                            </p>
                            <p>
                                Ejected Fuel Rate:{' '}
                                <span className='font-semibold text-white'>
                                    {superAgg
                                        ? superAgg.foulRateEjectedFuel.toFixed(2)
                                        : 'N/A'}
                                </span>
                            </p>
                            <p>
                                Defense Heavy Rate:{' '}
                                <span className='font-semibold text-white'>
                                    {superAgg
                                        ? (superAgg.defenseHeavyRate * 100).toFixed(1) +
                                          '%'
                                        : 'N/A'}
                                </span>
                            </p>
                        </div>
                    </section>
                </div>

                <section className={sectionClass}>
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
