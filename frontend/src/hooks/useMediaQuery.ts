import { useEffect, useState } from 'react'

/** 响应式断点 hook。返回 query 是否匹配。 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

/** 是否为 PC 端（≥768px） */
export const useIsDesktop = () => useMediaQuery('(min-width: 768px)')
