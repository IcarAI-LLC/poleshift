import {FC, memo, useCallback, useEffect} from "react"
import { useUI } from "@/hooks"
import { useAuthStore } from "@/stores/authStore"
import { PoleshiftPermissions } from "@/types"

// shadcn/ui
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Card, CardContent } from "@/components/ui/card"

interface ContextMenuProps {
  deleteItem: (id: string) => Promise<void>
}

export const ContextMenu: FC<ContextMenuProps> = ({ deleteItem }) => {
  const {
    leftSidebarContextMenu,
    selectedLeftItem,
    setSelectedLeftItem,
    closeLeftSidebarContextMenu,
    setErrorMessage,
    setShowMoveModal,
  } = useUI()

  const { userPermissions } = useAuthStore.getState()
  const { isVisible, x, y, itemId } = leftSidebarContextMenu

  const canDeleteSampleGroup =
      userPermissions?.includes(PoleshiftPermissions.DeleteSampleGroup) ?? false
  const canModifySampleGroup =
      userPermissions?.includes(PoleshiftPermissions.ModifySampleGroup) ?? false

  useEffect(() => {
    if (!isVisible) return

    const handleClickOutside = (event: MouseEvent) => {
      const menu = document.getElementById("context-menu")
      if (menu && !menu.contains(event.target as Node)) {
        closeLeftSidebarContextMenu()
      }
    }

    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [isVisible, closeLeftSidebarContextMenu])

  const handleDelete = useCallback(async () => {
    if (!itemId) return

    if (!canDeleteSampleGroup) {
      setErrorMessage("You do not have permission to delete this sample group.")
      return
    }

    try {
      await deleteItem(itemId)
      if (selectedLeftItem?.id === itemId) {
        setSelectedLeftItem(undefined)
      }
    } catch (error: any) {
      console.error("Error deleting item:", error)
      setErrorMessage(
          error instanceof Error ? error.message : "Failed to delete item"
      )
    } finally {
      closeLeftSidebarContextMenu()
    }
  }, [
    itemId,
    deleteItem,
    selectedLeftItem,
    setSelectedLeftItem,
    setErrorMessage,
    closeLeftSidebarContextMenu,
    canDeleteSampleGroup,
  ])

  const handleMoveToFolder = useCallback(() => {
    if (!itemId) return

    if (!canModifySampleGroup) {
      setErrorMessage("You do not have permission to modify this sample group.")
      return
    }

    setShowMoveModal(itemId)
    closeLeftSidebarContextMenu()
  }, [
    itemId,
    closeLeftSidebarContextMenu,
    setShowMoveModal,
    canModifySampleGroup,
    setErrorMessage,
  ])

  if (!isVisible) return null

  return (
      <div
          id="context-menu"
          style={{
            position: "absolute",
            top: y,
            left: x,
            backgroundColor: "var(--color-background)",
            border: "1px solid var(--color-border)",
            borderRadius: "4px",
            boxShadow: "0 2px 5px rgba(0, 0, 0, 0.7)",
            zIndex: 1000,
            padding: "8px",
            transform: isVisible ? "scale(1)" : "scale(0.95)",
            transition: "opacity 0.2s, transform 0.2s",
            opacity: isVisible ? 1 : 0,
          }}
      >
        <Card>
          <CardContent>
            <div className="space-y-2">
              <Tooltip>
                {/* Use asChild to avoid nesting <button> in <button> */}
                <TooltipTrigger asChild>
                  <Button
                      variant="ghost"
                      onClick={handleDelete}
                      disabled={!canDeleteSampleGroup}
                      className="w-full flex items-center justify-start space-x-2"
                  >
                    <span className="material-icons text-red-500">Delete</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent style={{ zIndex: 1100 }}>
                <span>
                  {canDeleteSampleGroup
                      ? "Delete this item"
                      : "You do not have permission to delete this item."}
                </span>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                      variant="ghost"
                      onClick={handleMoveToFolder}
                      disabled={!canModifySampleGroup}
                      className="w-full flex items-center justify-start space-x-2"
                  >
                  <span className="material-icons text-blue-500">
                    Move to Folder
                  </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent style={{ zIndex: 1100 }}>
                <span>
                  {canModifySampleGroup
                      ? "Move this item to a folder"
                      : "You do not have permission to modify this item."}
                </span>
                </TooltipContent>
              </Tooltip>
            </div>
          </CardContent>
        </Card>
      </div>
  )
}

export default memo(ContextMenu)
