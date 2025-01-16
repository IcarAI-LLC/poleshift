
import { SlidersHorizontal as FilterIcon } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface FilterSelectProps {
    value: string
    onChange: (newValue: string) => void
    options: Array<{ value: string; label: string }>
}

export default function FilterSelect({
                                         value,
                                         onChange,
                                         options,
                                     }: FilterSelectProps) {
    return (
        <div className="relative w-full">
            {/* Lucide icon positioned like the search icon */}
            <FilterIcon className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Select value={value} onValueChange={(newValue) => onChange(newValue)}>
                <SelectTrigger className="w-full pl-8">
                    <SelectValue placeholder="Filter rank" />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
