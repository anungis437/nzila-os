export interface ShareTarget {
  title: string
  url: string
  text?: string
}

function encode(value: string): string {
  return encodeURIComponent(value)
}

export function buildShareLinks(target: ShareTarget): {
  x: string
  facebook: string
  whatsapp: string
  linkedin: string
} {
  const text = target.text ?? target.title
  const encodedUrl = encode(target.url)
  const encodedText = encode(text)
  const encodedTitle = encode(target.title)

  return {
    x: `https://x.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&title=${encodedTitle}`,
  }
}
