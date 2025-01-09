import { SidebarToggle } from "./SidebarToggle";
import { SyncButton } from "./SyncButton";
import { FilterButton } from "./FilterButton";
import { AccountButton } from "./AccountButton";
import { SettingsButton } from "./SettingsButton";
import { SettingsModal } from "./SettingsModal";
import {RefObject, useState} from "react";

interface TopControlsProps {
    isSyncing: boolean;
    onToggleSidebar: (event: React.MouseEvent<HTMLButtonElement>) => void;
    setShowAccountActions: (value: boolean) => void;
    onOpenFilters: () => void;
    filterButtonRef: RefObject<HTMLButtonElement>;
}

export const TopControls: React.FC<TopControlsProps> = ({
                                                            isSyncing,
                                                            onToggleSidebar,
                                                            setShowAccountActions,
                                                            onOpenFilters,
                                                            filterButtonRef,
                                                        }) => {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    return (
        <div className="fixed top-2 left-2 z-[1001] flex items-center gap-2">
            <SidebarToggle onToggle={onToggleSidebar} />
            <SyncButton isSyncing={isSyncing} />
            <FilterButton onClick={onOpenFilters} buttonRef={filterButtonRef} />
            <AccountButton setShowAccountActions={setShowAccountActions} />
            <SettingsButton onClick={() => setIsSettingsOpen(true)} />
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </div>
    );
};
