'use client'

interface Props {
  locale: 'en-CA' | 'fr-CA'
}

export function TrustCoreLocaleToggle({ locale }: Props) {
  return <span className="text-sm text-gray-500">{locale}</span>
}
