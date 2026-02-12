import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AdminSidebar from '../components/admin/AdminSidebar'
import Loading from '../components/ui/Loading'
import './AdminLayout.css'

export default function AdminLayout() {
    const { isAuthenticated, loading, adminInfo, logout } = useAuth()
    const location = useLocation()

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
