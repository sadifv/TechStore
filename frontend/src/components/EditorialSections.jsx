export function BlogSection() {
  const posts = [
    ['/images/blog-gadgets.svg','Laptop, teléfono y audífonos inalámbricos','Los mejores Gadgets para potenciar tu Setup en 2026','Descubre los accesorios indispensables para optimizar tu espacio de trabajo.'],
    ['/images/blog-audio.svg','Audífonos inalámbricos con almohadillas acolchadas','Guía de compra: Audífonos con Cancelación de Ruido','Te enseñamos a elegir el modelo ideal según tu presupuesto y necesidades.'],
    ['/images/blog-smartwatch.svg','Reloj inteligente con indicadores de actividad','Smartwatches: Monitoreo de salud y rendimiento','Analizamos las funciones clave de los relojes inteligentes más avanzados.'],
  ]
  return <section id="blog" className="blog-section"><header className="section-header"><h2>Últimas Novedades en Tecnología</h2></header><ul className="blog-grid">{posts.map(([image,alt,title,description]) => <li key={title}><article className="blog-card"><img src={image} alt={alt}/><header className="blog-content"><h3>{title}</h3><p>{description}</p></header></article></li>)}</ul></section>
}

export function TestimonialsSection() {
  const quotes = [['CM','"Excelente servicio y entrega rapidísima. Los audífonos llegaron en perfecto estado."','- Carlos M.'],['LG','"Compré una cámara y un smartwatch. La calidad superó mis expectativas totalmente."','- Laura G.'],['MR','"El asistente de IA me ayudó a elegir el cargador correcto para mis dispositivos."','- María R.']]
  return <section className="testimonials-section"><header className="section-header"><h2>Lo que dicen nuestros clientes</h2></header><ul className="testimonials-grid">{quotes.map(([initials,quote,name]) => <li key={initials}><article className="testimonial-card"><span className="testimonial-avatar" aria-hidden="true">{initials}</span><blockquote>{quote}</blockquote><cite>{name}</cite></article></li>)}</ul></section>
}

export function VipPromo({ monthlyPrice = 4.99 }) {
  return <section className="vip-promo-section" aria-labelledby="vip-promo-heading"><div className="vip-promo-content"><span className="membership-eyebrow">TECHSTORE VIP</span><h2 id="vip-promo-heading">Beneficios exclusivos para tus compras</h2><p>Membresía mensual de ${Number(monthlyPrice).toFixed(2)} con cupones VIP y avisos anticipados de campañas seleccionadas.</p><a href="/vip" className="btn btn-primary">Conocer la membresía VIP</a></div></section>
}
