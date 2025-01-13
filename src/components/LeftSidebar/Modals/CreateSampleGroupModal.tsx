import { useEffect, useState, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { DateTime } from "luxon";

import type {
    FileNodes,
    Organizations,
    SampleGroupMetadata,
    SampleLocations,
} from "src/types";
import { useAuthStore } from "@/stores/authStore";

// shadcn/ui components
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandInput,
    CommandList,
    CommandItem,
    CommandGroup,
    CommandEmpty,
} from "@/components/ui/command";

interface CreateSampleGroupModalProps {
    open: boolean;
    onClose: () => void;
    organization: Organizations | null;
    sampleGroups: Record<string, SampleGroupMetadata>;
    locations: SampleLocations[];
    createSampleGroup: (data: SampleGroupMetadata, fileNode: FileNodes) => Promise<void>;
    setErrorMessage: (msg: string) => void;
}

const CreateSampleGroupModal: React.FC<CreateSampleGroupModalProps> = ({
                                                                           open,
                                                                           onClose,
                                                                           organization,
                                                                           sampleGroups,
                                                                           locations,
                                                                           createSampleGroup,
                                                                           setErrorMessage,
                                                                       }) => {
    // Form state
    const [collectionDate, setCollectionDate] = useState("");
    // Store time in "HH:mm:ss" format
    const [collectionTime, setCollectionTime] = useState("");
    const [locCharId, setLocCharId] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    const { userId } = useAuthStore.getState();

    // Reset fields each time modal is closed
    useEffect(() => {
        if (!open) {
            setCollectionDate("");
            setCollectionTime("");
            setLocCharId("");
            setSearchTerm("");
            setIsProcessing(false);
        }
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!organization?.id || !organization.org_short_id) {
            setErrorMessage("No organization info found.");
            return;
        }

        if (!collectionDate || !locCharId) {
            setErrorMessage("Collection date and location are required.");
            return;
        }

        try {
            setIsProcessing(true);

            // Convert date to YYYY-MM-DD for base name
            const formattedDate = new Date(collectionDate)
                .toISOString()
                .split("T")[0];
            const baseName = `${formattedDate}-${locCharId}`;

            // Figure out the next sample number
            const existingNumbers = Object.values(sampleGroups)
                .filter((group) => group.org_id === organization.id)
                .map((group) => {
                    const regex = new RegExp(
                        `^${baseName}-(\\d{2})-${organization.org_short_id}$`
                    );
                    const match = group.human_readable_sample_id.match(regex);
                    return match ? parseInt(match[1], 10) : null;
                })
                .filter((num): num is number => num !== null);

            let nextNumber = 0;
            while (existingNumbers.includes(nextNumber)) {
                nextNumber += 1;
            }

            const formattedNumber = String(nextNumber).padStart(2, "0");
            const sampleGroupName = `${baseName}-${formattedNumber}-${organization.org_short_id}`;

            // Find the location by its char_id
            const location = locations.find((loc) => loc.char_id === locCharId);
            if (!location) {
                throw new Error(`Location with char_id ${locCharId} not found.`);
            }

            const id: string = uuidv4();

            // The new file node
            const newNode = {
                id,
                org_id: organization.id,
                name: sampleGroupName,
                type: "sampleGroup" as const,
                parent_id: null,
                droppable: 0,
                version: 1,
                sample_group_id: id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            // If user set a time, we combine date + time into a single UTC datetime
            const collectionDateTimeUTC = collectionTime
                ? `${collectionDate}T${collectionTime}Z`
                : undefined;

            // The sample group record
            const sampleGroupData = {
                id,
                human_readable_sample_id: sampleGroupName,
                loc_id: location.id,
                collection_date: formattedDate,
                collection_datetime_utc: collectionDateTimeUTC || null,
                user_id: userId,
                org_id: organization.id,
                latitude_recorded: null,
                longitude_recorded: null,
                notes: null,
                created_at: new Date().toISOString(),
                updated_at: DateTime.now().toISO(),
                excluded: false,
                penguin_count: null,
                penguin_present: 0,
                proximity_category: null,
            };

            await createSampleGroup(sampleGroupData, newNode);
            setErrorMessage("");
            onClose();
        }finally {
            setIsProcessing(false);
        }
    };

    // Filter location list based on searchTerm
    const filteredLocations = useMemo(() => {
        const lower = searchTerm.toLowerCase();
        return locations.filter(
            (loc) =>
                loc.label.toLowerCase().includes(lower) ||
                loc.char_id.toLowerCase().includes(lower)
        );
    }, [locations, searchTerm]);

    // Manage whether the location popover is open
    const [popoverOpen, setPopoverOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <form onSubmit={handleSubmit}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Sampling Event</DialogTitle>
                    </DialogHeader>

                    {/* Collection Date */}
                    <div className="mt-2 space-y-1">
                        <Label htmlFor="collection-date">Collection Date</Label>
                        <Input
                            id="collection-date"
                            type="date"
                            value={collectionDate}
                            onChange={(e) => setCollectionDate(e.target.value)}
                            required
                        />
                    </div>

                    {/* Collection Time (UTC) */}
                    <div className="mt-4 space-y-1">
                        <Label htmlFor="collection-time">Collection Time (UTC)</Label>
                        <Input
                            id="collection-time"
                            type="time"
                            step="1"
                            value={collectionTime}
                            onChange={(e) => setCollectionTime(e.target.value)}
                        />
                    </div>

                    {/* Location Selection (Popover + Command) */}
                    <div className="mt-4 space-y-1">
                        <Label>Location</Label>
                        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="w-full justify-between"
                                    // If user has chosen a location, show it
                                >
                                    {locCharId
                                        ? `${locCharId} selected`
                                        : "Select a location..."}
                                </Button>
                            </PopoverTrigger>

                            <PopoverContent   side="bottom"
                                              align="start"
                                              sideOffset={8}
                                              updatePositionStrategy={"optimized"}
                                              avoidCollisions={false}
                                              className="p-0 w-[250px]">
                                <Command>
                                    <CommandInput
                                        placeholder="Search location..."
                                        value={searchTerm}
                                        onValueChange={setSearchTerm}
                                    />
                                    <CommandList>
                                        <CommandEmpty>No results found.</CommandEmpty>
                                        <CommandGroup>
                                            {filteredLocations.map((loc) => (
                                                <CommandItem
                                                    key={loc.char_id}
                                                    onSelect={() => {
                                                        setLocCharId(loc.char_id);
                                                        setSearchTerm(`${loc.label} (${loc.char_id})`);
                                                        setPopoverOpen(false);
                                                    }}
                                                >
                                                    {loc.label} ({loc.char_id})
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isProcessing}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isProcessing}>
                            {isProcessing ? "Creating..." : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </form>
        </Dialog>
    );
};

export default CreateSampleGroupModal;
