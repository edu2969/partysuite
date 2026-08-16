export interface EventInfo {
  id: string
  name: string
  closeTime: string // ISO date string
  cerrado: boolean
}

export interface Guest {
  gender?: 'F' | 'M'
}

export interface ImportMessageItem {
  item: string;
}

export interface ImportMessages {
  danger?: ImportMessageItem[]
  warning?: ImportMessageItem[]
  success?: ImportMessageItem[]
}
