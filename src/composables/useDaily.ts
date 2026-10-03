import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { formatTime } from '@/games/registry'
import { seeded, type Random } from '@/engine/random'
import {
  dailyResult,
  dailySeed,
  dateKey,
  recordDaily,
  streak,
  type DailyGame,
} from '@/engine/daily'

/** Daily-puzzle mode for a game page: `?daily` in the address opens it directly. */
export function useDaily(game: DailyGame) {
  const route = useRoute()
  const on = ref('daily' in route.query)
  /** Date of the daily being played; fixed when it starts, so midnight does not change it. */
  const date = ref(dateKey())
  const best = computed(() => dailyResult(game, dateKey()))
  const days = computed(() => streak())

  function random(): Random {
    date.value = dateKey()
    return seeded(dailySeed(game, date.value))
  }

  function solved(seconds: number) {
    recordDaily(game, seconds, date.value)
  }

  const streakText = computed(() =>
    days.value > 1 ? `${days.value} days in a row` : days.value === 1 ? 'Streak started' : '',
  )

  /** A line for the ready screen. */
  const intro = computed(() =>
    best.value !== null
      ? `Solved today in ${formatTime(best.value)} · new puzzle tomorrow`
      : 'Same puzzle for everyone today',
  )

  return { on, date, random, solved, intro, streakText }
}
