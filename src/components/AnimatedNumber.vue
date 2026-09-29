<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ value: number; format?: (n: number) => string }>()

const text = computed(() => (props.format ? props.format(props.value) : String(props.value)))
</script>

<template>
  <span class="num" :aria-label="text">
    <Transition name="roll">
      <span :key="text" class="num__value" aria-hidden="true">{{ text }}</span>
    </Transition>
  </span>
</template>

<style scoped>
.num {
  position: relative;
  display: inline-grid;
  overflow: hidden;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
.num__value {
  grid-area: 1 / 1;
  display: inline-block;
}
.roll-enter-active,
.roll-leave-active {
  transition:
    transform 180ms var(--ease-out),
    opacity 180ms ease;
}
.roll-enter-from {
  transform: translateY(70%);
  opacity: 0;
}
.roll-leave-to {
  transform: translateY(-70%);
  opacity: 0;
}
</style>
