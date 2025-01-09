// src/components/TopControls/SidebarToggle.tsx
import * as React from "react";
import { Menu } from "lucide-react"; // lucide-react icon
import { Button } from "@/components/ui/button"; // or wherever your shadcn button lives

interface SidebarToggleProps {
    onToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function SidebarToggle({ onToggle }: SidebarToggleProps) {
    return (
        <Button variant="ghost" onClick={onToggle}>
            <Menu className="w-4 h-4" />
            <span className="sr-only">Toggle sidebar</span>
        </Button>
    );
}
