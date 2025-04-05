export const languages = ['zh-hans', 'en']
export const defaultLng = 'zh-hans'

export function getOptions(lng = defaultLng, ns = 'common') {
  return {
    supportedLngs: languages,
    fallbackLng: defaultLng,
    lng,
    fallbackNS: 'common',
    defaultNS: 'common',
    ns
  }
}
