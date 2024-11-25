// src/renderer/components/ConfirmDialog.tsx

import React from 'react';

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  callback: () => void;
}

interface ConfirmDialogProps {
  confirmState: ConfirmState;
  setConfirmState: React.Dispatch<React.SetStateAction<ConfirmState>>;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  confirmState,
  setConfirmState,
}) => {
  const { isOpen, title, message, callback } = confirmState;

  const handleOk = () => {
    callback();
    setConfirmState({ ...confirmState, isOpen: false });
  };

  const handleCancel = () => {
    setConfirmState({ ...confirmState, isOpen: false });
  };

  if (!isOpen) return null;

  return (
    <div className={`modal-overlay ${isOpen ? 'modal-overlay--visible' : ''}`}>
      <div className="modal">
        <h2 className="modal__title">{title}</h2>
        <p>{message}</p>
        <div className="modal__buttons">
          <button type="button" className="modal__button" onClick={handleOk}>
            Yes
          </button>
          <button
            type="button"
            className="modal__button modal__button--cancel"
            onClick={handleCancel}
          >
            No
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
