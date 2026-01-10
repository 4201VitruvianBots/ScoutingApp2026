import { Dispatch, SetStateAction } from 'react';
import { MatchScores } from '../MatchApp';
import MultiButton from '../../../components/MultiButton';

type countKeys = keyof MatchScores;

function RegionButton({
    handleCount,
    className,
    teleKey,
    autoKey,
    teleOp,
    count,
    label,
    styleMode,

}: {
    handleCount: (
        autokey: countKeys,
        telekey: countKeys,
        aKey?: countKeys
    ) => void;
    className?: string;
    teleKey: countKeys;
    autoKey: countKeys;
    teleOp: boolean;
    count: MatchScores;
    label?: string;
    styleMode?: boolean;
    textClassName?: string;

}) {
    return (
        <div className='flex flex-col items-center'>
            <p className={`text-4xl ${styleMode ?'text-white' : 'text-[#171c26]'}`}>{label}</p>
            <button
                className={` ${className} text-5xl rounded-md border-white border-2 min-w-44 h-44 bg-[#48c55c]`}
                onClick={() => handleCount(autoKey, teleKey)}
                id='one'>
                <p>
                    {count[teleOp ? teleKey : autoKey]}
                </p>
            </button>
        
        </div>
    );
}

function FieldButton({
    setLeave,
    setCount,
    teleOp,
    leave,
    count,
    styleMode
}: {
    setLeave?: Dispatch<boolean>;
    setCount: Dispatch<SetStateAction<MatchScores>>;
    teleOp: boolean;
    leave?: boolean;
    count: MatchScores;
    styleMode?: boolean;
}) {
    const handleCount = (autoKey: countKeys, teleKey: countKeys) => {
        //if (teleOp) {
            const finalKey = teleOp ? teleKey : autoKey;
            setCount(prevCount => ({
                ...prevCount,
                [finalKey]: prevCount[finalKey] + 1,
            }));
      //  }
    };

    const handleLeave = () => {
        setLeave?.(!leave);
    };
    
    return (
        <>
            <div className='flex items-center justify-center gap-2 py-2'>
                {!teleOp && (
                    <>
                        <div className='flex-col items-center justify-center pr-3'>
                            <h1 className={`text-4xl ${styleMode ? 'text-white' : 'text-[#171c26]'}`}>Mobility? </h1>
                            <p className={`${styleMode ? 'text-white' : 'text-[#171c26]'}`}>
                                The robot must be completely off the starting  
                                <br /> line at the end of the match to select yes.
                            </p>
                        </div>
                        <MultiButton
                            className='h-[100px] flex-grow basis-0 flex-row text-4xl'
                            value={leave}
                            values={[true, false]}
                            labels={['Yes', 'No']}
                            onChange={handleLeave}
                        />
                    </>
                )}
            </div>

            <div
                className={` mx-auto justify-center w-[20em] bg-center object-contain brightness-75 transition-[filter] duration-200
                ${!teleOp ? '' : ''}`}>
            </div>
                    <>
                    <div className={`my-10 flex justify-center text-4xl font-semibold ${styleMode ? 'text-white' : 'text-[#171c26]'}`}>Coral</div>
                        <div className='mb-20 flex justify-center gap-x-4'>
                        <RegionButton
                            teleOp={teleOp}
                            count={count}
                            handleCount={handleCount}
                            autoKey='autoL1'
                            teleKey='teleL1'
                            label='L1'
                            styleMode={styleMode}
                        />

                        <RegionButton
                            teleOp={teleOp}
                            count={count}
                            handleCount={handleCount}
                            autoKey='autoL2'
                            teleKey='teleL2'
                            label='L2'
                            styleMode={styleMode}
                        />
                    
                        <RegionButton
                            teleOp={teleOp}
                            count={count}
                            handleCount={handleCount}
                            autoKey='autoL3'
                            teleKey='teleL3'
                            label='L3'
                            styleMode={styleMode}
                        />
                        
                        <RegionButton
                            teleOp={teleOp}
                            count={count}
                            handleCount={handleCount}
                            autoKey='autoL4'
                            teleKey='teleL4'
                            label='L4'
                            styleMode={styleMode}
                        />

                    </div>
                    </>
                    <>
                    <div className={`my-10 flex justify-center text-4xl font-semibold ${styleMode ? 'text-white' : 'text-[#171c26]'}`}>Algae</div>
                        <div className=' mb-20 flex justify-center gap-x-4'>
                        
                        <RegionButton
                            teleOp={teleOp}
                            count={count}
                            handleCount={handleCount}
                            autoKey='autoAlgaenetRobot'
                            teleKey='teleAlgaenetRobot'
                            className={``}
                            label='Net'
                            styleMode={styleMode}
                        />
                    
                        <RegionButton
                            teleOp={teleOp}
                            count={count}
                            handleCount={handleCount}
                            autoKey='autoProcessor'
                            teleKey='teleProcessor'
                            className={``}
                            label='Processor'
                            styleMode={styleMode}
                        />

                        <RegionButton
                            teleOp={teleOp}
                            count={count}
                            handleCount={handleCount}
                            autoKey='autoRemove'
                            teleKey='teleRemove'
                            className={``}
                            label='Remove'
                            styleMode={styleMode}
                        />
                        </div>
                    </>
                    

        </>
    );
}

export default FieldButton;
