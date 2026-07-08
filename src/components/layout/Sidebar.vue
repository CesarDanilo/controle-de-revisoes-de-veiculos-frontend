<script setup>
import { useRouter } from 'vue-router'
import { LayoutGrid, Users, BarChart3, LogOut } from '@lucide/vue'
import BrandMark from '../ui/BrandMark.vue'
import { useAuth } from '../../composables/useAuth.js'

const router = useRouter()
const { logout } = useAuth()

const links = [
  { label: 'Painel', to: '/painel', icon: LayoutGrid },
  { label: 'Proprietários', to: '/people', icon: Users },
  { label: 'Relatórios', to: '/relatorios', icon: BarChart3 },
]

const handleLogout = () => {
  logout()
  router.push('/login')
}
</script>

<template>
  <aside class="flex h-screen w-64 shrink-0 flex-col border-r border-surface-border bg-white">
    <div class="px-5 pb-6 pt-6">
      <BrandMark size="md" />
    </div>

    <nav class="flex flex-1 flex-col gap-1 px-3">
      <router-link
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-500 transition-colors hover:bg-surface hover:text-ink-900"
        active-class="!bg-surface !text-ink-900"
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