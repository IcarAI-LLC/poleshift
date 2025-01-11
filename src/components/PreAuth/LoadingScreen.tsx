import { Loader2 } from "lucide-react";
import {FC} from "react";

interface LoadingScreenProps {
    message?: string;
    showRefreshHint?: boolean;
    size?: number;
}

const LoadingScreen: FC<LoadingScreenProps> = ({
                                                         message = "Loading application...",
                                                         showRefreshHint = true,
                                                         size = 44,
                                                     }) => {
    // Replicating the logic for the detailed loading message
    const getDetailMessage = () => {
        if (message.includes("Authenticating")) {
            return "Verifying your credentials and retrieving your user profile...";
        }
        if (message.includes("Loading your profile")) {
            return "Setting up your workspace and preparing the application...";
        }
        if (message.includes("Syncing")) {
            return "Retrieving and synchronizing your data with the server...";
        }
        return "Preparing your workspace...";
    };

    return (
        <div>
            {/* Spinner */}
            <div style={{ marginBottom: "1rem" }}>
                <Loader2
                    className="animate-spin"
                    style={{ width: size, height: size }}
                />
            </div>

            {/* Main loading message */}
            <h2 style={{ marginBottom: "0.5rem" }}>{message}</h2>

            {/* Detailed message */}
            <p style={{ marginBottom: "0.5rem" }}>{getDetailMessage()}</p>

            {/* Optional hint */}
            {showRefreshHint && (
                <p style={{ fontSize: "0.875rem", opacity: 0.8 }}>
                    This should take no longer than a minute...
                </p>
            )}
        </div>
    );
};

export default LoadingScreen;
