import { useNavigate } from 'react-router-dom'
import { ArrowLeft, User } from 'lucide-react'
import './PlaceholderPages.css'

export default function ProfilePage() {
    const navigate = useNavigate()

    return (
        <div className="placeholder-page animate-fade-in">
            <header className="placeholder-header">
                <button className="placeholder-header__back" onClick={() => navigate(-1)}>
                    <ArrowLeft size={22} />
                </button>
                <h1>Meu Perfil</h1>
                <div style={{ width: 38 }} />
            </header>
            <div className="placeholder-content">
                <div className="placeholder-icon">
                    <User size={48} strokeWidth={1.5} />
                </div>
                <h2>Perfil do Cliente</h2>
                <p>Em breve você poderá editar seus dados, endereços salvos e muito mais.</p>
            </div>
        </div>
    )
}
