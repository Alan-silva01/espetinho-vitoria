import { useState } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AdminSidebar from '../components/admin/AdminSidebar'
import Loading from '../components/ui/Loading'
import './AdminLayout.css'

export default function AdminLayout() {
    const { isAuthenticated, loading, adminInfo, logout } = useAuth()
    const location = useLocation()
    const [isCollapsed, setIsCollapsed] = useState(() => {
        return localStorage.getItem('admin_sidebar_collapsed') === 'true'
    })
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    const toggleSidebar = () => {
        setIsCollapsed(prev => {
            const next = !prev
            localStorage.setItem('admin_sidebar_collapsed', next)
            return next
        })
    }

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(prev => !prev)
    }

    if (loading) {
        return (
            <div className="loading-wrapper-fullscreen">
                <Loading fullScreen text="Carregando painel...">
                    <button
                        onClick={logout}
                        style={{
                            marginTop: '20px',
                            padding: '10px 20px',
                            background: 'transparent',
                            border: '1px solid #ccc',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            color: '#666'
                        }}
                    >
                        Cancelar e Sair
                    </button>
                </Loading>
            </div>
        )
    }
    if (!isAuthenticated) return <Navigate to="/admin/login" replace />

    return (
        <div className={`admin-container ${isCollapsed ? 'sidebar-collapsed' : ''} ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}>
            {/* Mobile Header */}
            <header className="admin-mobile-header">
                <button className="mobile-menu-toggle" onClick={toggleMobileMenu}>
                    <span className="hamburger-bar"></span>
                    <span className="hamburger-bar"></span>
                    <span className="hamburger-bar"></span>
                </button>
                <div className="mobile-brand">
                    <span className="brand-main">ESPETINHO</span>
                    <span className="brand-sub">VITÓRIA</span>
                </div>
                <div className="mobile-actions">
                    {/* Placeholder for notifications or profile if needed */}
                </div>
            </header>

            {/* Mobile Overlay */}
            <div className="admin-mobile-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>

            <AdminSidebar
                adminInfo={adminInfo}
                currentPath={location.pathname}
                onLogout={logout}
                isCollapsed={isCollapsed}
                onToggle={toggleSidebar}
                onCloseMobile={() => setIsMobileMenuOpen(false)}
            />
            <main className="admin-main">
                <Outlet />
            </main>
        </div>
    )
}
