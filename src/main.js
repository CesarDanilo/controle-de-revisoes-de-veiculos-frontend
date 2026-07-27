import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import './plugins/chart'
import { VueQueryPlugin } from '@tanstack/vue-query'

const app = createApp(App)

app.use(router)
app.use(VueQueryPlugin, {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 min sem refetch automático
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  },
})

app.mount('#app')