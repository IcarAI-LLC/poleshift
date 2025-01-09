// src/components/TopControls/FilterButton.tsx
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {RefObject} from "react";

interface FilterButtonProps {
    onClick: () => void;
    buttonRef: RefObject<HTMLButtonElement>;
}

export function FilterButton({ onClick, buttonRef }: FilterButtonProps) {
    return (
        <Button variant="ghost" onClick={onClick} ref={buttonRef}>
            <Filter className="w-4 h-4" />
            <span className="sr-only">Open Filters</span>
        </Button>
    );
}
