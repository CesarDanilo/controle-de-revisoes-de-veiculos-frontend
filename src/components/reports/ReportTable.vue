<script setup>
defineProps({
  columns: { type: Array, required: true }, // [{ key: 'name', label: 'Nome' }]
  rows: { type: Array, required: true },
  emptyText: { type: String, default: 'Nenhum registro encontrado.' },
})
</script>

<template>
  <div v-if="!rows.length" class="py-6 text-center text-sm text-ink-400">
    {{ emptyText }}
  </div>
  <table v-else class="w-full text-left text-sm">
    <thead class="text-ink-400">
      <tr>
        <th v-for="col in columns" :key="col.key" class="pb-2 pr-4 font-medium">
          {{ col.label }}
        </th>
      </tr>
    </thead>
    <tbody class="divide-y divide-ink-50 text-ink-700">
      <tr v-for="(row, i) in rows" :key="i">
        <td v-for="col in columns" :key="col.key" class="py-2 pr-4">
          {{ row[col.key] }}
        </td>
      </tr>
    </tbody>
  </table>
</template>