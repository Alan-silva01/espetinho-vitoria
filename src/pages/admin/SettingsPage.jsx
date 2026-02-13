import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
    Settings, Clock, MapPin, Truck,
    MessageSquare, Bell, Globe, Shield,
    Save, ChevronRight, Moon, Sun,
    CreditCard, Smartphone, AlertCircle, CheckCircle2,
    Plus, Trash2, Edit3, X
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import './SettingsPage.css'

export default function SettingsPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState('Geral')
    const [config, setConfig] = useState({})
    const [feedback, setFeedback] = useState({ type: '', msg: '' })


    useEffect(() => {
        fetchSettings()
    }, [])

    async function fetchSettings() {
        setLoading(true)
        try {
            const { data, error } = await supabase.from('configuracoes_loja').select('*').single()
            if (data) setConfig(data)
            if (error) throw error
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
            const { error: configErr } = await supabase
                .from('configuracoes_loja')
                .update({
                    nome_loja: config.nome_loja,
                    telefone: config.telefone,
                    endereco: config.endereco,
                    taxa_entrega: config.taxa_entrega,
                    pedido_minimo: config.pedido_minimo,
                    mensagem_fechamento: config.mensagem_fechamento
                })
                .eq('id', config.id)

            if (configErr) throw configErr

            setFeedback({ type: 'success', msg: 'Configurações salvas com sucesso!' })
        } catch (err) {
            setFeedback({ type: 'error', msg: 'Erro ao salvar: ' + err.message })
        } finally {
            setSaving(false)
            setTimeout(() => setFeedback({ type: '', msg: '' }), 4000)
        }
    }


    const tabs = [
        { id: 'Geral', icon: Settings },
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
                                        <label>Taxa de Entrega (Geral/Fallback)</label>
                                        <div className="input-with-icon">
                                            <span>R$</span>
                                            <input
                                                type="number"
                                                value={config.taxa_entrega || 0}
                                                onChange={e => setConfig({ ...config, taxa_entrega: e.target.value })}
                                            />
                                        </div>
                                        <p className="input-hint">Usada caso o bairro não tenha uma taxa específica.</p>
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
