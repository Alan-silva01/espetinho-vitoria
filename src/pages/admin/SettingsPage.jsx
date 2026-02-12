import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
    Settings, Clock, MapPin, Truck,
    MessageSquare, Bell, Globe, Shield,
    Save, ChevronRight, Moon, Sun,
    CreditCard, Smartphone, AlertCircle, CheckCircle2
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import './SettingsPage.css'

export default function SettingsPage() {
    const [searchParams] = useSearchParams()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState('Geral')
    const [config, setConfig] = useState({})
    const [horarios, setHorarios] = useState([])
    const [feedback, setFeedback] = useState({ type: '', msg: '' })

    useEffect(() => {
        const tabParam = searchParams.get('tab')
        if (tabParam === 'horarios') {
            setActiveTab('Operação')
        }
        fetchSettings()
    }, [searchParams])

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
                // Initialize default hours if table is empty
                console.log('Inicializando horários padrão...')
                const defaultHours = Array.from({ length: 7 }, (_, i) => ({
                    id: `temp-${i}`, // Temp ID until saved
                    dia_semana: i,
                    aberto: i !== 0, // Closed on Sunday by default test
                    horario_abertura: '18:00:00',
                    horario_fechamento: '23:30:00'
                }))
                setHorarios(defaultHours)
            }
        } catch (err) {
            console.error('Erro ao carregar configs:', err)
        } finally {
            setLoading(false)
        }
    }

    async function handleSave() {
        setSaving(true)
        setFeedback({ type: '', msg: '' })
        try {
            // 1. Save main config
            const { error: configErr } = await supabase
                .from('configuracoes_loja')
                .update({
                    nome_loja: config.nome_loja,
                    telefone: config.telefone,
                    endereco: config.endereco,
                    taxa_entrega: config.taxa_entrega,
                    pedido_minimo: config.pedido_minimo,
                    mensagem_fechamento: config.mensagem_fechamento,
                    fechar_hoje_excepcionalmente: config.fechar_hoje_excepcionalmente,
                    motivo_fechamento_hoje: config.motivo_fechamento_hoje
                })
                .eq('id', config.id)

            if (configErr) throw configErr

            // 2. Save hours
            for (const h of horarios) {
                const payload = {
                    dia_semana: h.dia_semana,
                    aberto: h.aberto,
                    horario_abertura: h.horario_abertura,
                    horario_fechamento: h.horario_fechamento
                }

                if (h.id.toString().startsWith('temp-')) {
                    // Insert new record
                    await supabase.from('horarios_funcionamento').insert(payload)
                } else {
                    // Update existing
                    await supabase
                        .from('horarios_funcionamento')
                        .update(payload)
                        .eq('id', h.id)
                }
            }

            // Refresh to get real IDs
            fetchSettings()

            setFeedback({ type: 'success', msg: 'Configurações salvas com sucesso!' })
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

    const diasNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

    const tabs = [
        { id: 'Geral', icon: Settings },
        { id: 'Operação', icon: Clock },
        { id: 'Entrega', icon: Truck },
        { id: 'Notificações', icon: Bell }
    ]

    if (loading) return <div className="admin-loading">Carregando configurações...</div>

    return (
        <div className="settings-page-wrapper animate-fade-in">
            <header className="settings-header-premium">
                <div className="header-titles">
                    <h1>Configurações</h1>
                    <p>Gerencie como sua loja opera e aparece para os clientes.</p>
                </div>
                <div className="header-actions">
                    {feedback.msg && (
                        <div className={`feedback-pill ${feedback.type}`}>
                            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                            <span>{feedback.msg}</span>
                        </div>
                    )}
                    <button className="btn-save-settings" onClick={handleSave} disabled={saving}>
                        <Save size={18} />
                        <span>{saving ? 'Gravando...' : 'Salvar Alterações'}</span>
                    </button>
                </div>
            </header>

            <div className="settings-layout">
                <aside className="settings-sidebar">
                    <nav>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                className={`set-tab ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <tab.icon size={20} />
                                <span>{tab.id}</span>
                                <ChevronRight size={14} className="chevron" />
                            </button>
                        ))}
                    </nav>

                    <div className={`status-box ${config.esta_aberta && !config.fechar_hoje_excepcionalmente ? 'online' : 'offline'}`} style={{ marginTop: 'auto' }}>
                        <div className="status-indicator" />
                        <div className="info">
                            <strong>{config.esta_aberta && !config.fechar_hoje_excepcionalmente ? 'Loja Aberta' : 'Loja Fechada'}</strong>
                            <span>Status em tempo real</span>
                        </div>
                    </div>
                </aside>

                <main className="settings-content-v2">
                    {activeTab === 'Geral' && (
                        <div className="settings-section animate-fade-in">
                            <h3>Informações Básicas</h3>
                            <div className="settings-card-v2">
                                <div className="input-group-v2">
                                    <label>Nome do Estabelecimento</label>
                                    <input
                                        type="text"
                                        value={config.nome_loja || ''}
                                        onChange={e => setConfig({ ...config, nome_loja: e.target.value })}
                                    />
                                </div>
                                <div className="input-group-v2">
                                    <label>WhatsApp para Pedidos</label>
                                    <div className="input-with-icon">
                                        <MessageSquare size={18} />
                                        <input
                                            type="text"
                                            value={config.telefone || ''}
                                            onChange={e => setConfig({ ...config, telefone: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <h3>Endereço</h3>
                            <div className="settings-card-v2">
                                <div className="input-group-v2">
                                    <label>Endereço Completo</label>
                                    <input
                                        type="text"
                                        value={config.endereco || ''}
                                        onChange={e => setConfig({ ...config, endereco: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Operação' && (
                        <div className="settings-section animate-fade-in">
                            <div className="section-header-row">
                                <h3>Horário de Funcionamento</h3>
                                <div className="excepcional-control">
                                    <label className="toggle-label">
                                        <strong>Fechar hoje excepcionalmente?</strong>
                                        <label className="toggle-switch red">
                                            <input
                                                type="checkbox"
                                                checked={config.fechar_hoje_excepcionalmente || false}
                                                onChange={e => setConfig({ ...config, fechar_hoje_excepcionalmente: e.target.checked })}
                                            />
                                            <span className="slider" />
                                        </label>
                                    </label>
                                </div>
                            </div>

                            {config.fechar_hoje_excepcionalmente && (
                                <div className="settings-card-v2 warning-card animate-slide-down">
                                    <div className="input-group-v2">
                                        <label>Por que não vamos abrir hoje?</label>
                                        <textarea
                                            placeholder="Ex: Hoje não abriremos devido a manutenção preventiva. Voltamos amanhã!"
                                            value={config.motivo_fechamento_hoje || ''}
                                            onChange={e => setConfig({ ...config, motivo_fechamento_hoje: e.target.value })}
                                        />
                                        <small>Esta mensagem aparecerá para os clientes assim que entrarem no app.</small>
                                    </div>
                                </div>
                            )}

                            <div className="settings-card-v2">
                                {horarios.map(h => (
                                    <div key={h.id} className={`day-row ${!h.aberto ? 'closed' : ''}`}>
                                        <div className="day-info">
                                            <span className="day-name">{diasNomes[h.dia_semana]}</span>
                                        </div>
                                        <div className="time-selects">
                                            <input
                                                type="time"
                                                value={h.horario_abertura?.slice(0, 5) || '18:00'}
                                                disabled={!h.aberto}
                                                onChange={e => updateHorario(h.id, 'horario_abertura', e.target.value)}
                                            />
                                            <span>até</span>
                                            <input
                                                type="time"
                                                value={h.horario_fechamento?.slice(0, 5) || '23:30'}
                                                disabled={!h.aberto}
                                                onChange={e => updateHorario(h.id, 'horario_fechamento', e.target.value)}
                                            />
                                        </div>
                                        <div className="day-toggle">
                                            <label className="toggle-switch">
                                                <input
                                                    type="checkbox"
                                                    checked={h.aberto}
                                                    onChange={e => updateHorario(h.id, 'aberto', e.target.checked)}
                                                />
                                                <span className="slider" />
                                            </label>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <h3>Mensagem Padrão (Loja Fechada)</h3>
                            <div className="settings-card-v2">
                                <div className="input-group-v2">
                                    <label>Mensagem de Agradecimento</label>
                                    <textarea
                                        placeholder="Ex: Obrigado pela preferência! Nosso horário de atendimento é das 18h às 23h30."
                                        value={config.mensagem_fechamento || ''}
                                        onChange={e => setConfig({ ...config, mensagem_fechamento: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Entrega' && (
                        <div className="settings-section animate-fade-in">
                            <h3>Parâmetros de Delivery</h3>
                            <div className="settings-card-v2">
                                <div className="grid-2-col">
                                    <div className="input-group-v2">
                                        <label>Valor Mínimo do Pedido</label>
                                        <div className="input-with-icon">
                                            <span>R$</span>
                                            <input
                                                type="number"
                                                value={config.pedido_minimo || 0}
                                                onChange={e => setConfig({ ...config, pedido_minimo: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="input-group-v2">
                                        <label>Taxa de Entrega</label>
                                        <div className="input-with-icon">
                                            <span>R$</span>
                                            <input
                                                type="number"
                                                value={config.taxa_entrega || 0}
                                                onChange={e => setConfig({ ...config, taxa_entrega: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
