<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppDialog from './AppDialog.vue'
import { GAMES, boardsOf, findGame, formatScore } from '@/games/registry'
import { scoreBoard } from '@/scores'
import type { ScoreEntry } from '@/scores/scoreboard'

const open = defineModel<boolean>({ required: true })
const props = defineProps<{ game?: string; board?: string; highlightAt?: number }>()

const currentGame = ref(props.game ?? GAMES[0]?.id ?? '')
const currentBoard = ref(props.board ?? currentGame.value)
const entries = ref<ScoreEntry[]>([])

const shownGame = computed(() => findGame(currentGame.value))
const boards = computed(() => (shownGame.value ? boardsOf(shownGame.value) : []))

async function load() {
  entries.value = await scoreBoard.top(currentBoard.value)
}

function pickGame(id: string) {
  currentGame.value = id
  const g = findGame(id)
  currentBoard.value = g ? boardsOf(g)[0]!.id : id
}

watch(open, (isOpen) => {
  if (!isOpen) return
  if (props.game) currentGame.value = props.game
  // A board without a table of its own (the daily puzzle) opens the game's first one.
  const known = boards.value.some((b) => b.id === props.board)
  currentBoard.value =
    props.board && known
      ? props.board
      : shownGame.value
        ? boardsOf(shownGame.value)[0]!.id
        : currentGame.value
  void load()
})
watch(currentBoard, load)

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
</script>

<template>
  <AppDialog v-model="open" title="Top players">
    <div v-if="GAMES.length > 1" class="tabs" role="tablist" aria-label="Game">
      <button
        v-for="g in GAMES"
        :key="g.id"
        type="button"
        role="tab"
        class="tab"
        :class="{ 'tab--on': g.id === currentGame }"
        :aria-selected="g.id === currentGame"
        :style="{ '--c': `var(${g.color})` }"
        @click="pickGame(g.id)"
      >
        {{ g.title }}
      </button>
    </div>
    <div v-if="boards.length > 1" class="levels" role="tablist" aria-label="Level">
      <button
        v-for="b in boards"
        :key="b.id"
        type="button"
        role="tab"
        class="level"
        :class="{ 'level--on': b.id === currentBoard }"
        :aria-selected="b.id === currentBoard"
        @click="currentBoard = b.id"
      >
        {{ b.label }}
      </button>
    </div>
    <p class="note">Best games on this device.</p>
    <ol v-if="entries.length" class="board">
      <li
        v-for="(e, i) in entries"
        :key="e.at + e.name"
        class="row"
        :class="{ 'row--me': e.at === highlightAt, 'row--first': i === 0 }"
      >
        <span class="row__rank">{{ i + 1 }}</span>
        <span class="row__name">
          {{ e.name }}
          <small v-if="e.tag" class="row__tag">{{ e.tag }}</small>
        </span>
        <span class="row__score">{{ shownGame ? formatScore(shownGame, e.score) : e.score }}</span>
        <span class="row__date">{{ dateFmt.format(e.at) }}</span>
      </li>
    </ol>
    <p v-else class="empty">No scores yet. Play a game and take the first place.</p>
  </AppDialog>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  margin-bottom: 10px;
  scrollbar-width: none;
}
.tab {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--text-muted);
  transition: all var(--t-fast) ease;
}
.tab--on {
  color: var(--text);
  border-color: var(--c);
  box-shadow: inset 0 0 0 1px var(--c);
}
.levels {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  margin-bottom: 10px;
  border-radius: 12px;
  background: var(--surface-2);
}
.level {
  padding: 5px 12px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
}
.level--on {
  color: var(--text);
  background: var(--surface);
}
.note {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--text-muted);
}
.board {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 4px;
}
.row {
  display: grid;
  grid-template-columns: 28px 1fr auto auto;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
  border-radius: 12px;
  background: var(--surface-2);
}
.row--first .row__rank {
  color: var(--gold);
}
.row--me {
  animation: flash 1.4s var(--ease-out);
  box-shadow: inset 0 0 0 2px var(--gold);
}
@keyframes flash {
  0%,
  30% {
    background: color-mix(in srgb, var(--gold) 35%, var(--surface-2));
    transform: scale(1.03);
  }
}
.row__rank {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--text-muted);
}
.row__name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row__tag {
  margin-left: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.row__score {
  font-family: var(--font-mono);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.row__date {
  font-size: 12px;
  color: var(--text-muted);
  min-width: 44px;
  text-align: right;
}
.empty {
  margin: 24px 0 8px;
  text-align: center;
  color: var(--text-muted);
}
</style>
