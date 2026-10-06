import { formatCurrency, getSmartItemName } from '../../lib/utils'
import { LOGO_BASE64 } from '../../lib/logoBase64'

const getItemDisplayName = (item) => {
    return getSmartItemName(
        item.produtos?.nome,
        item.variacoes_produto?.nome,
        item.personalizacao
    )
}

export default function ThermalReceipt({ order }) {
    if (!order) return null

    return (
        <div id="thermal-receipt">
            <div className="receipt-print-container">
                <div className="receipt-logo-container">
                    <img src={LOGO_BASE64} alt="VITORIA" className="receipt-logo" />
                </div>

                <div className="receipt-header-info">
                    <h2 style={{ fontSize: '22px', fontWeight: '900', textAlign: 'center', margin: '8px 0', textTransform: 'uppercase', borderBottom: '2px dashed #000', paddingBottom: '8px' }}>
                        {order.tipo_pedido === 'entrega'
                            ? 'ENTREGA'
                            : order.tipo_pedido === 'mesa'
                                ? (order.nome_cliente?.toUpperCase().includes('MESA') ? order.nome_cliente?.toUpperCase() : `MESA - ${order.nome_cliente?.toUpperCase()}`)
                                : 'RETIRADA'}
                    </h2>
                    <div style={{ textAlign: 'center', lineHeight: '1.1' }}>
                        <div style={{ fontSize: '24px', fontWeight: '950', letterSpacing: '0.5px' }}>{order.numero_pedido}</div>
                        <div style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '1px', opacity: 0.85, marginTop: '1px' }}>PEDIDO</div>
                    </div>
                    <div className="receipt-date">
                        {new Date(order.criado_em).toLocaleDateString('pt-BR')} - {new Date(order.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>

                <div className="receipt-divider"></div>

                <div className="receipt-section">
                    <div className="receipt-section-title">ESTABELECIMENTO</div>
                    <div style={{ textAlign: 'center', fontSize: '14.5px', fontWeight: '950' }}>ESPETINHO VITÓRIA</div>
                    <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: '800', marginTop: '0.5mm', letterSpacing: '-0.2px' }}>ESPETOS, AÇAÍ E CALDOS</div>
                </div>

                <div className="receipt-divider"></div>

                <div className="receipt-section">
                    <div className="receipt-section-title">{order.tipo_pedido === 'mesa' ? 'IDENTIFICAÇÃO' : 'CLIENTE'}</div>
                    <div style={{ 
                        textAlign: 'center', 
                        fontSize: '13px', 
                        fontWeight: '800', 
                        lineHeight: '1.2', 
                        marginBottom: (order.tipo_pedido !== 'mesa' && order.telefone_cliente && !/^0+$/.test(String(order.telefone_cliente).trim())) ? '1.5mm' : '0', 
                        wordBreak: 'break-word' 
                    }}>
                        {order.nome_cliente?.toUpperCase() || 'N/A'}
                    </div>
                    {order.tipo_pedido !== 'mesa' && order.telefone_cliente && !/^0+$/.test(String(order.telefone_cliente).trim()) && (
                        <div className="receipt-data-row">
                            <span className="receipt-label">TEL:</span>
                            <span>{order.telefone_cliente || order.clientes?.telefone || 'N/A'}</span>
                        </div>
                    )}
                </div>

                {order.tipo_pedido === 'entrega' && order.endereco && (
                    <>
                        <div className="receipt-divider"></div>
                        <div className="receipt-section">
                            <div className="receipt-section-title" style={{ fontSize: '13px', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>ENDEREÇO DE ENTREGA</div>
                            <div>
                                {typeof order.endereco === 'string'
                                    ? order.endereco.toUpperCase()
                                    : `${order.endereco.rua?.toUpperCase()}, ${order.endereco.numero}`}
                            </div>
                            <div>{order.endereco.bairro?.toUpperCase()}</div>
                            {order.endereco.referencia && <div>REF: {order.endereco.referencia.toUpperCase()}</div>}
                        </div>
                    </>
                )}

                <div className="receipt-divider"></div>

                <div className="receipt-section">
                    <div className="receipt-section-title">ITENS DO PEDIDO</div>
                    <table className="receipt-table">
                        <thead>
                            <tr>
                                <th style={{ width: '20%', textAlign: 'center' }}>QTD</th>
                                <th style={{ width: '80%', paddingLeft: '1.5mm' }}>ITENS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {order.itens?.map((item, i) => (
                                <tr key={i} style={{ borderBottom: '1px dashed #ddd' }}>
                                    <td style={{ verticalAlign: 'top', paddingTop: '1.5mm', textAlign: 'center', fontWeight: '950', fontSize: '15px' }}>{item.quantidade}</td>
                                    <td style={{ paddingTop: '1.5mm', paddingBottom: '1.5mm', paddingLeft: '1.5mm' }}>
                                        <div style={{ fontSize: '14.5px', fontWeight: '900', wordBreak: 'break-word', lineHeight: '1.2' }}>
                                            {getItemDisplayName(item)?.toUpperCase()}
                                        </div>
                                        {item.personalizacao && typeof item.personalizacao === 'object' && (() => {
                                            const isAcai = getItemDisplayName(item)?.toLowerCase().includes('açaí') || getItemDisplayName(item)?.toLowerCase().includes('acai')
                                            const elements = []

                                            for (const [key, val] of Object.entries(item.personalizacao)) {
                                                if (!val || (Array.isArray(val) && val.length === 0)) continue

                                                const keyLower = key.toLowerCase()
                                                const isPaid = keyLower.includes('pago') || keyLower === 'adicionais'
                                                const isFruitSelection = keyLower.includes('escolha') || keyLower.includes('incl')

                                                if (isPaid) {
                                                    elements.push(
                                                        <div key={`title-${key}`} className="receipt-item-details" style={{ textTransform: 'uppercase', marginTop: '1mm' }}>
                                                            * Adicionais pagos:
                                                        </div>
                                                    )

                                                    const itemsArray = Array.isArray(val) ? val : [val]
                                                    const counts = {}
                                                    itemsArray.forEach(v => {
                                                        const cleanName = String(v).replace(/\s*\(\s*1\s*(unidade|unid|un)\s*\)/gi, '').trim().toUpperCase()
                                                        counts[cleanName] = (counts[cleanName] || 0) + 1
                                                    })

                                                    Object.entries(counts).forEach(([cleanName, count], idx) => {
                                                        elements.push(
                                                            <div key={`item-${key}-${idx}`} className="receipt-item-details" style={{ paddingLeft: '2mm' }}>
                                                                + {count} X {cleanName}
                                                            </div>
                                                        )
                                                    })
                                                } else if (isFruitSelection) {
                                                    let displayVal
                                                    if (Array.isArray(val)) {
                                                        const counts = {}
                                                        val.forEach(v => {
                                                            const cleanName = String(v).replace(/\s*\(\s*1\s*(unidade|unid|un)\s*\)/gi, '').trim()
                                                            counts[cleanName] = (counts[cleanName] || 0) + 1
                                                        })
                                                        displayVal = Object.entries(counts)
                                                            .map(([name, count]) => count > 1 ? `${count}x ${name}` : name)
                                                            .join(', ')
                                                    } else {
                                                        displayVal = String(val)
                                                    }
                                                    elements.push(
                                                        <div key={`fruit-${key}`} className="receipt-item-details">
                                                            Frutas Escolhidas: {displayVal}
                                                        </div>
                                                    )
                                                } else if (!isAcai) {
                                                    const displayVal = Array.isArray(val) ? val.join(', ') : String(val)
                                                    elements.push(
                                                        <div key={`other-${key}`} className="receipt-item-details">
                                                            {key}: {displayVal}
                                                        </div>
                                                    )
                                                }
                                            }

                                            return elements
                                        })()}
                                        {item.observacoes && (
                                            <div className="receipt-item-details" style={{ fontWeight: 'bold' }}>
                                                * OBS: {item.observacoes.toUpperCase()}
                                            </div>
                                        )}
                                        <div style={{ textAlign: 'right', fontWeight: '950', fontSize: '14.5px', marginTop: '1mm' }}>
                                            {formatCurrency(item.preco_unitario * item.quantidade)}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="receipt-divider"></div>

                <div className="receipt-total-section">
                    <div className="receipt-total-row" style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>
                        <span>SUBTOTAL</span>
                        <span>{formatCurrency(order.subtotal)}</span>
                    </div>
                    {order.taxa_entrega > 0 && (
                        <div className="receipt-total-row" style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>
                            <span>TAXA ENTREGA</span>
                            <span>{formatCurrency(order.taxa_entrega)}</span>
                        </div>
                    )}
                    {order.taxa_cartao > 0 && (
                        <div className="receipt-total-row" style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>
                            <span>TAXA CARTÃO</span>
                            <span>{formatCurrency(order.taxa_cartao)}</span>
                        </div>
                    )}
                    <div className="receipt-total-big">
                        <span>TOTAL</span>
                        <span>{formatCurrency(order.valor_total)}</span>
                    </div>
                </div>

                <div className="receipt-divider"></div>

                <div className="receipt-section">
                    <div className="receipt-section-title" style={{ fontSize: '13px', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>FORMA DE PAGAMENTO</div>
                    <div className="receipt-data-row" style={{ gap: '2mm' }}>
                        <span>{
                            order.forma_pagamento === 'pagar_na_mesa' ? 'NA MESA' :
                            order.forma_pagamento === 'cartao_credito' ? 'CARTÃO CRÉDITO' :
                            order.forma_pagamento === 'cartao_debito' ? 'CARTÃO DÉBITO' :
                            order.forma_pagamento?.replace(/_/g, ' ').toUpperCase()
                        }</span>
                        <span style={{ whiteSpace: 'nowrap' }}>{formatCurrency(order.valor_total)}</span>
                    </div>
                    {order.troco_para && (
                        <div className="receipt-data-row" style={{ marginTop: '2mm' }}>
                            <span className="receipt-label">TROCO PARA:</span>
                            <span>{formatCurrency(order.troco_para)}</span>
                        </div>
                    )}
                </div>

                {order.observacoes && (() => {
                    const cleanObs = order.observacoes.trim()
                    if (order.tipo_pedido === 'mesa' && /^mesa\s*\d+$/i.test(cleanObs)) {
                        return null
                    }
                    return (
                        <>
                            <div className="receipt-divider"></div>
                            <div className="receipt-section">
                                <div className="receipt-section-title">OBSERVAÇÃO GERAL</div>
                                <div style={{ textAlign: 'center', fontWeight: 'bold' }}>{cleanObs.toUpperCase()}</div>
                            </div>
                        </>
                    )
                })()}

                <div className="receipt-footer-msg">
                    <div className="footer">
                        OBRIGADO PELA PREFERÊNCIA!<br />
                        ESPETINHO VITÓRIA
                    </div>
                </div>

                <div className="receipt-end-line"></div>
            </div>
        </div>
    )
}
