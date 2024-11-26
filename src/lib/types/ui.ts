// src/lib/types/ui.ts

// Also update the types in your UIState interface
import {ResearchLocation, TreeItem} from "./data.ts";
// Define the structure for context menus
export interface ContextMenuState {
    isVisible: boolean;
    x: number;
    y: number;
    itemId: string | null;
}

export interface UIState {
    selectedLeftItem: TreeItem | null;
    selectedRightItem: ResearchLocation | null;
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
    contextMenu: ContextMenuState; // Add this line
}