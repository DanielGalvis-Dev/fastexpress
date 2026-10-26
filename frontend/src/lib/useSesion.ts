import { useContext } from 'react'
import { SesionContext } from './SesionContext.ts'

export function useSesion() {
  return useContext(SesionContext)
}
