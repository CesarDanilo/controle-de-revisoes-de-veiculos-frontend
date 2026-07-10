<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { LayoutGrid, Users, BarChart3, LogOut, Menu, X } from '@lucide/vue'
import BrandMark from '../ui/BrandMark.vue'
import { useAuth } from '../../composables/useAuth.js'

const router = useRouter()
const { logout } = useAuth()

const isOpen = ref(false)
const isCollapsed = ref(false)

const links = [
  { label: 'Painel', to: '/painel', icon: LayoutGrid },
  { label: 'Proprietários', to: '/people', icon: Users },
  { label: 'Relatórios', to: '/relatorios', icon: BarChart3 },
]

const handleLogout = () => {
  logout()
  router.push('/login')
}

const closeSidebar = () => {
  isOpen.value = false
}

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}
</script>

<template>
  <!-- Botão hambúrguer (só aparece no mobile) -->
  <button
    type="button"
    class="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-white text-ink-500 shadow-sm md:hidden"
    @click="isOpen = true"
  >
    <Menu :size="20" />
  </button>

  <!-- Overlay (mobile, quando aberto) -->
  <div
    v-if="isOpen"
    class="fixed inset-0 z-40 bg-black/40 md:hidden"
    @click="closeSidebar"
  />

  <aside
    class="fixed inset-y-0 left-0 z-50 flex shrink-0 -translate-x-full flex-col border-r border-surface-border bg-white transition-all duration-300 ease-in-out md:static md:min-h-screen md:translate-x-0"
    :class="[isOpen ? 'translate-x-0' : '', isCollapsed ? 'w-64 md:w-20' : 'w-64']"
  >
    <div
      class="flex items-center pb-6 pt-6"
      :class="isCollapsed ? 'justify-center px-3 md:px-0' : 'justify-between px-5'"
    >
      <BrandMark v-if="!isCollapsed" size="md" />

      <!-- Botão mobile: fecha o overlay -->
      <button
        type="button"
        class="text-ink-500 md:hidden"
        @click="closeSidebar"
      >
        <X :size="20" />
      </button>

      <!-- Mesmo botão, agora para desktop: retrai/expande o sidebar -->
      <button
        type="button"
        class="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-surface-border text-ink-500 transition-colors hover:bg-surface hover:text-ink-900 md:flex"
        :aria-label="isCollapsed ? 'Expandir menu' : 'Retrair menu'"
        @click="toggleCollapse"
      >
        <component :is="isCollapsed ? Menu : X" :size="18" />
      </button>
    </div>

    <nav class="flex flex-1 flex-col gap-1 px-3">
      <router-link
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-500 transition-colors hover:bg-surface hover:text-ink-900"
        active-class="!bg-surface !text-ink-900"
        :class="isCollapsed ? 'md:justify-center md:px-0' : ''"
        :title="isCollapsed ? link.label : null"
        @click="closeSidebar"
      >
        <component :is="link.icon" :size="18" class="shrink-0" />
        <span :class="isCollapsed ? 'md:hidden' : ''">{{ link.label }}</span>
      </router-link>
    </nav>

    <div class="px-3 pb-6">
      <button
        type="button"
        class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-500 transition-colors hover:bg-surface hover:text-ink-900"
        :class="isCollapsed ? 'md:justify-center md:px-0' : ''"
        :title="isCollapsed ? 'Sair' : null"
        @click="handleLogout"
      >
        <LogOut :size="18" class="shrink-0" />
        <span :class="isCollapsed ? 'md:hidden' : ''">Sair</span>
      </button>
    </div>
  </aside>
</template>