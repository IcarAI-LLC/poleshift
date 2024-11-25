// lib/hooks/useModalState.ts
import { useCallback, useState } from 'react';
import { DropboxConfigItem } from '../../config/dropboxConfig.ts';

interface ModalState {
    isOpen: boolean;
    title: string;
    type: 'input' | 'data';
    configItem?: DropboxConfigItem;
    modalInputs?: Record<string, string>;
    uploadedFiles?: File[];
    data?: any;
    units?: Record<string, string>;
}

export function useModalState() {
    const [modalState, setModalState] = useState<ModalState>({
        isOpen: false,
        title: '',
        type: 'input',
        modalInputs: {}
    });

    const openModal = useCallback((
        title: string,
        configItem: DropboxConfigItem,
        uploadedFiles: File[] = []
    ) => {
        if (configItem.modalFields?.length) {
            setModalState({
                isOpen: true,
                title,
                type: 'input',
                configItem,
                modalInputs: {},
                uploadedFiles
            });
        }
    }, []);

    const openDataModal = useCallback(async (
        title: string,
        dataItem: any,
        configItem: DropboxConfigItem
    ) => {
        if (!dataItem) return;

        setModalState({
            isOpen: true,
            title: `Data for ${title}`,
            type: 'data',
            data: dataItem,
            configItem
        });
    }, []);

    const closeModal = useCallback(() => {
        setModalState({
            isOpen: false,
            title: '',
            type: 'input',
            configItem: undefined,
            modalInputs: {},
            uploadedFiles: [],
            data: null,
            units: undefined
        });
    }, []);

    return {
        modalState,
        openModal,
        openDataModal,
        closeModal,
        setModalState
    };
}