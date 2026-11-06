<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Inbox,
  Layers,
  LogOut,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-vue-next'
import SidebarLink from './SidebarLink.vue'
import TimerPill from '@/components/timer/TimerPill.vue'
import ProjectFormDialog from '@/components/projects/ProjectFormDialog.vue'
import ProjectIcon from '@/components/projects/ProjectIcon.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DropdownMenu, { type MenuItem } from '@/components/ui/DropdownMenu.vue'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
import { PROJECT_COLOR_CLASSES, type Project } from '@/domain/projects'
import { useAdminStore } from '@/stores/admin'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { useProjectsStore } from '@/stores/projects'
import { useToastsStore } from '@/stores/toasts'

/**
 * Menú lateral (step-8): «Todos», «Sin proyecto», proyectos con sus acciones, archivados,
 * panel de admin con el contador de pendientes, tema y cierre de sesión.
 */
const props = defineProps<{ collapsed: boolean; mobile?: boolean }>()
const emit = defineEmits<{ toggle: []; close: [] }>()

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const profileStore = useProfileStore()
const projectsStore = useProjectsStore()
const adminStore = useAdminStore()
const toasts = useToastsStore()

const isDev = import.meta.env.DEV
// Ruta del logotipo con la base de la app (/taskwave/).
const logoUrl = `${import.meta.env.BASE_URL}favicon.svg`
const showArchived = ref(false)
const formOpen = ref(false)
const editing = ref<Project | null>(null)
const deleting = ref<Project | null>(null)
const busy = ref(false)

/** Los enlaces conservan la vista elegida (calendario o kanban). */
const viewQuery = computed(() => (route.query.vista ? { vista: route.query.vista } : {}))
const displayName = computed(() => profileStore.profile?.displayName || authStore.user?.email || '')

function projectMenu(project: Project, index: number): MenuItem[] {
  if (project.archived) {
    return [
      { key: 'unarchive', label: t('projects.actions.unarchive'), icon: ArchiveRestore },
      { key: 'delete', label: t('projects.actions.delete'), icon: Trash2, danger: true },
    ]
  }
  return [
    { key: 'edit', label: t('projects.actions.edit'), icon: Pencil },
    { key: 'up', label: t('projects.actions.moveUp'), icon: ArrowUp, disabled: index === 0 },
    {
      key: 'down',
      label: t('projects.actions.moveDown'),
      icon: ArrowDown,
      disabled: index === projectsStore.active.length - 1,
    },
    { key: 'archive', label: t('projects.actions.archive'), icon: Archive },
    { key: 'delete', label: t('projects.actions.delete'), icon: Trash2, danger: true },
  ]
}

async function safely(action: () => Promise<void>): Promise<void> {
  try {
    await action()
  } catch {
    toasts.show(t('projects.failed'), 'error')
  }
}

/** Si se archiva o borra el proyecto abierto, se vuelve a «Todos». */
async function leaveIfOpen(project: Project): Promise<void> {
  if (route.name === 'project' && route.params.projectKey === project.key) {
    await router.push({ name: 'home', query: viewQuery.value })
  }
}

async function onProjectAction(project: Project, key: string): Promise<void> {
  if (key === 'edit') {
    editing.value = project
    formOpen.value = true
  } else if (key === 'up' || key === 'down') {
    await safely(() => projectsStore.move(project.id, key))
  } else if (key === 'archive') {
    await safely(async () => {
      await projectsStore.setArchived(project.id, true)
      await leaveIfOpen(project)
    })
  } else if (key === 'unarchive') {
    await safely(() => projectsStore.setArchived(project.id, false))
  } else if (key === 'delete') {
    deleting.value = project
  }
}

async function confirmDelete(): Promise<void> {
  const project = deleting.value
  if (!project) return
  busy.value = true
  await safely(async () => {
    if (await projectsStore.remove(project.id)) await leaveIfOpen(project)
    else toasts.show(t('projects.notEmpty', { name: project.name }), 'warning', 7000)
  })
  busy.value = false
  deleting.value = null
}

function openCreate(): void {
  editing.value = null
  formOpen.value = true
}

async function onSaved(id: string): Promise<void> {
  const wasNew = !editing.value
  formOpen.value = false
  editing.value = null
  const project = projectsStore.byId(id)
  if (wasNew && project) {
    await router.push({
      name: 'project',
      params: { projectKey: project.key },
      query: viewQuery.value,
    })
  }
}

async function logout(): Promise<void> {
  await authStore.logout()
  await router.replace({ name: 'login' })
}

const iconButton =
  'inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-gray-500 transition hover:bg-gray-200 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white'
</script>

<template>
  <nav
    class="flex h-full min-h-0 flex-col gap-4 bg-gray-100 p-3 dark:bg-gray-800"
    :aria-label="t('nav.menu')"
  >
    <!-- Marca y plegar / cerrar -->
    <div :class="['flex items-center gap-2', props.collapsed ? 'flex-col' : 'justify-between']">
      <RouterLink
        :to="{ name: 'home', query: viewQuery }"
        class="flex items-center gap-2 no-underline"
        :title="t('app.name')"
      >
        <img :src="logoUrl" alt="" class="h-8 w-8 shrink-0" />
        <span
          v-if="!props.collapsed"
          class="bg-radial-blue bg-clip-text font-title text-3xl leading-tight font-semibold text-transparent"
        >
          {{ t('app.name') }}
        </span>
      </RouterLink>
      <button
        v-if="props.mobile"
        type="button"
        :class="iconButton"
        :aria-label="t('nav.closeMenu')"
        @click="emit('close')"
      >
        <X class="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        v-else
        type="button"
        :class="iconButton"
        :aria-label="props.collapsed ? t('nav.expand') : t('nav.collapse')"
        :title="props.collapsed ? t('nav.expand') : t('nav.collapse')"
        :aria-expanded="!props.collapsed"
        @click="emit('toggle')"
      >
        <PanelLeftOpen v-if="props.collapsed" class="h-5 w-5" aria-hidden="true" />
        <PanelLeftClose v-else class="h-5 w-5" aria-hidden="true" />
      </button>
    </div>

    <!-- Cronómetro en marcha (step-19); en móvil ya está en la cabecera -->
    <TimerPill v-if="!props.mobile" :compact="props.collapsed" />

    <!-- Vistas generales -->
    <div class="flex flex-col gap-1">
      <SidebarLink
        :to="{ name: 'home', query: viewQuery }"
        :label="t('nav.all')"
        :collapsed="props.collapsed"
      >
        <template #icon><Layers class="h-5 w-5" /></template>
      </SidebarLink>
      <SidebarLink
        :to="{ name: 'inbox', query: viewQuery }"
        :label="t('nav.inbox')"
        :collapsed="props.collapsed"
      >
        <template #icon><Inbox class="h-5 w-5" /></template>
      </SidebarLink>
    </div>

    <!-- Proyectos -->
    <div class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
      <div
        :class="[
          'flex items-center gap-2',
          props.collapsed ? 'justify-center' : 'justify-between px-3',
        ]"
      >
        <span
          v-if="!props.collapsed"
          class="font-text text-xs font-bold tracking-wider text-gray-500 uppercase dark:text-gray-400"
        >
          {{ t('nav.projects') }}
        </span>
        <button
          type="button"
          :class="iconButton"
          :aria-label="t('nav.newProject')"
          :title="t('nav.newProject')"
          @click="openCreate"
        >
          <Plus class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <p
        v-if="!props.collapsed && projectsStore.loaded && projectsStore.active.length === 0"
        class="m-0 px-3 font-text text-sm text-gray-500 dark:text-gray-400"
      >
        {{ t('nav.noProjects') }}
      </p>

      <div
        v-for="(project, index) in projectsStore.active"
        :key="project.id"
        class="group flex min-w-0 items-center gap-1"
      >
        <SidebarLink
          :to="{ name: 'project', params: { projectKey: project.key }, query: viewQuery }"
          :label="project.name"
          :collapsed="props.collapsed"
          class="flex-1"
        >
          <template #icon>
            <ProjectIcon
              :name="project.icon"
              :class="['h-5 w-5', PROJECT_COLOR_CLASSES[project.color].text]"
            />
          </template>
        </SidebarLink>
        <DropdownMenu
          v-if="!props.collapsed"
          :label="t('nav.projectActions', { name: project.name })"
          :items="projectMenu(project, index)"
          class="opacity-100 transition group-focus-within:opacity-100 group-hover:opacity-100 md:opacity-0"
          @select="onProjectAction(project, $event)"
        />
      </div>

      <!-- Archivados (D-14) -->
      <template v-if="!props.collapsed && projectsStore.archived.length > 0">
        <button
          type="button"
          class="mt-2 flex h-8 cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-3 text-left font-text text-xs font-bold tracking-wider text-gray-500 uppercase transition hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
          :aria-expanded="showArchived"
          @click="showArchived = !showArchived"
        >
          <ChevronDown v-if="showArchived" class="h-4 w-4" aria-hidden="true" />
          <ChevronRight v-else class="h-4 w-4" aria-hidden="true" />
          {{ t('nav.archived', { n: projectsStore.archived.length }) }}
        </button>
        <template v-if="showArchived">
          <div
            v-for="(project, index) in projectsStore.archived"
            :key="project.id"
            class="group flex min-w-0 items-center gap-1 opacity-70"
          >
            <SidebarLink
              :to="{ name: 'project', params: { projectKey: project.key }, query: viewQuery }"
              :label="project.name"
              class="flex-1"
            >
              <template #icon>
                <ProjectIcon
                  :name="project.icon"
                  class="h-5 w-5 text-gray-500 dark:text-gray-400"
                />
              </template>
            </SidebarLink>
            <DropdownMenu
              :label="t('nav.projectActions', { name: project.name })"
              :items="projectMenu(project, index)"
              @select="onProjectAction(project, $event)"
            />
          </div>
        </template>
      </template>
    </div>

    <!-- Pie: admin, sistema de diseño (solo en desarrollo), tema y sesión -->
    <div class="flex flex-col gap-1 border-t border-gray-200 pt-3 dark:border-gray-700">
      <SidebarLink
        v-if="profileStore.isAdmin"
        :to="{ name: 'admin-users' }"
        :label="t('admin.link')"
        :badge="adminStore.pendingCount || undefined"
        :collapsed="props.collapsed"
      >
        <template #icon><Users class="h-5 w-5" /></template>
      </SidebarLink>
      <SidebarLink
        v-if="isDev"
        :to="{ name: 'design-system' }"
        :label="t('nav.designSystem')"
        :collapsed="props.collapsed"
      >
        <template #icon><Palette class="h-5 w-5" /></template>
      </SidebarLink>
      <div :class="['flex items-center gap-2', props.collapsed ? 'flex-col' : 'px-1']">
        <span
          v-if="!props.collapsed"
          class="min-w-0 flex-1 truncate font-text text-sm text-gray-500 dark:text-gray-400"
          :title="authStore.user?.email ?? ''"
        >
          {{ displayName }}
        </span>
        <ThemeToggle />
        <button
          type="button"
          :class="iconButton"
          :aria-label="t('auth.logout')"
          :title="t('auth.logout')"
          @click="logout"
        >
          <LogOut class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>

    <ProjectFormDialog
      :open="formOpen"
      :project="editing"
      @close="formOpen = false"
      @saved="onSaved"
    />
    <ConfirmDialog
      :open="deleting !== null"
      :title="t('projects.confirmDelete.title')"
      :message="deleting ? t('projects.confirmDelete.message', { name: deleting.name }) : ''"
      :confirm-label="t('projects.confirmDelete.confirm')"
      :cancel-label="t('common.cancel')"
      :busy="busy"
      @confirm="confirmDelete"
      @cancel="deleting = null"
    />
  </nav>
</template>
