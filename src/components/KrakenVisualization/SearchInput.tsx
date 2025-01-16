
import { Input } from "@/components/ui/input"
import { Search as SearchIcon } from "lucide-react"

interface SearchInputProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
}

export default function SearchInput({
                                        value,
                                        onChange,
                                        placeholder = "Search taxa...",
                                    }: SearchInputProps) {
    return (
        <div className="relative w-full">
            {/* Positioned icon absolutely on the left */}
            <SearchIcon className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="pl-8" // leave room for the icon
            />
        </div>
    )
}
