import React from 'react';
import { RotateCcw, PenLine } from 'lucide-react';
import Button from '@/components/ui/Button';
import { SignatureStroke } from '@/types/database';

interface SignaturePadProps {
  value: SignatureStroke[];
  onChange: (value: SignatureStroke[]) => void;
  required?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ value, onChange, required = false }) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const currentStrokeRef = React.useRef<SignatureStroke>([]);
  const hasSignature = value.length > 0;

  const setupContext = React.useCallback((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d');
    if (!context) return null;

    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 2.4;
    context.strokeStyle = '#0f172a';
    context.fillStyle = '#f0f9ff'; // match bg-sky-50
    context.fillRect(0, 0, rect.width, rect.height);
    return context;
  }, []);

  const drawStrokes = React.useCallback((strokes: SignatureStroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = setupContext(canvas);
    if (!context) return;

    const rect = canvas.getBoundingClientRect();
    strokes.forEach((stroke) => {
      if (!stroke.length) return;
      context.beginPath();
      context.moveTo(stroke[0].x * rect.width, stroke[0].y * rect.height);
      stroke.slice(1).forEach((point) => {
        context.lineTo(point.x * rect.width, point.y * rect.height);
      });
      context.stroke();
    });
  }, [setupContext]);

  const resizeCanvas = React.useCallback(() => {
    drawStrokes(value);
  }, [drawStrokes, value]);

  React.useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1),
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getPoint(event);
    const rect = canvas.getBoundingClientRect();
    currentStrokeRef.current = [point];
    context.beginPath();
    context.moveTo(point.x * rect.width, point.y * rect.height);
    setIsDrawing(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const context = canvasRef.current?.getContext('2d');
    const canvas = canvasRef.current;
    if (!context || !canvas) return;

    const point = getPoint(event);
    const rect = canvas.getBoundingClientRect();
    currentStrokeRef.current = [...currentStrokeRef.current, point];
    context.lineTo(point.x * rect.width, point.y * rect.height);
    context.stroke();
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsDrawing(false);
    if (currentStrokeRef.current.length > 1) {
      onChange([...value, currentStrokeRef.current]);
    }
    currentStrokeRef.current = [];
  };

  const handleClear = () => {
    onChange([]);
    drawStrokes([]);
  };

  return (
    <section className="billing-signature-card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <PenLine className="h-4 w-4 text-primary" />
            Customer Signature
            {required ? <span className="text-rose-500">*</span> : null}
          </div>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Confirms the customer received the items.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={!hasSignature}
          leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
        >
          Clear
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border-2 border-dashed border-primary/40 bg-sky-50/50 shadow-inner ring-4 ring-primary/5">
        <canvas
          ref={canvasRef}
          className="block h-44 w-full touch-none sm:h-56"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => setIsDrawing(false)}
          aria-label="Customer signature pad"
        />
      </div>
    </section>
  );
};

export default SignaturePad;
