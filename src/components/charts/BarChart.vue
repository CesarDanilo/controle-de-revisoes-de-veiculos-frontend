<script setup>
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'

ChartJS.register(ChartDataLabels)

const props = defineProps({
  chartData: { type: Object, required: true },
  horizontal: { type: Boolean, default: true },
  showValues: { type: Boolean, default: true },
  showLegend: { type: Boolean, default: true },
})

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
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
      :options="{
        ...baseOptions,
        indexAxis: horizontal ? 'y' : 'x',
        layout: showValues && horizontal ? { padding: { right: 28 } } : undefined,
        plugins: {
          legend: {
            display: showLegend && chartData.datasets.length > 1,
            position: 'bottom',
            labels: { boxWidth: 10, font: { size: 12 }, usePointStyle: true, pointStyle: 'circle' },
          },
          datalabels: showValues
            ? {
                display: (context) => {
                  const value = context.dataset.data[context.dataIndex]
                  return value !== 0 && value !== null // esconde rótulo quando valor é 0
                },
                color: (context) => context.dataset.backgroundColor,
                anchor: 'end',
                align: horizontal ? 'right' : 'top',
                offset: 4,
                font: { weight: '900', size: 11 },
                formatter: (value) => value,
              }
            : { display: false },
        },
      }"
    />
  </div>
</template>