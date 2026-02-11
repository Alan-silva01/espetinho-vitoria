import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from '../components/customer/BottomNav'
import { useStore } from '../hooks/useStore'

export default function CustomerLayout() {
    const location = useLocation()
    const { isOpen } = useStore()

    const hideNav = ['/checkout', '/pedido'].some(p => location.pathname.startsWith(p))

    return (
        <div className="customer-layout">
            <div className="customer-container">
                <Outlet />
            </div>
            {!hideNav && <BottomNav />}
        </div>
    )
}
