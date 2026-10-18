import { useEffect, useState } from 'react'
import { backendAssetUrl, requestJson } from './api.js'
import AiAssistant from './components/AiAssistant.jsx'
import {
  ForgotPasswordPage,
  LegalPage,
  LoginPage,
  MembershipPage,
  MockMembershipCheckoutPage,
  ProfilePage,
  RegisterPage,
  ResetPasswordPage,
} from './components/AccountPages.jsx'
import { BlogSection, TestimonialsSection, VipPromo } from './components/EditorialSections.jsx'
import FlashSaleSection from './components/FlashSaleSection.jsx'
import { ContactSection, NewsletterSection } from './components/FormsSections.jsx'
import HeroSection from './components/HeroSection.jsx'
import { CartProvider } from './components/Cart.jsx'
import { useCart } from './components/CartContext.js'
import ProductCard from './components/ProductCard.jsx'
import SiteFooter from './components/SiteFooter.jsx'
import SiteHeader from './components/SiteHeader.jsx'
import { defaultMembershipConfig } from './config/membership.js'
import {
  AdminDashboardPage,
  AdminMarketingPage,
  AdminOrderDetailPage,
  AdminOrdersPage,
  AdminPackingSlipPage,
  AdminUsersPage,
  CheckoutSuccessPage,
} from './components/AdminPages.jsx'
import NewsletterUnsubscribePage from './components/NewsletterUnsubscribePage.jsx'

function HomePage({ user }) {
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

const categories = ['Laptops', 'Smartphones', 'Audio', 'Accesorios', 'Periféricos', 'Monitores', 'Almacenamiento', 'Componentes', 'Gaming', 'Redes']

function CatalogPage() {
  const searchParams = new URLSearchParams(window.location.search)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [category, setCategory] = useState(searchParams.get('category') || 'all')
  const [sort, setSort] = useState(searchParams.get('sort') || 'recent')
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)
  const [data, setData] = useState({ key: '', products: [], pagination: null })
  const [error, setError] = useState('')
  const query = new URLSearchParams({ page: String(page), limit: '8', search, category, sort }).toString()

  useEffect(() => {
    let active = true
    requestJson(`/api/products?${query}`)
      .then((result) => { if (active) { setData({ ...result, key: query }); setError('') } })
      .catch((requestError) => { if (active) { setData({ key: query, products: [], pagination: null }); setError(requestError.message) } })
    return () => { active = false }
  }, [query])

  const loading = data.key !== query
  return <section id="catalogo" className="products-section" aria-labelledby="catalog-heading">
    <header className="section-header"><h1 id="catalog-heading">Nuestro Catálogo</h1></header>
    <form id="catalog-filters-form" className="catalog-filters" role="search" aria-label="Filtros de catálogo" onSubmit={(event) => event.preventDefault()}>
      <fieldset className="filter-group search-group"><legend className="sr-only">Búsqueda de productos</legend><i className="ri-search-line search-icon" aria-hidden="true" /><input type="search" id="search-input" name="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Buscar productos por nombre o descripción..." aria-label="Buscar productos" /></fieldset>
      <fieldset className="filter-group"><label htmlFor="category-select">Categoría:</label><select id="category-select" name="category" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1) }}><option value="all">Todas las categorías</option>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select></fieldset>
      <fieldset className="filter-group"><label htmlFor="sort-select">Ordenar por:</label><select id="sort-select" name="sort" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1) }}><option value="recent">Más recientes</option><option value="price_asc">Precio: Menor a Mayor</option><option value="price_desc">Precio: Mayor a Menor</option><option value="name_asc">Nombre (A - Z)</option></select></fieldset>
    </form>
    <ul id="products-grid" className="products-grid" aria-live="polite">{loading ? <li className="empty-state-item"><p className="empty-msg">Cargando productos...</p></li> : error ? <li className="empty-state-item"><p className="empty-msg">{error}</p></li> : data.products.length ? data.products.map((product) => <ProductCard key={product._id} product={product} />) : <li className="empty-state-item"><p className="empty-msg">No se encontraron productos con los filtros seleccionados.</p></li>}</ul>
    {data.pagination?.totalPages > 1 && <nav id="pagination-controls" className="pagination-container" aria-label="Navegación de páginas">{Array.from({ length: data.pagination.totalPages }, (_, index) => index + 1).map((number) => <button className={number === page ? 'active' : ''} key={number} type="button" aria-current={number === page ? 'page' : undefined} onClick={() => setPage(number)}>{number}</button>)}</nav>}
  </section>
}

function ProductPage({ productId }) {
  const { add, notify } = useCart()
  const [product, setProduct] = useState(null)
  const [error, setError] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [cartError, setCartError] = useState('')
  useEffect(() => {
    let active = true
    requestJson(`/api/products/${encodeURIComponent(productId)}`)
      .then((result) => { if (active) setProduct(result.data) })
      .catch((requestError) => { if (active) setError(requestError.message) })
    return () => { active = false }
  }, [productId])

  async function addProduct(event) {
    event.preventDefault(); setCartError('')
    try { await add(product, quantity) } catch (requestError) { setCartError(requestError.message); notify(requestError.message, 'error') }
  }

  if (error) return <section className="products-section"><p className="empty-msg" role="alert">{error}</p><a href="/catalogo">Volver al catálogo</a></section>
  if (!product) return <section className="products-section"><p className="empty-msg" role="status">Cargando producto...</p></section>
  const available = product.availableStock ?? 0
  const onSale = product.flashSale && product.flashSaleEndsAt && new Date(product.flashSaleEndsAt) > new Date()
  return <article className="product-detail-page"><figure className="product-detail-media"><img src={backendAssetUrl(product.image || '/images/products/product-placeholder.svg')} alt={product.name} />{onSale && <span className="product-detail-discount">-{product.flashSaleDiscount}%</span>}</figure>
    <section className="product-detail-info"><nav aria-label="Navegación"><a href="/catalogo" className="product-detail-back">← Volver al catálogo</a></nav><p className="product-detail-category"><i className="ri-price-tag-3-line" aria-hidden="true" /> {product.category}</p><h1 className="product-detail-title">{product.name}</h1>{product.description && <p className="product-detail-description">{product.description}</p>}<section className="product-detail-price-section" aria-label="Precio">{onSale && product.originalPrice != null && <p className="product-detail-price-original"><del>${Number(product.originalPrice).toFixed(2)}</del></p>}<p className="product-detail-price">${Number(product.price).toFixed(2)}</p></section><section className="product-detail-stock" aria-label="Disponibilidad"><p id="stock-indicator" className={available > 0 ? 'stock-in' : 'stock-out'} aria-live="polite"><i className="ri-checkbox-circle-line" aria-hidden="true" /><span id="stock-label">{available > 0 ? 'En stock' : 'Agotado temporalmente'}</span><span id="stock-separator" aria-hidden="true">·</span><span id="stock-count">{available}</span><span id="stock-unit-label">unidades disponibles</span></p></section><form className="product-detail-actions" id="add-to-cart-form" onSubmit={addProduct}><input type="hidden" name="productId" value={product._id} /><label htmlFor="quantity" className="sr-only">Cantidad</label><input type="number" id="quantity" name="quantity" value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(available || 1, Number(event.target.value) || 1)))} min="1" max={available} disabled={available === 0} /><button type="submit" className="btn btn-primary btn-block" disabled={available === 0}><i className="ri-shopping-cart-line" aria-hidden="true" />{available === 0 ? 'Producto agotado' : 'Añadir al carrito'}</button>{cartError && <output className="form-status error" role="alert">{cartError}</output>}</form></section></article>
}

function NotFoundPage() {
  return <section className="products-section"><h1>Página no encontrada</h1><a className="btn btn-primary" href="/">Volver al inicio</a></section>
}

function ErrorPage() {
  return <section className="error-page container"><h1>Ocurrió un error</h1><p>No pudimos completar tu solicitud. Inténtalo de nuevo.</p><a className="btn btn-primary" href="/">Volver al inicio</a></section>
}

export default function App() {
  const pathname = location.pathname.replace(/\/+$/, '') || '/'
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  useEffect(() => {
    requestJson('/api/auth/me').then((result) => setUser(result.user)).catch(() => setUser(null)).finally(() => setAuthReady(true))
  }, [])

  const productMatch = pathname.match(/^\/producto\/([^/]+)$/)
  const resetMatch = pathname.match(/^\/reset-password\/([^/]+)$/)
  const unsubscribeMatch = pathname.match(/^\/(?:api\/)?(?:newsletter|membership)\/unsubscribe\/([^/]+)$/)
  const orderDetailMatch = pathname.match(/^\/admin\/orders\/([^/]+)$/)
  const packingSlipMatch = pathname.match(/^\/admin\/orders\/([^/]+)\/packing-slip$/)
  let page
  if (pathname === '/') page = <HomePage user={user} />
  else if (pathname === '/catalogo') page = <CatalogPage />
  else if (productMatch) page = <ProductPage productId={decodeURIComponent(productMatch[1])} />
  else if (pathname === '/login') page = <LoginPage />
  else if (pathname === '/register') page = <RegisterPage />
  else if (pathname === '/profile') page = authReady ? user ? <ProfilePage user={user} /> : <section className="products-section"><h1>Inicia sesión para ver tu cuenta</h1><a className="btn btn-primary" href="/login?next=%2Fprofile">Iniciar sesión</a></section> : <section className="products-section"><p role="status">Cargando tu cuenta…</p></section>
  else if (pathname === '/vip') page = <MembershipPage user={user} />
  else if (pathname === '/vip/checkout') page = <MockMembershipCheckoutPage />
  else if (pathname === '/legal') page = <LegalPage />
  else if (pathname === '/forgot-password') page = <ForgotPasswordPage />
  else if (resetMatch) page = <ResetPasswordPage token={decodeURIComponent(resetMatch[1])} />
  else if (unsubscribeMatch || pathname === '/api/marketing/unsubscribe' || pathname === '/marketing/unsubscribe') page = <NewsletterUnsubscribePage />
  else if (pathname === '/checkout-success' || pathname === '/api/orders/success') page = <CheckoutSuccessPage />
  else if (pathname === '/error') page = <ErrorPage />
  else if (pathname === '/admin' || pathname === '/admin/dashboard') page = <AdminDashboardPage />
  else if (pathname === '/admin/marketing') page = <AdminMarketingPage />
  else if (pathname === '/admin/orders') page = <AdminOrdersPage />
  else if (packingSlipMatch) page = <AdminPackingSlipPage orderId={decodeURIComponent(packingSlipMatch[1])} />
  else if (orderDetailMatch) page = <AdminOrderDetailPage orderId={decodeURIComponent(orderDetailMatch[1])} />
  else if (pathname === '/admin/users') page = <AdminUsersPage />
  else page = <NotFoundPage />

  if (packingSlipMatch) return page
  return <CartProvider user={user}><a className="skip-link" href="#main-content">Saltar al contenido principal</a><SiteHeader user={user} /><main id="main-content" className="main-content">{page}</main><SiteFooter /></CartProvider>
}
