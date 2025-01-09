// src/components/TopControls/SettingsButton.tsx
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SettingsButtonProps {
    onClick: () => void;
}

export function SettingsButton({ onClick }: SettingsButtonProps) {
    return (
        <Button variant="ghost" onClick={onClick}>
            <Settings className="w-4 h-4" />
            <span className="sr-only">Open Settings</span>
        </Button>
    );
}
