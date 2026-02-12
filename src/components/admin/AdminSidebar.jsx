import { NavLink } from 'react-router-dom'
import {
    LayoutDashboard,
    ClipboardList,
    Package,
    UtensilsCrossed,
    Users,
    BarChart3,
    Truck,
    Settings,
    LogOut,
    Megaphone,
    Search,
    Bell,
    Moon,
    Sun,
    Clock
} from 'lucide-react'
import './AdminSidebar.css'

const navItems = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/admin/pedidos', icon: ClipboardList, label: 'Pedidos', badge: 4 },
    { to: '/admin/cardapio', icon: UtensilsCrossed, label: 'Cardápio' },
    { to: '/admin/estoque', icon: Package, label: 'Estoque' },
    { to: '/admin/promocoes', icon: Megaphone, label: 'Promoções' },
    { to: '/admin/clientes', icon: Users, label: 'Clientes' },
    { to: '/admin/relatorios', icon: BarChart3, label: 'Relatórios' },
    { to: '/admin/motoboys', icon: Truck, label: 'Motoboys' },
    { to: '/admin/configuracoes?tab=horarios', icon: Clock, label: 'Horários' },
    { to: '/admin/configuracoes', icon: Settings, label: 'Configurações' },
]

export default function AdminSidebar({ adminInfo, currentPath, onLogout }) {
    const toggleTheme = () => {
        document.documentElement.classList.toggle('dark')
    }

    return (
        <aside className="admin-sidebar">
            <div className="sidebar-brand">
                <div className="brand-icon">
                    <UtensilsCrossed size={20} />
                </div>
                <div className="brand-text">
                    <h1>Espetinho Vitória</h1>
                    <span>Admin Dashboard</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                            `nav-item ${isActive ? 'active' : ''}`
                        }
                    >
                        <item.icon size={20} />
                        <span className="nav-label">{item.label}</span>
                        {item.badge && <span className="nav-badge">{item.badge}</span>}
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="theme-toggle-container">
                    <button className="theme-toggle-btn" onClick={toggleTheme}>
                        <Sun size={18} className="icon-light" />
                        <Moon size={18} className="icon-dark" />
                        <span>Alternar Tema</span>
                    </button>
                </div>

                <div className="admin-profile-card">
                    <img
                        src={adminInfo?.avatar_url || 'https://via.placeholder.com/40'}
                        alt="Admin"
                    />
                    <div className="profile-info">
                        <span className="profile-name">{adminInfo?.nome || 'Admin'}</span>
                        <span className="profile-role">Gerente</span>
                    </div>
                    <button className="logout-btn" onClick={onLogout} title="Sair">
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </aside>
    )
}
