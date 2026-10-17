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

    const queryParams = new URLSearchParams(location.search)
    const codeFromQuery = (queryParams.get('c') || queryParams.get('cliente'))?.toUpperCase()
    const effectiveCode = (customerCode?.startsWith('CLI-') ? customerCode : (codeFromQuery?.startsWith('CLI-') ? codeFromQuery : null))?.toUpperCase()

    // Global detection: if URL has CLI-XXXXXX (path or query), load that customer
    useEffect(() => {
        if (effectiveCode && effectiveCode.startsWith('CLI-')) {
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
            if ((!customer || customer.codigo !== effectiveCode) && fetchingCodeRef.current !== effectiveCode) {
                fetchingCodeRef.current = effectiveCode
                fetchCustomerByCode(effectiveCode).finally(() => {
                    fetchingCodeRef.current = null
                })
            }
        }
    }, [effectiveCode, customer])

    // Redirect to coded URL if we are at root but have a customer in context
    // This ensures that Add to Home Screen works correctly even if it opens at /
    // IMPORTANT: Only redirect if NOT in mesa mode, and not if a new customer code is in query string
    useEffect(() => {
        const isRoot = location.pathname === '/' || location.pathname === ''
        const isMesa = localStorage.getItem('espetinho_tipo_pedido') === 'mesa'

        if (isRoot && customer?.codigo && !isMesa && !codeFromQuery?.startsWith('CLI-')) {
            navigate(`/${customer.codigo}`, { replace: true })
        }
    }, [location.pathname, location.search, customer?.codigo, navigate, codeFromQuery])

    const hideNav = ['/checkout', '/pedido'].some(p => location.pathname.startsWith(p))
    const isProfilePage = location.pathname === '/perfil'

    // Detect if this session was launched from Admin
    const isFromAdmin = sessionStorage.getItem('espetinho_opened_from_admin') === 'true' || location.search.includes('admin=true')

    const handleReturnToAdmin = () => {
        sessionStorage.removeItem('espetinho_opened_from_admin')
        navigate('/admin/pedidos')
    }

    return (
        <div className="customer-layout">
            {/* Barra fixa discreta para o administrador retornar ao Kanban */}
            {isFromAdmin && (
                <div style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 9999,
                    background: '#232220',
                    color: '#ffffff',
                    padding: '8px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    fontWeight: 600,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                            display: 'inline-block',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#16a34a'
                        }} />
                        <span>Modo Atendimento — Criando pedido para {customer?.nome || 'Cliente'}</span>
                    </div>
                    <button
                        type="button"
                        onClick={handleReturnToAdmin}
                        style={{
                            background: '#ffffff',
                            color: '#171717',
                            border: 'none',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            borderRadius: '3px'
                        }}
                    >
                        Voltar ao Painel
                    </button>
                </div>
            )}

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
