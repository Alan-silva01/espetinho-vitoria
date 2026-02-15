import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Home, ShoppingCart, Heart, ClipboardList } from 'lucide-react'
import { useCart } from '../../hooks/useCart'
import { useOrderTracking } from '../../hooks/useOrders'
import { getStatusLabel } from '../../lib/utils'
import './BottomNav.css'

export default function BottomNav() {
    const location = useLocation()
    const navigate = useNavigate()
    const { customerCode } = useParams()
    const { totalItems } = useCart()

    // Order tracking for Bottom Nav
    const lastOrderId = localStorage.getItem('espetinho_ultimo_pedido_id')
    const { order: activeOrder } = useOrderTracking(lastOrderId)
    const hasActiveOrder = activeOrder && ['pendente', 'confirmado', 'preparando', 'pronto', 'saiu_entrega'].includes(activeOrder.status)

    // Prefix for routes if customer identified via URL
    const prefix = customerCode ? `/${customerCode}` : ''

    // Hide BottomNav on cart/checkout/tracking/product detail pages
    const hideOn = ['/carrinho', '/checkout']
    const pathWithoutPrefix = customerCode
        ? location.pathname.replace(`/${customerCode}`, '')
        : location.pathname

    if (hideOn.includes(pathWithoutPrefix) || location.pathname.includes('/pedido/') || location.pathname.includes('/produto/')) {
        return null
    }

    const tabs = [
        { path: '/', icon: Home, label: 'Início' },
        { path: '/carrinho', icon: ShoppingCart, label: '', isCenter: true },
        hasActiveOrder ? {
            path: `/pedido/${activeOrder.id}`,
            icon: ClipboardList,
            label: getStatusLabel(activeOrder.status, activeOrder.tipo_pedido),
            isStatus: true
        } : {
            path: '/pedidos',
            icon: ClipboardList,
            label: 'Pedidos'
        },
    ]

    return (
        <nav className="bottom-nav">
            {tabs.map(tab => {
                const targetPath = prefix + (tab.path === '/' ? '' : tab.path)
                const isActive = location.pathname === targetPath || (tab.path === '/' && location.pathname === prefix)
                const Icon = tab.icon

                if (tab.isCenter) {
                    return (
                        <div key={tab.path} className="bottom-nav__center">
                            <button
                                className="bottom-nav__cart-btn"
                                onClick={() => navigate(targetPath)}
                            >
                                <ShoppingCart size={24} />
                                {totalItems > 0 && (
                                    <span className="bottom-nav__badge">{totalItems}</span>
                                )}
                            </button>
                        </div>
                    )
                }

                return (
                    <button
                        key={tab.path}
                        className={`bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`}
                        onClick={() => navigate(targetPath)}
                    >
                        <div className="bottom-nav__icon-wrapper">
                            <Icon size={22} />
                            {tab.isStatus && <div className="status-dot-ping" />}
                        </div>
                        <span className="bottom-nav__label">{tab.label}</span>
                    </button>
                )
            })}
        </nav>
    )
}
