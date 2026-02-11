import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import './Modal.css'

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
    const overlayRef = useRef()

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => { document.body.style.overflow = '' }
    }, [isOpen])

    if (!isOpen) return null

    function handleOverlayClick(e) {
        if (e.target === overlayRef.current) onClose()
    }

    return (
        <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
            <div className={`modal-content modal-${size} animate-slide-up`}>
                {title && (
                    <div className="modal-header">
                        <h3>{title}</h3>
                        <button className="modal-close" onClick={onClose}>
                            <X size={20} />
                        </button>
                    </div>
                )}
                <div className="modal-body">
                    {children}
                </div>
            </div>
        </div>
    )
}
