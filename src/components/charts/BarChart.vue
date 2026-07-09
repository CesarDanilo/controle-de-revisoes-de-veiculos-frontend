<script setup>
import { Bar } from 'vue-chartjs'

defineProps({
  chartData: { type: Object, required: true },
  horizontal: { type: Boolean, default: false },
})

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false } },
    y: { grid: { color: '#f1f1f4' } },
  },
}
</script>

<template>
  <div class="h-64">
    <Bar
      :data="chartData"
      :options="{ ...baseOptions, indexAxis: horizontal ? 'y' : 'x' }"
    />
  </div>
</template>