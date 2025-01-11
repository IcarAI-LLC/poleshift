// src/renderer/components/DropBoxes/ModalInputs/NutrientAmmoniaInput.tsx

import React, { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"

interface NutrientAmmoniaInputProps {
    open: boolean
    onClose: () => void
    onSubmit: (ammoniaValue: number) => void
    isProcessing?: boolean
}

const NutrientAmmoniaInput: React.FC<NutrientAmmoniaInputProps> = ({
                                                                       open,
                                                                       onClose,
                                                                       onSubmit,
                                                                       isProcessing = false,
                                                                   }) => {
    const [ammoniaValue, setAmmoniaValue] = useState("")

    const handleSubmit = () => {
        const numericVal = parseFloat(ammoniaValue)
        if (isNaN(numericVal) || numericVal < 0) {
            alert("Please enter a valid positive number for ammonia")
            return
        }
        onSubmit(numericVal)
    }

    const handleClose = () => {
        // Clear the input value each time the modal is closed
        setAmmoniaValue("")
        onClose()
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => {
                // If the dialog is closed, call handleClose
                if (!isOpen) handleClose()
            }}
        >
            <DialogContent>
                <DialogHeader className="flex items-center justify-between">
                    <DialogTitle>Nutrient Ammonia</DialogTitle>
                </DialogHeader>

                <p>Please enter your measured ammonia concentration in mg/L:</p>
                <Input
                    type="number"
                    value={ammoniaValue}
                    onChange={(e) => setAmmoniaValue(e.target.value)}
                    disabled={isProcessing}
                    required
                />

                <DialogFooter>
                    <Button variant="ghost" onClick={handleClose} disabled={isProcessing}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isProcessing}>
                        {isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            "Submit"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default NutrientAmmoniaInput
