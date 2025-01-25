// ProgressTracker.tsx

import React, { memo, useMemo } from 'react';

interface ProgressTrackerProps {
  progress: number;
  status: string;
  showPercentage?: boolean;
  type: 'processing';
}

const ProgressTracker: React.FC<ProgressTrackerProps> = memo(
  ({ progress, status, showPercentage = false, type }) => {
    // Choose a text color class based on type
    const progressColorClass = useMemo(() => {
      // You can modify these to your preferred colors
      return type === 'processing' ? 'text-blue-500' : 'text-gray-500';
    }, [type]);

    return (
      <div className='w-full text-center'>
        <p className='text-sm font-medium mb-1'>{status}</p>
        <div className='inline-flex relative'>
          <CircularProgressWithLabel
            value={progress}
            colorClass={progressColorClass}
            showPercentage={showPercentage}
          />
        </div>
      </div>
    );
  }
);

interface CircularProgressWithLabelProps {
  value: number;
  colorClass: string;
  showPercentage: boolean;
}

/**
 * A minimal circular progress indicator using an SVG <circle>.
 */
const CircularProgressWithLabel: React.FC<CircularProgressWithLabelProps> =
  memo(({ value, colorClass, showPercentage }) => {
    // Basic circle math
    const radius = 20;
    const stroke = 4;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (value / 100) * circumference;

    return (
      <div className='relative inline-flex'>
        {/* Rotated -90deg to have the circle start from the top */}
        <svg
          height={radius * 2}
          width={radius * 2}
          className={`rotate-[-90deg] ${colorClass}`}
        >
          <circle
            stroke='currentColor'
            fill='transparent'
            strokeWidth={stroke}
            strokeDasharray={`${circumference} ${circumference}`}
            style={{ strokeDashoffset }}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            strokeLinecap='round'
          />
        </svg>
        {showPercentage && (
          <div className='absolute inset-0 flex items-center justify-center text-xs text-gray-600'>
            {Math.round(value)}%
          </div>
        )}
      </div>
    );
  });

export default ProgressTracker;
