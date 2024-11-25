export interface ResearchLocation {
    id: string;
    char_id: string;
    label: string;
    lat: number;
    long: number;
    is_enabled: boolean;
}

// Actions specific to locations
export type LocationAction =
    | { type: 'SET_LOCATIONS'; payload: ResearchLocation[] }
    | { type: 'UPDATE_LOCATION'; payload: ResearchLocation }
    | { type: 'UPDATE_LOCATIONS_CACHE'; payload: { timestamp: number; data: ResearchLocation[] } };