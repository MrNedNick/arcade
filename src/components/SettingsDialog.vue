<script setup lang="ts">
import { ref, watch } from 'vue'
import AppDialog from './AppDialog.vue'
import { cleanName, MAX_NAME, useSettings } from '@/composables/useSettings'

const open = defineModel<boolean>({ required: true })
const settings = useSettings()
const name = ref(settings.name)

watch(open, (isOpen) => {
  if (isOpen) name.value = settings.name
})

function saveName() {
  settings.name = cleanName(name.value)
  name.value = settings.name
}
</script>

<template>
  <AppDialog v-model="open" title="Settings">
    <form class="field" @submit.prevent="saveName">
      <label for="player-name" class="field__label">Your name on the top players board</label>
      <div class="field__row">
        <input
          id="player-name"
          v-model="name"
          class="input"
          :maxlength="MAX_NAME"
          autocomplete="nickname"
          placeholder="Player"
          @blur="saveName"
        />
      </div>
    </form>
    <label class="switch">
      <span>Sound</span>
      <input v-model="settings.sound" type="checkbox" role="switch" />
      <span class="switch__track" aria-hidden="true" />
    </label>
  </AppDialog>
</template>

<style scoped>
.field {
  display: grid;
  gap: 8px;
  margin-bottom: 18px;
}
.field__label {
  font-size: 14px;
  color: var(--text-muted);
}
.input {
  width: 100%;
  padding: 11px 14px;
  font: inherit;
  color: var(--text);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 12px;
}
.input:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.switch {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  cursor: pointer;
}
.switch input {
  position: absolute;
  opacity: 0;
  right: 0;
  width: 46px;
  height: 28px;
  margin: 0;
  cursor: pointer;
}
.switch__track {
  width: 46px;
  height: 28px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  position: relative;
  transition: background var(--t) ease;
}
.switch__track::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: transform var(--t) var(--ease-spring);
}
.switch input:checked + .switch__track {
  background: var(--accent);
}
.switch input:checked + .switch__track::after {
  transform: translateX(18px);
  background: var(--accent-ink);
}
.switch input:focus-visible + .switch__track {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
