import { 20_bps } from ''

function BPSCounter({ value = 10, onChange, className }: 
    {
    value?: number;
    onChange?: (value: number) => void;
    className?: string;
}) {
    const MIN = 0;
    const MAX = 20;
    const TICKS = [5, 10, 15];
    const fillPercent = ((value - MIN) / (MAX - MIN)) * 100;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = Number(e.target.value);
        onChange?.(newValue);
    };

    return (
        <div className={`flex flex-col gap-3 ${className}`}>
            <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Balls/sec</label>
                <span className="text-3xl font-bold text-[#48c55c]">{value.toFixed(1)}</span>
            </div>
            
            <img src={}></img>

            <div className="relative space-y-6">
                {/* Slider container */}
                <div className="relative h-1 rounded-full bg-gray-700/50">
                    {/* Fill bar - visual only */}
                    <div
                        className="absolute h-full rounded-full bg-[#48c55c]"
                        style={{ width: `${fillPercent}%` }}
                    />

                    {/* Slider input */}
                    <input
                        type="range"
                        min={MIN}
                        max={MAX}
                        step={0.1}
                        value={value}
                        onChange={handleChange}
                        className="absolute inset-0 w-full appearance-none bg-transparent cursor-pointer rounded-full z-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#48c55c] [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-black/50 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/20 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#48c55c] [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:shadow-black/50 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white/20 [&::-moz-range-thumb]:appearance-none"
                    />

                    {/* Tick marks */}
                    <div className="absolute inset-0 flex justify-between pointer-events-none px-0">
                        {TICKS.map((tick) => (
                            <div
                                key={tick}
                                className="w-0.5 h-2 bg-gray-600 -translate-y-1/2 top-1/2"
                                style={{
                                    position: 'absolute',
                                    left: `${((tick - MIN) / (MAX - MIN)) * 100}%`,
                                    transform: 'translateX(-50%)'
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* All labels - min, ticks, and max */}
                <div className="relative h-5 px-0">
                    {/* Min label */}
                    <div className="absolute text-xs text-gray-400 font-medium" style={{ left: '0%', transform: 'translateX(-50%)' }}>
                        {MIN}
                    </div>

                    {/* Tick labels */}
                    {TICKS.map((tick) => (
                        <div
                            key={`label-${tick}`}
                            className="absolute text-xs text-gray-400 font-medium"
                            style={{
                                left: `${((tick - MIN) / (MAX - MIN)) * 100}%`,
                                transform: 'translateX(-50%)'
                            }}
                        >
                            {tick}
                        </div>
                    ))}

                    {/* Max label */}
                    <div className="absolute text-xs text-gray-400 font-medium" style={{ left: '100%', transform: 'translateX(-50%)' }}>
                        {MAX}+
                    </div>
                </div>
            </div>
        </div>
    );
}

export default BPSCounter;