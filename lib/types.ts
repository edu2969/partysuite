export interface EventInfo {
  id: string
  name: string
  closeTime: string // ISO date string
  cerrado: boolean
}

export interface Guest {
  gender?: 'F' | 'M'
}

export interface ImportMessages {
  danger?: string[]
  warning?: string[]
  success?: string[]
}
