import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Package } from 'lucide-react'
import './PlaceholderPages.css'

export default function OrdersListPage() {
    const navigate = useNavigate()

    return (
        <div className="placeholder-page animate-fade-in">
            <header className="placeholder-header">
                <button className="placeholder-header__back" onClick={() => navigate(-1)}>
                    <ArrowLeft size={22} />
                </button>
                <h1>Meus Pedidos</h1>
                <div style={{ width: 38 }} />
            </header>
            <div className="placeholder-content">
                <div className="placeholder-icon">
                    <Package size={48} strokeWidth={1.5} />
                </div>
                <h2>Nenhum pedido ainda</h2>
                <p>Seus pedidos aparecerão aqui após você fazer seu primeiro pedido!</p>
                <button className="btn btn-primary btn-md" onClick={() => navigate('/')}>
                    Ver Cardápio
                </button>
            </div>
        </div>
    )
}
