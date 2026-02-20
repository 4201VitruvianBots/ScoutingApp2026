import {
    MatchDataAggregations,
    MatchIndividualDataAggregations,
    PitResult,
    SuperDataAggregations,
    SuperIndividualDataAggregations,
    TeamData,
} from 'requests';
import LinkButton from '../../components/LinkButton';
import { useFetchJson } from '../../lib/useFetch';
import { useState } from 'react';
import { MaterialSymbol } from 'react-material-symbols';
import TeamDropdown from '../../components/TeamDropdown';
import CheckBoxRecon from './components/CheckDisplayRecon';
import FuelPerMatchChart from '../../components/charts/FuelPerMatchChart';
import SuperFoulsPerMatchChart from '../../components/charts/SuperFoulsPerMatchChart';
import SuperBreaksPerMatchChart from '../../components/charts/SuperBreaksPerMatchChart';
import { snakeToSpaced } from '../../lib/snakeCaseConvert';

function commentToColor(comment: string) {
    switch (comment) {
        case 'great_driving':
        case 'fast_cycles':
        case 'accurate_shots':
        case 'smart_defense':
        case 'fast_climb':
            return 'bg-[#5ac750]';
        case 'good_driving':
            return 'bg-[#50a1c7]';
        case 'ok_driving':
        case 'slow_climb':
            return 'bg-[#c78450]';
        case 'drops_fuel':
        case 'inaccurate_shots':
        case 'defense_liability':
        case 'no_climb':
            return 'bg-[#c78450]';
        case 'aggressive_defense':
            return 'bg-[#c107f0]';
        case 'rough_driving':
            return 'bg-[#c75050]';
        default:
            return 'bg-gray-500';
    }
}

function formatPercent(value: number, digits = 1) {
    if (!Number.isFinite(value)) return 'N/A';
    return `${(value * 100).toFixed(digits)}%`;
}

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
    const [retrieveIndividualSuper, reloadRetrieveIndividualSuper] =
        useFetchJson<SuperIndividualDataAggregations[]>(
            '/data/retrieve/individualSuper'
        );
    const [pitData, reloadPitData] = useFetchJson<PitResult>('/data/pit');
    const [teamInfo, reloadTeamInfo] = useFetchJson<TeamData>('/team_info.json');

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
    const pitEntry = teamNumber ? pitData?.[teamNumber] : undefined;
    const teamMeta = teamNumber ? teamInfo?.[teamNumber.toString()] : undefined;
    const teamInfoDetails = teamMeta?.info;

    const hasLevel3 = (matchAgg?.climbRateLevel3 ?? 0) > 0;
    const scoresActiveFuel = (matchAgg?.avgTeleFuelActiveComputed ?? 0) >= 10;
    const lowBreakdowns = (matchAgg?.breakdownRate ?? 1) <= 0.1;
    const lowFouls = (superAgg?.avgFoulsTotal ?? 99) <= 1;
    const lowBreaks = (superAgg?.breakRateAny ?? 1) <= 0.1;
    const goodDriver = (matchAgg?.driverQualityScoreAvg ?? 0) >= 0.6;

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
                                reloadRetrieveIndividualSuper();
                                reloadPitData();
                                reloadTeamInfo();
                            }}>
                            Reload Data
                        </button>
                    </div>
                </div>

                <section className={sectionClass}>
                    <p className='text-sm uppercase text-gray-300'>Team</p>
                    <div className='mt-2'>
                        <TeamDropdown
                            onChange={setTeamNumber}
                            value={teamNumber}
                        />
                    </div>
                </section>

                <div className='grid gap-6 md:grid-cols-2'>
                    <section className={sectionClass}>
                        <h2 className='text-lg font-semibold text-[#48c55c]'>
                            Team
                        </h2>
                        <div className='mt-3 space-y-1 text-sm text-gray-200'>
                            <p className='text-base font-semibold text-white'>
                                {teamNumber
                                    ? `Team ${teamNumber}`
                                    : 'Select a team'}
                            </p>
                            {teamInfoDetails && (
                                <>
                                    <p className='text-gray-300'>
                                        {teamInfoDetails.nickname}
                                    </p>
                                    <p>
                                        {teamInfoDetails.city},{' '}
                                        {teamInfoDetails.state_prov},{' '}
                                        {teamInfoDetails.country}
                                    </p>
                                    <p>
                                        Rookie Year:{' '}
                                        {teamInfoDetails.rookie_year}
                                    </p>
                                </>
                            )}
                        </div>

                        <div className='mt-4 grid grid-cols-2 gap-2 text-sm'>
                            <div className='rounded-lg border border-white/10 bg-[#1f2432] p-2'>
                                <p className='text-xs uppercase text-gray-400'>
                                    Matches
                                </p>
                                <p className='text-lg font-semibold'>
                                    {matchAgg?.matchCount ?? 0}
                                </p>
                            </div>
                            <div className='rounded-lg border border-white/10 bg-[#1f2432] p-2'>
                                <p className='text-xs uppercase text-gray-400'>
                                    Super Matches
                                </p>
                                <p className='text-lg font-semibold'>
                                    {superAgg?.matchCount ?? 0}
                                </p>
                            </div>
                        </div>

                        <h3 className='mt-5 text-sm font-semibold text-gray-200'>
                            Pit Snapshot
                        </h3>
                        <div className='mt-2 space-y-1 text-sm text-gray-200'>
                            <p>Drivebase: {pitEntry?.drivebase ?? 'N/A'}</p>
                            <p>
                                Batteries: {pitEntry?.batteryCount ?? 'N/A'}
                            </p>
                            <p>
                                Storage:{' '}
                                {pitEntry?.maxFuelStorageEstimate ?? 'N/A'}
                            </p>
                            <p>
                                Intake:{' '}
                                {pitEntry?.intakeSources
                                    ? Object.entries(pitEntry.intakeSources)
                                          .filter(([, value]) => value)
                                          .map(([key]) => snakeToSpaced(key))
                                          .join(', ') || 'None'
                                    : 'N/A'}
                            </p>
                            <p>
                                Notes:{' '}
                                <span className='text-gray-300'>
                                    {pitEntry?.notes || 'N/A'}
                                </span>
                            </p>
                        </div>
                    </section>

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
                </div>

                <div className='grid gap-6 md:grid-cols-2'>
                    <section className={sectionClass}>
                        <h2 className='text-lg font-semibold text-[#48c55c]'>
                            Fuel Per Match (Segments)
                        </h2>
                        <FuelPerMatchChart
                            data={retrieveIndividualMatch || []}
                            teamNumber={teamNumber}
                            mode='segments'
                        />
                    </section>

                    <section className={sectionClass}>
                        <h2 className='text-lg font-semibold text-[#48c55c]'>
                            Fouls Per Match
                        </h2>
                        <SuperFoulsPerMatchChart
                            data={retrieveIndividualSuper || []}
                            teamNumber={teamNumber}
                        />
                    </section>
                </div>

                <section className={sectionClass}>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>
                        Breaks Per Match
                    </h2>
                    <SuperBreaksPerMatchChart
                        data={retrieveIndividualSuper || []}
                        teamNumber={teamNumber}
                    />
                </section>

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
                                Avg Fuel Total:{' '}
                                <span className='font-semibold text-white'>
                                    {matchAgg?.avgFuelTotal?.toFixed(2) ?? 'N/A'}
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
                                Auto Move Rate:{' '}
                                <span className='font-semibold text-white'>
                                    {matchAgg
                                        ? formatPercent(matchAgg.autoMovedRate, 1)
                                        : 'N/A'}
                                </span>
                            </p>
                            <p>
                                Driver Quality Score:{' '}
                                <span className='font-semibold text-white'>
                                    {matchAgg
                                        ? formatPercent(matchAgg.driverQualityScoreAvg, 1)
                                        : 'N/A'}
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
                            <p>
                                Breakdown (Comms):{' '}
                                <span className='font-semibold text-white'>
                                    {matchAgg
                                        ? formatPercent(matchAgg.breakdownRateComms, 1)
                                        : 'N/A'}
                                </span>
                            </p>
                            <p>
                                Breakdown (Mech):{' '}
                                <span className='font-semibold text-white'>
                                    {matchAgg
                                        ? formatPercent(
                                              matchAgg.breakdownRateMechanism,
                                              1
                                          )
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
                                Avg Breaks:{' '}
                                <span className='font-semibold text-white'>
                                    {superAgg?.avgBreaksTotal?.toFixed(2) ?? 'N/A'}
                                </span>
                            </p>
                            <p>
                                Break Rate (Any):{' '}
                                <span className='font-semibold text-white'>
                                    {superAgg
                                        ? formatPercent(superAgg.breakRateAny, 1)
                                        : 'N/A'}
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
                            <p>
                                Defense None Rate:{' '}
                                <span className='font-semibold text-white'>
                                    {superAgg
                                        ? formatPercent(superAgg.defenseNoneRate, 1)
                                        : 'N/A'}
                                </span>
                            </p>
                            <p>
                                Avg Comment Tags:{' '}
                                <span className='font-semibold text-white'>
                                    {superAgg?.avgCommentTags?.toFixed(2) ?? 'N/A'}
                                </span>
                            </p>
                        </div>
                    </section>
                </div>

                <section className={sectionClass}>
                    <h2 className='text-lg font-semibold text-[#48c55c]'>
                        Comments
                    </h2>
                    <div className='mt-3 flex flex-wrap gap-2 text-sm text-gray-200'>
                        {superAgg?.commentCounts &&
                            Object.entries(superAgg.commentCounts)
                                .sort(([_, a], [__, b]) => (b ?? 0) - (a ?? 0))
                                .map(
                                    ([comment, count]) =>
                                        (count ?? 0) > 0 && (
                                            <span
                                                key={comment}
                                                className={`max-w-fit rounded-lg border px-2 py-1 text-zinc-100 saturate-[75%] ${commentToColor(comment)}`}>
                                                {snakeToSpaced(comment)}{' '}
                                                <span className='ml-1 rounded bg-black/15 px-2 py-1'>
                                                    {count}
                                                </span>
                                            </span>
                                        )
                                )}
                        {!teamNumber && (
                            <p className='text-gray-400'>Select a team.</p>
                        )}
                        {teamNumber &&
                            (!superAgg?.commentCounts ||
                                Object.values(superAgg.commentCounts).every(
                                    v => !v || v <= 0
                                )) && (
                                <p className='text-gray-400'>
                                    No comments yet.
                                </p>
                            )}
                    </div>
                </section>

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
                        <CheckBoxRecon
                            ischecked={lowBreaks}
                            label='Low break rate'
                        />
                        <CheckBoxRecon
                            ischecked={goodDriver}
                            label='Good driver quality'
                        />
                    </div>
                </section>
            </main>
        </div>
    );
}

export default ReconApp;
