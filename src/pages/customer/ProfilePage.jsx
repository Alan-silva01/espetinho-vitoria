import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Info } from 'lucide-react'
import { useStore } from '../../hooks/useStore'
import Loading from '../../components/ui/Loading'
import './ProfilePage.css'

export default function ProfilePage() {
    const navigate = useNavigate()
    const { config, horarios, loading } = useStore()

    const diasSemana = [
        'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
        'Quinta-feira', 'Sexta-feira', 'Sábado'
    ]

    const bsbToday = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getDay()

    if (loading) return <Loading fullScreen text="Carregando informações..." />

    return (
        <div className="profile-page animate-fade-in">
            <header className="profile-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={20} />
                </button>
                <h1>Funcionamento</h1>
                <div style={{ width: 36 }} />
            </header>

            <div className="profile-section">
                <div className="section-label">
                    <Clock size={14} />
                    <span>Horários Semanais</span>
                </div>

                <div className="hours-card-premium">
                    <div className="hours-list">
                        {diasSemana.map((dia, index) => {
                            const horario = horarios?.find(h => h.dia_semana === index)
                            const isToday = index === bsbToday

                            return (
                                <div key={dia} className={`hour-row ${isToday ? 'is-today' : ''}`}>
                                    <div className="day-label">
                                        <span className="day-name">{dia}</span>
                                        {isToday && <span className="today-tag">HOJE</span>}
                                    </div>

                                    <div className="time-range">
                                        {horario?.aberto ? (
                                            <span>
                                                {horario.horario_abertura.slice(0, 5)} — {horario.horario_fechamento.slice(0, 5)}
                                            </span>
                                        ) : (
                                            <span className="closed-text">Fechado</span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="info-card">
                    <Info size={18} color="#D97706" />
                    <span>
                        Os horários podem sofrer alterações em feriados ou datas comemorativas.
                        Acompanhe sempre o aviso na página inicial.
                    </span>
                </div>
            </div>
        </div>
    )
}
