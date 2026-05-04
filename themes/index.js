export const DEFAULT_THEME_ID = 'tappay-default';

export const THEME_PRESETS = {
  [DEFAULT_THEME_ID]: {
    id: DEFAULT_THEME_ID,
    name: 'TapPay Default',
      description: 'The default TapPay direct-pay storefront look.',
    settings: {
      brandType: 'text',
      wordmarkTop: 'TAP',
      wordmarkBottom: 'PAY',
      logoImage: '',
      logoAlt: 'TapPay logo',
      logoMaxWidth: '180',
      introEyebrow: 'Direct-pay storefront',
      introTitle: 'Tap to order. Pay direct.',
      introText: 'A simple storefront for sellers who want order requests without accounts, carts, or card processing friction.',
      footerTitle: 'TapPay storefront',
      footerText: 'No cart. No account. Just tap and pay direct.',
      pageBg: '#e9e9ea',
      panelBg: '#f4f4f4',
      cardBg: '#ffffff',
      headerBg: '#050505',
      footerBg: '#050505',
      textColor: '#090909',
      mutedColor: '#6f6f73',
      accentColor: '#d9ff00',
      buttonTextColor: '#050505',
      productImageBg: '#eeeeee',
      cornerStyle: 'square'
    }
  },
  'dark-streetwear': {
    id: 'dark-streetwear',
    name: 'Dark Streetwear',
    description: 'Black, red, and off-white storefront styling for streetwear drops.',
    settings: {
      pageBg: '#111111',
      panelBg: '#181818',
      cardBg: '#f7f1e8',
      headerBg: '#070707',
      footerBg: '#070707',
      textColor: '#f7f1e8',
      mutedColor: '#b7aea2',
      accentColor: '#c80f1e',
      buttonTextColor: '#ffffff',
      productImageBg: '#231f1f',
      cornerStyle: 'square'
    }
  },
  'dark-drop': {
    id: 'dark-drop',
    name: 'Dark Drop',
    description: 'High-contrast pitch-black storefront for streetwear drops.',
    settings: {
      wordmarkTop: 'DARK',
      wordmarkBottom: 'DROP',
      introEyebrow: 'New Season Drop',
      introTitle: 'Built in the void.',
      introText: 'Direct-pay drops for brands that move fast.',
      footerTitle: 'Dark Drop Store',
      footerText: 'No cart. No noise. Just drop.',
      pageBg: '#0f0f0f',
      panelBg: '#161616',
      cardBg: '#1c1c1c',
      headerBg: '#080808',
      footerBg: '#080808',
      textColor: '#f0ede8',
      mutedColor: '#7a776f',
      accentColor: '#f0ede8',
      buttonTextColor: '#0f0f0f',
      productImageBg: '#1a1a1a',
      cornerStyle: 'square'
    }
  }
};

export function getThemePreset(themeId = DEFAULT_THEME_ID){
  return THEME_PRESETS[themeId] || THEME_PRESETS[DEFAULT_THEME_ID];
}

export function getThemeDefaults(themeId = DEFAULT_THEME_ID){
  return { ...getThemePreset(themeId).settings };
}

export function themePresetOptions(selectedThemeId = DEFAULT_THEME_ID){
  return Object.values(THEME_PRESETS).map(theme => ({
    id: theme.id,
    name: theme.name,
    selected: theme.id === selectedThemeId
  }));
}
