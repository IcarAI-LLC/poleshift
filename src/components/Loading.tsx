// src/renderer/components/Loading.tsx

import React from 'react';

const Loading: React.FC = () => {
  return (
    <div className="loading-container">
      <div className="loading-spinner" />
      <p className="loading-text">Loading...</p>
    </div>
  );
};

export default Loading;
