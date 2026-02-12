import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Home, ShoppingCart, ClipboardList, Heart, User } from 'lucide-react'
import { useCart } from '../../hooks/useCart'
import './BottomNav.css'

export default function BottomNav() {
    const location = useLocation()
    const navigate = useNavigate()
    const { customerCode } = useParams()
    const { totalItems } = useCart()

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
        { path: '/pedidos', icon: ClipboardList, label: 'Pedidos' },
        { path: '/carrinho', icon: ShoppingCart, label: '', isCenter: true },
        { path: '/favoritos', icon: Heart, label: 'Favoritos' },
        { path: '/perfil', icon: User, label: 'Perfil' },
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
                        <Icon size={22} />
                        <span className="bottom-nav__label">{tab.label}</span>
                    </button>
                )
            })}
        </nav>
    )
}
