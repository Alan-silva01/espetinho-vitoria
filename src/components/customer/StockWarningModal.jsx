import { AlertTriangle, ShoppingBag } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import './StockWarningModal.css'

export default function StockWarningModal({ isOpen, onClose, productName, availableQty }) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm">
            <div className="stock-warning">
                <div className="stock-warning__header">
                    <div className="stock-warning__icon-wrapper">
                        <AlertTriangle className="stock-warning__icon" size={32} />
                    </div>
                </div>

                <div className="stock-warning__content">
                    <h3 className="stock-warning__title">Ops! Estoque Limitado</h3>
                    <p className="stock-warning__message">
                        Infelizmente só temos <strong>{availableQty}</strong> {availableQty === 1 ? 'unidade' : 'unidades'} de <strong>{productName}</strong> disponível no momento.
                    </p>
                    <p className="stock-warning__suggestion">
                        Que tal aproveitar as últimas unidades ou escolher outro sabor delicioso?
                    </p>
                </div>

                <div className="stock-warning__footer">
                    <Button
                        variant="primary"
                        fullWidth
                        onClick={onClose}
                        className="stock-warning__btn"
                    >
                        <ShoppingBag size={18} />
                        Entendido
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
