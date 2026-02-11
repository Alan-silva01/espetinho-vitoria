import { NavLink, useNavigate } from 'react-router-dom'
import {
    LayoutDashboard, ClipboardList, Package, UtensilsCrossed,
    BarChart3, Truck, Settings, LogOut, Flame, Megaphone
} from 'lucide-react'
import './AdminSidebar.css'

const navItems = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/admin/pedidos', icon: ClipboardList, label: 'Pedidos' },
    { to: '/admin/estoque', icon: Package, label: 'Estoque' },
    { to: '/admin/cardapio', icon: UtensilsCrossed, label: 'Cardápio' },
    { to: '/admin/promocoes', icon: Megaphone, label: 'Promoções' },
    { to: '/admin/relatorios', icon: BarChart3, label: 'Relatórios' },
    { to: '/admin/motoboys', icon: Truck, label: 'Motoboys' },
    { to: '/admin/configuracoes', icon: Settings, label: 'Configurações' },
]

export default function AdminSidebar({ adminInfo, currentPath, onLogout }) {
    const navigate = useNavigate()

    return (
        <aside className="admin-sidebar">
            {/* Logo */}
            <div className="admin-sidebar__logo">
                <div className="admin-sidebar__logo-icon">
                    <Flame size={22} />
                </div>
                <div>
                    <h2>Espetinho</h2>
                    <p>Vitória</p>
                </div>
            </div>

            {/* Nav */}
            <nav className="admin-sidebar__nav">
                {navItems.map(item => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                            `admin-sidebar__link ${isActive ? 'admin-sidebar__link--active' : ''}`
                        }
                    >
                        <item.icon size={20} />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* User */}
            <div className="admin-sidebar__user">
                <div className="admin-sidebar__avatar">
                    {adminInfo?.nome?.[0] || 'A'}
                </div>
                <div className="admin-sidebar__user-info">
                    <p className="admin-sidebar__user-name">{adminInfo?.nome || 'Admin'}</p>
                    <p className="admin-sidebar__user-role">{adminInfo?.cargo || 'Administrador'}</p>
                </div>
                <button className="admin-sidebar__logout" onClick={onLogout} title="Sair">
                    <LogOut size={18} />
                </button>
            </div>
        </aside>
    )
}
