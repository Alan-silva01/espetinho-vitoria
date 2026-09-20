import { useState, useEffect } from 'react'
import { optimizeUrl } from '../../lib/cloudinary'
import './OptimizedImage.css'

/**
 * Componente de imagem com estado de carregamento, fade-in e placeholder.
 * Resolve o problema de imagens carregando "pela metade" ou piscando.
 */
export default function OptimizedImage({
    src,
    alt,
    className = '',
    width = 400,
    height = 400,
    priority = false,
    ...props
}) {
    const [loaded, setLoaded] = useState(false)
    const [error, setError] = useState(false)

    // Apply optimization if it's a Cloudinary URL
    const optimizedSrc = optimizeUrl(src, { width, height })

    // Reset state if src changes
    useEffect(() => {
        // Optimization: check if image is already in browser cache
        const img = new Image()
        img.src = optimizedSrc
        if (img.complete) {
            setLoaded(true)
        } else {
            setLoaded(false)
        }
        setError(false)
    }, [src, optimizedSrc])

    return (
        <div className={`optimized-image-container ${className} ${loaded ? 'loaded' : 'loading'}`}>
            {!loaded && !error && (
                <div className="optimized-image-skeleton" />
            )}

            <img
                src={optimizedSrc}
                alt={alt}
                onLoad={() => setLoaded(true)}
                onError={() => setError(true)}
                loading={priority ? 'eager' : 'lazy'}
                decoding="async"
                className={`optimized-image ${loaded ? 'visible' : 'hidden'}`}
                {...props}
            />

            {error && (
                <div className="optimized-image-fallback">
                    🍖
                </div>
            )}
        </div>
    )
}
