import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { fetchProducts } from '../api'
import type { Product } from '../types'

const FEATURED_IDS = [
  'basic-hoodie-big-yale',
  '2025-yale-vs-harvard-t-shirt',
  'champion-reverse-weave-crewneck',
  'saybrook-sweater-fleece-jacket',
]

const collections = [
  { title: 'Residential Colleges', text: 'Rep your college, from Branford to Timothy Dwight.', key: 'colleges' },
  { title: 'Varsity Sports', text: 'Gear for game day, whatever the sport.', key: 'sports' },
  { title: 'The Yale Family', text: 'Mom, Dad, Grandpa, Aunt, and everyone who cheers.', key: 'family' },
  { title: 'Graduate Schools', text: 'Law, Medicine, SOM, Art, Music, and more.', key: 'schools' },
]

export default function Home() {
  const [featured, setFeatured] = useState<Product[]>([])

  useEffect(() => {
    fetchProducts()
      .then((all) => setFeatured(FEATURED_IDS.map((id) => all.find((p) => p.product_id === id)).filter((p) => p !== undefined)))
      .catch(() => setFeatured([]))
  }, [])

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <p className="eyebrow">Officially licensed Yale apparel</p>
          <h1>Yale Blue, made for every day.</h1>
          <p className="hero-sub">
            Hoodies, crewnecks, tees, and cozy layers for students, alumni, and the families who cheer them on,
            straight from our shop on Broadway in New Haven.
          </p>
          <div className="hero-actions">
            <Link to="/products" className="btn btn-light">
              Shop the collection
            </Link>
            <Link to="/about" className="btn btn-outline-light">
              Our story
            </Link>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <h2>Game-day favorites</h2>
          <Link to="/products" className="text-link">
            See all products →
          </Link>
        </div>
        <div className="product-grid">
          {featured.map((p) => (
            <ProductCard key={p.product_id} product={p} />
          ))}
        </div>
      </section>

      <section className="section section-tint">
        <div className="container">
          <h2>Find your people</h2>
          <p className="section-sub">Every corner of campus has a look. Here is where to start.</p>
          <div className="collection-grid">
            {collections.map((c) => (
              <Link key={c.title} to={`/products?collection=${c.key}`} className="collection-card">
                <h3>{c.title}</h3>
                <p>{c.text}</p>
                <span className="text-link">Browse →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="container section perks">
        <div>
          <h3>Licensed and legit</h3>
          <p>Every design carries official Yale marks, so what you wear is the real thing.</p>
        </div>
        <div>
          <h3>Layers for every season</h3>
          <p>Light tees for September, heavyweight crews and fleece for a New Haven February.</p>
        </div>
        <div>
          <h3>Help when you need it</h3>
          <p>Not sure about a size or color? Ask our chatbot in the corner, anytime.</p>
        </div>
      </section>
    </>
  )
}
