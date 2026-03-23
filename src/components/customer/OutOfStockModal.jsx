import { AlertTriangle, ShoppingBag } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import './OutOfStockModal.css'

export default function OutOfStockModal({ isOpen, onClose, items = [] }) {
    if (!items.length) return null

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm">
            <div className="out-of-stock">
                <div className="out-of-stock__header">
                    <div className="out-of-stock__icon-wrapper">
                        <AlertTriangle className="out-of-stock__icon" size={32} />
                    </div>
                </div>

                <div className="out-of-stock__content">
                    <h3 className="out-of-stock__title">Ops! Alguns itens esgotaram</h3>
                    <p className="out-of-stock__message">
                        Infelizmente, enquanto você finalizava o pedido, {items.length === 1 ? 'este item esgotou' : 'estes itens esgotaram'}:
                    </p>

                    <ul className="out-of-stock__list">
                        {items.map((item, idx) => (
                            <li key={idx} className="out-of-stock__item">
                                <span className="out-of-stock__item-icon">✕</span>
                                <span className="out-of-stock__item-name">{item}</span>
                            </li>
                        ))}
                    </ul>

                    <p className="out-of-stock__suggestion">
                        {items.length === 1
                            ? 'Removemos esse item do seu carrinho. Escolha outro por favor! 😊'
                            : 'Removemos esses itens do seu carrinho. Escolha outros por favor! 😊'}
                    </p>
                </div>

                <div className="out-of-stock__footer">
                    <Button
                        variant="primary"
                        fullWidth
                        onClick={onClose}
                        className="out-of-stock__btn"
                    >
                        <ShoppingBag size={18} />
                        Entendi
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
