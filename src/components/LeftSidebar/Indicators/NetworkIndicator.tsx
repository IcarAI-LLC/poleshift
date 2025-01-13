import { FC } from "react";
import { Cloud, CloudOff } from "lucide-react";
import { useNetworkStatus } from "@/hooks";

export interface NetworkIndicatorProps {
    showText?: boolean;
}

// Option 1: Arrow function component
export const NetworkIndicator: FC<NetworkIndicatorProps> = ({ showText }) => {
    const { isOnline } = useNetworkStatus();

    return (
        <div className="flex items-center gap-2 px-2 py-1">
            {isOnline ? (
                <div className={"inline-flex"}>
                <Cloud className="text-green-500 h-4 w-4" aria-label="online" />
                <span className={"text-sm px-2"}>{showText && "Online"}</span>
                </div>
            ) : (
                <div>
                <CloudOff className="text-red-500 h-4 w-4" aria-label="offline" />
                <span className={"text-sm px-2"}>{showText && "Offline"}</span>
                </div>
            )}
        </div>
    );
};
