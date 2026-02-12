import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from '../components/customer/BottomNav'
import StoreClosedOverlay from '../components/customer/StoreClosedOverlay'
import { useStore } from '../hooks/useStore'

export default function CustomerLayout() {
    const location = useLocation()
    const { isOpen, config, loading } = useStore()

    const hideNav = ['/checkout', '/pedido'].some(p => location.pathname.startsWith(p))
    const isProfilePage = location.pathname === '/perfil'

    return (
        <div className="customer-layout">
            <div className="customer-container">
                <Outlet />
            </div>
            {!hideNav && <BottomNav />}

            {!loading && !isOpen && !isProfilePage && (
                <StoreClosedOverlay config={config} closureInfo={closureInfo} />
            )}
        </div>
    )
}
