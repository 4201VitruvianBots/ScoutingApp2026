
function CoralReconButton({
    className,
    buttonValue
}:
{
    className: string;
    buttonValue?: boolean;
}){


    return(
        <button
            className={`${buttonValue? 'bg-green-300' : 'bg-red-300'} ${className}`}
            disabled={true}
        />
    )
}

export default CoralReconButton;