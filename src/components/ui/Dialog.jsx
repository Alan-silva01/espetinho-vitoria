import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './Dialog.css';

export default function Dialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    type = 'confirm',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    isDanger = true
}) {
    if (!isOpen) return null;

    return createPortal(
        <div className="v4-dialog-overlay" onClick={onClose}>
            <div className="v4-dialog-content" onClick={e => e.stopPropagation()}>
                {/* Close X Button in top right */}
                <button className="v4-dialog-close-btn" onClick={onClose} title="Fechar">
                    <X size={16} />
                </button>

                <div className="v4-dialog-icon">
                    <img
                        src="/icons/alert.png"
                        alt="Alerta"
                        className="v4-dialog-alert-img"
                    />
                </div>

                <h3>{title}</h3>
                <p>{message}</p>

                <div className="v4-dialog-actions">
                    <button className="btn-dialog btn-dialog-cancel" onClick={onClose}>
                        {cancelText}
                    </button>
                    <button
                        className={`btn-dialog btn-dialog-confirm ${isDanger ? 'btn-danger' : ''}`}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
