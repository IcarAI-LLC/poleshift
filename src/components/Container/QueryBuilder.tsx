import React from "react";
import { DateTime } from "luxon";
import { TaxonomicRank } from "@/lib/powersync/DrizzleSchema";

// Third-party datepicker
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// ShadCN components
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils"; // or your own className utility

// Types
interface Location {
    id: string;
    label: string;
}

interface QueryBuilderProps {
    selectedRank: TaxonomicRank;
    setSelectedRank: (rank: TaxonomicRank) => void;

    colorShadeRank: TaxonomicRank;
    setColorShadeRank: (rank: TaxonomicRank) => void;

    selectedLocations: string[];
    setSelectedLocations: (locs: string[]) => void;
    locations: Location[];

    startDate: string | null;
    setStartDate: (date: string | null) => void;
    endDate: string | null;
    setEndDate: (date: string | null) => void;

    minReadPercentage: number;
    setMinReadPercentage: (val: number) => void;
    minCoverage: number;
    setMinCoverage: (val: number) => void;

    showAsIntraPercent: boolean;
    setShowAsIntraPercent: (checked: boolean) => void;
}

export const QueryBuilder: React.FC<QueryBuilderProps> = ({
                                                              selectedRank,
                                                              setSelectedRank,
                                                              colorShadeRank,
                                                              setColorShadeRank,

                                                              selectedLocations,
                                                              setSelectedLocations,
                                                              locations,

                                                              startDate,
                                                              setStartDate,
                                                              endDate,
                                                              setEndDate,

                                                              minReadPercentage,
                                                              setMinReadPercentage,
                                                              minCoverage,
                                                              setMinCoverage,

                                                              showAsIntraPercent,
                                                              setShowAsIntraPercent,
                                                          }) => {
    // ------------------- Datepicker Helpers -------------------
    // Convert the ISO string to a JS Date or null
    const parsedStartDate = React.useMemo(
        () => (startDate ? DateTime.fromISO(startDate).toJSDate() : null),
        [startDate]
    );
    const parsedEndDate = React.useMemo(
        () => (endDate ? DateTime.fromISO(endDate).toJSDate() : null),
        [endDate]
    );

    // When the user picks a date, convert it to ISO or null
    const handleStartDateChange = (date: Date | null) => {
        if (!date) {
            setStartDate(null);
        } else {
            // convert from JS Date to ISO
            setStartDate(DateTime.fromJSDate(date).toISO());
        }
    };

    const handleEndDateChange = (date: Date | null) => {
        if (!date) {
            setEndDate(null);
        } else {
            setEndDate(DateTime.fromJSDate(date).toISO());
        }
    };

    // ------------------- Multi-select Autocomplete for Locations -------------------
    const [popoverOpen, setPopoverOpen] = React.useState(false);
    const [locationQuery, setLocationQuery] = React.useState("");

    // Filter locations based on user input in the CommandInput
    const filteredLocations = React.useMemo(() => {
        if (!locationQuery) return locations;
        return locations.filter((loc) =>
            loc.label.toLowerCase().includes(locationQuery.toLowerCase())
        );
    }, [locationQuery, locations]);

    return (
        <div className="flex flex-col gap-4">
            {/* A) Taxonomic Rank to Display */}
            <div className="flex flex-col space-y-1">
                <Label htmlFor="rank">Taxonomic Rank (to Display)</Label>
                <Select
                    value={selectedRank}
                    onValueChange={(val) => setSelectedRank(val as TaxonomicRank)}
                >
                    <SelectTrigger id="rank" className="w-full">
                        <SelectValue placeholder="Choose rank..." />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.values(TaxonomicRank).map((rank) => (
                            <SelectItem key={rank} value={rank}>
                                {rank}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* B) Color Shading Rank */}
            <div className="flex flex-col space-y-1">
                <Label htmlFor="shadeRank">Shade by Rank</Label>
                <Select
                    value={colorShadeRank}
                    onValueChange={(val) => setColorShadeRank(val as TaxonomicRank)}
                >
                    <SelectTrigger id="shadeRank" className="w-full">
                        <SelectValue placeholder="Choose rank..." />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.values(TaxonomicRank).map((rank) => (
                            <SelectItem key={rank} value={rank}>
                                {rank}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* C) Locations (multi-select via autocomplete) */}
            <div className="flex flex-col space-y-2">
                <Label>Locations</Label>
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger className="w-full justify-between inline-flex items-center rounded-md border px-3 py-2 text-sm">
                        {selectedLocations.length === 0
                            ? "Select locations..."
                            : selectedLocations
                                .map((id) => locations.find((loc) => loc.id === id)?.label)
                                .filter(Boolean)
                                .join(", ")}
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-full">
                        <Command>
                            <CommandInput
                                placeholder="Search locations..."
                                value={locationQuery}
                                onValueChange={setLocationQuery}
                            />
                            <CommandList>
                                <CommandEmpty>No results found.</CommandEmpty>
                                <CommandGroup>
                                    {filteredLocations.map((loc) => {
                                        const isSelected = selectedLocations.includes(loc.id);
                                        return (
                                            <CommandItem
                                                key={loc.id}
                                                onSelect={() => {
                                                    if (isSelected) {
                                                        setSelectedLocations(
                                                            selectedLocations.filter((item) => item !== loc.id)
                                                        );
                                                    } else {
                                                        setSelectedLocations([...selectedLocations, loc.id]);
                                                    }
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        isSelected ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                {loc.label}
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>

            {/* D) Date Range (ReactDatePicker) */}
            <div className="flex flex-col space-y-1">
                <Label htmlFor="start-date">Start Date</Label>
                <ReactDatePicker
                    id="start-date"
                    selected={parsedStartDate}
                    onChange={handleStartDateChange}
                    placeholderText="Select start date..."
                    // Optional datepicker props
                    className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
            </div>
            <div className="flex flex-col space-y-1">
                <Label htmlFor="end-date">End Date</Label>
                <ReactDatePicker
                    id="end-date"
                    selected={parsedEndDate}
                    onChange={handleEndDateChange}
                    placeholderText="Select end date..."
                    className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
            </div>

            {/* E) Minimum Read Percentage */}
            <div className="flex flex-col space-y-2">
                <Label htmlFor="min-read-percentage">Minimum Read Percentage</Label>
                <p className="text-sm text-gray-500">{minReadPercentage}%</p>
                <Slider
                    id="min-read-percentage"
                    value={[minReadPercentage]}
                    onValueChange={(val) => setMinReadPercentage(val[0])}
                    min={0}
                    max={100}
                    step={1}
                    className="w-full"
                />
            </div>

            {/* F) Minimum Coverage */}
            <div className="flex flex-col space-y-2">
                <Label htmlFor="min-coverage">Minimum Coverage</Label>
                <p className="text-sm text-gray-500">{minCoverage}</p>
                <Slider
                    id="min-coverage"
                    value={[minCoverage]}
                    onValueChange={(val) => setMinCoverage(val[0])}
                    min={0}
                    max={1}
                    step={0.01}
                    className="w-full"
                />
            </div>

            {/* G) Show as Intra-location % */}
            <div className="flex items-center space-x-2">
                <Switch
                    id="showAsIntraPercent"
                    checked={showAsIntraPercent}
                    onCheckedChange={(checked) => setShowAsIntraPercent(checked)}
                />
                <Label htmlFor="showAsIntraPercent">Show as Intra-location %</Label>
            </div>
        </div>
    );
};
