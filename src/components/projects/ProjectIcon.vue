<script setup lang="ts">
import { computed, type Component } from 'vue'
import {
  BookOpen,
  Briefcase,
  Code,
  Dumbbell,
  Folder,
  GraduationCap,
  Heart,
  House,
  Music,
  Plane,
  ShoppingCart,
  Star,
} from 'lucide-vue-next'
import type { ProjectIconName } from '@/domain/projects'

/** Icono de un proyecto a partir de su nombre guardado (`book-open`, `home`…). */
const props = defineProps<{ name: string }>()

const ICONS: Record<ProjectIconName, Component> = {
  folder: Folder,
  'book-open': BookOpen,
  'graduation-cap': GraduationCap,
  briefcase: Briefcase,
  home: House,
  heart: Heart,
  dumbbell: Dumbbell,
  code: Code,
  music: Music,
  plane: Plane,
  'shopping-cart': ShoppingCart,
  star: Star,
}

const icon = computed(() => ICONS[props.name as ProjectIconName] ?? Folder)
</script>

<template>
  <component :is="icon" aria-hidden="true" />
</template>
