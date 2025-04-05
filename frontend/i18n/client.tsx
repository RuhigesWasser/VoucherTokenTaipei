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
        merchant: require('../public/locales/hans/merchant.json'),
        voucher: require('../public/locales/hans/voucher.json'),
        consumer: require('../public/locales/hans/consumer.json'),
        events: require('../public/locales/hans/events.json'),
        tooltip: require('../public/locales/hans/tooltip.json'),
      },
      "en": {
        common: require('../public/locales/en/common.json'),
        merchant: require('../public/locales/en/merchant.json'),
        voucher: require('../public/locales/en/voucher.json'),
        consumer: require('../public/locales/en/consumer.json'),
        events: require('../public/locales/en/events.json'),
        tooltip: require('../public/locales/en/tooltip.json'),
      },
      "hant": {
        common: require('../public/locales/hant/common.json'),
        merchant: require('../public/locales/hant/merchant.json'),
        voucher: require('../public/locales/hant/voucher.json'),
        consumer: require('../public/locales/hant/consumer.json'),
        events: require('../public/locales/hant/events.json'),
        tooltip: require('../public/locales/hant/tooltip.json'),
      },
    },
  })

export {useTranslation}