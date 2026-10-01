import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { supabase } from '../../lib/supabase'
import { MapPin, Loader2 } from 'lucide-react'
import './DeliveryHeatMap.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

function extractCoords(url) {
    if (!url) return null
    const match = url.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/)
    if (!match) return null
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) }
}

export default function DeliveryHeatMap() {
    const mapContainer = useRef(null)
    const map = useRef(null)
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({ total: 0, comMapa: 0, hotspot: null })

    useEffect(() => {
        fetchAndRender()
    }, [])

    async function fetchAndRender() {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('clientes')
                .select('id, nome, dados, pedidos(id, valor_total)')
                .not('dados->endereco->google_maps_link', 'is', null)

            if (error) throw error

            const features = []
            let hotspot = null
            let maxPedidos = 0

            data?.forEach(cliente => {
                const link = cliente.dados?.endereco?.google_maps_link
                const coords = extractCoords(link)
                if (!coords) return

                const totalPedidos = cliente.pedidos?.length || 0
                if (totalPedidos === 0) return

                if (totalPedidos > maxPedidos) {
                    maxPedidos = totalPedidos
                    hotspot = { nome: cliente.nome, pedidos: totalPedidos, ...coords }
                }

                features.push({
                    type: 'Feature',
                    properties: {
                        weight: totalPedidos,
                        nome: cliente.nome,
                        pedidos: totalPedidos,
                        valor_total: cliente.pedidos?.reduce((acc, p) => acc + Number(p.valor_total || 0), 0)
                    },
                    geometry: { type: 'Point', coordinates: [coords.lng, coords.lat] }
                })
            })

            setStats({ total: data?.length || 0, comMapa: features.length, hotspot })
            initMap(features)
        } catch (err) {
            console.error('[HeatMap] Erro:', err)
            setLoading(false)
        }
    }

    function initMap(features) {
        if (map.current) return

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/light-v11',
            center: [-47.42, -4.91],
            zoom: 12.5,
            attributionControl: false
        })

        map.current.on('load', () => {
            map.current.addSource('entregas', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features }
            })

            map.current.addLayer({
                id: 'entregas-heat',
                type: 'heatmap',
                source: 'entregas',
                maxzoom: 16,
                paint: {
                    'heatmap-weight': ['interpolate', ['linear'], ['get', 'pedidos'], 0, 0, 60, 1],
                    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 16, 3],
                    'heatmap-color': [
                        'interpolate', ['linear'], ['heatmap-density'],
                        0,   'rgba(0,0,0,0)',
                        0.2, 'rgba(59,130,246,0.6)',
                        0.4, 'rgba(16,185,129,0.7)',
                        0.6, 'rgba(245,158,11,0.85)',
                        0.8, 'rgba(239,68,68,0.9)',
                        1,   'rgba(185,28,28,1)'
                    ],
                    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 11, 20, 15, 40],
                    'heatmap-opacity': 0.85
                }
            })

            map.current.addLayer({
                id: 'entregas-points',
                type: 'circle',
                source: 'entregas',
                minzoom: 14,
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['get', 'pedidos'], 1, 5, 60, 16],
                    'circle-color': '#B91C1C',
                    'circle-stroke-color': '#fff',
                    'circle-stroke-width': 1.5,
                    'circle-opacity': 0.9
                }
            })

            map.current.on('click', 'entregas-points', (e) => {
                const { nome, pedidos, valor_total } = e.features[0].properties
                const coords = e.features[0].geometry.coordinates
                new mapboxgl.Popup({ offset: 12, className: 'heatmap-popup' })
                    .setLngLat(coords)
                    .setHTML('<div class="popup-inner"><strong>' + nome + '</strong><span>🛵 ' + pedidos + ' pedidos</span><span>💰 R$ ' + Number(valor_total).toFixed(2) + '</span></div>')
                    .addTo(map.current)
            })

            map.current.on('mouseenter', 'entregas-points', () => { map.current.getCanvas().style.cursor = 'pointer' })
            map.current.on('mouseleave', 'entregas-points', () => { map.current.getCanvas().style.cursor = '' })

            setLoading(false)
        })

        map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right')
    }

    return (
        <div className="heatmap-card">
            <div className="heatmap-header">
                <div className="heatmap-title">
                    <MapPin size={18} />
                    <h3>Mapa de Calor de Entregas</h3>
                </div>
            </div>
            <div className="heatmap-map-wrapper">
                {loading && (
                    <div className="heatmap-loading">
                        <Loader2 size={28} className="spin" />
                        <span>Carregando mapa...</span>
                    </div>
                )}
                <div ref={mapContainer} className="heatmap-mapbox-container" />
                <div className="heatmap-legend">
                    <span className="legend-label">Menos</span>
                    <div className="legend-gradient" />
                    <span className="legend-label">Mais</span>
                </div>
            </div>
        </div>
    )
}
