<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'

ChartJS.register(ChartDataLabels)

const props = defineProps({
  chartData: { type: Object, required: true },
  horizontal: { type: Boolean, default: true },
  showValues: { type: Boolean, default: true },
  showLegend: { type: Boolean, default: true },
  // tamanho mínimo por item (barra), em px — ajuste conforme o design
  itemSize: { type: Number, default: 36 },
  // a partir de quantos itens o scroll passa a valer a pena
  minItemsForScroll: { type: Number, default: 6 },
})

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: { grid: { display: false } },
    y: { grid: { color: '#f1f1f4' } },
  },
}

const labelCount = computed(() => props.chartData?.labels?.length || 0)

// tamanho "real" do gráfico (cresce com a quantidade de dados)
const computedSize = computed(() => {
  const base = labelCount.value * props.itemSize
  return Math.max(base, 256) // nunca menor que os 256px (h-64) originais
})

const needsScroll = computed(() => labelCount.value > props.minItemsForScroll)
</script>

<template>
  <!-- Container externo: mantém o tamanho fixo (h-64) -->
  <div class="h-64 overflow-hidden">
    <div
      class="h-full custom-scrollbar"
      :class="horizontal
        ? 'overflow-y-auto overflow-x-hidden'
        : 'overflow-x-auto overflow-y-hidden'"
    >
      <div
        :style="horizontal
          ? { height: needsScroll ? computedSize + 'px' : '100%', width: '100%' }
          : { width: needsScroll ? computedSize + 'px' : '100%', height: '100%' }"
      >
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
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #d1d1d6;
  border-radius: 999px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #b5b5bd;
}
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: #d1d1d6 transparent;
}
</style>