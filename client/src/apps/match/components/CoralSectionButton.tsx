

function CoralSectionButton({
    selectClassName,
    unselectClassName,
    className,
    onChange,
    value,
}: {
    selectClassName: string;
    unselectClassName: string;
    className: string;
    onChange: (newValue: boolean) => void;
    value: boolean
}) {

    function handleSelect() {
        const newValue = !value;
        onChange(newValue);
    }
// :3
    return(
        <button
            onClick={handleSelect}
            className={`${className} ${value? selectClassName : unselectClassName}`}
        />
    );
}

export default CoralSectionButton;