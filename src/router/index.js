import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import PainelView from '../views/PainelView.vue'
import PeopleView from '../views/PeopleView.vue'
import ReportsView from '../views/ReportsView.vue'

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', name: 'login', component: LoginView },
  { path: '/painel', name: 'painel', component: PainelView },
  { path: '/people', name: 'Pessoas', component: PeopleView },
  { path: '/relatorios', name: 'relatorios', component: ReportsView },
  { path: '/auth/callback', name: 'auth-callback', component: () => import('../views/AuthCallback.vue'),
}
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
