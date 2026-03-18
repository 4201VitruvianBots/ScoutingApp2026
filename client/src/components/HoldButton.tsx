import { ReactNode, useEffect, useRef } from 'react';

function HoldButton({
    onHold,
    onHoldStart,
    onHoldEnd,
    className = '',
    children,
    ariaLabel,
    disabled = false,
    triggerOnPress = true,
    repeatDelay = 300,
    repeatInterval = 70,
}: {
    onHold: () => void;
    onHoldStart?: () => void;
    onHoldEnd?: () => void;
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
    const isHoldingRef = useRef(false);

    useEffect(() => {
        return () => {
            if (holdTimeoutRef.current !== null) {
                window.clearTimeout(holdTimeoutRef.current);
            }
            if (holdIntervalRef.current !== null) {
                window.clearInterval(holdIntervalRef.current);
            }
            isHoldingRef.current = false;
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
        if (disabled || isHoldingRef.current) return;
        isHoldingRef.current = true;
        onHoldStart?.();
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
        if (!isHoldingRef.current) return;
        isHoldingRef.current = false;
        clearHoldTimers();
        onHoldEnd?.();
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
