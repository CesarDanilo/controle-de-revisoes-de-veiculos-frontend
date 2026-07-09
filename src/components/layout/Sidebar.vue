<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { LayoutGrid, Users, BarChart3, LogOut, Menu, X } from '@lucide/vue'
import BrandMark from '../ui/BrandMark.vue'
import { useAuth } from '../../composables/useAuth.js'

const router = useRouter()
const { logout } = useAuth()

const isOpen = ref(false)

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
    class="fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 -translate-x-full flex-col border-r border-surface-border bg-white transition-transform duration-300 ease-in-out md:static md:min-h-screen md:translate-x-0"
    :class="{ 'translate-x-0': isOpen }"
  >
    <div class="flex items-center justify-between px-5 pb-6 pt-6">
      <BrandMark size="md" />
      <button
        type="button"
        class="text-ink-500 md:hidden"
        @click="closeSidebar"
      >
        <X :size="20" />
      </button>
    </div>

    <nav class="flex flex-1 flex-col gap-1 px-3">
      <router-link
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-500 transition-colors hover:bg-surface hover:text-ink-900"
        active-class="!bg-surface !text-ink-900"
        @click="closeSidebar"
      >
        <component :is="link.icon" :size="18" />
        {{ link.label }}
      </router-link>
    </nav>

    <div class="px-3 pb-6">
      <button
        type="button"
        class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-500 transition-colors hover:bg-surface hover:text-ink-900"
        @click="handleLogout"
      >
        <LogOut :size="18" />
        Sair
      </button>
    </div>
  </aside>
</template>