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
                // Ensure all times are HH:MM:SS
                const formatted = horariosRes.data.map(h => ({
                    ...h,
                    horario_abertura: h.horario_abertura || '18:00:00',
                    horario_fechamento: h.horario_fechamento || '22:00:00'
                }))
                setHorarios(formatted)
            } else {
                handleResetDefaults()
            }
        } catch (err) {
            console.error('Erro ao carregar horários:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleResetDefaults = () => {
        const defaultHours = Array.from({ length: 7 }, (_, i) => ({
            id: `temp-${i}`,
            dia_semana: i,
            aberto: i !== 6, // Closed on Saturday (6)
            horario_abertura: '18:00:00',
            horario_fechamento: '22:00:00'
        }))
        setHorarios(defaultHours)
        setFeedback({ type: 'success', msg: 'Horários redefinidos para o padrão (18h-22h, exceto Sábado)' })
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

    const calculateStatus = () => {
        if (!config || horarios.length === 0) return { open: false, label: 'CARREGANDO...' }

        // Manual master switch
        if (config.esta_aberta === false) return { open: false, label: 'LOJA DESATIVADA' }

        // Exceptional closure
        if (config.fechar_hoje_excepcionalmente) return { open: false, label: 'FECHADO HOJE' }

        // Get Brasília Time
        const now = new Date()
        const brTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
        const day = brTime.getDay()
        const timeStr = brTime.getHours().toString().padStart(2, '0') + ':' + brTime.getMinutes().toString().padStart(2, '0') + ':00'

        const todaySchedule = horarios.find(h => h.dia_semana === day)

        if (!todaySchedule || !todaySchedule.aberto) return { open: false, label: 'FECHADO HOJE' }

        // Compare times (standard format HH:MM:SS)
        const openTime = todaySchedule.horario_abertura
        const closeTime = todaySchedule.horario_fechamento

        if (timeStr >= openTime && timeStr <= closeTime) {
            return { open: true, label: 'LOJA ABERTA' }
        }

        if (timeStr < openTime) {
            return { open: false, label: `ABRIREMOS ÀS ${openTime.slice(0, 5)}` }
        }

        return { open: false, label: 'JÁ ENCERRADO' }
    }

    const currentStatus = calculateStatus()

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
                                <h3>Fechar hoje?</h3>
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

                        <div className="exception-body">
                            <p>Use esta função se hoje for um dia que você normalmente abriria, mas precisou fechar (ex: imprevisto ou feriado).</p>
                            <textarea
                                placeholder="Descreva o motivo (Ex: Hoje não abriremos devido ao feriado de Carnaval. Voltamos amanhã!)"
                                value={config.motivo_fechamento_hoje || ''}
                                onChange={e => setConfig({ ...config, motivo_fechamento_hoje: e.target.value })}
                            />
                            {config.fechar_hoje_excepcionalmente && (
                                <div className="warning-info animate-pulse">
                                    <AlertCircle size={14} />
                                    <span>LOJA FECHADA NO APP: Seus clientes verão o motivo acima.</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="glass-card status-card">
                        <div className={`status-indicator-big ${currentStatus.open ? 'open' : 'closed'}`}>
                            <div className="pulsing-dot" />
                            <div className="text">
                                <strong>{currentStatus.label}</strong>
                                <span>Status automático (Horário de Brasília)</span>
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
                            <button className="btn-reset-link" onClick={handleResetDefaults}>
                                Redefinir para Padrão (18h-22h)
                            </button>
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
