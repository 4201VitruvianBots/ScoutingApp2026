/* eslint-disable @typescript-eslint/no-unused-vars */
import {
    MatchDataAggregations,
    MatchSchedule,
    MatchIndividualDataAggregations,
    SuperDataAggregations,
    SuperFoulAggregationsData,
} from 'requests';
import LinkButton from '../../components/LinkButton';
import { useFetchJson } from '../../lib/useFetch';
import { useEffect, useState } from 'react';
import { MaterialSymbol } from 'react-material-symbols';
import TeamDropdown from '../../components/TeamDropdown';
import scheduleJson from '../../assets/matchSchedule.json';
import { RobotPosition } from 'requests';

// import BarChartWIP, { MatchAndSuper } from './components/BarchartWIP';
import CheckBoxRecon from './components/CheckDisplayRecon';
import Checkbox from '../../components/Checkbox';
import CoralReconButton from './components/ReconDisplay';
import BarChartWIP, { MatchAndSuper } from './components/BarchartWIP';

const schedule = scheduleJson as MatchSchedule;

const matchStats: Exclude<keyof MatchDataAggregations, '_id'>[] = [
    // 'averageTeleCoral',
    // 'averageTeleAlgaeProcessor',
    // 'averageAutoCoral',
    // 'averageAutoAlgaeProcessor',
    // 'averageAutoAlgaeRobotNet',
    'avgClimbRate',
    'totalL1' ,
    'totalL2',
    'totalL3',
    'totalL4' ,
    'totalProcessor' ,
    'totalNet' ,
    'totalRemoved' ,
    'coralDrop1',
    'coralDrop2',
    'coralDrop3',
    'coralDrop4',
    'coralDrop5',
    'coralDrop6',
    'groundPick1',
    'groundPick2',
    'groundPick3',
    'sourcePick1',
    'sourcePick2',
    'start1',
    'start2',
    'start3',
];
const superStats: Exclude<keyof SuperDataAggregations, '_id'>[] = [
    'avgFouls',
    'maxFouls',
    'humanAccuracy'
];

function ReconApp() {
    const [retrieveMatch, reloadRetrieveMatch] =
        useFetchJson<MatchDataAggregations[]>('/data/retrieve');
    const [retrieveSuper, reloadRetrieveSuper] = useFetchJson<
        SuperDataAggregations[]
    >('/data/retrieve/super');
    const [retrieveIndividualMatch, reloadRetrieveIndividualMatch] =
        useFetchJson<MatchIndividualDataAggregations[]>('/data/retrieve/individualMatch');
    const [retrieveIndividualSuper, reloadRetrieveIndividualSuper] = useFetchJson<
        SuperFoulAggregationsData[]
    >('/data/retrieve/individualSuper');
    const [matchNumber, setMatchNumber] = useState<number>();
    const [teams, setTeams] = useState<(number | undefined)[]>([undefined]);
    const [teamNumber, setTeamNumber] = useState(Number);
    const [handleCheck ] = useState(false);
    const [robotPosition, setRobotPosition] = useState<RobotPosition>();
    const [currentMatchDisplayed, setcurrentMatchDisplayed] = useState<number>(1);

    const blueAlliance = (robotPosition: string) => {
        return ['blue_1', 'blue_2', 'blue_3'].some(position => robotPosition.includes(position));
    };

   
    useEffect(() => {
        if (!matchNumber) return;
        const match = schedule?.[matchNumber];
        if (!match) return;
        setTeams([
            match.red_1,
            match.red_2,
            match.red_3,
            match.blue_1,
            match.blue_2,
            match.blue_3,
        ]);
    }, [matchNumber]);

    const matchIncrease = () => {
        const maxAutos = (retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber == teamNumber).length) ?? 1;

        setcurrentMatchDisplayed(prevMatchDisplayed => (
        currentMatchDisplayed < maxAutos? prevMatchDisplayed + 1 : prevMatchDisplayed
    ))
}

const matchDecrease = () => {
    setcurrentMatchDisplayed(prevMatchDisplayed => (
        currentMatchDisplayed > 1? prevMatchDisplayed - 1 : prevMatchDisplayed
    ))
}

// const teamAlliance = () =>{
//     wip
// }


const setTeamNumberAndResetAutos = (value: React.SetStateAction<number>) => {
    setTeamNumber(value);
    setcurrentMatchDisplayed(1);
}

   const bingus: MatchAndSuper[] = [];
   const blingos : MatchIndividualDataAggregations[] = [];
   const bongus : SuperFoulAggregationsData[] = [];


retrieveIndividualSuper?.forEach(foulData => {

    const plsData = retrieveIndividualMatch?.find(match => 
        match._id.teamNumber === teamNumber && 
        foulData._id.teamNumber === teamNumber && 
        match._id.matchNumber === foulData._id.matchNumber
    );
    //I SEE THE TRUTH! I SEE THE LIGHT AT THE END OF THE TUNNEL!
  
    if (plsData) {
        const combinedArrayThings = {
          _id: foulData._id,
          totalInsideRobot: Array.isArray(foulData.totalInsideRobot) ? foulData.totalInsideRobot[0] : foulData.totalInsideRobot,
          totalProtectedZone: Array.isArray(foulData.totalProtectedZone) ? foulData.totalProtectedZone[0] : foulData.totalProtectedZone,
          totalMultiplePieces: Array.isArray(foulData.totalMultiplePieces) ? foulData.totalMultiplePieces[0] : foulData.totalMultiplePieces,
          totalOther: Array.isArray(foulData.totalOther) ? foulData.totalOther[0] : foulData.totalOther,
          totalPinning: Array.isArray(foulData.totalPinning) ? foulData.totalPinning[0] : foulData.totalPinning,
          totalCageFoul: Array.isArray(foulData.totalCageFoul) ? foulData.totalCageFoul[0] : foulData.totalCageFoul,
          totalProcessor: Array.isArray(plsData.totalProcessor) ? plsData.totalProcessor[0] : plsData.totalProcessor,
          totalRemoved: Array.isArray(plsData.totalRemoved) ? plsData.totalRemoved[0] : plsData.totalRemoved,
          totalNet: Array.isArray(plsData.totalNet) ? plsData.totalNet[0] : plsData.totalNet,
          totalL1: Array.isArray(plsData.totalL1) ? plsData.totalL1[0] : plsData.totalL1,
          totalL2: Array.isArray(plsData.totalL2) ? plsData.totalL2[0] : plsData.totalL2,
          totalL3: Array.isArray(plsData.totalL3) ? plsData.totalL3[0] : plsData.totalL3,
          totalL4: Array.isArray(plsData.totalL4) ? plsData.totalL4[0] : plsData.totalL4,
        };
  
      bingus.push(combinedArrayThings);
    }
  });

  console.log(bingus)

  //delete later
  console.log('Team Number:', teamNumber);

    return (
        <div className='h-auto min-h-fit border-4 border-[#171c26] bg-[#171c26]'>
            <main className='mx-auto mb-10 flex h-full grid-flow-row flex-col content-center items-center justify-center bg-[#171c26] bg-repeat text-white'>
                <h1 className='my-8 text-center text-3xl font-bold text-[#48c55c]'>
                    Recon Interface
                </h1>

                <div className='fixed left-4 top-4 z-20  flex flex-col gap-2 rounded-md p-2'>
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
                </div>

                <p className='mb-2 text-2xl text-white'>Team Number</p>
                
                <TeamDropdown 
                    onChange={setTeamNumberAndResetAutos} 
                    value={teamNumber} 
                />
                
                <button
                    className='mb-10 mt-5 rounded-lg border-2 border-slate-900 text-lg'
                    onClick={() => {
                        reloadRetrieveMatch();
                        reloadRetrieveSuper();
                        reloadRetrieveIndividualMatch();
                        reloadRetrieveIndividualSuper();
                    }}>
                    Reload Data
                </button>
                
                <div className='grid gap-10 grid-cols-4 w-full'>

                    <div className='col-span-2 ml-auto mr-20 rounded-lg border-2 border-gray-800 bg-gray-800 p-4 w-full'>
                        <img
                            src={`/image/${teamNumber}.jpeg`}
                            width='100px'
                            height='100px'
                            alt=''
                            className='items-center text-center h-[300px] w-[500px]'
                        />
                    </div>

                    <div className='col-span-2 w-full items-center justify-center rounded-lg border-2 border-gray-800 bg-gray-800 p-4'>
                       <BarChartWIP data={bingus} teamNumber={teamNumber}></BarChartWIP>
                    </div>

                <div className='mt-6 h-fit w-full col-span-2 items-center rounded-lg border-2 border-gray-800 bg-gray-800 p-4'>
                    <button 
                    className='absolute left-[40px] top-[690px]'
                    onClick={matchDecrease}>
    
                        <MaterialSymbol
                        icon='arrow_circle_left'
                        size={60}
                        fill
                        grade={200}
                        color='green'
                        className=''
                        />
                    </button>

                    <h3 className='text-3xl font-bold text-center pb-5'>Autos {currentMatchDisplayed}</h3>

                    <button 
                    className='absolute left-[270px] top-[690px]'
                    onClick={matchIncrease}>
                        <MaterialSymbol
                        icon='arrow_circle_right'
                        size={60}
                        fill
                        grade={200}
                        color='green'
                        className=''
                        />
                    </button>

                    <img
                    src={`${retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition 
                    ? blueAlliance(retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition) ? 'bluesidematch.png' : 'redsidematch.png' : 'bluesidematch.png'}`}>
                    </img>

                    <CheckBoxRecon
                        ischecked={retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber == teamNumber)[currentMatchDisplayed - 1]?.groundPick1}
                        className={`${retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition 
                            ? blueAlliance(retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition) ? 'top-[840px] left-[115px] absolute z-20 h-8 w-8 overflow-hidden rounded-full text-left' : 'top-[845px] left-[233px] absolute z-20 h-8 w-8 overflow-hidden rounded-full text-left' : 'top-[840px] left-[115px] absolute z-20 h-8 w-8 overflow-hidden rounded-full text-left'}`}>
                        {/* ground1 */}
                    </CheckBoxRecon>
                    
                    <CheckBoxRecon
                        ischecked={retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber == teamNumber)[currentMatchDisplayed - 1]?.groundPick2}
                        className={`${retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition 
                            ? blueAlliance(retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition) ? 'top-[893px] left-[115px] absolute z-20 h-8 w-8 overflow-hidden rounded-full text-left' : 'top-[900px] left-[233px] absolute z-20 h-8 w-8 overflow-hidden rounded-full text-left' : 'top-[893px] left-[115px] absolute z-20 h-8 w-8 overflow-hidden rounded-full text-left'} `}>
                        {/* ground2 */}
                    </CheckBoxRecon>
                    
                    <CheckBoxRecon
                        ischecked={retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber == teamNumber)[currentMatchDisplayed - 1]?.groundPick3}
                        className={`${retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition 
                            ? blueAlliance(retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition) ? 'top-[945px] left-[115px] absolute z-20 h-8 w-8 overflow-hidden rounded-full text-left' : 'top-[955px] left-[233px] absolute z-20 h-8 w-8 overflow-hidden rounded-full text-left' : 'top-[945px] left-[115px] absolute z-20 h-8 w-8 overflow-hidden rounded-full text-left'}`}>
                        {/* ground3 */}
                    </CheckBoxRecon>
                    
                    <CheckBoxRecon
                        ischecked={retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber == teamNumber)[currentMatchDisplayed - 1]?.sourcePick1}
                        className={`${retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition 
                            ? blueAlliance(retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition) ? 'top-[780px] left-[95px] absolute z-20 h-8 w-8 overflow-hidden rounded-full text-left' : 'top-[780px] left-[260px] absolute z-20 h-8 w-8 overflow-hidden rounded-full text-left' : 'top-[780px] left-[95px] absolute z-20 h-8 w-8 overflow-hidden rounded-full text-left'}`}>
                        {/* source1 */}
                    </CheckBoxRecon>
                    
                    <CheckBoxRecon
                        ischecked={retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber == teamNumber)[currentMatchDisplayed - 1]?.sourcePick2}
                        className={`${retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition 
                            ? blueAlliance(retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition) ? 'top-[1000px] left-[95px] absolute z-20 h-8 w-8 overflow-hidden rounded-full text-left' : 'top-[1025px] left-[260px] absolute z-20 h-8 w-8 overflow-hidden rounded-full text-left' : 'top-[1000px] left-[95px] absolute z-20 h-8 w-8 overflow-hidden rounded-full text-left'}`}>
                        {/* source2 */}
                    </CheckBoxRecon>
                    
                    <CheckBoxRecon
                        ischecked={retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber == teamNumber)[currentMatchDisplayed - 1]?.start1}
                        className={`${retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition 
                            ? blueAlliance(retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition) ? 'top-[832px] left-[300px] absolute z-20 h-8 w-8 overflow-hidden rounded-full text-left' : 'top-[840px] left-[40px] absolute z-20 h-8 w-8 overflow-hidden rounded-full text-left' : 'top-[832px] left-[300px] absolute z-20 h-8 w-8 overflow-hidden rounded-full text-left'}`}>
                        {/* start1 */}
                    </CheckBoxRecon>
                    
                    <CheckBoxRecon
                        ischecked={retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber == teamNumber)[currentMatchDisplayed - 1]?.start2}
                        className={`${retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition 
                            ? blueAlliance(retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition) ? 'top-[895px] left-[300px] absolute z-20 h-8 w-8 overflow-hidden rounded-full text-left' : 'top-[905px] left-[40px] absolute z-20 h-8 w-8 overflow-hidden rounded-full text-left' : 'top-[895px] left-[300px] absolute z-20 h-8 w-8 overflow-hidden rounded-full text-left'}`}>
                        {/* start2 */}
                    </CheckBoxRecon>
                    
                    <CheckBoxRecon
                        ischecked={retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber == teamNumber)[currentMatchDisplayed - 1]?.start3}
                        className={`${retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition 
                            ? blueAlliance(retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition) ? 'top-[955px] left-[300px] absolute z-20 h-8 w-8 overflow-hidden rounded-full text-left' : 'top-[970px] left-[40px] absolute z-20 h-8 w-8 overflow-hidden rounded-full text-left' : 'top-[955px] left-[300px] absolute z-20 h-8 w-8 overflow-hidden rounded-full text-left'}`}>
                        {/* start3 */}
                    </CheckBoxRecon>

                    <CoralReconButton 
                    buttonValue={retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber == teamNumber)[currentMatchDisplayed - 1]?.coralDrop1}
                    className={`${retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition 
                        ? blueAlliance(retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition) ? 'absolute left-[222px] top-[875px] h-[10px] w-[45px] rotate-[6.81rad]' : 'absolute left-[145px] top-[885px] h-[10px] w-[45px] rotate-[6.81rad]' : 'absolute left-[222px] top-[875px] h-[10px] w-[45px] rotate-[6.81rad]'}`}></CoralReconButton>
                    <CoralReconButton 
                    buttonValue={retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber == teamNumber)[currentMatchDisplayed - 1]?.coralDrop2}
                    className={`${retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition 
                        ? blueAlliance(retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition) ? 'absolute left-[240px] top-[905px] h-[10px] w-[45px] rotate-[4.7rad]' : 'absolute left-[163px] top-[915px] h-[10px] w-[45px] rotate-[4.7rad]' : 'absolute left-[240px] top-[905px] h-[10px] w-[45px] rotate-[4.7rad]'}`}></CoralReconButton>
                    <CoralReconButton 
                    buttonValue={retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber == teamNumber)[currentMatchDisplayed - 1]?.coralDrop3}
                    className={`${retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition 
                        ? blueAlliance(retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition) ? 'absolute left-[222px] top-[935px] h-[10px] w-[45px] rotate-[5.76rad]' : 'absolute left-[145px] top-[945px] h-[10px] w-[45px] rotate-[5.76rad]' : 'absolute left-[222px] top-[935px] h-[10px] w-[45px] rotate-[5.76rad]'}`}></CoralReconButton>
                    <CoralReconButton
                    buttonValue={retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber == teamNumber)[currentMatchDisplayed - 1]?.coralDrop4} 
                    className={`${retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition 
                        ? blueAlliance(retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition) ? 'absolute left-[187px] top-[935px] h-[10px] w-[45px] rotate-[6.81rad]' : 'absolute left-[110px] top-[945px] h-[10px] w-[45px] rotate-[6.81rad]' : 'absolute left-[187px] top-[935px] h-[10px] w-[45px] rotate-[6.81rad]'}`}></CoralReconButton>
                    <CoralReconButton 
                    buttonValue={retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber == teamNumber)[currentMatchDisplayed - 1]?.coralDrop5}
                    className={`${retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition 
                        ? blueAlliance(retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition) ? 'absolute left-[170px] top-[905px] h-[10px] w-[45px] rotate-[4.7rad]' : 'absolute left-[93px] top-[915px] h-[10px] w-[45px] rotate-[4.7rad]' : 'absolute left-[170px] top-[905px] h-[10px] w-[45px] rotate-[4.7rad]'}`}></CoralReconButton>
                    <CoralReconButton 
                    buttonValue={retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber == teamNumber)[currentMatchDisplayed - 1]?.coralDrop6}
                    className={`${retrieveIndividualMatch && retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition 
                        ? blueAlliance(retrieveIndividualMatch.filter((matchDataEntry) => matchDataEntry._id.teamNumber === teamNumber)[currentMatchDisplayed - 1]?._id.robotPosition) ? 'absolute left-[188px] top-[875px] h-[10px] w-[45px] rotate-[5.76rad]' : 'absolute left-[110px] top-[885px] h-[10px] w-[45px] rotate-[5.76rad]' : 'absolute left-[188px] top-[875px] h-[10px] w-[45px] rotate-[5.76rad]'}`}></CoralReconButton>
                    
                </div>
                {/* <div className='h-80 w-full col-span-1 col-start-3 mt-6 rounded-lg border-2 border-gray-800 bg-gray-800'>
                    <h3 className='text-3xl font-bold text-center'>Outliers</h3>
                </div> */}
                
                <div>
                <div className='justify h-24 w-full col-span-1 col-start-4 mt-6 rounded-lg border-2 border-gray-800 bg-gray-800'>
                    <h3 className='text-3xl font-bold text-center'>HP%</h3>
                    <p className='text-center mt-2 text-2xl'>
                        {(retrieveSuper?.filter((superDataEntry) => superDataEntry._id.teamNumber == teamNumber)[0]?.humanAccuracy) 
                        ? retrieveSuper?.filter((superDataEntry) => superDataEntry._id.teamNumber == teamNumber)[0]?.humanAccuracy.toFixed(3) 
                        : "No Data"}
                    </p>
                </div>
                <div className='justify h-fit w-full col-span-1 mt-8 col-start-4 rounded-lg border-2 border-gray-800 bg-gray-800'> 
                    <h3 className='text-3xl font-bold text-center'>Checklist</h3>
                    <CheckBoxRecon 
                    label='Coral L1'
                    ischecked={retrieveMatch && retrieveMatch.filter((matchEntryCheck) => matchEntryCheck._id.teamNumber == teamNumber)[0]?.totalL1 > 0}
                    className='text-center'> 
                    </CheckBoxRecon>
                    <br/>
                    <CheckBoxRecon 
                    label='Coral L2'
                    ischecked={retrieveMatch && retrieveMatch.filter((matchEntryCheck) => matchEntryCheck._id.teamNumber == teamNumber)[0]?.totalL2 > 0}
                    className='text-center'> 
                    </CheckBoxRecon>
                    <br/>
                    <CheckBoxRecon 
                    label='Coral L3'
                    ischecked={retrieveMatch && retrieveMatch.filter((matchEntryCheck) => matchEntryCheck._id.teamNumber == teamNumber)[0]?.totalL3 > 0}
                    className='text-center'> 
                    </CheckBoxRecon>
                    <br/>
                    <CheckBoxRecon 
                    label='Coral L4'
                    ischecked={retrieveMatch && retrieveMatch.filter((matchEntryCheck) => matchEntryCheck._id.teamNumber == teamNumber)[0]?.totalL4 > 0}
                    className='text-center'> 
                    </CheckBoxRecon>
                    <br/>
                    <CheckBoxRecon 
                    label='Algae Net'
                    ischecked={retrieveMatch && retrieveMatch.filter((matchEntryCheck) => matchEntryCheck._id.teamNumber == teamNumber)[0]?.totalNet > 0}
                    className='text-center'> 
                    </CheckBoxRecon>
                    <br/>
                    <CheckBoxRecon 
                    label='Algae Processor'
                    ischecked={retrieveMatch && retrieveMatch.filter((matchEntryCheck) => matchEntryCheck._id.teamNumber == teamNumber)[0]?.totalProcessor > 0}
                    className='text-center'> 
                    </CheckBoxRecon>
                    <br/>
                    <CheckBoxRecon 
                    label='Algae Removed'
                    ischecked={retrieveMatch && retrieveMatch.filter((matchEntryCheck) => matchEntryCheck._id.teamNumber == teamNumber)[0]?.totalRemoved > 0}
                    className='text-center'> 
                    </CheckBoxRecon>
                    </div>
                </div>


                </div>
            </main>
        </div>
    );
}

export default ReconApp;
