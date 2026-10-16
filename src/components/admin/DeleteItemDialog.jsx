import { createPortal } from 'react-dom'
import { Trash2, X } from 'lucide-react'

/**
 * Confirmation dialog for removing an item from an order.
 * Matches the receipt theme (dark top bar, square borders).
 */
export default function DeleteItemDialog({ isOpen, itemName, onCancel, onConfirm }) {
    if (!isOpen) return null

    return createPortal(
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 99999,
                background: 'rgba(0,0,0,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(2px)',
            }}
            onClick={onCancel}
        >
            <div
                style={{
                    background: '#fff',
                    border: '1.5px solid #232220',
                    borderRadius: 0,
                    minWidth: 320,
                    maxWidth: 360,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
                    overflow: 'hidden',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Dark top bar */}
                <div style={{
                    background: '#232220',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Trash2 size={15} color="#ef4444" />
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: '0.05em' }}>
                            REMOVER ITEM
                        </span>
                    </div>
                    <button
                        onClick={onCancel}
                        style={{
                            background: 'transparent', border: 'none',
                            cursor: 'pointer', color: '#aaa', padding: 2,
                            display: 'flex', alignItems: 'center',
                        }}
                        title="Cancelar"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '20px 20px 8px' }}>
                    <p style={{
                        fontSize: 14, color: '#171717', lineHeight: 1.5, margin: 0,
                        fontFamily: 'Inter, sans-serif',
                    }}>
                        Deseja remover o item{' '}
                        <strong style={{ fontWeight: 700 }}>{itemName}</strong>{' '}
                        do pedido?
                    </p>
                    <p style={{ fontSize: 12, color: '#737373', marginTop: 6, fontFamily: 'Inter, sans-serif' }}>
                        O total do pedido será recalculado automaticamente.
                    </p>
                </div>

                {/* Actions */}
                <div style={{
                    display: 'flex', gap: 10, padding: '12px 20px 20px',
                    justifyContent: 'flex-end',
                }}>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '8px 18px',
                            border: '1.5px solid #e5e5e5',
                            borderRadius: 0,
                            background: '#fafafa',
                            color: '#525252',
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: 'pointer',
                            fontFamily: 'Inter, sans-serif',
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: '8px 18px',
                            border: '1.5px solid #dc2626',
                            borderRadius: 0,
                            background: '#dc2626',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: 'pointer',
                            fontFamily: 'Inter, sans-serif',
                            display: 'flex', alignItems: 'center', gap: 6,
                        }}
                    >
                        <Trash2 size={13} />
                        Remover
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
