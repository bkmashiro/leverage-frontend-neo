import type { GlobalThemeOverrides } from 'naive-ui'

function token(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

// Naive UI parses colors in JS, so pass resolved values while sourcing them from CSS tokens.
export function getThemeOverrides(): GlobalThemeOverrides {
  return {
    common: {
      primaryColor: token('--lv-color-accent'),
      primaryColorHover: token('--lv-color-accent-hover'),
      primaryColorPressed: token('--lv-color-accent-hover'),
      primaryColorSuppl: token('--lv-color-accent'),
      infoColor: token('--lv-color-accent'),
      successColor: token('--lv-color-success'),
      warningColor: token('--lv-color-warning'),
      errorColor: token('--lv-color-error'),
      textColorBase: token('--lv-color-text'),
      borderColor: token('--lv-color-border'),
      borderRadius: token('--lv-radius-md'),
      fontFamily: token('--lv-font-ui'),
      fontFamilyMono: token('--lv-font-code'),
      fontSize: token('--lv-size-body'),
    },
    Layout: {
      color: token('--lv-color-canvas'),
      headerColor: token('--lv-color-surface'),
      siderColor: token('--lv-color-surface'),
    },
    Menu: {
      itemColorActive: token('--lv-color-accent-soft'),
      itemTextColor: token('--lv-color-text-secondary'),
      itemTextColorActive: token('--lv-color-accent'),
      itemIconColorActive: token('--lv-color-accent'),
    },
  }
}
