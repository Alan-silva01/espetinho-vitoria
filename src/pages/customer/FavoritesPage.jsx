import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Heart } from 'lucide-react'
import './PlaceholderPages.css'

export default function FavoritesPage() {
    const navigate = useNavigate()

    return (
        <div className="placeholder-page animate-fade-in">
            <header className="placeholder-header">
                <button className="placeholder-header__back" onClick={() => navigate(-1)}>
                    <ArrowLeft size={22} />
                </button>
                <h1>Favoritos</h1>
                <div style={{ width: 38 }} />
            </header>
            <div className="placeholder-content">
                <div className="placeholder-icon">
                    <Heart size={48} strokeWidth={1.5} />
                </div>
                <h2>Nenhum favorito</h2>
                <p>Toque no ❤️ dos produtos que você mais gosta e eles aparecerão aqui!</p>
                <button className="btn btn-primary btn-md" onClick={() => navigate('/')}>
                    Ver Cardápio
                </button>
            </div>
        </div>
    )
}
