import { useLocation, useNavigate } from 'react-router-dom'
import { Home, ShoppingCart, ClipboardList, Heart, User } from 'lucide-react'
import { useCart } from '../../hooks/useCart'
import './BottomNav.css'

export default function BottomNav() {
    const location = useLocation()
    const navigate = useNavigate()
    const { totalItems } = useCart()

    // Hide BottomNav on cart/checkout/tracking pages
    const hideOn = ['/carrinho', '/checkout']
    if (hideOn.includes(location.pathname) || location.pathname.startsWith('/pedido/')) {
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
                const isActive = location.pathname === tab.path
                const Icon = tab.icon

                if (tab.isCenter) {
                    return (
                        <div key={tab.path} className="bottom-nav__center">
                            <button
                                className="bottom-nav__cart-btn"
                                onClick={() => navigate(tab.path)}
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
                        onClick={() => navigate(tab.path)}
                    >
                        <Icon size={22} />
                        <span className="bottom-nav__label">{tab.label}</span>
                    </button>
                )
            })}
        </nav>
    )
}
