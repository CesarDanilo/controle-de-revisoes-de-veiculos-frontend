import { ref } from 'vue'

const STORAGE_KEY = 'sidebar-collapsed'

// 🟢 Estado no escopo do módulo (fora de qualquer função "setup"), então é
// UM ÚNICO ref compartilhado por todas as instâncias do Sidebar — sobrevive
// a remounts causados pela navegação de rota. O valor inicial vem do
// localStorage, então também sobrevive a um F5.
const isCollapsed = ref(localStorage.getItem(STORAGE_KEY) === 'true')

export function useSidebarCollapsed() {
  const toggleCollapse = () => {
    isCollapsed.value = !isCollapsed.value
    localStorage.setItem(STORAGE_KEY, String(isCollapsed.value))
  }

  return { isCollapsed, toggleCollapse }
}