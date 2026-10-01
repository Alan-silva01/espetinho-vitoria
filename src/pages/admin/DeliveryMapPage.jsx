import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { supabase } from '../../lib/supabase'
import { Map, Loader2, Navigation, Flame, Users } from 'lucide-react'
import './DeliveryMapPage.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

function extractCoords(url) {
    if (!url) return null
    const match = url.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/)
    if (!match) return null
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) }
}

export default function DeliveryMapPage() {
    const mapContainer = useRef(null)
    const map = useRef(null)
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({ totalClientes: 0, mapeados: 0, totalPedidos: 0, hotspot: null })

    useEffect(() => {
        fetchAndRender()
        return () => {
            if (map.current) {
                map.current.remove()
                map.current = null
            }
        }
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
            let somaPedidos = 0

            data?.forEach(cliente => {
                const link = cliente.dados?.endereco?.google_maps_link
                const coords = extractCoords(link)
                if (!coords) return

                const totalPedidos = cliente.pedidos?.length || 0
                if (totalPedidos === 0) return

                somaPedidos += totalPedidos

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

            setStats({
                totalClientes: data?.length || 0,
                mapeados: features.length,
                totalPedidos: somaPedidos,
                hotspot
            })

            initMap(features)
        } catch (err) {
            console.error('[DeliveryMapPage] Erro ao carregar dados:', err)
            setLoading(false)
        }
    }

    function initMap(features) {
        if (!mapContainer.current) return
        if (map.current) return

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/light-v11',
            center: [-47.42, -4.91],
            zoom: 13,
            attributionControl: false
        })

        map.current.on('load', () => {
            map.current.addSource('entregas', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features }
            })

            // Camada de calor
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
                    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 11, 24, 15, 48],
                    'heatmap-opacity': 0.85
                }
            })

            // Camada de círculos ao aproximar
            map.current.addLayer({
                id: 'entregas-points',
                type: 'circle',
                source: 'entregas',
                minzoom: 14,
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['get', 'pedidos'], 1, 6, 60, 20],
                    'circle-color': '#B91C1C',
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 2,
                    'circle-opacity': 0.95
                }
            })

            // Popups interativos
            map.current.on('click', 'entregas-points', (e) => {
                const { nome, pedidos, valor_total } = e.features[0].properties
                const coords = e.features[0].geometry.coordinates
                new mapboxgl.Popup({ offset: 12, className: 'heatmap-popup' })
                    .setLngLat(coords)
                    .setHTML(`
                        <div class="popup-inner">
                            <strong>${nome}</strong>
                            <span>🛵 ${pedidos} pedidos realizados</span>
                            <span>💰 R$ ${Number(valor_total || 0).toFixed(2)} total gasto</span>
                        </div>
                    `)
                    .addTo(map.current)
            })

            map.current.on('mouseenter', 'entregas-points', () => {
                if (map.current) map.current.getCanvas().style.cursor = 'pointer'
            })
            map.current.on('mouseleave', 'entregas-points', () => {
                if (map.current) map.current.getCanvas().style.cursor = ''
            })

            setLoading(false)
        })

        map.current.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right')
        map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right')
    }

    return (
        <div className="map-page-container">
            <header className="map-page-header">
                <div className="map-page-title-wrap">
                    <div className="map-page-icon">
                        <Map size={24} />
                    </div>
                    <div>
                        <h1>Mapa de Entregas</h1>
                        <p>Visualização territorial e densidade de pedidos por cliente</p>
                    </div>
                </div>

                <div className="map-page-stats">
                    <div className="map-page-badge">
                        <Users size={14} />
                        <span><strong>{stats.mapeados}</strong> clientes com GPS</span>
                    </div>
                    <div className="map-page-badge">
                        <Navigation size={14} />
                        <span><strong>{stats.totalPedidos}</strong> entregas mapeadas</span>
                    </div>
                    {stats.hotspot && (
                        <div className="map-page-badge highlight">
                            <Flame size={14} />
                            <span>Maior foco: <strong>{stats.hotspot.nome}</strong> ({stats.hotspot.pedidos})</span>
                        </div>
                    )}
                </div>
            </header>

            <div className="map-page-body">
                {loading && (
                    <div className="map-page-loading">
                        <Loader2 size={32} className="spin" />
                        <span>Carregando dados cartográficos...</span>
                    </div>
                )}
                <div ref={mapContainer} className="map-page-fullscreen-canvas" />

                <div className="map-page-legend">
                    <span className="map-page-legend-label">Baixa densidade</span>
                    <div className="map-page-legend-bar" />
                    <span className="map-page-legend-label">Alta densidade</span>
                </div>
            </div>
        </div>
    )
}
