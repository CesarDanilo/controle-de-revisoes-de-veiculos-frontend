<script setup>
import { Doughnut } from 'vue-chartjs'

defineProps({
  chartData: { type: Object, required: true },
})

const options = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '68%',
  plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 12 } } } },
}
</script>

<template>
  <div class="h-56">
    <Doughnut :data="chartData" :options="options" />
  </div>
</template>