import { ref } from 'vue'
import { personService } from '../services/person.service'

export function usePeople() {
  const people = ref([])
  const isLoading = ref(false)
  const errorMessage = ref('')

  async function fetchPeople() {
    isLoading.value = true
    errorMessage.value = ''
    try {
      people.value = await personService.list()
    } catch {
      errorMessage.value = 'Não foi possível carregar as pessoas.'
    } finally {
      isLoading.value = false
    }
  }

  async function createPerson(payload) {
    const person = await personService.create(payload)
    people.value.unshift(person)
    return person
  }

  async function updatePerson(id, payload) {
    const person = await personService.update(id, payload)
    const index = people.value.findIndex((p) => p.id === id)
    if (index !== -1) people.value[index] = person
    return person
  }

  async function deletePerson(id) {
    await personService.remove(id)
    people.value = people.value.filter((p) => p.id !== id)
  }

  return {
    people,
    isLoading,
    errorMessage,
    fetchPeople,
    createPerson,
    updatePerson,
    deletePerson,
  }
}