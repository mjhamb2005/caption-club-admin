// A meme photo with its caption in classic meme lettering
export default function MemeThumb({ url, caption, alt, size = 'md' }: { url: string | null; caption?: string; alt: string; size?: 'sm' | 'md' | 'lg' }) {
  const n = caption?.length ?? 0
  const fs = n <= 24 ? 9 : n <= 45 ? 7.2 : n <= 75 ? 5.8 : 4.6
  return (
    <div className={`b-meme b-meme-${size}`}>
      {url ? <img src={url} alt={alt} /> : <div className="b-meme-missing">Photo unavailable</div>}
      {caption && size !== 'sm' && <p className="b-meme-text" style={{ fontSize: `${fs}cqw` }}>{caption}</p>}
    </div>
  )
}
