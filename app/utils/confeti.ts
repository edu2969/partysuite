type ConfettiOptions = {
  count?: number
  duration?: number
  spread?: number
  container?: HTMLElement | null
}

const CONFETTI_COLORS = [
  '#39ff14',
  '#00f5ff',
  '#ff00ff',
  '#ff4ecd',
  '#ffd166',
  '#7bffb7',
  '#7c4dff',
  '#ff6b6b',
  '#ffffff',
  '#00ffa3',
]

let styleInjected = false

function ensureConfettiStyles() {
  if (styleInjected || typeof document === 'undefined') return

  const style = document.createElement('style')
  style.id = 'confetti-styles'
  style.textContent = `
    .confetti-layer {
      position: fixed;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      z-index: 9999;
    }

    .confetti-piece {
      position: absolute;
      left: 50%;
      top: 50%;
      opacity: 0;
      border-radius: 3px;
      animation-name: confetti-burst;
      animation-timing-function: cubic-bezier(0.12, 0.72, 0.18, 1);
      animation-fill-mode: forwards;
      box-shadow:
        0 0 6px rgba(255,255,255,0.8),
        0 0 14px currentColor;
      transform: translate(-50%, -50%);
      filter: brightness(1.15) saturate(1.3);
    }

    @keyframes confetti-burst {
      0% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.6) rotate(0deg);
      }
      10% {
        opacity: 1;
      }
      100% {
        opacity: 0;
        transform: translate(
          calc(-50% + var(--dx)),
          calc(-50% + var(--dy))
        ) rotate(var(--rotation)) scale(1);
      }
    }
  `

  document.head.appendChild(style)
  styleInjected = true
}

export function launchConfetti({
  count = 160,
  duration = 2600,
  spread = 260,
  container = typeof document !== 'undefined' ? document.body : null,
}: ConfettiOptions = {}) {
  if (typeof document === 'undefined' || !container) return

  ensureConfettiStyles()

  const layer = document.createElement('div')
  layer.className = 'confetti-layer'
  layer.setAttribute('aria-hidden', 'true')

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span')
    const size = 8 + Math.random() * 12
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.7
    const distance = (Math.random() * spread) + 80
    const dx = Math.cos(angle) * distance
    const dy = Math.sin(angle) * distance - 30
    const rotation = `${(Math.random() * 720 - 360).toFixed(2)}deg`

    piece.className = 'confetti-piece'
    piece.style.width = `${size}px`
    piece.style.height = `${(size * 1.7).toFixed(2)}px`
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
    piece.style.color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
    piece.style.setProperty('--dx', `${dx}px`)
    piece.style.setProperty('--dy', `${dy}px`)
    piece.style.setProperty('--rotation', rotation)
    piece.style.animationDuration = `${(duration + Math.random() * 600).toFixed(0)}ms`
    piece.style.animationDelay = `${(Math.random() * 100).toFixed(0)}ms`

    layer.appendChild(piece)
  }

  container.appendChild(layer)
  window.setTimeout(() => layer.remove(), duration + 500)
}
