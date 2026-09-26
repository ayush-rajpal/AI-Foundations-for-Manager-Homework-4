import type { MouseEvent } from 'react'
import { useShop } from '../shop'

// Star toggle for saving a product to the customer's favorites (saved to their account).
export default function FavoriteButton({ productId, name, large = false }: { productId: string; name: string; large?: boolean }) {
  const { isFavorite, toggleFavorite } = useShop()
  const starred = isFavorite(productId)

  const onClick = (e: MouseEvent) => {
    e.preventDefault() // the button sits inside a product card link
    e.stopPropagation()
    toggleFavorite(productId)
  }

  return (
    <button
      type="button"
      className={`favorite-button${starred ? ' starred' : ''}${large ? ' large' : ''}`}
      onClick={onClick}
      aria-pressed={starred}
      aria-label={starred ? `Remove ${name} from favorites` : `Save ${name} to favorites`}
      title={starred ? 'Saved to favorites' : 'Save to favorites'}
    >
      <svg viewBox="0 0 24 24" width={large ? 22 : 18} height={large ? 22 : 18} aria-hidden="true">
        <path
          d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"
          fill={starred ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      {large && <span>{starred ? 'Saved' : 'Save'}</span>}
    </button>
  )
}
