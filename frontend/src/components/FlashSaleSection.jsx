import { useEffect, useState } from 'react'

const countdown = (end, now) => {
  const difference = new Date(end).getTime() - now
  const seconds = Math.max(0, Math.floor(difference / 1000))
  return { expired: difference <= 0, days: Math.floor(seconds / 86400), hours: Math.floor((seconds % 86400) / 3600), minutes: Math.floor((seconds % 3600) / 60), seconds: seconds % 60 }
}

export default function FlashSaleSection({ product }) {
  const [now, setNow] = useState(0)
  useEffect(() => {
    if (!product) return undefined
    const update = () => setNow(Date.now())
    const initialUpdate = setTimeout(update, 0)
    const timer = setInterval(update, 1000)
    return () => {
      clearTimeout(initialUpdate)
      clearInterval(timer)
    }
  }, [product])
  if (!product) return null
  const time = now ? countdown(product.flashSaleEndsAt, now) : null
  const expired = time?.expired || false
  return <section className="flash-sale-section" aria-labelledby="flash-sale-title"><article className="flash-sale-card">
    <figure className="flash-sale-media"><img src={product.image} alt={product.name} /><span className="flash-sale-discount-badge">-{product.flashSaleDiscount}%</span></figure>
    <header className="flash-sale-info"><span className="badge flash-sale-badge">🔥 ¡Oferta por Tiempo Limitado!</span><h2 id="flash-sale-title">{product.name}</h2><p className="flash-sale-description">{product.description || 'Aprovecha esta oferta exclusiva por tiempo limitado.'}</p>
      <p className="flash-sale-prices">{product.originalPrice != null && <del>${Number(product.originalPrice).toFixed(2)}</del>}<strong>${Number(product.price).toFixed(2)}</strong></p>
      <section className={`flash-sale-timer${expired ? ' is-expired' : ''}`} aria-label="Tiempo restante"><p className="flash-sale-timer-label">⏰ Termina en:</p><output className="flash-sale-countdown" aria-live="off">{[['days','Días'],['hours','Horas'],['minutes','Min'],['seconds','Seg']].map(([key,label]) => <span className="countdown-block" key={key}><strong>{String(time?.[key] ?? 0).padStart(2,'0')}</strong><small>{label}</small></span>)}</output></section>
      {expired ? <span className="btn btn-primary btn-lg flash-sale-cta is-expired" aria-disabled="true">⏹ Oferta terminada</span> : <a href={`/producto/${product._id}`} className="btn btn-primary btn-lg flash-sale-cta"><i className="ri-shopping-cart-2-line" aria-hidden="true" />Comprar Ahora</a>}
    </header>
  </article></section>
}
