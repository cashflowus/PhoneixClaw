/**
 * Re-export all domain API modules for convenience.
 */
export { default } from '@/lib/api'
export { agentsApi } from './agents'
export { tradesApi, positionsApi } from './trades'
export { connectorsApi } from './connectors'
export { positionsApi as positionsDetailApi } from './positions'
export { skillsApi } from './skills'
export { performanceApi } from './performance'
export { adminApi } from './admin'
