// src/lib/types/ui.ts

import {TreeItem} from "./data.ts";

export interface UIState {
    selectedLeftItem: TreeItem | null;
    selectedRightItem: Location | null;
    isSidebarCollapsed: boolean;
    isRightSidebarCollapsed: boolean;
    showAccountActions: boolean;
    errorMessage: string;
    filters: {
        startDate: string | null;
        endDate: string | null;
        selectedLocations: string[];
    };
    modal: {
        isOpen: boolean;
        title: string;
        type: 'input' | 'data';
        configItem?: any;
        modalInputs?: Record<string, string>;
        data?: any;
    };
}