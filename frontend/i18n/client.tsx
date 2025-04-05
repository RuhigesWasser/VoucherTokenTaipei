'use client'

import { initReactI18next, useTranslation } from "react-i18next";

import i18n from 'i18next'

i18n
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    debug: true,
    interpolation: {
      escapeValue: false, // React already does escaping
    },
    lng: 'en',
    resources: {
      "hans": {
        common: require('../public/locales/hans/common.json'),
      },
      "en": {
        common: require('../public/locales/en/common.json'),
      },
      "hant": {
        common: require('../public/locales/hant/common.json'),
      },
    },
  })

export {useTranslation}