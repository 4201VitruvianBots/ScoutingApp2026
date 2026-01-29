function MultiButton<T>({
    className = '',
    onChange,
    values,
    labels,
    value,
    selectedClassName = 'bg-[#48c55c]',
    unSelectedClassName = 'bg-[#d4d4d4]',
}: {
    className?: string | string[];
    onChange: (value: T) => void;
    values: T[];
    labels: string[];
    value: T | undefined;
    selectedClassName?: string | string[];
    unSelectedClassName?: string | string[];
}) {
    const resolveClass = (input: string | string[] | undefined, index: number) =>
        typeof input === 'string' ? input : input?.[index] ?? '';

    return values.map((v, index) => {
        const isSelected = v === value;
        return (
            <button
                key={`${index}-${String(v)}`}
                type='button'
                onClick={() => onChange(v)}
                aria-pressed={isSelected}
                className={`rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#48c55c]/50 active:scale-[0.98] ${resolveClass(className, index)} ${
                    isSelected
                        ? resolveClass(selectedClassName, index)
                        : resolveClass(unSelectedClassName, index)
                }`}>
                {labels[index]}
            </button>
        );
    });
}

export default MultiButton;
