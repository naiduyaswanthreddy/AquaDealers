import React from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';

interface MobileZoomableContainerProps {
  children: React.ReactNode;
}

export const MobileZoomableContainer: React.FC<MobileZoomableContainerProps> = ({ children }) => {
  const [scale, setScale] = React.useState(1);
  const [isManualZoom, setIsManualZoom] = React.useState(false);

  const calculateAutoZoom = React.useCallback(() => {
    const screenWidth = window.innerWidth;
    if (screenWidth < 794) {
      return (screenWidth * 1.1) / 794;
    }
    return 1;
  }, []);

  React.useEffect(() => {
    const handleResize = () => {
      if (!isManualZoom) {
        setScale(calculateAutoZoom());
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isManualZoom, calculateAutoZoom]);

  const handleZoomIn = () => {
    setIsManualZoom(true);
    setScale(s => Math.min(s + 0.15, 3));
  };
  
  const handleZoomOut = () => {
    setIsManualZoom(true);
    setScale(s => Math.max(s - 0.15, 0.3));
  };
  
  const handleResetZoom = () => {
    setIsManualZoom(false);
    setScale(calculateAutoZoom());
  };

  return (
    <div className="w-full relative flex flex-col items-center">
      {/* Floating Zoom Controls */}
      <div className="sticky top-2 z-10 flex justify-center mb-2 pointer-events-none w-full max-w-sm">
        <div className="bg-slate-800/95 backdrop-blur-sm shadow-xl rounded-full flex items-center p-1 border border-white/10 pointer-events-auto">
          <button onClick={handleZoomOut} className="p-2 hover:bg-white/20 text-white rounded-full transition-colors flex items-center justify-center" title="Zoom Out">
            <ZoomOut className="w-5 h-5 text-white" />
          </button>
          <div className="w-px h-6 bg-white/30 mx-1"></div>
          <button onClick={handleResetZoom} className="px-3 hover:bg-white/20 text-white font-medium text-xs rounded-full transition-colors h-9 flex items-center" title="Reset Zoom">
            {Math.round(scale * 100)}%
          </button>
          <div className="w-px h-6 bg-white/30 mx-1"></div>
          <button onClick={handleZoomIn} className="p-2 hover:bg-white/20 text-white rounded-full transition-colors flex items-center justify-center" title="Zoom In">
            <ZoomIn className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      <div className="w-full overflow-auto bg-slate-100 p-0 sm:p-4 touch-pan-x touch-pan-y flex justify-start items-start">
        <div 
          style={{
            width: 794 * scale,
            height: 1123 * scale,
            position: 'relative',
            margin: '0 auto'
          }}
          className="shrink-0 transition-all duration-200"
        >
          <div 
            className="bg-white shadow-xl absolute top-0 left-0"
            style={{
              width: '794px',
              minHeight: '1123px',
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              transition: 'transform 0.2s ease-out'
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
