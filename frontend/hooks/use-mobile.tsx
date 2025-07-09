import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = window.innerWidth < MOBILE_BREAKPOINT || 
                            'ontouchstart' in window ||
                            navigator.maxTouchPoints > 0
      setIsMobile(isMobileDevice)
    }

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => checkMobile()
    
    mql.addEventListener("change", onChange)
    checkMobile()
    
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
