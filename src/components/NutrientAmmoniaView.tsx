import { Info } from "lucide-react"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { ProcessedNutrientAmmoniaData } from "src/types"

interface NutrientAmmoniaViewProps {
  data: ProcessedNutrientAmmoniaData[]
}

export default function NutrientAmmoniaView({ data }: NutrientAmmoniaViewProps) {
  const { ammonia, ammonium } = data[0]

  return (
      <div className="p-4 space-y-4">
        <h2 className="text-lg font-semibold">Nutrient Ammonia Details</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-sm font-medium text-muted-foreground">
                <span>Ammonia Value (NH₃) mg/L</span>
                <Info className="h-4 w-4" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl text-primary">{ammonia.toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-sm font-medium text-muted-foreground">
                <span>Ammonium Value (NH₄⁺) μmol/L</span>
                <Info className="h-4 w-4" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl text-primary">{ammonium.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>
      </div>
  )
}
