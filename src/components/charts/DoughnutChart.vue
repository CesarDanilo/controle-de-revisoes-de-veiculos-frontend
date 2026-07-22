<script setup>
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels)

defineProps({
  chartData: { type: Object, required: true },
})

const options = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '68%',
  plugins: {
    legend: {
      position: 'bottom',
      labels: { boxWidth: 10, font: { size: 12 }, usePointStyle: true, pointStyle: 'circle' },
    },
    datalabels: {
      color: '#000000',        // preto para destaque
      font: {
        weight: 'bold',
        size: 13,
      },
      formatter: (value) => value, // exibe o valor bruto
    },
  },
}
</script>

<template>
  <div class="h-56">
    <Doughnut :data="chartData" :options="options" />
  </div>
</template>