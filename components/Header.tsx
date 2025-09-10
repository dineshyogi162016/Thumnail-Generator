
import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-10">
      <div className="container mx-auto px-4 py-4">
        <h1 className="text-2xl md:text-3xl font-bold text-center">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
            AI YouTube Thumbnail Generator
          </span>
        </h1>
        <p className="text-center text-gray-400 mt-1 text-sm md:text-base">
            Turn your headshot & title into a viral masterpiece.
        </p>
      </div>
    </header>
  );
};
