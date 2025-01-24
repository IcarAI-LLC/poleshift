'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { Input } from '@/components/ui/input';

// Replace with your own clock icon or any icon of your choice.
function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width='1em'
      height='1em'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      {...props}
    >
      <circle cx='12' cy='12' r='10' />
      <polyline points='12 6 12 12 16 14' />
    </svg>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, '0')
);
const SECONDS = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, '0')
);

type TimePickerProps = {
  /**
   * Current time value in "HH:MM:SS" format (24-hour) or `""` (empty) if cleared.
   * Omit if using as an uncontrolled component.
   */
  value?: string;
  /**
   * Callback to receive time changes in "HH:MM:SS" (24-hour) format,
   * or `""` if cleared.
   */
  onChange?: (time: string) => void;
  /** Additional classNames for the Input. */
  className?: string;
  /** Disable user interaction. */
  disabled?: boolean;
};

/**
 * A 24-hour time picker that allows:
 * - Free text input in "HH:MM:SS" format
 * - Selecting hours, minutes, and seconds from a popover
 * - Clearing by deleting the text
 */
export function TimePicker({
  value: controlledValue,
  onChange,
  className,
  disabled = false,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Local text state that the user sees in the input while typing.
  // If a controlled value is provided, we sync with it in an effect.
  const [internalText, setInternalText] = React.useState<string>('');

  // Sync local input text with controlled prop (if present)
  React.useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalText(controlledValue);
    }
  }, [controlledValue]);

  // Parse a "HH:MM:SS" string (or partial) into a normalized version
  // or return "" if cleared/invalid.
  function parseTimeString(str: string): string {
    const trimmed = str.trim();
    if (!trimmed) {
      // Empty => treat as cleared
      return '';
    }

    // Match up to three groups: HH : MM : SS
    const match = trimmed.match(/^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?$/);
    if (!match) {
      // If invalid, return empty (could alternatively keep the old value)
      return '';
    }

    let hr = parseInt(match[1] ?? '0', 10);
    let min = parseInt(match[2] ?? '0', 10);
    let sec = parseInt(match[3] ?? '0', 10);

    // Clamp
    if (hr < 0) hr = 0;
    if (hr > 23) hr = 23;
    if (min < 0) min = 0;
    if (min > 59) min = 59;
    if (sec < 0) sec = 0;
    if (sec > 59) sec = 59;

    // Return normalized string "HH:MM:SS"
    return `${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(
      sec
    ).padStart(2, '0')}`;
  }

  // Call this whenever we want to finalize an entered time, e.g. on blur or popover selection.
  function finalizeTime(str: string) {
    const parsed = parseTimeString(str);
    // Update local text
    setInternalText(parsed);
    // Fire callback
    onChange?.(parsed);
  }

  // Split current text for the popover columns
  // If the user hasn't typed anything yet, default "00:00:00" in the popover
  const [hour, minute, second] = React.useMemo(() => {
    if (!internalText) {
      return ['00', '00', '00'];
    }
    const parts = internalText.split(':');
    return [parts[0] ?? '00', parts[1] ?? '00', parts[2] ?? '00'];
  }, [internalText]);

  return (
    <div className={cn('relative inline-flex items-center', className)}>
      <Input
        disabled={disabled}
        className={cn(
          'pr-10', // Make space on the right for the icon
          disabled && 'cursor-not-allowed'
        )}
        // Show the typed (or controlled) text
        value={internalText}
        onChange={(e) => {
          if (!disabled) {
            setInternalText(e.target.value);
          }
        }}
        // When the user leaves the field, parse & finalize
        onBlur={() => {
          if (!disabled) {
            finalizeTime(internalText);
          }
        }}
        // Optionally finalize on Enter key
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            finalizeTime(internalText);
            // Optionally close popover on Enter if open
            setOpen(false);
          }
        }}
        placeholder='HH:MM:SS'
      />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type='button'
            disabled={disabled}
            className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2 p-1',
              'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300',
              disabled && 'cursor-not-allowed opacity-60'
            )}
            aria-label='Open time picker'
          >
            <ClockIcon />
          </button>
        </PopoverTrigger>

        {!disabled && (
          <PopoverContent align='start' className='p-2 space-y-2 w-auto'>
            <div className='flex flex-row gap-4'>
              {/* Hours */}
              <div className='flex flex-col max-h-48 overflow-auto border-r pr-2'>
                <div className='text-sm font-medium mb-1'>Hours</div>
                {HOURS.map((hr) => {
                  const isSelected = hr === hour;
                  return (
                    <button
                      key={hr}
                      onClick={() => {
                        // Build new time from selected hour + existing min/sec
                        const newTime = `${hr}:${minute}:${second}`;
                        finalizeTime(newTime);
                      }}
                      className={cn(
                        'w-full text-left px-2 py-1 rounded cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800',
                        isSelected ? 'bg-zinc-200 dark:bg-zinc-700' : ''
                      )}
                    >
                      {hr}
                    </button>
                  );
                })}
              </div>

              {/* Minutes */}
              <div className='flex flex-col max-h-48 overflow-auto border-r pr-2'>
                <div className='text-sm font-medium mb-1'>Minutes</div>
                {MINUTES.map((min) => {
                  const isSelected = min === minute;
                  return (
                    <button
                      key={min}
                      onClick={() => {
                        // Build new time from selected min + existing hr/sec
                        const newTime = `${hour}:${min}:${second}`;
                        finalizeTime(newTime);
                      }}
                      className={cn(
                        'w-full text-left px-2 py-1 rounded cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800',
                        isSelected ? 'bg-zinc-200 dark:bg-zinc-700' : ''
                      )}
                    >
                      {min}
                    </button>
                  );
                })}
              </div>

              {/* Seconds */}
              <div className='flex flex-col max-h-48 overflow-auto'>
                <div className='text-sm font-medium mb-1'>Seconds</div>
                {SECONDS.map((sec) => {
                  const isSelected = sec === second;
                  return (
                    <button
                      key={sec}
                      onClick={() => {
                        // Build new time from selected sec + existing hr/min
                        const newTime = `${hour}:${minute}:${sec}`;
                        finalizeTime(newTime);
                      }}
                      className={cn(
                        'w-full text-left px-2 py-1 rounded cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800',
                        isSelected ? 'bg-zinc-200 dark:bg-zinc-700' : ''
                      )}
                    >
                      {sec}
                    </button>
                  );
                })}
              </div>
            </div>
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
}
