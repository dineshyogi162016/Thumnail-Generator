import React from 'react';
import { DownloadIcon } from './icons/DownloadIcon';

interface ThumbnailDisplayProps {
  thumbnail: string | null;
  isLoading: boolean;
  videoTitle: string;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const Placeholder = () => (
    <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
        <h3 className="text-lg font-semibold">Your thumbnail will appear here</h3>
        <p className="text-sm">Complete the steps on the left and click "Generate".</p>
    </div>
);

const LoadingSkeleton = () => (
    <div className="animate-pulse flex items-center justify-center h-full bg-gray-700 rounded-lg">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
    </div>
);

export const ThumbnailDisplay: React.FC<ThumbnailDisplayProps> = ({ thumbnail, isLoading, videoTitle, onUndo, onRedo, canUndo, canRedo }) => {
  const handleDownload = () => {
    if (!thumbnail) return;
    const link = document.createElement('a');
    link.href = thumbnail;
    const safeTitle = videoTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'thumbnail';
    link.download = `${safeTitle}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <div className="w-full aspect-video bg-gray-800 border-2 border-gray-700 rounded-lg flex items-center justify-center p-2 relative">
        {isLoading ? (
          <LoadingSkeleton />
        ) : thumbnail ? (
          <img src={thumbnail} alt="Generated Thumbnail" className="w-full h-full object-contain rounded-md" />
        ) : (
          <Placeholder />
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button 
          onClick={onUndo} 
          disabled={!canUndo || isLoading}
          className="col-span-1 flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800/50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out"
          aria-label="Undo"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v6h6"/><path d="M21 12A9 9 0 0 0 6.43 6.43L3 10"/></svg>
          Undo
        </button>
        <button 
          onClick={onRedo} 
          disabled={!canRedo || isLoading}
          className="col-span-1 flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800/50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out"
          aria-label="Redo"
        >
          Redo
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 3v6h-6"/><path d="M3 12a9 9 0 0 0 14.57 6.57L21 14"/></svg>
        </button>
        {thumbnail && !isLoading && (
          <button
            onClick={handleDownload}
            className="col-span-3 flex items-center justify-center gap-3 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out mt-2"
          >
            <DownloadIcon className="w-5 h-5" />
            Download Thumbnail
          </button>
        )}
      </div>
    </div>
  );
};
