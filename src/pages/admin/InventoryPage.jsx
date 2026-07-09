import { useState, useEffect, useCallback } from 'react'
import {
    Search, Plus, Filter, ArrowUpRight,
    ArrowDownRight, AlertTriangle, Package,
    ShoppingCart, ChevronRight, MoreVertical,
    CheckCircle2, XCircle, RefreshCw, Save,
    History, Download
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh'
import './InventoryPage.css'



export default function InventoryPage() {
    const [inventory, setInventory] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [stats, setStats] = useState({
        total: 0,
        sales: 0,
        alerts: 0
    })
    const [activities, setActivities] = useState([])
    const [saving, setSaving] = useState(false)
    const [savingItem, setSavingItem] = useState(null)
    const [activeTab, setActiveTab] = useState('todos')
    const [error, setError] = useState(null)

    // Helper to normalize text (remove accents)
    const normalize = (text) => {
        return (text || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    }

    // Smart search logic
    const matchesSearch = (item) => {
        if (!searchTerm) return true
        const searchNorm = normalize(searchTerm)
        const itemNorm = normalize(`${item.nome} ${item.categorias?.nome || ''}`)
        const queryWords = searchNorm.split(/\s+/).filter(w => w.length > 0)
        return queryWords.every(word => itemNorm.includes(word))
    }

    useEffect(() => {
        fetchInventory()

        // Real-time subscription for stock updates
        const channel = supabase
            .channel('inventory-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'produtos' },
                () => fetchInventory(true) // Silent refetch for realtime
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'estoque_diario' },
                () => fetchInventory(true)
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    // Wake-from-sleep: re-fetch inventory data silently
    useVisibilityRefresh(useCallback(() => {
        console.log('[InventoryPage] Woke from sleep — refreshing silently')
        fetchInventory(true)
    }, []))

    async function fetchInventory(isSilent = false) {
        if (!isSilent) setLoading(true)
        setError(null)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)

        try {
            const today = new Date().toISOString().split('T')[0]

            // 1. Fetch products
            const { data: products, error: prodErr } = await supabase
                .from('produtos')
                .select('id, nome, imagem_url, quantidade_disponivel, controlar_estoque, categorias(nome), opcoes_personalizacao, variacoes_produto(id, nome, disponivel, controlar_estoque, quantidade_disponivel)')
                .order('nome')
                .abortSignal(controller.signal)

            if (prodErr) throw prodErr

            // 2. Fetch daily stock
            const { data: stockToday, error: stockErr } = await supabase
                .from('estoque_diario')
                .select('*')
                .eq('data', today)
                .abortSignal(controller.signal)

            if (stockErr) throw stockErr

            // Merge data
            const merged = (products || []).map(p => {
                const stock = stockToday?.find(s => s.produto_id === p.id)
                const initial = stock?.qtd_inicial || p.quantidade_disponivel || 0
                const current = p.quantidade_disponivel || 0
                const sold = stock ? stock.qtd_inicial - stock.qtd_atual : 0
                const percentage = initial > 0 ? (current / initial) * 100 : 0

                return {
                    ...p,
                    stock_id: stock?.id,
                    inicial: initial,
                    atual: current,
                    vendidos: sold > 0 ? sold : 0,
                    percentage: percentage,
                    is_dirty: false
                }
            })

            setInventory(merged)

            // 3. Update stats summary
            const totalStock = merged.reduce((acc, i) => acc + i.atual, 0)
            const totalSold = merged.reduce((acc, i) => acc + i.vendidos, 0)
            const lowStock = merged.filter(i => i.percentage < 20 && i.inicial > 0).length

            setStats({
                total: totalStock,
                sales: totalSold,
                alerts: lowStock
            })

            // 4. Fetch real activities (Recent Sales)
            const { data: recentOrders, error: ordersErr } = await supabase
                .from('pedidos')
                .select('id, numero_pedido, criado_em, itens_pedido(quantidade, produtos(nome))')
                .order('criado_em', { ascending: false })
                .limit(5)

            if (ordersErr) throw ordersErr

            if (recentOrders) {
                const formatted = []
                recentOrders.forEach(order => {
                    order.itens_pedido?.forEach(item => {
                        if (formatted.length < 5) {
                            const date = new Date(order.criado_em)
                            const today = new Date()
                            const yesterday = new Date()
                            yesterday.setDate(today.getDate() - 1)

                            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            let displayTime = ''
                            if (date.toDateString() === today.toDateString()) {
                                displayTime = `Hoje, ${timeStr}`
                            } else if (date.toDateString() === yesterday.toDateString()) {
                                displayTime = `Ontem, ${timeStr}`
                            } else {
                                displayTime = `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${timeStr}`
                            }

                            formatted.push({
                                id: order.id,
                                title: `Pedido #${order.numero_pedido}`,
                                subtitle: `${item.quantidade}x ${item.produtos?.nome}`,
                                time: displayTime,
                                type: 'blue'
                            })
                        }
                    })
                })
                setActivities(formatted)
            }


        } catch (err) {
            if (err.name === 'AbortError') {
                console.warn('[Inventory] Request timed out')
                setError('A conexão está lenta. Tente recarregar a página.')
            } else {
                console.error('[Inventory] Erro ao carregar dados:', err)
                setError('Não foi possível carregar o estoque. Verifique sua conexão.')
            }
        } finally {
            clearTimeout(timeoutId)
            setLoading(false)
        }
    }

    const updateStock = (id, field, value) => {
        setInventory(prev => prev.map(item => {
            if (item.id === id) {
                // Allow empty string for better UX (so user can clear the input)
                const rawValue = value === "" ? "" : Math.max(0, parseInt(value) || 0)
                const numericValue = rawValue === "" ? 0 : rawValue

                const isInitial = field === 'inicial'

                // For percentage calculation
                const calcInitial = isInitial ? numericValue : (parseFloat(item.inicial) || 0)
                const calcCurrent = field === 'atual' ? numericValue : (isInitial ? numericValue : (parseFloat(item.atual) || 0))

                return {
                    ...item,
                    [field]: rawValue,
                    // If updating initial, we usually update current as well for the starting point
                    atual: isInitial ? rawValue : (field === 'atual' ? rawValue : item.atual),
                    percentage: calcInitial > 0 ? (calcCurrent / calcInitial) * 100 : 0,
                    is_dirty: true
                }
            }
            return item
        }))
    }

    const saveChanges = async () => {
        setSaving(true)
        const today = new Date().toISOString().split('T')[0]
        const dirtyItems = inventory.filter(p => p.is_dirty)

        for (const item of dirtyItems) {
            const finalInicial = parseInt(item.inicial) || 0
            const finalAtual = parseInt(item.atual) || 0

            // Update persistent stock in products table
            await supabase
                .from('produtos')
                .update({
                    quantidade_disponivel: finalAtual,
                    controlar_estoque: true,
                    disponivel: finalAtual > 0 // Auto-hide when stock is 0, show when restocked
                })
                .eq('id', item.id)

            // Update or create daily stock record for tracking
            if (item.stock_id) {
                await supabase
                    .from('estoque_diario')
                    .update({
                        qtd_inicial: finalInicial,
                        qtd_atual: finalAtual
                    })
                    .eq('id', item.stock_id)
            } else {
                await supabase
                    .from('estoque_diario')
                    .insert({
                        produto_id: item.id,
                        qtd_inicial: finalInicial,
                        qtd_atual: finalAtual,
                        data: today
                    })
            }
        }

        await fetchInventory()
        setSaving(false)
    }



    const toggleAddonAvailability = async (productId, groupName, optionName) => {
        const product = inventory.find(p => p.id === productId)
        if (!product || !product.opcoes_personalizacao) return

        const isAcaiAddon = product.categorias?.nome === 'Açaí' && (groupName === 'Adicionais (Pagos)' || groupName === 'Escolha 2 Frutas (Inclusos)')
        const isEspetoAddon = product.categorias?.nome === 'Espetinhos' && (groupName === 'Tipo de Arroz' || groupName === 'Ponto da Carne' || groupName === 'Acompanha' || groupName === 'Adicionais')

        const affectedProducts = (isAcaiAddon || isEspetoAddon)
            ? inventory.filter(p => p.categorias?.nome === product.categorias?.nome)
            : [product]

        // Determine new state from the clicked product
        const gIdx = product.opcoes_personalizacao.findIndex(g => g.grupo === groupName)
        if (gIdx === -1) return
        const oIdx = product.opcoes_personalizacao[gIdx].opcoes.findIndex(o => (typeof o === 'string' ? o : o.nome) === optionName)
        if (oIdx === -1) return

        const currentOpt = product.opcoes_personalizacao[gIdx].opcoes[oIdx]
        const nextAvailable = !(typeof currentOpt === 'string' ? true : (currentOpt.disponivel !== false))

        setSavingItem(`addon-${productId}-${groupName}-${optionName}`)

        try {
            const updates = affectedProducts.map(async (p) => {
                const updatedPersonalization = JSON.parse(JSON.stringify(p.opcoes_personalizacao))
                let hasChanges = false;

                updatedPersonalization.forEach(g => {
                    const shouldUpdate = (isAcaiAddon || isEspetoAddon) ? true : g.grupo === groupName;
                    
                    if (shouldUpdate) {
                        const oIdx = g.opcoes.findIndex(o => (typeof o === 'string' ? o : o.nome) === optionName)
                        if (oIdx !== -1) {
                            const option = g.opcoes[oIdx]
                            g.opcoes[oIdx] = typeof option === 'string'
                                ? { nome: option, preco: 0, disponivel: nextAvailable }
                                : { ...option, disponivel: nextAvailable }
                            hasChanges = true;
                        }
                    }
                })

                if (!hasChanges) return null

                const { error } = await supabase
                    .from('produtos')
                    .update({ opcoes_personalizacao: updatedPersonalization })
                    .eq('id', p.id)

                if (error) throw error
                return { id: p.id, updatedPersonalization }
            })

            const results = await Promise.all(updates)

            // Update local state
            setInventory(prev => prev.map(p => {
                const res = results.find(r => r?.id === p.id)
                return res ? { ...p, opcoes_personalizacao: res.updatedPersonalization } : p
            }))
        } catch (error) {
            console.error('Erro ao atualizar acompanhamento:', error)
        } finally {
            setSavingItem(null)
        }
    }

    const toggleVariationAvailability = async (categoryName, variationName) => {
        const affectedProducts = inventory.filter(p => p.categorias?.nome === categoryName && p.variacoes_produto?.some(v => v.nome === variationName))
        if (affectedProducts.length === 0) return

        const firstVar = affectedProducts[0].variacoes_produto.find(v => v.nome === variationName)
        const nextAvailable = !(firstVar.disponivel !== false) // default true if undefined

        setSavingItem(`var-${categoryName}-${variationName}`)

        try {
            const variationIdsToUpdate = []
            affectedProducts.forEach(p => {
                const targetVars = p.variacoes_produto.filter(v => v.nome === variationName)
                targetVars.forEach(v => variationIdsToUpdate.push(v.id))
            })

            const { error } = await supabase
                .from('variacoes_produto')
                .update({ disponivel: nextAvailable })
                .in('id', variationIdsToUpdate)

            if (error) throw error

            setInventory(prev => prev.map(p => {
                if (p.categorias?.nome === categoryName) {
                    if (p.variacoes_produto?.some(v => v.nome === variationName)) {
                        const newVars = p.variacoes_produto.map(v => 
                            v.nome === variationName ? { ...v, disponivel: nextAvailable } : v
                        )
                        return { ...p, variacoes_produto: newVars }
                    }
                }
                return p
            }))
        } catch (error) {
            console.error('Erro ao atualizar variação:', error)
        } finally {
            setSavingItem(null)
        }
    }

    const matchesTab = (item) => {
        if (activeTab === 'todos') return true
        const cat = item.categorias?.nome || ''
        const nome = (item.nome || '').toLowerCase()

        if (activeTab === 'acais') return cat === 'Açaí'
        if (activeTab === 'espetinhos') return cat === 'Espetinhos'
        if (activeTab === 'caldos') return cat === 'Caldos'
        if (activeTab === 'arroz') return cat === 'Porções' || nome.includes('arroz')
        if (activeTab === 'refrigerantes') return cat === 'Bebidas' && (nome.includes('refrigerante') || nome.includes('coca') || nome.includes('guaraná') || nome.includes('sprite') || nome.includes('fanta') || nome.includes('pepsi') || nome.includes('kuat') || nome.includes('bare') || nome.includes('tuchaua') || nome.includes('lata') || nome.includes('litro'))
        if (activeTab === 'jarras_sucos') return cat === 'Bebidas' && (nome.includes('jarra') || nome.includes('litro') && nome.includes('suco'))
        if (activeTab === 'sucos_naturais') return cat === 'Bebidas' && (nome.includes('suco') || nome.includes('polpa')) && !nome.includes('jarra')

        if (activeTab === 'tamanhos_ml') return cat === 'Açaí' || cat === 'Caldos'
        return true
    }

    const groupedInventory = inventory.reduce((acc, item) => {
        const catName = item.categorias?.nome || 'Sem Categoria'
        if (!acc[catName]) acc[catName] = []
        acc[catName].push(item)
        return acc
    }, {})

    if (loading) return <div className="admin-loading">Carregando estoque...</div>

    if (error) {
        return (
            <div className="admin-error-state">
                <AlertTriangle size={48} />
                <h3>Ops! Algo deu errado</h3>
                <p>{error}</p>
                <button onClick={fetchInventory} className="btn-retry">
                    <RefreshCw size={18} />
                    Tentar Novamente
                </button>
            </div>
        )
    }

    return (
        <div className="inventory-wrapper animate-fade-in">
            <header className="inventory-header-premium">
                <div className="header-titles">
                    <h1>Controle de Estoque</h1>
                    <p>Gerenciamento diário de produtos</p>
                </div>
                <div className="header-actions">
                    <div className="sync-info">
                        <RefreshCw size={14} />
                        <span>Última sincronização: Agora</span>
                    </div>
                    <button
                        className={`btn-save ${inventory.some(i => i.is_dirty) ? 'active' : ''}`}
                        onClick={saveChanges}
                        disabled={saving || !inventory.some(i => i.is_dirty)}
                    >
                        {saving ? 'Salvando...' : <><Save size={18} /> Salvar Alterações</>}
                    </button>
                </div>
            </header>

            <div className="inventory-layout-grid">
                <div className="inventory-main-content">
                    {/* Search and Quick Filters */}
                    <div className="inventory-toolbar" style={{ marginBottom: '16px' }}>
                        <div className="search-bar-v2">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Buscar produto..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Tabs / Botões Rápidos */}
                    <div className="inventory-tabs hide-scrollbar">
                        <button className={`inv-tab ${activeTab === 'todos' ? 'active' : ''}`} onClick={() => setActiveTab('todos')}>Todos</button>

                        <hr className="inv-tab-divider" />

                        <button className={`inv-tab addon-tab ${activeTab === 'acomp_acai' ? 'active' : ''}`} onClick={() => setActiveTab('acomp_acai')}>Acomp. Açaí</button>
                        <button className={`inv-tab addon-tab ${activeTab === 'acomp_espeto' ? 'active' : ''}`} onClick={() => setActiveTab('acomp_espeto')}>Acomp. Espetos</button>
                        <button className={`inv-tab addon-tab ${activeTab === 'tamanhos_ml' ? 'active' : ''}`} onClick={() => setActiveTab('tamanhos_ml')}>Tamanhos ML</button>

                        <hr className="inv-tab-divider" />

                        <button className={`inv-tab ${activeTab === 'acais' ? 'active' : ''}`} onClick={() => setActiveTab('acais')}>Açaís</button>
                        <button className={`inv-tab ${activeTab === 'espetinhos' ? 'active' : ''}`} onClick={() => setActiveTab('espetinhos')}>Espetinhos</button>
                        <button className={`inv-tab ${activeTab === 'caldos' ? 'active' : ''}`} onClick={() => setActiveTab('caldos')}>Caldos</button>
                        <button className={`inv-tab ${activeTab === 'refrigerantes' ? 'active' : ''}`} onClick={() => setActiveTab('refrigerantes')}>Refrigerantes</button>
                        <button className={`inv-tab ${activeTab === 'jarras_sucos' ? 'active' : ''}`} onClick={() => setActiveTab('jarras_sucos')}>Jarras de Suco</button>
                        <button className={`inv-tab ${activeTab === 'sucos_naturais' ? 'active' : ''}`} onClick={() => setActiveTab('sucos_naturais')}>Sucos Naturais</button>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="inventory-stats-row">
                        <div className="inv-stat-card gray">
                            <div className="stat-info">
                                <span>Total em Estoque</span>
                                <h3>{inventory.reduce((acc, i) => acc + i.atual, 0)} <small>unid.</small></h3>
                            </div>
                            <div className="stat-icon"><Package /></div>
                        </div>
                        <div className="inv-stat-card green">
                            <div className="stat-info">
                                <span>Vendidos Hoje</span>
                                <h3>{inventory.reduce((acc, i) => acc + i.vendidos, 0)} <small>unid.</small></h3>
                            </div>
                            <div className="stat-icon"><ShoppingCart /></div>
                        </div>
                        <div className="inv-stat-card red">
                            <div className="stat-info">
                                <span>Alertas de Baixa</span>
                                <h3>{stats.alerts} <small>produtos</small></h3>
                            </div>
                            <div className="stat-icon"><AlertTriangle /></div>
                        </div>
                    </div>

                    {/* Fast Entry View */}
                    {activeTab !== 'acomp_acai' && activeTab !== 'acomp_espeto' && activeTab !== 'tamanhos_ml' && (
                        <div className="fast-entry-container animate-fade-in" style={{ marginBottom: '24px' }}>
                            {inventory.filter(matchesSearch).filter(matchesTab).length === 0 ? (
                                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#9CA3AF' }}>Nenhum produto encontrado nesta categoria.</div>
                            ) : (
                                <table className="fast-entry-table">
                                    <thead>
                                        <tr>
                                            <th>Produto</th>
                                            <th>Categoria</th>
                                            <th style={{ width: '120px' }}>Estoque Atual</th>
                                            <th style={{ width: '100px' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {inventory
                                            .filter(matchesSearch)
                                            .filter(matchesTab)
                                            .map(item => (
                                                <tr key={item.id} className={item.is_dirty ? 'dirty' : ''}>
                                                    <td>
                                                        <div className="fast-prod-info">
                                                            <img src={item.imagem_url || 'https://via.placeholder.com/50'} alt="" />
                                                            <strong>{item.nome}</strong>
                                                        </div>
                                                    </td>
                                                    <td><span className="cat-pill">{item.categorias?.nome}</span></td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            className="fast-input"
                                                            value={item.atual}
                                                            onChange={e => updateStock(item.id, 'atual', e.target.value)}
                                                            min="0"
                                                        />
                                                    </td>
                                                    <td>
                                                        <span className={`status-text ${item.atual === 0 ? 'red' : item.percentage < 20 ? 'orange' : 'green'}`}>
                                                            {item.atual === 0 ? 'Esgotado' : item.percentage < 20 ? 'Baixo' : 'OK'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {/* Addons & Flavors View */}
                    <div className="inventory-sections animate-fade-in">
                        {Object.entries(groupedInventory).map(([catName, items]) => {
                            const productsWithAddons = items.filter(i => i.opcoes_personalizacao?.length > 0 && matchesSearch(i) && matchesTab(i))

                            const isShowingAcaiAddon = activeTab === 'acomp_acai' && catName === 'Açaí'
                            const isShowingEspetoAddon = activeTab === 'acomp_espeto' && catName === 'Espetinhos'
                            const isShowingSizes = activeTab === 'tamanhos_ml' && (catName === 'Açaí' || catName === 'Caldos')

                            if (productsWithAddons.length === 0 && !isShowingAcaiAddon && !isShowingEspetoAddon && !isShowingSizes) return null

                            // If specific accompaniment tab is active, hide everything else
                            if (activeTab === 'acomp_acai' && !isShowingAcaiAddon) return null;
                            if (activeTab === 'acomp_espeto' && !isShowingEspetoAddon) return null;
                            if (activeTab === 'tamanhos_ml' && !isShowingSizes) return null;

                            return (
                                <section key={catName} className="inventory-group">
                                    <div className="inventory-grid-v2">
                                        {/* Centralized card for Açaí additives (Inclusos e Pagos) */}
                                        {isShowingAcaiAddon && items.length > 0 && (
                                            <div className="addon-management-card global-addons">
                                                <div className="addon-card-header">
                                                    <img src={items[0]?.imagem_url || 'https://via.placeholder.com/150'} alt="" />
                                                    <div>
                                                        <h4>Opções de Açaí (Global)</h4>
                                                        <p style={{ fontSize: '11px', color: '#6B7280' }}>Alteração aqui afeta todos os açaís</p>
                                                    </div>
                                                </div>
                                                <div className="addon-groups-list">
                                                    {(() => {
                                                        // Get unique group names for Açaí category
                                                        const groupNames = ['Escolha 2 Frutas (Inclusos)', 'Adicionais (Pagos)']

                                                        return groupNames.map(gName => {
                                                            const masterProduct = items.find(i => i.opcoes_personalizacao.some(g => g.grupo === gName))
                                                            if (!masterProduct) return null
                                                            const group = masterProduct.opcoes_personalizacao.find(g => g.grupo === gName)

                                                            return (
                                                                <div key={gName} className="addon-group-item">
                                                                    <h5>{group.grupo}</h5>
                                                                    <div className="addon-options-grid">
                                                                        {group.opcoes.map((opt, oIdx) => {
                                                                            const name = typeof opt === 'string' ? opt : opt.nome
                                                                            const isAvailable = typeof opt === 'string' ? true : (opt.disponivel !== false)
                                                                            const isSaving = savingItem === `addon-${masterProduct.id}-${group.grupo}-${name}`

                                                                            return (
                                                                                <div key={oIdx} className={`addon-toggle-row ${!isAvailable ? 'off' : ''}`}>
                                                                                    <span>{name}</span>
                                                                                    <button
                                                                                        className={`addon-toggle-btn ${isAvailable ? 'on' : 'off'}`}
                                                                                        onClick={() => toggleAddonAvailability(masterProduct.id, group.grupo, name)}
                                                                                        disabled={isSaving}
                                                                                    >
                                                                                        {isSaving ? (
                                                                                            <RefreshCw size={12} className="animate-spin" />
                                                                                        ) : (
                                                                                            <div className="toggle-knob" />
                                                                                        )}
                                                                                    </button>
                                                                                </div>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })
                                                    })()}
                                                </div>
                                            </div>
                                        )}

                                        {/* Centralized card for Espetos (Arroz e Ponto) */}
                                        {isShowingEspetoAddon && items.length > 0 && (
                                            <div className="addon-management-card global-addons espeto-addons">
                                                <div className="addon-card-header">
                                                    <img src={items[0]?.imagem_url || 'https://via.placeholder.com/150'} alt="" />
                                                    <div>
                                                        <h4>Opções de Espeto (Global)</h4>
                                                        <p style={{ fontSize: '11px', color: '#6B7280' }}>Alteração aqui afeta todos os espetinhos</p>
                                                    </div>
                                                </div>
                                                <div className="addon-groups-list">
                                                    {(() => {
                                                        const espetoGroups = ['Tipo de Arroz', 'Ponto da Carne', 'Acompanha', 'Adicionais']
                                                        return espetoGroups.map(gName => {
                                                            const masterProduct = items.find(i => i.opcoes_personalizacao.some(g => g.grupo === gName))
                                                            if (!masterProduct) return null
                                                            const group = masterProduct.opcoes_personalizacao.find(g => g.grupo === gName)
                                                            const isRiceGroup = gName === 'Tipo de Arroz'

                                                            return (
                                                                <div key={gName} className="addon-group-item">
                                                                    <h5>{group.grupo} {isRiceGroup && <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 400 }}>— Qtd. disponível</span>}</h5>
                                                                    <div className="addon-options-grid">
                                                                        {group.opcoes.map((opt, oIdx) => {
                                                                            const name = typeof opt === 'string' ? opt : opt.nome
                                                                            const isAvailable = typeof opt === 'string' ? true : (opt.disponivel !== false)
                                                                            const isSaving = savingItem === `addon-${masterProduct.id}-${group.grupo}-${name}`
                                                                            const quantidade = typeof opt === 'object' ? (opt.quantidade ?? '') : ''

                                                                            return (
                                                                                <div key={oIdx} className={`addon-toggle-row ${!isAvailable ? 'off' : ''}`}>
                                                                                    <span>{name}</span>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                        {isRiceGroup && (
                                                                                            <input
                                                                                                type="number"
                                                                                                min="0"
                                                                                                placeholder="Qtd"
                                                                                                value={quantidade}
                                                                                                onChange={async (e) => {
                                                                                                    const val = e.target.value === '' ? null : Math.max(0, parseInt(e.target.value) || 0)
                                                                                                    setSavingItem(`addon-${masterProduct.id}-${group.grupo}-${name}`)
                                                                                                    try {
                                                                                                        const affectedProducts = inventory.filter(p => p.categorias?.nome === 'Espetinhos')
                                                                                                        const updates = affectedProducts.map(async (p) => {
                                                                                                            const updatedPersonalization = JSON.parse(JSON.stringify(p.opcoes_personalizacao))
                                                                                                            const g = updatedPersonalization.find(gr => gr.grupo === gName)
                                                                                                            if (!g) return null
                                                                                                            const oi = g.opcoes.findIndex(o => (typeof o === 'string' ? o : o.nome) === name)
                                                                                                            if (oi === -1) return null
                                                                                                            const option = g.opcoes[oi]
                                                                                                            g.opcoes[oi] = typeof option === 'string'
                                                                                                                ? { nome: option, preco: 0, disponivel: val === null || val > 0, quantidade: val }
                                                                                                                : { ...option, disponivel: val === null || val > 0, quantidade: val }
                                                                                                            const { error } = await supabase
                                                                                                                .from('produtos')
                                                                                                                .update({ opcoes_personalizacao: updatedPersonalization })
                                                                                                                .eq('id', p.id)
                                                                                                            if (error) throw error
                                                                                                            return { id: p.id, updatedPersonalization }
                                                                                                        })
                                                                                                        const results = await Promise.all(updates)
                                                                                                        setInventory(prev => prev.map(p => {
                                                                                                            const res = results.find(r => r?.id === p.id)
                                                                                                            return res ? { ...p, opcoes_personalizacao: res.updatedPersonalization } : p
                                                                                                        }))
                                                                                                    } catch (err) {
                                                                                                        console.error('Erro ao atualizar quantidade do arroz:', err)
                                                                                                    } finally {
                                                                                                        setSavingItem(null)
                                                                                                    }
                                                                                                }}
                                                                                                style={{
                                                                                                    width: '60px',
                                                                                                    padding: '4px 6px',
                                                                                                    borderRadius: '6px',
                                                                                                    border: '1px solid #D1D5DB',
                                                                                                    fontSize: '13px',
                                                                                                    textAlign: 'center',
                                                                                                    background: isAvailable ? '#fff' : '#FEE2E2'
                                                                                                }}
                                                                                            />
                                                                                        )}
                                                                                        <button
                                                                                            className={`addon-toggle-btn ${isAvailable ? 'on' : 'off'}`}
                                                                                            onClick={() => toggleAddonAvailability(masterProduct.id, group.grupo, name)}
                                                                                            disabled={isSaving}
                                                                                        >
                                                                                            {isSaving ? (
                                                                                                <RefreshCw size={12} className="animate-spin" />
                                                                                            ) : (
                                                                                                <div className="toggle-knob" />
                                                                                            )}
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })
                                                    })()}
                                                </div>
                                            </div>
                                        )}

                                        {/* Centralized card for Tamanhos (Sizes) */}
                                        {isShowingSizes && items.length > 0 && (
                                            <div className="addon-management-card global-addons">
                                                <div className="addon-card-header">
                                                    <img src={items[0]?.imagem_url || 'https://via.placeholder.com/150'} alt="" />
                                                    <div>
                                                        <h4>Tamanhos de {catName} (Global)</h4>
                                                        <p style={{ fontSize: '11px', color: '#6B7280' }}>Alteração aqui afeta os tamanhos de todos os {catName.toLowerCase()}</p>
                                                    </div>
                                                </div>
                                                <div className="addon-groups-list">
                                                    {(() => {
                                                        // Get unique variation names for this category
                                                        const uniqueSizesMap = new Map()
                                                        items.forEach(p => {
                                                            if (p.variacoes_produto) {
                                                                p.variacoes_produto.forEach(v => {
                                                                    if (!uniqueSizesMap.has(v.nome)) {
                                                                        uniqueSizesMap.set(v.nome, v)
                                                                    }
                                                                })
                                                            }
                                                        })
                                                        
                                                        const uniqueSizes = Array.from(uniqueSizesMap.values()).sort((a,b) => (a.ordem || 0) - (b.ordem || 0))
                                                        if (uniqueSizes.length === 0) return <div style={{padding: '12px', fontSize: '13px', color: '#6b7280'}}>Nenhum tamanho cadastrado.</div>

                                                        return (
                                                            <div className="addon-group-item">
                                                                <h5>Tamanhos (ML / Variações)</h5>
                                                                <div className="addon-options-grid">
                                                                    {uniqueSizes.map((size, oIdx) => {
                                                                        const isAvailable = size.disponivel !== false
                                                                        const isSaving = savingItem === `var-${catName}-${size.nome}`

                                                                        return (
                                                                            <div key={oIdx} className={`addon-toggle-row ${!isAvailable ? 'off' : ''}`}>
                                                                                <span>{size.nome}</span>
                                                                                <button
                                                                                    className={`addon-toggle-btn ${isAvailable ? 'on' : 'off'}`}
                                                                                    onClick={() => toggleVariationAvailability(catName, size.nome)}
                                                                                    disabled={isSaving}
                                                                                >
                                                                                    {isSaving ? (
                                                                                        <RefreshCw size={12} className="animate-spin" />
                                                                                    ) : (
                                                                                        <div className="toggle-knob" />
                                                                                    )}
                                                                                </button>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )
                                                    })()}
                                                </div>
                                            </div>
                                        )}

                                        {/* Individual product inclusion cards (Sabores Sucos, Refrigerantes, etc) */}
                                        {activeTab !== 'acomp_acai' && activeTab !== 'acomp_espeto' && activeTab !== 'tamanhos_ml' && productsWithAddons.map(item => {
                                            const inclusionGroups = item.opcoes_personalizacao.filter(g =>
                                                g.grupo &&
                                                g.grupo.trim() !== '' &&
                                                g.opcoes &&
                                                g.opcoes.length > 0 &&
                                                g.grupo !== 'Adicionais (Pagos)' &&
                                                g.grupo !== 'Adicionais' &&
                                                g.grupo !== 'Tipo de Arroz' &&
                                                g.grupo !== 'Ponto da Carne' &&
                                                g.grupo !== 'Acompanha' &&
                                                (item.categorias?.nome !== 'Açaí' || g.grupo !== 'Escolha 2 Frutas (Inclusos)')
                                            )
                                            if (inclusionGroups.length === 0) return null

                                            return (
                                                <div key={item.id} className="addon-management-card">
                                                    <div className="addon-card-header">
                                                        <img src={item.imagem_url || 'https://via.placeholder.com/150'} alt="" />
                                                        <h4>{item.nome}</h4>
                                                    </div>
                                                    <div className="addon-groups-list">
                                                        {inclusionGroups.map((group, gIdx) => (
                                                            <div key={gIdx} className="addon-group-item">
                                                                <h5>{group.grupo}</h5>
                                                                <div className="addon-options-grid">
                                                                    {group.opcoes.map((opt, oIdx) => {
                                                                        const name = typeof opt === 'string' ? opt : opt.nome
                                                                        const isAvailable = typeof opt === 'string' ? true : (opt.disponivel !== false)
                                                                        const isSaving = savingItem === `addon-${item.id}-${group.grupo}-${name}`

                                                                        return (
                                                                            <div key={oIdx} className={`addon-toggle-row ${!isAvailable ? 'off' : ''}`}>
                                                                                <span>{name}</span>
                                                                                <button
                                                                                    className={`addon-toggle-btn ${isAvailable ? 'on' : 'off'}`}
                                                                                    onClick={() => toggleAddonAvailability(item.id, group.grupo, name)}
                                                                                    disabled={isSaving}
                                                                                >
                                                                                    {isSaving ? (
                                                                                        <RefreshCw size={12} className="animate-spin" />
                                                                                    ) : (
                                                                                        <div className="toggle-knob" />
                                                                                    )}
                                                                                </button>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </section>
                            )
                        })}
                    </div>
                </div>

                {/* Activity Sidebar */}
                <aside className="inventory-sidebar">
                    <h3>Atividades Recentes</h3>
                    <div className="activity-timeline">
                        {activities.length > 0 ? activities.map((act, idx) => (
                            <div key={idx} className={`activity-item ${act.type}`}>
                                <div className="marker" />
                                <div className="act-content">
                                    <p><strong>{act.title}</strong></p>
                                    <span>{act.subtitle}</span>
                                    <small>{act.time}</small>
                                </div>
                            </div>
                        )) : (
                            <div className="empty-activities">Nenhuma atividade hoje.</div>
                        )}
                    </div>

                    <div className="report-box">
                        <h4>Relatório do Dia</h4>
                        <p>Exportar o controle de estoque de hoje em PDF.</p>
                        <button className="btn-download" onClick={() => window.print()}>
                            <Download size={16} /> Baixar PDF
                        </button>
                    </div>
                </aside>
            </div>
        </div>
    )
}
// Forced deployment revert check
