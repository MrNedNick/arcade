<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { findGame } from '@/games/registry'

const props = defineProps<{ game: string }>()

const info = computed(() => findGame(props.game))
const Game = computed(() => (info.value ? defineAsyncComponent(info.value.load) : null))
</script>

<template>
  <component :is="Game" v-if="Game" />
</template>
