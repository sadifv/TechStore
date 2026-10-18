import { useEffect, useState } from 'react'
import { requestJson } from '../api.js'
import AiAssistant from '../components/AiAssistant.jsx'
import { BlogSection, TestimonialsSection, VipPromo } from '../components/EditorialSections.jsx'
import FlashSaleSection from '../components/FlashSaleSection.jsx'
import { ContactSection, NewsletterSection } from '../components/FormsSections.jsx'
import HeroSection from '../components/HeroSection.jsx'
import ProductCard from '../components/ProductCard.jsx'
import { defaultMembershipConfig } from '../config/membership.js'

export default function HomePage({ user }) {
  const [products, setProducts] = useState([])
  const [flashSale, setFlashSale] = useState(null)
  const monthlyPrice = defaultMembershipConfig.monthlyPrice
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    requestJson('/api/products?limit=100&sort=recent')
      .then((result) => {
        if (!active) return
        const allProducts = result.products || []
        setProducts(allProducts.slice(0, 8))
        const now = Date.now()
        const activeSales = allProducts
          .filter((product) => product.flashSale && new Date(product.flashSaleEndsAt).getTime() > now)
          .sort((a, b) => new Date(a.flashSaleEndsAt) - new Date(b.flashSaleEndsAt))
        setFlashSale(activeSales[0] || null)
        setError('')
      })
      .catch((requestError) => { if (active) setError(requestError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return <>
    <HeroSection />
    <FlashSaleSection product={flashSale} />
    <section id="destacados" className="products-section" aria-labelledby="featured-heading">
      <header className="section-header"><h2 id="featured-heading">Productos Destacados</h2></header>
      <ul id="featured-grid" className="products-grid" aria-live="polite">
        {loading ? <li className="empty-state-item"><p className="empty-msg">Cargando productos...</p></li>
          : error ? <li className="empty-state-item"><p className="empty-msg">{error}</p></li>
            : products.length ? products.map((product) => <ProductCard key={product._id} product={product} />)
              : <li className="empty-state-item"><p className="empty-msg">No hay productos destacados disponibles en este momento.</p></li>}
      </ul>
    </section>
    <AiAssistant user={user} />
    <BlogSection />
    <TestimonialsSection />
    <NewsletterSection />
    <VipPromo monthlyPrice={monthlyPrice} />
    <ContactSection />
  </>
}
