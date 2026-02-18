import React from 'react';
import { AlertCircle, HelpCircle } from 'lucide-react';
import './Dialog.css';

export default function Dialog({ isOpen, onClose, onConfirm, title, message, type = 'confirm' }) {
    if (!isOpen) return null;

    return (
        <div className="v4-dialog-overlay" onClick={onClose}>
            <div className="v4-dialog-content animate-zoom-in" onClick={e => e.stopPropagation()}>
                <div className="v4-dialog-icon">
                    {type === 'confirm' ? <HelpCircle size={32} color="#F59E0B" /> : <AlertCircle size={32} color="#EF4444" />}
                </div>
                <h3>{title}</h3>
                <p>{message}</p>

                <div className="v4-dialog-actions">
                    <button className="btn-dialog btn-dialog-cancel" onClick={onClose}>Cancelar</button>
                    <button className="btn-dialog btn-dialog-confirm" onClick={onConfirm}>Confirmar</button>
                </div>
            </div>
        </div>
    );
}
