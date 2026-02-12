import { useState, useEffect } from 'react'
import {
    Clock, Save, AlertCircle, CheckCircle2,
    Calendar, Moon, Sun, ToggleRight, ToggleLeft
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import './OpeningHoursPage.css'

export default function OpeningHoursPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [horarios, setHorarios] = useState([])
    const [config, setConfig] = useState({})
    const [feedback, setFeedback] = useState({ type: '', msg: '' })

    const diasNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

    useEffect(() => {
        fetchSettings()
    }, [])

    async function fetchSettings() {
        setLoading(true)
        try {
            const [configRes, horariosRes] = await Promise.all([
                supabase.from('configuracoes_loja').select('*').single(),
                supabase.from('horarios_funcionamento').select('*').order('dia_semana')
            ])

            if (configRes.data) setConfig(configRes.data)

            if (horariosRes.data && horariosRes.data.length > 0) {
                setHorarios(horariosRes.data)
            } else {
                const defaultHours = Array.from({ length: 7 }, (_, i) => ({
                    id: `temp-${i}`,
                    dia_semana: i,
                    aberto: i !== 0,
                    horario_abertura: '18:00:00',
                    horario_fechamento: '23:30:00'
                }))
                setHorarios(defaultHours)
            }
        } catch (err) {
            console.error('Erro ao carregar horários:', err)
        } finally {
            setLoading(false)
        }
    }

    async function handleSave() {
        setSaving(true)
        setFeedback({ type: '', msg: '' })
        try {
            // 1. Update exceptional closure
            await supabase
                .from('configuracoes_loja')
                .update({
                    fechar_hoje_excepcionalmente: config.fechar_hoje_excepcionalmente,
                    motivo_fechamento_hoje: config.motivo_fechamento_hoje
                })
                .eq('id', config.id)

            // 2. Update regular hours
            for (const h of horarios) {
                const payload = {
                    dia_semana: h.dia_semana,
                    aberto: h.aberto,
                    horario_abertura: h.horario_abertura,
                    horario_fechamento: h.horario_fechamento
                }

                if (h.id.toString().startsWith('temp-')) {
                    await supabase.from('horarios_funcionamento').insert(payload)
                } else {
                    await supabase
                        .from('horarios_funcionamento')
                        .update(payload)
                        .eq('id', h.id)
                }
            }

            setFeedback({ type: 'success', msg: 'Horários atualizados com sucesso!' })
            fetchSettings()
        } catch (err) {
            setFeedback({ type: 'error', msg: 'Erro ao salvar: ' + err.message })
        } finally {
            setSaving(false)
            setTimeout(() => setFeedback({ type: '', msg: '' }), 4000)
        }
    }

    const updateHorario = (id, field, value) => {
        setHorarios(prev => prev.map(h => h.id === id ? { ...h, [field]: value } : h))
    }

    if (loading) return (
        <div className="admin-loading">
            <div className="loader" />
            <span>Carregando horários...</span>
        </div>
    )

    return (
        <div className="hours-page-wrapper animate-fade-in">
            <header className="page-header-premium">
                <div className="header-titles">
                    <div className="icon-badge">
                        <Clock size={24} />
                    </div>
                    <div>
                        <h1>Horário de Funcionamento</h1>
                        <p>Configure quando sua loja está aberta para receber pedidos.</p>
                    </div>
                </div>
                <div className="header-actions">
                    {feedback.msg && (
                        <div className={`feedback-pill ${feedback.type}`}>
                            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                            <span>{feedback.msg}</span>
                        </div>
                    )}
                    <button className="btn-save-hours" onClick={handleSave} disabled={saving}>
                        <Save size={18} />
                        <span>{saving ? 'Gravando...' : 'Salvar Alterações'}</span>
                    </button>
                </div>
            </header>

            <div className="hours-grid">
                <section className="exception-section">
                    <div className="glass-card exception-card">
                        <div className="card-header">
                            <div className="title">
                                <AlertCircle size={20} className="icon-warning" />
                                <h3>Fechamento Excepcional</h3>
                            </div>
                            <label className="premium-toggle red">
                                <input
                                    type="checkbox"
                                    checked={config.fechar_hoje_excepcionalmente || false}
                                    onChange={e => setConfig({ ...config, fechar_hoje_excepcionalmente: e.target.checked })}
                                />
                                <span className="slider" />
                            </label>
                        </div>

                        {config.fechar_hoje_excepcionalmente && (
                            <div className="exception-body animate-slide-down">
                                <p>Informe aos seus clientes por que a loja não abrirá hoje.</p>
                                <textarea
                                    placeholder="Ex: Hoje o sistema está em manutenção..."
                                    value={config.motivo_fechamento_hoje || ''}
                                    onChange={e => setConfig({ ...config, motivo_fechamento_hoje: e.target.value })}
                                />
                                <div className="warning-info">
                                    <AlertCircle size={14} />
                                    <span>Esta mensagem aparecerá como prioridade no APP.</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="glass-card status-card">
                        <div className={`status-indicator-big ${config.esta_aberta && !config.fechar_hoje_excepcionalmente ? 'open' : 'closed'}`}>
                            <div className="pulsing-dot" />
                            <div className="text">
                                <strong>{config.esta_aberta && !config.fechar_hoje_excepcionalmente ? 'LOJA ABERTA' : 'LOJA FECHADA'}</strong>
                                <span>Status atual automático</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="regular-hours-section">
                    <div className="glass-card hours-card">
                        <div className="card-header">
                            <div className="title">
                                <Calendar size={20} />
                                <h3>Horários Semanais</h3>
                            </div>
                        </div>

                        <div className="days-list">
                            {horarios.map(h => (
                                <div key={h.id} className={`day-item ${!h.aberto ? 'is-closed' : ''}`}>
                                    <div className="day-name">{diasNomes[h.dia_semana]}</div>
                                    <div className="time-inputs">
                                        <div className="time-group">
                                            <Sun size={14} />
                                            <input
                                                type="time"
                                                value={h.horario_abertura?.slice(0, 5) || '18:00'}
                                                disabled={!h.aberto}
                                                onChange={e => updateHorario(h.id, 'horario_abertura', e.target.value)}
                                            />
                                        </div>
                                        <span className="separator">até</span>
                                        <div className="time-group">
                                            <Moon size={14} />
                                            <input
                                                type="time"
                                                value={h.horario_fechamento?.slice(0, 5) || '23:30'}
                                                disabled={!h.aberto}
                                                onChange={e => updateHorario(h.id, 'horario_fechamento', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <label className="premium-toggle">
                                        <input
                                            type="checkbox"
                                            checked={h.aberto}
                                            onChange={e => updateHorario(h.id, 'aberto', e.target.checked)}
                                        />
                                        <span className="slider" />
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}
