import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
    Plus, Trash2, QrCode, Download,
    Power, PowerOff, Hash
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import './TablesPage.css'

export default function TablesPage() {
    const [mesas, setMesas] = useState([])
    const [loading, setLoading] = useState(true)
    const [novaMesa, setNovaMesa] = useState('')
    const [showQR, setShowQR] = useState(null) // mesa id to show full QR
    const [saving, setSaving] = useState(false)

    const baseUrl = window.location.origin

    useEffect(() => {
        fetchMesas()
    }, [])

    async function fetchMesas() {
        const { data, error } = await supabase
            .from('mesas')
            .select('*')
            .order('numero', { ascending: true })

        if (!error) setMesas(data || [])
        setLoading(false)
    }

    async function adicionarMesa() {
        const num = parseInt(novaMesa, 10)
        if (isNaN(num) || num <= 0) {
            alert('Digite um número válido para a mesa.')
            return
        }

        const jaExiste = mesas.some(m => m.numero === num)
        if (jaExiste) {
            alert(`A mesa ${num} já existe.`)
            return
        }

        setSaving(true)
        const { error } = await supabase
            .from('mesas')
            .insert({ numero: num })

        if (error) {
            alert('Erro ao criar mesa: ' + error.message)
        } else {
            setNovaMesa('')
            await fetchMesas()
        }
        setSaving(false)
    }

    async function toggleAtiva(mesa) {
        const { error } = await supabase
            .from('mesas')
            .update({ ativa: !mesa.ativa })
            .eq('id', mesa.id)

        if (!error) {
            setMesas(prev =>
                prev.map(m => m.id === mesa.id ? { ...m, ativa: !m.ativa } : m)
            )
        }
    }

    async function deletarMesa(mesa) {
        if (!confirm(`Excluir mesa ${mesa.numero}? Esta ação não pode ser desfeita.`)) return

        const { error } = await supabase
            .from('mesas')
            .delete()
            .eq('id', mesa.id)

        if (!error) {
            setMesas(prev => prev.filter(m => m.id !== mesa.id))
        }
    }

    function downloadQR(mesa) {
        const svg = document.getElementById(`qr-mesa-${mesa.numero}`)
        if (!svg) return

        const svgData = new XMLSerializer().serializeToString(svg)
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const img = new Image()

        img.onload = () => {
            const padding = 40
            const textHeight = 60
            canvas.width = img.width + padding * 2
            canvas.height = img.height + padding * 2 + textHeight

            // White bg
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            // QR code
            ctx.drawImage(img, padding, padding)

            // Mesa number text
            ctx.fillStyle = '#333333'
            ctx.font = 'bold 28px Arial'
            ctx.textAlign = 'center'
            ctx.fillText(`Mesa ${mesa.numero}`, canvas.width / 2, img.height + padding + 40)

            const link = document.createElement('a')
            link.download = `qrcode-mesa-${mesa.numero}.png`
            link.href = canvas.toDataURL('image/png')
            link.click()
        }

        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
    }

    function adicionarMultiplasMesas() {
        const input = prompt('Adicionar múltiplas mesas.\n\nDigite o intervalo (ex: 1-10):')
        if (!input) return

        const match = input.match(/(\d+)\s*-\s*(\d+)/)
        if (!match) {
            alert('Formato inválido. Use "1-10" por exemplo.')
            return
        }

        const start = parseInt(match[1], 10)
        const end = parseInt(match[2], 10)

        if (start > end || end - start > 50) {
            alert('Intervalo inválido. Máximo de 50 mesas por vez.')
            return
        }

        const existentes = new Set(mesas.map(m => m.numero))
        const novas = []
        for (let i = start; i <= end; i++) {
            if (!existentes.has(i)) {
                novas.push({ numero: i })
            }
        }

        if (novas.length === 0) {
            alert('Todas as mesas nesse intervalo já existem.')
            return
        }

        setSaving(true)
        supabase
            .from('mesas')
            .insert(novas)
            .then(({ error }) => {
                if (error) alert('Erro: ' + error.message)
                else fetchMesas()
                setSaving(false)
            })
    }

    if (loading) {
        return (
            <div className="tables-loading">
                <div className="spinner" />
                <p>Carregando mesas...</p>
            </div>
        )
    }

    return (
        <div className="tables-page">
            <header className="tables-header">
                <div className="tables-header__info">
                    <h1><QrCode size={24} /> Mesas & QR Codes</h1>
                    <p>{mesas.length} mesa{mesas.length !== 1 ? 's' : ''} cadastrada{mesas.length !== 1 ? 's' : ''}</p>
                </div>
            </header>

            {/* Adicionar Mesa */}
            <div className="tables-add">
                <div className="tables-add__input-group">
                    <Hash size={18} />
                    <input
                        type="number"
                        placeholder="Nº da mesa"
                        value={novaMesa}
                        onChange={e => setNovaMesa(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && adicionarMesa()}
                        min="1"
                    />
                    <button
                        className="btn-add"
                        onClick={adicionarMesa}
                        disabled={saving || !novaMesa}
                    >
                        <Plus size={18} /> Adicionar
                    </button>
                </div>
                <button
                    className="btn-add-multiple"
                    onClick={adicionarMultiplasMesas}
                    disabled={saving}
                >
                    <Plus size={16} /> Adicionar Várias
                </button>
            </div>

            {/* Lista de Mesas */}
            {mesas.length === 0 ? (
                <div className="tables-empty">
                    <QrCode size={48} />
                    <h3>Nenhuma mesa cadastrada</h3>
                    <p>Adicione mesas para gerar QR codes.</p>
                </div>
            ) : (
                <div className="tables-grid">
                    {mesas.map(mesa => (
                        <div
                            key={mesa.id}
                            className={`table-card ${!mesa.ativa ? 'table-card--disabled' : ''}`}
                        >
                            <div className="table-card__header">
                                <h3>Mesa {mesa.numero}</h3>
                                <span className={`table-card__status ${mesa.ativa ? 'active' : 'inactive'}`}>
                                    {mesa.ativa ? 'Ativa' : 'Inativa'}
                                </span>
                            </div>

                            <div
                                className="table-card__qr"
                                onClick={() => setShowQR(showQR === mesa.id ? null : mesa.id)}
                            >
                                <QRCodeSVG
                                    id={`qr-mesa-${mesa.numero}`}
                                    value={`${baseUrl}/mesa/${mesa.numero}`}
                                    size={140}
                                    bgColor="#ffffff"
                                    fgColor="#1a1a1a"
                                    level="M"
                                    includeMargin={true}
                                />
                            </div>

                            <p className="table-card__url">
                                /mesa/{mesa.numero}
                            </p>

                            <div className="table-card__actions">
                                <button
                                    className="btn-icon btn-download"
                                    onClick={() => downloadQR(mesa)}
                                    title="Baixar QR Code"
                                >
                                    <Download size={16} />
                                </button>
                                <button
                                    className={`btn-icon ${mesa.ativa ? 'btn-deactivate' : 'btn-activate'}`}
                                    onClick={() => toggleAtiva(mesa)}
                                    title={mesa.ativa ? 'Desativar mesa' : 'Ativar mesa'}
                                >
                                    {mesa.ativa ? <PowerOff size={16} /> : <Power size={16} />}
                                </button>
                                <button
                                    className="btn-icon btn-delete"
                                    onClick={() => deletarMesa(mesa)}
                                    title="Excluir mesa"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Fullscreen QR Modal */}
            {showQR && (() => {
                const mesa = mesas.find(m => m.id === showQR)
                if (!mesa) return null
                return (
                    <div className="qr-modal-overlay" onClick={() => setShowQR(null)}>
                        <div className="qr-modal" onClick={e => e.stopPropagation()}>
                            <h2>Mesa {mesa.numero}</h2>
                            <QRCodeSVG
                                value={`${baseUrl}/mesa/${mesa.numero}`}
                                size={280}
                                bgColor="#ffffff"
                                fgColor="#1a1a1a"
                                level="H"
                                includeMargin={true}
                            />
                            <p className="qr-modal__url">{baseUrl}/mesa/{mesa.numero}</p>
                            <div className="qr-modal__actions">
                                <button className="btn-primary" onClick={() => downloadQR(mesa)}>
                                    <Download size={18} /> Baixar PNG
                                </button>
                                <button className="btn-secondary" onClick={() => setShowQR(null)}>
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
