<script setup lang="ts">
import { computed, nextTick, ref, useId, watch, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChartColumn, Inbox, Layers, Plus, Search } from 'lucide-vue-next'
import ProjectIcon from '@/components/projects/ProjectIcon.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useTaskSearch } from '@/composables/useTaskSearch'
import { PROJECT_COLOR_CLASSES, type Project } from '@/domain/projects'
import type { Task } from '@/domain/task'
import { matchesWords } from '@/domain/text'
import { useProjectsStore } from '@/stores/projects'
import { useUiStore } from '@/stores/ui'

/**
 * Buscador global (step-24, D-52): `Ctrl+K` o `/`. Busca tareas por clave o título (las
 * abiertas y, con la clave exacta, también las cerradas), proyectos y accesos directos. Flechas
 * para moverse, Enter para abrir y Esc para cerrar.
 */
const { t } = useI18n()
const router = useRouter()
const ui = useUiStore()
const projectsStore = useProjectsStore()
const id = useId()

const dialog = ref<HTMLDialogElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const text = ref('')
const active = ref(0)

const { results: tasks, searchingKey } = useTaskSearch(text, {
  enabled: () => ui.searchOpen,
  max: 8,
})

type Item =
  | { kind: 'task'; task: Task }
  | { kind: 'project'; project: Project }
  | { kind: 'go'; key: string; label: string; icon: Component; run: () => void }

const shortcuts = computed<Item[]>(() => [
  {
    kind: 'go',
    key: 'new',
    label: t('search.go.newTask'),
    icon: Plus,
    run: () => {
      ui.requestNewTask()
      void router.push({ name: 'home' })
    },
  },
  {
    kind: 'go',
    key: 'all',
    label: t('nav.all'),
    icon: Layers,
    run: () => void router.push({ name: 'home' }),
  },
  {
    kind: 'go',
    key: 'inbox',
    label: t('nav.inbox'),
    icon: Inbox,
    run: () => void router.push({ name: 'inbox' }),
  },
  {
    kind: 'go',
    key: 'stats',
    label: t('nav.stats'),
    icon: ChartColumn,
    run: () => void router.push({ name: 'stats' }),
  },
])

const groups = computed(() => {
  const q = text.value.trim()
  const projects = q
    ? projectsStore.active
        .filter((p) => matchesWords(`${p.name} ${p.key}`, q))
        .slice(0, 5)
        .map((project) => ({ kind: 'project' as const, project }))
    : []
  const goes = q
    ? shortcuts.value.filter((s) => s.kind === 'go' && matchesWords(s.label, q))
    : shortcuts.value
  return [
    {
      key: 'tasks',
      label: t('search.tasks'),
      items: tasks.value.map((task) => ({ kind: 'task' as const, task })),
    },
    { key: 'projects', label: t('search.projects'), items: projects },
    { key: 'go', label: t('search.goTo'), items: goes },
  ].filter((g) => g.items.length > 0) as { key: string; label: string; items: Item[] }[]
})
const flat = computed(() => groups.value.flatMap((g) => g.items))

watch(flat, () => (active.value = 0))

watch(
  () => ui.searchOpen,
  async (open) => {
    if (!dialog.value) return
    if (open && !dialog.value.open) {
      text.value = ''
      dialog.value.showModal()
      await nextTick()
      input.value?.focus()
    }
    if (!open && dialog.value.open) dialog.value.close()
  },
  { flush: 'post' },
)

function close(): void {
  ui.searchOpen = false
}

function choose(item: Item | undefined): void {
  if (!item) return
  close()
  if (item.kind === 'task') void router.push({ name: 'task', params: { taskKey: item.task.key } })
  else if (item.kind === 'project')
    void router.push({ name: 'project', params: { projectKey: item.project.key } })
  else item.run()
}

function onKeydown(event: KeyboardEvent): void {
  const count = flat.value.length
  if (event.key === 'ArrowDown' && count) {
    event.preventDefault()
    active.value = (active.value + 1) % count
  } else if (event.key === 'ArrowUp' && count) {
    event.preventDefault()
    active.value = (active.value - 1 + count) % count
  } else if (event.key === 'Enter') {
    event.preventDefault()
    choose(flat.value[active.value])
  }
}

const optionId = (index: number) => `${id}-opt-${index}`
const indexOf = (item: Item) => flat.value.indexOf(item)
const projectName = (projectId: string | null) =>
  projectId ? (projectsStore.byId(projectId)?.name ?? '') : t('nav.inbox')
</script>

<template>
  <dialog
    ref="dialog"
    class="mx-auto mt-[10vh] mb-auto max-h-[75dvh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-lg border border-gray-300 bg-white p-0 text-gray-800 shadow-lg backdrop:bg-gray-900/60 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
    :aria-label="t('search.title')"
    @cancel.prevent="close"
    @click.self="close"
  >
    <div v-if="ui.searchOpen" class="flex max-h-[75dvh] flex-col">
      <div class="flex items-center gap-2 border-b border-gray-200 px-4 dark:border-gray-700">
        <Search class="h-5 w-5 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true" />
        <input
          ref="input"
          v-model="text"
          type="text"
          role="combobox"
          autocomplete="off"
          :aria-label="t('search.title')"
          :aria-expanded="flat.length > 0"
          :aria-controls="`${id}-list`"
          :aria-activedescendant="flat.length ? optionId(active) : undefined"
          :placeholder="t('search.placeholder')"
          class="h-14 min-w-0 flex-1 border-0 bg-transparent font-text text-base text-gray-800 outline-none placeholder:text-gray-500 dark:text-white dark:placeholder:text-gray-400"
          @keydown="onKeydown"
        />
        <kbd
          class="shrink-0 rounded border border-gray-300 px-1.5 font-text text-xs text-gray-500 dark:border-gray-600 dark:text-gray-400"
          >Esc</kbd
        >
      </div>

      <div :id="`${id}-list`" role="listbox" class="min-h-0 flex-1 overflow-y-auto p-2">
        <template v-for="group in groups" :key="group.key">
          <p
            class="m-0 px-2 pt-2 pb-1 font-text text-xs font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400"
            role="presentation"
          >
            {{ group.label }}
          </p>
          <div
            v-for="item in group.items"
            :id="optionId(indexOf(item))"
            :key="
              item.kind === 'task'
                ? item.task.id
                : item.kind === 'project'
                  ? item.project.id
                  : item.key
            "
            role="option"
            :aria-selected="indexOf(item) === active"
            :class="[
              'flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-2 font-text text-sm',
              indexOf(item) === active ? 'bg-gray-100 dark:bg-gray-800' : '',
            ]"
            @mouseenter="active = indexOf(item)"
            @mousedown.prevent
            @click="choose(item)"
          >
            <template v-if="item.kind === 'task'">
              <span class="shrink-0 font-bold text-gray-500 dark:text-gray-400">{{
                item.task.key
              }}</span>
              <span class="min-w-0 flex-1 truncate">{{ item.task.title }}</span>
              <span class="hidden shrink-0 text-xs text-gray-500 sm:inline dark:text-gray-400">{{
                projectName(item.task.projectId)
              }}</span>
              <StatusBadge :status="item.task.status" class="shrink-0 scale-90" />
            </template>
            <template v-else-if="item.kind === 'project'">
              <ProjectIcon
                :name="item.project.icon"
                :class="['h-4 w-4 shrink-0', PROJECT_COLOR_CLASSES[item.project.color].text]"
              />
              <span class="min-w-0 flex-1 truncate">{{ item.project.name }}</span>
              <span class="shrink-0 text-xs text-gray-500 dark:text-gray-400">{{
                item.project.key
              }}</span>
            </template>
            <template v-else>
              <component
                :is="item.icon"
                class="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400"
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
            </template>
          </div>
        </template>
        <p
          v-if="text.trim() && !flat.length"
          class="m-0 px-2 py-6 text-center font-text text-sm text-gray-500 dark:text-gray-400"
          role="status"
        >
          {{ searchingKey ? t('search.searching') : t('search.noResults') }}
        </p>
      </div>

      <p
        class="m-0 border-t border-gray-200 px-4 py-2 font-text text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400"
      >
        {{ t('search.hint') }}
      </p>
    </div>
  </dialog>
</template>
