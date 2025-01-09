// src/components/TopControls/AccountButton.tsx
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AccountButtonProps {
    setShowAccountActions: (value: boolean) => void;
}

export function AccountButton({ setShowAccountActions }: AccountButtonProps) {
    const handleClick = () => {
        setShowAccountActions(true);
    };

    return (
        <Button variant="ghost" onClick={handleClick}>
            <User className="w-4 h-4" />
            <span className="sr-only">Account</span>
        </Button>
    );
}
