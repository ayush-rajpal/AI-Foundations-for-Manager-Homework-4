export interface SizeStock {
  size: string
  quantity: number
}

// A catalogue product. Chat product cards (backend ProductCard) use the same shape.
export interface Product {
  product_id: string
  name: string
  garment_type: string
  category?: string // included on chat product cards
  description: string
  colors: string[] // catalogue column: primary color first, then logo colors
  primary_color: string | null // the garment's own color, e.g. "navy blue"
  secondary_colors: string[] // logo / graphic colors
  search_tags: string[]
  image_url: string
  price: number
  total_stock: number
  in_stock_sizes?: string[] // product list only: sizes with at least 1 unit
  inventory?: SizeStock[] // only returned by the single-product endpoint
}

export interface User {
  id: number
  first_name: string | null
  last_name: string | null
  name: string
  email: string
  phone: string | null
  phone_country: string | null
}

// Products the chatbot's search put on the page (backend PageResults).
export interface PageResults {
  title: string
  total: number
  products: Product[]
}
