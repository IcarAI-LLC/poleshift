import {FC, useEffect, useState} from "react";
import { FileNodeWithChildren, useData, useUI } from "@/hooks";
// shadcn/ui components
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const MoveModal: FC = () => {
    const { fileTree, moveNode } = useData();
    const { moveModalItemId, setHideMoveModal } = useUI();

    // Local state to control open/close
    const [open, setOpen] = useState(false);

    // The user’s currently chosen parent folder
    // Use "ROOT" to indicate that we want no parent (root).
    const [selectedFolderId, setSelectedFolderId] = useState<string>("ROOT");

    // Whenever moveModalItemId changes, we open/close the modal accordingly
    useEffect(() => {
        if (moveModalItemId) {
            setOpen(true);
        } else {
            setOpen(false);
        }
    }, [moveModalItemId]);

    // Helper function: recursively gather only the folders
    const allFolders = (nodes: FileNodeWithChildren[]): FileNodeWithChildren[] => {
        let result: FileNodeWithChildren[] = [];
        for (const node of nodes) {
            if (node.type === "folder") result.push(node);
            if (node.children && node.children.length > 0) {
                result = result.concat(allFolders(node.children));
            }
        }
        return result;
    };

    const folders = allFolders(fileTree);

    const handleMove = async () => {
        if (!moveModalItemId) return;

        // If user selects "ROOT", pass `null` as the parent
        const newParent = selectedFolderId === "ROOT" ? null : selectedFolderId;

        await moveNode(moveModalItemId, newParent);

        // Close modal locally
        setOpen(false);

        // Notify the parent we’re done
        setHideMoveModal();
    };

    const handleCloseDialog = (nextOpen: boolean) => {
        // If the dialog is closing, also reset parent UI state
        if (!nextOpen) {
            setHideMoveModal();
            setSelectedFolderId("ROOT");
        }
        setOpen(nextOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleCloseDialog} aria-describedby="move-modal-description">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Move to Folder</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                    <Label htmlFor="folder-select">Select Folder</Label>
                    <Select
                        value={selectedFolderId}
                        onValueChange={(value) => setSelectedFolderId(value)}
                    >
                        <SelectTrigger id="folder-select">
                            <SelectValue placeholder="Select Folder" />
                        </SelectTrigger>
                        <SelectContent>
                            {/* "ROOT" = (No Parent) */}
                            <SelectItem value="ROOT">(No Parent)</SelectItem>

                            {/* Render all folders as valid targets */}
                            {folders.map((folder) => (
                                <SelectItem key={folder.id} value={folder.id}>
                                    {folder.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => handleCloseDialog(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="default"
                        onClick={handleMove}
                        // If no folders exist AND user is forced to pick "ROOT", it might be fine.
                        // Or if you want to disable the button when there's no real folder to move to,
                        // keep an additional check here. For example:
                        // disabled={!folders.length && selectedFolderId === "ROOT"}
                    >
                        Move
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MoveModal;
