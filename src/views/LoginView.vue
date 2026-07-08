<script setup>
import BrandMark from '../components/ui/BrandMark.vue'
import LoginForm from '../components/auth/LoginForm.vue'
import AuthShowcase from '../components/auth/AuthShowcase.vue'
</script>

<template>
  <div class="min-h-screen bg-surface">
    <div class="mx-auto grid min-h-screen max-w-6xl grid-cols-1">
      <!-- Coluna do formulário -->
      <div class="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-16">
        <div class="mx-auto w-full max-w-sm">
          <BrandMark size="lg" />

          <div class="mt-10">
            <h1 class="text-2xl font-bold tracking-tight text-ink-900">Bem-vindo de volta</h1>
            <p class="mt-1.5 text-sm text-ink-500">Entre com sua conta para acessar o painel.</p>
          </div>

          <div class="mt-8">
            <LoginForm />
          </div>

          <p class="mt-8 text-center text-xs text-ink-400">
            Acesso restrito à equipe Revisar.
          </p>
        </div>
      </div>

    </div>
  </div>
</template>
