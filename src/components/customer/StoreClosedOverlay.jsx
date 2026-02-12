import { useNavigate } from 'react-router-dom'
import { Clock, Info } from 'lucide-react'
import './StoreClosedOverlay.css'

export default function StoreClosedOverlay({ config }) {
    const navigate = useNavigate()

    return (
        <div className="store-closed-backdrop">
            <div className="store-closed-content">
                <div className="store-closed-premium-card">
                    <div className="card-glare" />

                    <div className="status-badge">
                        <Clock size={14} className="icon-pulse" />
                        <span>FORA DE EXPEDIENTE</span>
                    </div>

                    <h2 className="closed-title">
                        {config?.fechar_hoje_excepcionalmente ? 'Aviso Importante' : 'Estamos Fechados'}
                    </h2>

                    <div className="closed-message-box">
                        <p className="closed-text">
                            {config?.fechar_hoje_excepcionalmente
                                ? (config?.motivo_fechamento_hoje || 'Fechado excepcionalmente hoje para manutenção interna.')
                                : (config?.mensagem_fechamento || 'Obrigado pela preferência! Voltamos em breve com os melhores espetinhos da região.')}
                        </p>
                    </div>

                    {!config?.fechar_hoje_excepcionalmente && (
                        <div className="hours-hint">
                            <div className="hint-divider" />
                            <p>Quer saber quando abrimos?</p>
                            <button
                                className="action-btn"
                                onClick={() => navigate('/perfil')}
                            >
                                <Info size={16} />
                                Ver Horários
                            </button>
                        </div>
                    )}

                    <div className="card-footer">
                        <span className="brand-label">Espetinho Vitória</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
