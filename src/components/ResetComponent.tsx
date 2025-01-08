"use client"

import * as React from "react"
import { RefreshCw, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { useToast } from "@/lib/hooks/use-toast.ts"

interface ResetComponentProps {
    onReset: () => Promise<void>
}

export default function ResetComponent({ onReset }: ResetComponentProps) {
    const [isResetting, setIsResetting] = React.useState(false)
    const { toast } = useToast()

    const handleReset = async () => {
        setIsResetting(true)
        try {
            // Execute your reset function
            await onReset()

            // Notify the user upon successful completion
            toast({
                title: "Reset completed successfully",
            })
        } catch (error) {
            console.error("Reset failed:", error)
            toast({
                title: "Reset failed. Please try again.",
                variant: "destructive",
            })
        } finally {
            setIsResetting(false)
        }
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        onClick={handleReset}
                        disabled={isResetting}
                        aria-label="Reset Application"
                    >
                        {isResetting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        <span className="sr-only">Reset</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Reset Application</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
