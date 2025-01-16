"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

import { Input } from "@/components/ui/input"

// Replace with your own clock icon or any icon of your choice.
function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            width="1em"
            height="1em"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    )
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"))

type TimePickerProps = {
    /**
     * Current time value in "HH:MM" format (24-hour) or `null`.
     * Omit if using as an uncontrolled component.
     */
    value?: string
    /**
     * Callback to receive time changes in "HH:MM" (24-hour) format, or `null` if cleared.
     */
    onChange?: (time: string) => void
    /** Additional classNames for the Input. */
    className?: string
    /** Disable user interaction. */
    disabled?: boolean
}

/**
 * A 24-hour time picker that does not rely on the native <input type="time"/>.
 * Allows free text input, clearing (to null), and selection from a popover list
 * of hours & minutes.
 */
export function TimePicker({
                               value: controlledValue,
                               onChange,
                               className,
                               disabled = false,
                           }: TimePickerProps) {
    const [open, setOpen] = React.useState(false)
    // Local (uncontrolled) state for the time value if no `value` is provided
    const [internalValue, setInternalValue] = React.useState<string>("")

    // If a controlled `value` is provided, we’ll use that; otherwise, fall back to internal state
    const value = controlledValue ?? internalValue

    // Helper to parse "HH:MM" or partial input and return a normalized 24hr string, or null if cleared
    function parseTimeString(str: string): string {
        // If the user deletes everything, interpret that as "clear"
        if (!str.trim()) {
            return ""
        }

        // Try matching "HH:MM" or partial
        const match = str.match(/^(\d{1,2})(?::(\d{1,2}))?$/)
        if (!match) {
            // If completely invalid text, default to "00:00"
            return "00:00"
        }

        const [unused, hh, mm] = match
        const safeMm = mm ?? "00"
        console.debug(unused); // unused to suppress the warning about unused variable
        let hourNum = parseInt(hh, 10)
        let minuteNum = parseInt(safeMm, 10)

        // Clamp the values
        if (hourNum < 0) hourNum = 0
        if (hourNum > 23) hourNum = 23
        if (minuteNum < 0) minuteNum = 0
        if (minuteNum > 59) minuteNum = 59

        return `${String(hourNum).padStart(2, "0")}:${String(minuteNum).padStart(
            2,
            "0"
        )}`
    }

    // Update the local or controlled value
    function handleChange(newValue: string) {
        const parsed = parseTimeString(newValue)
        if (controlledValue === undefined) {
            setInternalValue("")
        }
        onChange?.(parsed)
    }

    // For display in the input: if value is null, show an empty string.
    const displayValue = value ?? undefined

    // Split the current time into hours & minutes for the popover lists
    // If `value` is null, we default to "00:00" in the popover.
    const [currentHour, currentMinute] = React.useMemo(() => {
        if (!value) return ["00", "00"]
        const match = value.match(/^(\d{2}):(\d{2})$/)
        if (!match) return ["00", "00"]
        return [match[1], match[2]]
    }, [value])

    return (
        <div className={cn("relative inline-flex items-center", className)}>
            {/* The plain text input -- user can type or clear here */}
            <Input
                disabled={disabled}
                className={cn(
                    // Let the user see that they can click inside and type (default cursor is text).
                    "pr-10", // Make space on the right for the icon button
                    disabled && "cursor-not-allowed"
                )}
                value={displayValue}
                onChange={(e) => {
                    if (!disabled) {
                        handleChange(e.target.value)
                    }
                }}
                placeholder=""
            />

            {/* The icon button that toggles the popover */}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        disabled={disabled}
                        className={cn(
                            "absolute right-2 top-1/2 -translate-y-1/2",
                            "p-1 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
                            disabled && "cursor-not-allowed opacity-60"
                        )}
                        aria-label="Open time picker"
                        onClick={() => !disabled && setOpen(!open)}
                    >
                        <ClockIcon />
                    </button>
                </PopoverTrigger>
                {!disabled && (
                    <PopoverContent align="start" className="p-2 space-y-2 w-auto">
                        {/* Hours / Minutes */}
                        <div className="flex flex-row gap-4">
                            {/* Hours list */}
                            <div className="flex flex-col max-h-48 overflow-auto border-r pr-2">
                                <div className="text-sm font-medium mb-1">Hours</div>
                                {HOURS.map((hr) => {
                                    const isSelected = hr === currentHour
                                    return (
                                        <button
                                            key={hr}
                                            onClick={() => {
                                                const newValue = `${hr}:${currentMinute}`
                                                handleChange(newValue)
                                                setOpen(false)
                                            }}
                                            className={cn(
                                                "w-full text-left px-2 py-1 rounded cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800",
                                                isSelected ? "bg-zinc-200 dark:bg-zinc-700" : ""
                                            )}
                                        >
                                            {hr}
                                        </button>
                                    )
                                })}
                            </div>

                            {/* Minutes list */}
                            <div className="flex flex-col max-h-48 overflow-auto">
                                <div className="text-sm font-medium mb-1">Minutes</div>
                                {MINUTES.map((min) => {
                                    const isSelected = min === currentMinute
                                    return (
                                        <button
                                            key={min}
                                            onClick={() => {
                                                const newValue = `${currentHour}:${min}`
                                                handleChange(newValue)
                                                setOpen(false)
                                            }}
                                            className={cn(
                                                "w-full text-left px-2 py-1 rounded cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800",
                                                isSelected ? "bg-zinc-200 dark:bg-zinc-700" : ""
                                            )}
                                        >
                                            {min}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </PopoverContent>
                )}
            </Popover>
        </div>
    )
}
