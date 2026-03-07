import { ReactNode, useEffect, useRef } from 'react';

function HoldButton({
    onHold,
    className = '',
    children,
    ariaLabel,
    disabled = false,
    triggerOnPress = true,
    repeatDelay = 300,
    repeatInterval = 70,
}: {
    onHold: () => void;
    className?: string;
    children?: ReactNode;
    ariaLabel?: string;
    disabled?: boolean;
    triggerOnPress?: boolean;
    repeatDelay?: number;
    repeatInterval?: number;
}) {
    const holdTimeoutRef = useRef<number | null>(null);
    const holdIntervalRef = useRef<number | null>(null);
    const ignoreClickRef = useRef(false);

    useEffect(() => {
        return () => {
            if (holdTimeoutRef.current !== null) {
                window.clearTimeout(holdTimeoutRef.current);
            }
            if (holdIntervalRef.current !== null) {
                window.clearInterval(holdIntervalRef.current);
            }
        };
    }, []);

    const clearHoldTimers = () => {
        if (holdTimeoutRef.current !== null) {
            window.clearTimeout(holdTimeoutRef.current);
            holdTimeoutRef.current = null;
        }
        if (holdIntervalRef.current !== null) {
            window.clearInterval(holdIntervalRef.current);
            holdIntervalRef.current = null;
        }
    };

    const startHold = () => {
        if (disabled) return;
        ignoreClickRef.current = true;
        if (triggerOnPress) {
            onHold();
        }
        clearHoldTimers();
        holdTimeoutRef.current = window.setTimeout(() => {
            holdIntervalRef.current = window.setInterval(() => {
                onHold();
            }, repeatInterval);
        }, repeatDelay);
    };

    const stopHold = () => {
        clearHoldTimers();
        window.setTimeout(() => {
            ignoreClickRef.current = false;
        }, 0);
    };

    const handleClick = () => {
        if (disabled) return;
        if (ignoreClickRef.current) {
            ignoreClickRef.current = false;
            return;
        }
        if (triggerOnPress) {
            onHold();
        }
    };

    return (
        <button
            type='button'
            aria-label={ariaLabel}
            disabled={disabled}
            className={className}
            onPointerDown={startHold}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            onClick={handleClick}>
            {children}
        </button>
    );
}

export default HoldButton;
