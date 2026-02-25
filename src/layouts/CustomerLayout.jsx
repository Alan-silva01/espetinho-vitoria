import { Outlet, useLocation, useParams, useNavigate } from 'react-router-dom'
import BottomNav from '../components/customer/BottomNav'
import StoreClosedOverlay from '../components/customer/StoreClosedOverlay'
import { useStore } from '../hooks/useStore'
import { useCustomer } from '../context/CustomerContext'
import { useEffect, useRef } from 'react'

export default function CustomerLayout() {
    const location = useLocation()
    const { customerCode } = useParams()
    const { fetchCustomerByCode, customer } = useCustomer()
    const { isOpen, config, loading, closureInfo } = useStore()
    const navigate = useNavigate()

    const fetchingCodeRef = useRef(null)

    // Global detection: if URL has CLI-XXXXXX, load that customer
    useEffect(() => {
        if (customerCode && customerCode.startsWith('CLI-')) {
            // When entering via a customer code, ensure we're not stuck in "table mode"
            // with stale data from a previous session.
            const currentTipo = localStorage.getItem('espetinho_tipo_pedido')
            if (currentTipo === 'mesa') {
                localStorage.setItem('espetinho_tipo_pedido', 'entrega')
                localStorage.removeItem('espetinho_mesa_id')
                localStorage.removeItem('espetinho_mesa_numero')
                localStorage.removeItem('espetinho_comanda_id')
            }

            // Only fetch if it's different from current AND we are not already fetching it
            if ((!customer || customer.codigo !== customerCode) && fetchingCodeRef.current !== customerCode) {
                fetchingCodeRef.current = customerCode
                fetchCustomerByCode(customerCode).finally(() => {
                    fetchingCodeRef.current = null
                })
            }
        }
    }, [customerCode, customer]) // Removed fetchCustomerByCode as it changes on every render in Provider
    // Redirect to coded URL if we are at root but have a customer in context
    // This ensures that Add to Home Screen works correctly even if it opens at /
    // IMPORTANT: Only redirect if NOT in mesa mode, otherwise we lose the mesa context
    useEffect(() => {
        const isRoot = location.pathname === '/' || location.pathname === ''
        const isMesa = localStorage.getItem('espetinho_tipo_pedido') === 'mesa'

        if (isRoot && customer?.codigo && !isMesa) {
            navigate(`/${customer.codigo}`, { replace: true })
        }
    }, [location.pathname, customer?.codigo, navigate])

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
