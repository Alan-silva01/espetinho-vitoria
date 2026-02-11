import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AdminSidebar from '../components/admin/AdminSidebar'
import Loading from '../components/ui/Loading'
import './AdminLayout.css'

export default function AdminLayout() {
    const { isAuthenticated, loading, adminInfo, logout } = useAuth()
    const location = useLocation()

    if (loading) return <Loading fullScreen text="Carregando painel..." />
    if (!isAuthenticated) return <Navigate to="/admin/login" replace />

    return (
        <div className="admin-layout">
            <AdminSidebar
                adminInfo={adminInfo}
                currentPath={location.pathname}
                onLogout={logout}
            />
            <main className="admin-main">
                <Outlet />
            </main>
        </div>
    )
}
