<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, Mail, Search, ShieldCheck } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import FormMessage from '@/components/ui/FormMessage.vue'
import TextLink from '@/components/ui/TextLink.vue'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
import UserStatusBadge from '@/components/ui/UserStatusBadge.vue'
import {
  availableActions,
  countByStatus,
  filterUsers,
  needsConfirmation,
  type AdminUserRow,
  type UserAction,
  type UserFilter,
} from '@/domain/adminUsers'
import { formatDateTime } from '@/lib/format'
import { useAdminStore } from '@/stores/admin'
import { useAuthStore } from '@/stores/auth'

/** Panel de usuarios del admin (step-7, D-7, D-8, D-9). */
const { t } = useI18n()
const adminStore = useAdminStore()
const authStore = useAuthStore()

const FILTERS: UserFilter[] = ['pending', 'active', 'blocked', 'all']
const filter = ref<UserFilter>('pending')
const search = ref('')

const myUid = computed(() => authStore.user?.uid ?? '')
const counts = computed(() => countByStatus(adminStore.users))
const visible = computed(() => filterUsers(adminStore.users, filter.value, search.value))

const busyUid = ref<string | null>(null)
const notice = ref<{ tone: 'success' | 'error'; text: string } | null>(null)
const confirming = ref<{ user: AdminUserRow; action: UserAction } | null>(null)

onMounted(() => adminStore.openList())
onBeforeUnmount(() => adminStore.closeList())

const ACTION_VARIANT = { approve: 'success', block: 'danger', reactivate: 'primary' } as const

function request(user: AdminUserRow, action: UserAction): void {
  if (needsConfirmation(action)) confirming.value = { user, action }
  else void run(user, action)
}

async function run(user: AdminUserRow, action: UserAction): Promise<void> {
  busyUid.value = user.uid
  notice.value = null
  try {
    await adminStore.applyAction(user, action)
    notice.value = {
      tone: 'success',
      text: t(`admin.actions.done.${action}`, { name: user.displayName || user.email }),
    }
  } catch {
    notice.value = { tone: 'error', text: t('admin.actions.failed') }
  } finally {
    busyUid.value = null
    confirming.value = null
  }
}

function providerLabel(provider: string): string {
  return provider === 'google.com'
    ? t('admin.users.providerGoogle')
    : t('admin.users.providerPassword')
}
</script>

<template>
  <main class="container mx-auto flex flex-col gap-6 px-4 py-8">
    <header class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-4">
        <TextLink :to="{ name: 'home' }" class="inline-flex items-center gap-1">
          <ArrowLeft class="h-4 w-4" aria-hidden="true" />
          {{ t('admin.users.back') }}
        </TextLink>
        <ThemeToggle />
      </div>
      <h1
        class="m-0 w-fit bg-radial-blue bg-clip-text font-title text-5xl leading-tight font-semibold text-transparent"
      >
        {{ t('admin.users.title') }}
      </h1>
      <p class="m-0 text-base leading-relaxed text-gray-500 dark:text-gray-400">
        {{ t('admin.users.subtitle') }}
      </p>
    </header>

    <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div class="flex flex-wrap gap-2" role="group" :aria-label="t('admin.filters.label')">
        <BaseButton
          v-for="f in FILTERS"
          :key="f"
          variant="secondary"
          :selected="filter === f"
          @click="filter = f"
        >
          {{ t(`admin.filters.${f}`) }}
          <span
            class="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs"
            :class="
              f === 'pending' && counts.pending > 0
                ? 'bg-violet-500 text-white'
                : 'bg-white text-gray-800 dark:bg-gray-900 dark:text-white'
            "
          >
            {{ counts[f] }}
          </span>
        </BaseButton>
      </div>
      <label class="relative block w-full md:max-w-xs">
        <span class="sr-only">{{ t('admin.users.search') }}</span>
        <Search
          class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400"
          aria-hidden="true"
        />
        <input
          v-model="search"
          type="search"
          :placeholder="t('admin.users.search')"
          class="h-10 w-full rounded-lg border-0 bg-gray-100 pr-4 pl-9 font-text text-sm text-gray-800 transition placeholder:text-gray-500 focus:outline-2 focus:outline-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400"
        />
      </label>
    </div>

    <FormMessage v-if="notice" :tone="notice.tone">{{ notice.text }}</FormMessage>

    <p v-if="adminStore.listLoading" class="m-0 text-sm text-gray-500 dark:text-gray-400">
      {{ t('admin.users.loading') }}
    </p>
    <FormMessage v-else-if="adminStore.listError" tone="error">
      {{ t('admin.users.error') }}
    </FormMessage>
    <p v-else-if="visible.length === 0" class="m-0 text-sm text-gray-500 dark:text-gray-400">
      {{ t('admin.users.empty') }}
    </p>

    <ul v-else class="m-0 flex list-none flex-col gap-3 p-0">
      <li
        v-for="user in visible"
        :key="user.uid"
        class="flex min-w-0 flex-col gap-3 rounded-lg border border-gray-500 p-4 md:flex-row md:items-center md:justify-between dark:border-gray-400"
      >
        <div class="flex min-w-0 flex-col gap-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="truncate font-text text-base font-bold text-gray-800 dark:text-white">
              {{ user.displayName || user.email }}
            </span>
            <UserStatusBadge :status="user.status" />
            <span
              v-if="user.admin"
              class="inline-flex h-6 items-center gap-1 rounded-full bg-blue-500 px-3 font-text text-sm font-bold text-gray-900"
            >
              <ShieldCheck class="h-4 w-4" aria-hidden="true" />
              {{ t('admin.users.adminBadge') }}
            </span>
            <span
              v-if="user.uid === myUid"
              class="font-text text-sm font-medium text-gray-500 dark:text-gray-400"
            >
              ({{ t('admin.users.you') }})
            </span>
          </div>
          <span class="flex items-center gap-1 truncate text-sm text-gray-500 dark:text-gray-400">
            <Mail class="h-4 w-4 shrink-0" aria-hidden="true" />
            {{ user.email }} · {{ providerLabel(user.provider) }}
          </span>
          <span class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('admin.users.registered', { date: formatDateTime(user.createdAtMs) }) }}
            <template v-if="user.approvedAtMs">
              · {{ t('admin.users.approved', { date: formatDateTime(user.approvedAtMs) }) }}
            </template>
          </span>
        </div>
        <div class="flex shrink-0 flex-wrap gap-2">
          <BaseButton
            v-for="action in availableActions(user, myUid)"
            :key="action"
            :variant="ACTION_VARIANT[action]"
            :disabled="busyUid === user.uid"
            @click="request(user, action)"
          >
            {{ t(`admin.actions.${action}`) }}
          </BaseButton>
        </div>
      </li>
    </ul>

    <ConfirmDialog
      :open="confirming !== null"
      :title="t('admin.confirmBlock.title')"
      :message="
        confirming
          ? t('admin.confirmBlock.message', {
              name: confirming.user.displayName || confirming.user.email,
              email: confirming.user.email,
            })
          : ''
      "
      :confirm-label="t('admin.confirmBlock.confirm')"
      :cancel-label="t('admin.confirmBlock.cancel')"
      :busy="busyUid !== null"
      @confirm="confirming && run(confirming.user, confirming.action)"
      @cancel="confirming = null"
    />
  </main>
</template>
