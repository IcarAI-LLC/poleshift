// src/components/LeftSidebar/Modals/SettingsModal.tsx
import { useState, useCallback, useEffect } from "react";
import { Globe as GlobeIcon, Loader2, Dna } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks";
import { UserSettings } from "src/types";
import { TaxonomicRank } from "@/lib/powersync/DrizzleSchema";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    // Pull the single 'userSettings' from our new hook:
    const {
        userSettings, // The existing row for the current user (or null if none)
        loading,
        error,
        addUserSetting,
        updateUserSetting,
    } = useSettings();

    const { user } = useAuth();

    // Local state for the form
    const [newSetting, setNewSetting] = useState<Partial<UserSettings>>({});

    /**
     * Whenever `userSettings` (the stored data) or the user itself changes,
     * update local form state.
     */
    useEffect(() => {
        if (userSettings) {
            // Existing row in DB; populate the form with those values
            setNewSetting(userSettings);
        } else if (user) {
            // No row yet for this user; default to a new object with the user's ID
            setNewSetting({ id: user.id });
        }
    }, [userSettings, user]);

    const handleSave = useCallback(async () => {
        try {
            const settingToSave = {
                ...newSetting,
                // Fallback to user.id just in case
                id: newSetting.id || user?.id,
            };

            if (userSettings) {
                // Row exists => update it
                await updateUserSetting(settingToSave);
            } else {
                // Otherwise => create a new row
                await addUserSetting(settingToSave as UserSettings);
            }

            onClose();
        } catch (err) {
            console.error("Failed to save setting:", err);
        }
    }, [userSettings, newSetting, user, updateUserSetting, addUserSetting, onClose]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogTitle>
                    {userSettings ? "Edit Settings" : "Create Your Settings"}
                </DialogTitle>

                {/* Loading / Error handling */}
                {loading && (
                    <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading...</span>
                    </div>
                )}

                {error && (
                    <Alert variant="destructive">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{String(error)}</AlertDescription>
                    </Alert>
                )}

                {/* User Settings Subheading */}
                <p>{userSettings ? "User Settings" : "Create New Setting"}</p>

                {/* ======== Taxonomic Starburst Section ======== */}
                <div className="flex items-center gap-2 mt-4">
                    <Dna className="h-5 w-5" />
                    <p>Taxonomic Starburst</p>
                </div>

                {/* Max Rank (kept as is) */}
                <Label htmlFor="taxonomic_starburst_max_rank">Max Rank</Label>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Select
                            onValueChange={(val: TaxonomicRank) =>
                                setNewSetting((prev) => ({
                                    ...prev,
                                    taxonomic_starburst_max_rank: val,
                                }))
                            }
                            value={newSetting.taxonomic_starburst_max_rank || ""}
                        >
                            <SelectTrigger id="taxonomic_starburst_max_rank">
                                <SelectValue placeholder="Select a rank" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.values(TaxonomicRank).map((rank) => (
                                    <SelectItem key={rank} value={rank}>
                                        {rank}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </TooltipTrigger>
                    <TooltipContent>Max depth to query for taxonomic data</TooltipContent>
                </Tooltip>

                {/*
          REMOVED:
          <Label htmlFor="taxonomic_starburst_min_rank">Min Rank</Label>
          // old min rank code...
        */}

                {/* ======== Globe Section ======== */}
                <div className="flex items-center gap-2 mt-4">
                    <GlobeIcon className="h-5 w-5" />
                    <p>Globe</p>
                </div>

                {/* Poles (Switch) */}
                <div className="flex items-center gap-2">
                    <Switch
                        id="globe_datapoint_poles"
                        checked={Boolean(newSetting.globe_datapoint_poles)}
                        onCheckedChange={(checked) =>
                            setNewSetting((prev) => ({
                                ...prev,
                                globe_datapoint_poles: checked ? 1 : 0,
                            }))
                        }
                    />
                    <Label htmlFor="globe_datapoint_poles">Poles</Label>
                </div>

                {/* Color */}
                <Label htmlFor="globe_datapoint_color">Color (RGBA)</Label>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Input
                            id="globe_datapoint_color"
                            placeholder="rgba(255, 0, 0, 0.5)"
                            value={newSetting.globe_datapoint_color || ""}
                            onChange={(e) =>
                                setNewSetting((prev) => ({
                                    ...prev,
                                    globe_datapoint_color: e.target.value,
                                }))
                            }
                        />
                    </TooltipTrigger>
                    <TooltipContent>Point color in RGBA format</TooltipContent>
                </Tooltip>

                {/* Diameter */}
                <Label htmlFor="globe_datapoint_diameter">Diameter</Label>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Input
                            id="globe_datapoint_diameter"
                            type="number"
                            placeholder="5"
                            value={newSetting.globe_datapoint_diameter || ""}
                            onChange={(e) =>
                                setNewSetting((prev) => ({
                                    ...prev,
                                    globe_datapoint_diameter: e.target.value,
                                }))
                            }
                        />
                    </TooltipTrigger>
                    <TooltipContent>Globe point size</TooltipContent>
                </Tooltip>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
