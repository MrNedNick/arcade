<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

const open = defineModel<boolean>({ required: true })
defineProps<{ title: string }>()

const el = ref<HTMLDialogElement>()

function sync() {
  const d = el.value
  if (!d) return
  if (open.value && !d.open) d.showModal()
  if (!open.value && d.open) d.close()
}
watch(open, sync)
onMounted(sync)

function onBackdrop(e: MouseEvent) {
  if (e.target === el.value) open.value = false
}
</script>

<template>
  <dialog ref="el" class="dialog" :aria-label="title" @close="open = false" @click="onBackdrop">
    <div class="dialog__panel">
      <header class="dialog__head">
        <h2 class="dialog__title">{{ title }}</h2>
        <button type="button" class="dialog__close" aria-label="Close" @click="open = false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </header>
      <slot />
    </div>
  </dialog>
</template>

<style scoped>
.dialog {
  width: min(460px, calc(100vw - 24px));
  max-height: min(640px, calc(100dvh - 24px));
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow);
}
.dialog[open] {
  animation: pop-in var(--t) var(--ease-spring);
}
.dialog::backdrop {
  background: rgba(5, 6, 12, 0.55);
  backdrop-filter: blur(3px);
}
@keyframes pop-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.96);
  }
}
.dialog__panel {
  padding: 20px;
}
.dialog__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.dialog__title {
  font-size: 22px;
  letter-spacing: -0.02em;
}
.dialog__close {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
}
.dialog__close:hover {
  background: var(--surface-2);
}
.dialog__close svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}
</style>
