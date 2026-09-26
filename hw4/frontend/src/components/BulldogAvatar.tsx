import { useState } from 'react'
import BulldogIllustration from './BulldogIllustration'

// Chat assistant avatar: a photo of Handsome Dan, Yale's bulldog, cropped to a circle on
// his face. The photo lives at frontend/public/handsome-dan.jpg; if it's missing or fails
// to load, the drawn illustration is shown instead.
export const BULLDOG_PHOTO = '/handsome-dan.jpg'

export default function BulldogAvatar({ size = 36 }: { size?: number }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <BulldogIllustration size={size} />
  return (
    <span className="bulldog-avatar bulldog-photo" style={{ width: size, height: size }}>
      <img src={BULLDOG_PHOTO} alt="Handsome Dan, Yale's bulldog" onError={() => setFailed(true)} />
    </span>
  )
}
