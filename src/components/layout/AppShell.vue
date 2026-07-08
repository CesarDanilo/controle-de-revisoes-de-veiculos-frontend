<script setup>
import Sidebar from './Sidebar.vue'
import Topbar from './Topbar.vue'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
})
</script>

<template>
  <div class="flex min-h-screen bg-surface">
    <Sidebar />

    <div class="flex-1 overflow-y-auto">
      <main class="mx-auto flex max-w-6xl flex-col gap-8 px-8 py-8">
        <Topbar :title="title" :subtitle="subtitle">
          <template #actions>
            <slot name="actions" />
          </template>
        </Topbar>

        <slot />
      </main>
    </div>
  </div>
</template>
