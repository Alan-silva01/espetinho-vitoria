import { useState, useEffect } from 'react'
import {
    Megaphone, Plus, Calendar, Tag,
    MoreVertical, Trash2, Edit2, CheckCircle2,
    Clock, AlertCircle, Eye, Power
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import './PromotionsPage.css'

export default function PromotionsPage() {
    const [promotions, setPromotions] = useState([
        {
            id: 1,
            titulo: 'Combo Família 20%',
            desconto: '20%',
            tipo: 'Desconto em Itens',
            status: 'Ativo',
            inicio: '2024-10-01',
            fim: '2024-10-31',
            visualizacoes: 1240,
            cor: '#B91C1C'
        },
        {
            id: 2,
            titulo: 'Frete Grátis acima de R$50',
            desconto: '100% Frete',
            tipo: 'Envio Grátis',
            status: 'Agendado',
            inicio: '2024-11-01',
            fim: '2024-11-05',
            visualizacoes: 0,
            cor: '#2563EB'
        },
        {
            id: 3,
            titulo: 'Espeto de Carne em Dobro',
            desconto: '2x1',
            tipo: 'Leve 2 Pague 1',
            status: 'Pausado',
            inicio: '2024-09-15',
            fim: '2024-09-20',
            visualizacoes: 850,
            cor: '#F59E0B'
        }
    ])

    return (
        <div className="promotions-page-wrapper animate-fade-in">
            <header className="promotions-header-premium">
                <div className="header-titles">
                    <h1>Marketing & Promoções</h1>
                    <p>Aumente suas vendas com cupons e ofertas irresistíveis.</p>
                </div>
                <div className="header-actions">
                    <button className="btn-add-promo">
                        <Plus size={18} />
                        <span>Criar Promoção</span>
                    </button>
                </div>
            </header>

            <div className="promo-filters-row">
                <button className="filter-chip active">Todas</button>
                <button className="filter-chip">Ativas</button>
                <button className="filter-chip">Agendadas</button>
                <button className="filter-chip">Encerradas</button>
            </div>

            <div className="promotions-grid-v2">
                {promotions.map(promo => (
                    <div key={promo.id} className={`promo-card-premium ${promo.status.toLowerCase()}`}>
                        <div className="promo-badge-status">
                            {promo.status === 'Ativo' && <CheckCircle2 size={12} />}
                            {promo.status === 'Agendado' && <Clock size={12} />}
                            {promo.status === 'Pausado' && <Power size={12} />}
                            {promo.status}
                        </div>

                        <div className="promo-card-header" style={{ borderColor: promo.cor }}>
                            <div className="discount-circle" style={{ background: promo.cor }}>
                                <h3>{promo.desconto}</h3>
                                <span>OFF</span>
                            </div>
                            <div className="promo-actions-menu">
                                <button><MoreVertical size={18} /></button>
                            </div>
                        </div>

                        <div className="promo-card-body">
                            <h4>{promo.titulo}</h4>
                            <p className="promo-type">{promo.tipo}</p>

                            <div className="promo-dates">
                                <div className="date-item">
                                    <span>Início</span>
                                    <strong>{new Date(promo.inicio).toLocaleDateString('pt-BR')}</strong>
                                </div>
                                <div className="date-item">
                                    <span>Término</span>
                                    <strong>{new Date(promo.fim).toLocaleDateString('pt-BR')}</strong>
                                </div>
                            </div>

                            <div className="promo-stats-mini">
                                <div className="stat">
                                    <Eye size={14} />
                                    <span>{promo.visualizacoes} views</span>
                                </div>
                                <div className="stat">
                                    <Tag size={14} />
                                    <span>42 resgates</span>
                                </div>
                            </div>
                        </div>

                        <div className="promo-card-footer">
                            <button className="btn-edit-promo"><Edit2 size={14} /> Editar</button>
                            <button className="btn-toggle-promo">
                                {promo.status === 'Pausado' ? 'Reativar' : 'Pausar'}
                            </button>
                        </div>
                    </div>
                ))}

                {/* Create Card placeholder */}
                <button className="add-promo-card-dashed">
                    <div className="icon-circle"><Plus /></div>
                    <span>Nova Campanha</span>
                    <p>Crie combos, cupons ou taxa grátis</p>
                </button>
            </div>
        </div>
    )
}
