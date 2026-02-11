import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import './PromoMarquee.css'

export default function PromoMarquee() {
    const [promos, setPromos] = useState([])
    const scrollRef = useRef(null)

    useEffect(() => {
        async function fetchPromos() {
            const { data } = await supabase
                .from('promocoes')
                .select('*')
                .eq('ativa', true)
                .order('ordem')
            if (data && data.length > 0) setPromos(data)
        }
        fetchPromos()
    }, [])

    if (promos.length === 0) return null

    // Duplicate array for seamless infinite scroll
    const duped = [...promos, ...promos]

    return (
        <div className="promo-marquee">
            <div className="promo-marquee__track" ref={scrollRef}>
                {duped.map((promo, i) => (
                    <span
                        key={`${promo.id}-${i}`}
                        className="promo-marquee__item"
                        style={{
                            background: promo.cor_fundo,
                            color: promo.cor_texto
                        }}
                    >
                        {promo.titulo}
                    </span>
                ))}
            </div>
        </div>
    )
}
