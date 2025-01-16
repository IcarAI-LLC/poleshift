// components/Modals/MoveModal.tsx
import { FC, useEffect, useState } from "react";
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

interface MoveModalProps {
    /** The ID of the item we want to move (or `null` if none) */
    itemId: string | null;
    /** Function to close this modal */
    onClose: () => void;
}

const MoveModal: FC<MoveModalProps> = ({ itemId, onClose }) => {
    const { fileTree, moveNode } = useData();
    const { setHideMoveModal } = useUI();

    const [open, setOpen] = useState(false);
    const [selectedFolderId, setSelectedFolderId] = useState<string>("ROOT");

    useEffect(() => {
        // If we have an itemId, open the dialog
        if (itemId) {
            setOpen(true);
        } else {
            setOpen(false);
        }
    }, [itemId]);

    // Helper: gather only folders
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
        if (!itemId) return;
        const newParent = selectedFolderId === "ROOT" ? null : selectedFolderId;
        await moveNode(itemId, newParent);
        setOpen(false);
        setSelectedFolderId("ROOT");
        setHideMoveModal(); // optional, if you’re using the old UI state
        onClose(); // inform parent
    };

    const handleCloseDialog = (nextOpen: boolean) => {
        if (!nextOpen) {
            setOpen(false);
            setSelectedFolderId("ROOT");
            onClose();
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleCloseDialog}>
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
                            <SelectItem value="ROOT">(No Parent)</SelectItem>
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
                    <Button variant="default" onClick={handleMove}>
                        Move
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MoveModal;
