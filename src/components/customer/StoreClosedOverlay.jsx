import { useNavigate } from 'react-router-dom'
import { Clock, Info } from 'lucide-react'
import './StoreClosedOverlay.css'

export default function StoreClosedOverlay({ config, closureInfo }) {
    const navigate = useNavigate()

    const getDisplayMessage = () => {
        if (!closureInfo) return ''

        switch (closureInfo.type) {
            case 'future_opening':
                return closureInfo.message || `Abrimos às ${closureInfo.openTime}, calma que jaja você pode fazer seu pedido.`
            case 'saturday':
                return closureInfo.message
            case 'exceptional':
                return closureInfo.message || 'Fechado excepcionalmente hoje para manutenção interna.'
            case 'manual':
                return closureInfo.message || 'Estamos fechados no momento. Voltamos em breve!'
            default:
                return closureInfo.message || 'Obrigado pela preferência! Voltamos em breve com os melhores espetinhos da região.'
        }
    }

    const message = getDisplayMessage()
    const isSpecialNotice = ['exceptional', 'extreme'].includes(closureInfo?.type)

    return (
        <div className="store-closed-backdrop">
            <div className="store-closed-content">
                <div className="store-closed-premium-card">
                    <div className="card-glare" />

                    <div className="status-badge">
                        <Clock size={14} className="icon-pulse" />
                        <span>{isSpecialNotice ? 'AVISO IMPORTANTE' : 'FORA DE EXPEDIENTE'}</span>
                    </div>

                    <h2 className="closed-title">
                        {isSpecialNotice ? 'Aviso' : 'Estamos Fechados'}
                    </h2>

                    <div className="closed-message-box">
                        <p className="closed-text">{message}</p>
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
