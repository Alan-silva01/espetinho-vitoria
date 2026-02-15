import { useState, useEffect } from 'react'
import { optimizeUrl } from '../../lib/cloudinary'

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

            <style jsx>{`
                .optimized-image-container {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                    background: #f3f4f6;
                    border-radius: inherit;
                }

                .optimized-image-skeleton {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
                    background-size: 200% 100%;
                    animation: skeleton-pulse 1.5s infinite;
                }

                .optimized-image {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: opacity 0.3s ease-out, transform 0.3s ease-out;
                }

                .optimized-image.hidden {
                    opacity: 0;
                    transform: scale(1.02);
                }

                .optimized-image.visible {
                    opacity: 1;
                    transform: scale(1);
                }

                .optimized-image-fallback {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2rem;
                    background: #f9fafb;
                }

                @keyframes skeleton-pulse {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
            `}</style>
        </div>
    )
}
