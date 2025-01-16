
import { useState } from "react";
import { Search } from "lucide-react";
import ContainerVisualization from "./ContainerVisualization";
import { Button } from "@/components/ui/button";

const ContainerScreen = () => {
    const [isVisualizationOpen, setIsVisualizationOpen] = useState(false);

    return (
        <div className="m-2 flex flex-col overflow-hidden">
            <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold">Container Analysis</h2>
                <Button onClick={() => setIsVisualizationOpen(true)}>
                    <Search className="mr-2 h-4 w-4" />
                    Open Query Builder
                </Button>
            </div>

            <p className="mb-2 text-sm text-gray-600">
                Use the Query Builder to analyze taxonomic distributions across different
                locations and time periods.
            </p>

            <ContainerVisualization
                open={isVisualizationOpen}
                onClose={() => setIsVisualizationOpen(false)}
            />
        </div>
    );
};

export default ContainerScreen;
