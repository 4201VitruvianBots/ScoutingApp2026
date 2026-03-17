
import { useRef, useEffect } from 'react';
import fieldImage from '../../../assets/fieldImage.png';

function AutoPathDrawer({
    className
}: {
    className?: string;}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Set canvas resolution to match display size
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Load the background image
        const img = new Image();
        img.src = fieldImage;
        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };

        const getCoordinates = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
            if (!canvas) return null;
            const rect = canvas.getBoundingClientRect();
            
            if (e instanceof TouchEvent) {
                const touch = e.touches[0];
                return {
                    x: touch.clientX - rect.left,
                    y: touch.clientY - rect.top
                };
            } else {
                return {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                };
            }
        };

        const startDrawing = (e: MouseEvent | TouchEvent) => {
            e.preventDefault();
            isDrawing.current = true;
            const coords = getCoordinates(e);
            if (coords && ctx) {
                ctx.beginPath();
                ctx.moveTo(coords.x, coords.y);
            }
        };

        const draw = (e: MouseEvent | TouchEvent) => {
            e.preventDefault();
            if (!isDrawing.current || !ctx) return;

            const coords = getCoordinates(e);
            if (coords) {
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.lineTo(coords.x, coords.y);
                ctx.stroke();
            }
        };

        const stopDrawing = (e: MouseEvent | TouchEvent) => {
            e.preventDefault();
            isDrawing.current = false;
            if (ctx) {
                ctx.closePath();
            }
        };

        // Mouse events
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseleave', stopDrawing);

        // Touch events
        canvas.addEventListener('touchstart', startDrawing);
        canvas.addEventListener('touchmove', draw);
        canvas.addEventListener('touchend', stopDrawing);

        return () => {
            canvas.removeEventListener('mousedown', startDrawing);
            canvas.removeEventListener('mousemove', draw);
            canvas.removeEventListener('mouseup', stopDrawing);
            canvas.removeEventListener('mouseleave', stopDrawing);
            canvas.removeEventListener('touchstart', startDrawing);
            canvas.removeEventListener('touchmove', draw);
            canvas.removeEventListener('touchend', stopDrawing);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className={`${className}`}
            style={{
                backgroundImage: `url(${fieldImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                width: '100%',
                height: '100%',
                display: 'block',
                touchAction: 'none'
            }}
        />
    );
}

export default AutoPathDrawer;