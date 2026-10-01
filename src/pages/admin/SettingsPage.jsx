import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
    Settings, Truck,
    MessageSquare, Bell,
    Save, ChevronRight,
    AlertCircle, CheckCircle2,
    RefreshCw, WifiOff, Wifi, LogOut, Smartphone
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import { evolutionService } from '../../services/evolutionService'
import './SettingsPage.css'



export default function SettingsPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState('Geral')
    const [config, setConfig] = useState({})
    const [feedback, setFeedback] = useState({ type: '', msg: '' })

    // WhatsApp / Evolution API state
    const [waStatus, setWaStatus] = useState('loading') // 'loading' | 'open' | 'close' | 'connecting' | 'error'
    const [waQrCode, setWaQrCode] = useState(null)
    const [waLoading, setWaLoading] = useState(false)
    const [waError, setWaError] = useState('')
    const qrPollRef = useRef(null)


    useEffect(() => {
        fetchSettings()
    }, [])

    // Busca status do WhatsApp ao entrar na aba
    useEffect(() => {
        if (activeTab === 'WhatsApp') {
            fetchWaStatus()
        } else {
            // Limpa polling ao sair da aba
            if (qrPollRef.current) clearInterval(qrPollRef.current)
        }
        return () => {
            if (qrPollRef.current) clearInterval(qrPollRef.current)
        }
    }, [activeTab])

    // Wake-from-sleep: re-fetch settings silently
    useVisibilityRefresh(useCallback(() => {
        console.log('[SettingsPage] Woke from sleep — refreshing silently')
        fetchSettings(true)
        if (activeTab === 'WhatsApp') fetchWaStatus()
    }, [activeTab]))

    async function fetchSettings(isSilent = false) {
        if (!isSilent) setLoading(true)
        try {
            const { data, error } = await supabase.from('configuracoes_loja').select('*').single()
            if (data) {
                setConfig(data)
            }
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


    // --- WhatsApp helpers ---
    async function fetchWaStatus() {
        setWaStatus('loading')
        setWaError('')
        try {
            const data = await evolutionService.getConnectionState()
            const state = data?.instance?.state || 'close'
            setWaStatus(state)
            if (state !== 'open') {
                fetchWaQrCode()
            } else {
                setWaQrCode(null)
            }
        } catch (err) {
            setWaStatus('error')
            setWaError('Não foi possível conectar à Evolution API.')
        }
    }

    async function fetchWaQrCode() {
        setWaLoading(true)
        setWaError('')
        try {
            const data = await evolutionService.getQrCode()
            // Aceita base64 com ou sem prefixo data URI
            const raw = data?.base64 || data?.qrcode?.base64 || data?.code || ''
            if (raw) {
                const src = raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`
                setWaQrCode(src)
                setWaStatus('connecting')
                // Polling: re-verifica status a cada 5s até conectar
                if (qrPollRef.current) clearInterval(qrPollRef.current)
                qrPollRef.current = setInterval(async () => {
                    try {
                        const s = await evolutionService.getConnectionState()
                        if (s?.instance?.state === 'open') {
                            clearInterval(qrPollRef.current)
                            setWaStatus('open')
                            setWaQrCode(null)
                        }
                    } catch {}
                }, 5000)
            } else {
                setWaError('QR Code não disponível. Tente novamente.')
            }
        } catch (err) {
            setWaError('Erro ao gerar QR Code: ' + err.message)
        } finally {
            setWaLoading(false)
        }
    }

    async function handleWaLogout() {
        if (!window.confirm('Deseja desconectar o WhatsApp?')) return
        setWaLoading(true)
        try {
            await evolutionService.logout()
            setWaStatus('close')
            setWaQrCode(null)
            setTimeout(() => fetchWaQrCode(), 1500)
        } catch (err) {
            setWaError('Erro ao desconectar: ' + err.message)
        } finally {
            setWaLoading(false)
        }
    }

    const tabs = [
        { id: 'Geral', icon: Settings },
        { id: 'Entrega', icon: Truck },
        { id: 'Notificações', icon: Bell },
        { id: 'WhatsApp', icon: MessageSquare }
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

                    {activeTab === 'WhatsApp' && (
                        <div className="settings-section animate-fade-in">
                            <h3>Conexão WhatsApp</h3>
                            <div className="wa-connect-card">

                                {/* Status badge */}
                                <div className={`wa-status-badge wa-status--${waStatus}`}>
                                    {waStatus === 'open' && <><Wifi size={16} /><span>Conectado</span></>}
                                    {waStatus === 'close' && <><WifiOff size={16} /><span>Desconectado</span></>}
                                    {waStatus === 'connecting' && <><RefreshCw size={16} className="spin" /><span>Aguardando leitura do QR...</span></>}
                                    {waStatus === 'loading' && <><RefreshCw size={16} className="spin" /><span>Verificando status...</span></>}
                                    {waStatus === 'error' && <><AlertCircle size={16} /><span>Erro de conexão</span></>}
                                </div>

                                {/* Conectado: mostra info + botão desconectar */}
                                {waStatus === 'open' && (
                                    <div className="wa-connected-panel">
                                        <div className="wa-connected-icon">
                                            <CheckCircle2 size={56} />
                                        </div>
                                        <p className="wa-connected-msg">WhatsApp conectado e funcionando normalmente.</p>
                                        <div className="wa-actions">
                                            <button className="wa-btn wa-btn--secondary" onClick={fetchWaStatus} disabled={waLoading}>
                                                <RefreshCw size={16} /> Verificar status
                                            </button>
                                            <button className="wa-btn wa-btn--danger" onClick={handleWaLogout} disabled={waLoading}>
                                                <LogOut size={16} /> Desconectar
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Desconectado ou erro: mostra QR Code */}
                                {(waStatus === 'close' || waStatus === 'connecting' || waStatus === 'error') && (
                                    <div className="wa-qr-panel">
                                        {waLoading && !waQrCode && (
                                            <div className="wa-qr-placeholder">
                                                <RefreshCw size={32} className="spin" />
                                                <p>Gerando QR Code...</p>
                                            </div>
                                        )}

                                        {waQrCode && (
                                            <div className="wa-qr-wrapper">
                                                <img src={waQrCode} alt="QR Code WhatsApp" className="wa-qr-img" />
                                                <p className="wa-qr-hint">
                                                    <Smartphone size={14} />
                                                    Abra o WhatsApp → <strong>Dispositivos vinculados</strong> → <strong>Vincular dispositivo</strong>
                                                </p>
                                            </div>
                                        )}

                                        {waError && (
                                            <div className="wa-error-msg">
                                                <AlertCircle size={16} /> {waError}
                                            </div>
                                        )}

                                        <div className="wa-actions">
                                            <button
                                                className="wa-btn wa-btn--primary"
                                                onClick={fetchWaQrCode}
                                                disabled={waLoading}
                                            >
                                                <RefreshCw size={16} className={waLoading ? 'spin' : ''} />
                                                {waQrCode ? 'Atualizar QR Code' : 'Gerar QR Code'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </main>
            </div>
        </div>
    )
}
