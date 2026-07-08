import { reactive } from 'vue'

const toasts = reactive([])
let idCounter = 0

function addToast({ type = 'info', message, duration = 4000 }) {
  const id = ++idCounter
  toasts.push({ id, type, message })

  if (duration > 0) {
    setTimeout(() => removeToast(id), duration)
  }

  return id
}

function removeToast(id) {
  const index = toasts.findIndex((t) => t.id === id)
  if (index !== -1) toasts.splice(index, 1)
}

export function useToast() {
  return {
    toasts,
    success: (message, duration) => addToast({ type: 'success', message, duration }),
    error: (message, duration) => addToast({ type: 'error', message, duration }),
    info: (message, duration) => addToast({ type: 'info', message, duration }),
    remove: removeToast,
  }
}