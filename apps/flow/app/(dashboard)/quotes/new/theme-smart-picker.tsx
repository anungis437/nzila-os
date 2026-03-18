'use client'

/**
 * Theme Smart Picker — visual theme selector for gift box quotes.
 *
 * Provides curated themes per tier with smart suggestions and custom option.
 * Themes can be mapped to product bundles and margin adjustments downstream.
 */
import { useState } from 'react'
import {
  GiftIcon,
  HeartIcon,
  BuildingOfficeIcon,
  SunIcon,
  SparklesIcon,
  StarIcon,
  GlobeAltIcon,
  PaintBrushIcon,
} from '@heroicons/react/24/outline'

interface ThemeOption {
  value: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  tiers: string[] // Which tiers this theme is available for
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: 'holiday',
    label: 'Holiday',
    icon: GiftIcon,
    description: 'Festive seasonal celebrations',
    tiers: ['BUDGET', 'STANDARD', 'PREMIUM'],
  },
  {
    value: 'corporate',
    label: 'Corporate',
    icon: BuildingOfficeIcon,
    description: 'Professional business gifts',
    tiers: ['STANDARD', 'PREMIUM'],
  },
  {
    value: 'wellness',
    label: 'Wellness',
    icon: HeartIcon,
    description: 'Self-care & relaxation',
    tiers: ['STANDARD', 'PREMIUM'],
  },
  {
    value: 'summer',
    label: 'Summer',
    icon: SunIcon,
    description: 'Bright seasonal warmth',
    tiers: ['BUDGET', 'STANDARD', 'PREMIUM'],
  },
  {
    value: 'artisan',
    label: 'Artisan',
    icon: PaintBrushIcon,
    description: 'Handcrafted luxury selection',
    tiers: ['PREMIUM'],
  },
  {
    value: 'celebration',
    label: 'Celebration',
    icon: SparklesIcon,
    description: 'Milestone occasions',
    tiers: ['BUDGET', 'STANDARD', 'PREMIUM'],
  },
  {
    value: 'gourmet',
    label: 'Gourmet',
    icon: StarIcon,
    description: 'Fine food & beverages',
    tiers: ['STANDARD', 'PREMIUM'],
  },
  {
    value: 'eco',
    label: 'Eco',
    icon: GlobeAltIcon,
    description: 'Sustainable & green products',
    tiers: ['BUDGET', 'STANDARD', 'PREMIUM'],
  },
]

interface ThemeSmartPickerProps {
  value: string
  onChange: (theme: string) => void
  tier: string
}

export function ThemeSmartPicker({ value, onChange, tier }: ThemeSmartPickerProps) {
  const [customMode, setCustomMode] = useState(false)
  const [customText, setCustomText] = useState('')

  // Filter themes by tier availability
  const availableThemes = THEME_OPTIONS.filter((t) => t.tiers.includes(tier))

  // Highlight suggested themes (first 3 for the tier)
  const suggested = availableThemes.slice(0, 3)
  const isCustom = value !== '' && !THEME_OPTIONS.some((t) => t.value === value)

  function handleSelect(theme: string) {
    setCustomMode(false)
    onChange(theme)
  }

  function handleCustom() {
    setCustomMode(true)
    if (isCustom) {
      setCustomText(value)
    }
  }

  function handleCustomSubmit() {
    if (customText.trim()) {
      onChange(customText.trim())
      setCustomMode(false)
    }
  }

  const selectedOption = THEME_OPTIONS.find((t) => t.value === value)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">Theme</label>
        {suggested.length > 0 && (
          <span className="text-[10px] text-electric font-medium flex items-center gap-1">
            <SparklesIcon className="h-3 w-3" />
            Smart suggestions for {tier.charAt(0) + tier.slice(1).toLowerCase()}
          </span>
        )}
      </div>

      {/* Theme grid */}
      <div className="grid grid-cols-4 gap-2 mb-2">
        {availableThemes.map((theme) => {
          const isSelected = value === theme.value
          const isSuggested = suggested.includes(theme)
          const Icon = theme.icon

          return (
            <button
              key={theme.value}
              type="button"
              onClick={() => handleSelect(theme.value)}
              className={`relative flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 transition-all text-center ${
                isSelected
                  ? 'border-electric bg-electric/5 shadow-sm'
                  : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
              }`}
            >
              {isSuggested && !isSelected && (
                <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-electric/40" />
              )}
              {isSelected && (
                <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-electric" />
              )}
              <Icon className={`h-4 w-4 ${isSelected ? 'text-electric' : 'text-gray-400'}`} />
              <span className={`text-[11px] font-medium leading-tight ${isSelected ? 'text-electric' : 'text-gray-600'}`}>
                {theme.label}
              </span>
            </button>
          )
        })}

        {/* Custom option */}
        <button
          type="button"
          onClick={handleCustom}
          className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 border-dashed transition-all text-center ${
            isCustom || customMode
              ? 'border-electric bg-electric/5'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <PaintBrushIcon className={`h-4 w-4 ${isCustom || customMode ? 'text-electric' : 'text-gray-400'}`} />
          <span className={`text-[11px] font-medium ${isCustom || customMode ? 'text-electric' : 'text-gray-500'}`}>
            Custom
          </span>
        </button>
      </div>

      {/* Custom input */}
      {customMode && (
        <div className="flex gap-2">
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCustomSubmit())}
            placeholder="Enter custom theme..."
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-electric/20 focus:border-electric transition"
            autoFocus
          />
          <button
            type="button"
            onClick={handleCustomSubmit}
            className="px-3 py-2 text-sm font-medium text-white bg-electric rounded-lg hover:bg-electric/90 transition"
          >
            Set
          </button>
        </div>
      )}

      {/* Selected description */}
      {selectedOption && !customMode && (
        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
          <selectedOption.icon className="h-3 w-3 text-electric" />
          {selectedOption.description}
        </p>
      )}
      {isCustom && !customMode && (
        <p className="text-xs text-gray-500 mt-1">Custom theme: {value}</p>
      )}
    </div>
  )
}
