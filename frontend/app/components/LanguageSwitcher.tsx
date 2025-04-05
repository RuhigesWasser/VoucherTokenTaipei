'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { languages } from '../../i18n/settings'

export default function LanguageSwitcher() {
  const pathName = usePathname()

  const redirectedPathName = (locale: string) => {
    if (!pathName) return '/'
    const segments = pathName.split('/')
    segments[1] = locale
    return segments.join('/')
  }

  return (
    <div className="flex space-x-2">
      {languages.map((lng) => (
        <Link
          key={lng}
          href={redirectedPathName(lng)}
          className={`px-2 py-1 rounded ${
            pathName?.split('/')[1] === lng 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 hover:bg-gray-300'
          }`}
        >
          {lng === 'zh-hans' ? '中文' : 'English'}
        </Link>
      ))}
    </div>
  )
}