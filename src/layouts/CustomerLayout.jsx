import { Outlet, useLocation, useParams } from 'react-router-dom'
import BottomNav from '../components/customer/BottomNav'
import StoreClosedOverlay from '../components/customer/StoreClosedOverlay'
import { useStore } from '../hooks/useStore'
import { useCustomer } from '../context/CustomerContext'
import { useEffect } from 'react'

export default function CustomerLayout() {
    const location = useLocation()
    const { customerCode } = useParams()
    const { fetchCustomerByCode, customer } = useCustomer()
    const { isOpen, config, loading, closureInfo } = useStore()

    // Global detection: if URL has CLI-XXXXXX, load that customer
    useEffect(() => {
        if (customerCode && customerCode.startsWith('CLI-')) {
            // Only fetch if it's different from current
            if (!customer || customer.codigo !== customerCode) {
                fetchCustomerByCode(customerCode)
            }
        }
    }, [customerCode, customer])

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
