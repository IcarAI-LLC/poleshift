// src/components/Sidebar/CustomCursor.tsx

import React from 'react';
import { CursorProps } from 'react-arborist';

const CustomCursor: React.FC<CursorProps> = ({ top, left, indent }) => {
  return (
    <div
      className="custom-cursor"
      style={{
        top, // Ensure these are in pixels
        left: left + indent, // Combine left with indent for accurate placement
      }}
    >
      <div className="custom-cursor__line" />
      <div className="custom-cursor__circle" />
    </div>
  );
};

export default CustomCursor;
