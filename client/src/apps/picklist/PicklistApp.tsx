import { AnalysisEntry, WindowData } from './data';
import {
    MatchDataAggregations,
    MatchIndividualDataAggregations,
    PitResult,
    SuperDataAggregations,
    SuperIndividualDataAggregations,
    TeamData,
} from 'requests';
import Workspace from '../../components/workspace/Workspace';
import { useWorkspaceState } from '../../components/workspace/useWorkspaceState';
import StatTable from './components/StatTable';
import Dialog from '../../components/Dialog';
import StatDialog from './components/StatDialog';
import { useFetchJson } from '../../lib/useFetch';
import BarGraphDialog from './components/BarDialog';
import BarGraph from './components/BarGraph';
import ScatterPlotDialog from './components/ScatterPlotDialog';
import ScatterPlotGraph from './components/ScatterPlotGraph';
import { MaterialSymbol } from 'react-material-symbols';
import LinkButton from '../../components/LinkButton';
import StatSummaryDialog from './components/StatSummaryDialog';
import StatSummary from './components/StatSummary';
import TeamSummaryDialog from './components/TeamSummaryDialog';
import TeamSummary from './components/TeamSummary';
import { Dispatch, useState } from 'react';
import FinalPicklist from './components/FinalPicklist';
import RadarGraphDialog from './components/RadarDialog';
import RadarGraph from './components/RadarGraph';
import {
    fakeMatchAgg,
    fakePitData,
    fakeSuperAgg,
    fakeTeamInfo,
} from './fakeData';
import { buildAnalyzedData } from './analysis';

function generateWindow(
    data: AnalysisEntry[],
    table: WindowData,
    setTable: Dispatch<WindowData>,
    teamInfoJson: TeamData,
    pitData: PitResult,
    matchIndividualData: MatchIndividualDataAggregations[],
    superIndividualData: SuperIndividualDataAggregations[],
    addToFocused: Dispatch<WindowData>,
    setFinalPicklist: Dispatch<number[]>
) {
    switch (table.type) {
        case 'StatTable':
            return (
                <StatTable
                    data={data}
                    setTable={setTable}
                    table={table}
                    teamInfoJson={teamInfoJson}
                    onSubmit={addToFocused}
                    onSetFinal={setFinalPicklist}
                />
            );
        case 'BarGraph':
            return (
                <BarGraph
                    data={data}
                    table={table}
                    teamInfoJson={teamInfoJson}
                />
            );
        case 'ScatterPlotGraph':
            return (
                <ScatterPlotGraph
                    data={data}
                    table={table}
                    teamInfoJson={teamInfoJson}
                />
            );
        case 'StatSummary':
            return (
                <StatSummary
                    data={data}
                    table={table}
                    teamInfoJson={teamInfoJson}
                />
            );
        case 'TeamSummary':
            return (
                <TeamSummary
                    data={data}
                    table={table}
                    pitData={pitData}
                    teamInfoJson={teamInfoJson}
                    matchIndividualData={matchIndividualData}
                    superIndividualData={superIndividualData}
                />
            );
        case 'RadarGraph':
            return (
                <RadarGraph data={data} table={table} teamInfoJson={teamInfoJson} />
            );
        default:
            return undefined;
    }
}

function PicklistApp() {
    const [matchAgg, reloadMatchAgg] = useFetchJson<MatchDataAggregations[]>(
        '/data/retrieve'
    );
    const [superAgg, reloadSuperAgg] = useFetchJson<SuperDataAggregations[]>(
        '/data/retrieve/super'
    );
    const [matchIndividual, reloadMatchIndividual] = useFetchJson<
        MatchIndividualDataAggregations[]
    >('/data/retrieve/individualMatch');
    const [superIndividual, reloadSuperIndividual] = useFetchJson<
        SuperIndividualDataAggregations[]
    >('/data/retrieve/individualSuper');
    const [pitData, reloadPitData] = useFetchJson<PitResult>('/data/pit');
    const [teamInfo] = useFetchJson<TeamData>('/team_info.json');

    const [views, setViews, addToFocused, controls] =
        useWorkspaceState<WindowData>();

    const [finalPicklist, setFinalPicklist] = useState<number[]>([]);

    const forceFakeData =
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).has('fake');
    const loadingLiveData =
        !forceFakeData &&
        (matchAgg === undefined ||
            superAgg === undefined ||
            pitData === undefined ||
            teamInfo === undefined ||
            matchIndividual === undefined ||
            superIndividual === undefined);
    const useFakeData = forceFakeData;
    const matchAggData = useFakeData ? fakeMatchAgg : matchAgg ?? [];
    const superAggData = useFakeData ? fakeSuperAgg : superAgg ?? [];
    const pitDataValue = useFakeData ? fakePitData : pitData ?? {};
    const teamInfoValue = useFakeData ? fakeTeamInfo : teamInfo ?? {};
    const matchIndividualData = useFakeData ? [] : matchIndividual ?? [];
    const superIndividualData = useFakeData ? [] : superIndividual ?? [];

    const analyzedData: AnalysisEntry[] = buildAnalyzedData({
        matchAgg: matchAggData,
        superAgg: superAggData,
        matchIndividual: matchIndividualData,
        superIndividual: superIndividualData,
        pitData: pitDataValue,
        teamInfo: teamInfoValue,
    });

    return (
        <main className='relative grid h-screen grid-rows-[auto_1fr] overflow-hidden bg-gradient-to-b from-[#141922] via-[#11161f] to-[#0d1118] text-white'>
            <div className='flex items-center border-b border-white/10 bg-[#1f2432]/85 py-3 text-white shadow-lg shadow-black/30 backdrop-blur'>
                <LinkButton
                    link='/'
                    className='flex snap-none items-center justify-center px-2'>
                    <MaterialSymbol
                        icon='home'
                        size={50}
                        fill
                        grade={200}
                        color='white'
                        className='snap-none'
                    />
                </LinkButton>

                <button
                    className='flex snap-none items-center justify-center px-2'
                    onClick={() => {
                        reloadMatchAgg();
                        reloadSuperAgg();
                        reloadPitData();
                        reloadMatchIndividual();
                        reloadSuperIndividual();
                    }}
                    title='Refresh Data'>
                    <MaterialSymbol
                        icon='refresh'
                        size={50}
                        grade={200}
                        color='white'
                        className='snap-none'
                    />
                </button>

                <Dialog
                    trigger={open => (
                        <button
                            className='flex snap-none items-center justify-center px-2'
                            onClick={open}
                            title='Add Stat Table'>
                            <div className='flex items-center justify-center rounded border border-white/10 bg-[#2f3646] p-1'>
                                <MaterialSymbol
                                    icon='table'
                                    size={50}
                                    grade={200}
                                    color='white'
                                    className='snap-none'
                                />
                            </div>
                        </button>
                    )}>
                    {close => (
                        <StatDialog onSubmit={addToFocused} onClose={close} />
                    )}
                </Dialog>
                <Dialog
                    trigger={open => (
                        <button
                            className='flex snap-none items-center justify-center px-2'
                            onClick={open}
                            title='Add Stat Summary'>
                            <div className='flex items-center justify-center rounded border border-white/10 bg-[#2f3646] p-1'>
                                <MaterialSymbol
                                    icon='graphic_eq'
                                    size={50}
                                    grade={200}
                                    color='white'
                                    className='snap-none'
                                />
                            </div>
                        </button>
                    )}>
                    {close => (
                        <StatSummaryDialog
                            data={analyzedData || []}
                            onSubmit={addToFocused}
                            onClose={close}
                        />
                    )}
                </Dialog>
                <Dialog
                    trigger={open => (
                        <button
                            className='flex snap-none items-center justify-center px-2'
                            onClick={open}
                            title='Add Bar Graph'>
                            <div className='flex items-center justify-center rounded border border-white/10 bg-[#2f3646] p-1'>
                                <MaterialSymbol
                                    icon='bar_chart_4_bars'
                                    size={50}
                                    grade={200}
                                    color='white'
                                    className='snap-none'
                                />
                            </div>
                        </button>
                    )}>
                    {close => (
                        <BarGraphDialog
                            data={analyzedData || []}
                            onSubmit={addToFocused}
                            onClose={close}
                        />
                    )}
                </Dialog>
                <Dialog
                    trigger={open => (
                        <button
                            className='flex snap-none items-center justify-center px-2'
                            onClick={open}
                            title='Add Radar Graph'>
                            <div className='flex items-center justify-center rounded border border-white/10 bg-[#2f3646] p-1'>
                                <MaterialSymbol
                                    icon='radar'
                                    size={50}
                                    grade={200}
                                    color='white'
                                    className='snap-none'
                                />
                            </div>
                        </button>
                    )}>
                    {close => (
                        <RadarGraphDialog
                            data={analyzedData || []}
                            onSubmit={addToFocused}
                            onClose={close}
                        />
                    )}
                </Dialog>
                <Dialog
                    trigger={open => (
                        <button className='flex snap-none items-center justify-center px-2' onClick={open} title="Add Scatter Plot">
                            <div className='flex items-center justify-center rounded border border-white/10 bg-[#2f3646] p-1'>
                                <MaterialSymbol icon="scatter_plot" size={50} grade={200} color='white' className='snap-none'/>
                            </div>
                        </button>
                    )}>
                    {close => (
                        <ScatterPlotDialog
                            data={analyzedData || []}
                            onSubmit={addToFocused}
                            onClose={close}
                        />
                    )}
                </Dialog>
                <Dialog
                    trigger={open => (
                        <button
                            className='flex snap-none items-center justify-center px-2'
                            onClick={open}
                            title='Add Team Summary'>
                            <div className='flex items-center justify-center rounded border border-white/10 bg-[#2f3646] p-1'>
                                <MaterialSymbol
                                    icon='robot'
                                    size={50}
                                    grade={200}
                                    color='white'
                                    className='snap-none'
                                />
                            </div>
                        </button>
                    )}>
                    {close => (
                        <TeamSummaryDialog
                            data={analyzedData || []}
                            onSubmit={addToFocused}
                            onClose={close}
                        />
                    )}
                </Dialog>
                <h1 className='left-1/2 flex-grow text-center text-3xl font-bold text-[#48c55c] xl:absolute xl:-translate-x-1/2 xl:p-6'>
                    Statistical Analysis
                </h1>
            </div>
            {loadingLiveData && (
                <div className='absolute left-1/2 top-20 z-20 -translate-x-1/2 rounded-lg border border-white/20 bg-[#1d2330]/95 px-4 py-2 text-sm text-gray-200 shadow-lg shadow-black/40'>
                    Loading live scouting data...
                </div>
            )}
            <Workspace value={views} onChange={setViews} controls={controls}>
                {(value, onChange) => {
                    return (
                        analyzedData &&
                        generateWindow(
                            analyzedData,
                            value,
                            onChange,
                            teamInfoValue,
                            pitDataValue,
                            matchIndividualData,
                            superIndividualData,
                            addToFocused,
                            setFinalPicklist
                        )
                    );
                }}
            </Workspace>
            <FinalPicklist
                onSubmit={addToFocused}
                teamInfoJson={teamInfoValue}
                data={analyzedData}
                picklist={finalPicklist}
                setPicklist={setFinalPicklist}
            />
        </main>
    );
}

export default PicklistApp;
