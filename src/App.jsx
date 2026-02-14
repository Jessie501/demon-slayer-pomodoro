import { useState, useEffect, useRef, Fragment } from 'react'
import { RotateCcw, Volume2, VolumeX, Plus, Check, Star, Trash2, Edit2, Flame, ListTodo, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// 鬼灭主题模式配置
const MODES = {
  focus: {
    label: '全集中',
    duration: 25 * 60,
    gradient: 'radial-gradient(ellipse 65% 60% at 50% 50%, rgba(139,0,0,0.28) 0%, rgba(18,18,18,1) 70%)',
    image: '/images/tanjiro.png',
  },
  shortBreak: {
    label: '小憩',
    duration: 5 * 60,
    gradient: 'radial-gradient(ellipse 60% 50% at 55% 55%, rgba(30,58,138,0.15) 0%, rgba(18,18,18,1) 80%)',
    image: '/images/zenitsu-sleep.png',
  },
  longBreak: {
    label: '长休',
    duration: 15 * 60,
    gradient: 'radial-gradient(ellipse 65% 50% at 52% 54%, rgba(255,215,0,0.13) 0%, rgba(18,18,18,1) 80%)',
    image: '/images/zenitsu-awake.png',
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function getTodayDateStr() {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

const STATS_STORAGE_KEY = 'kms-focus-stats-v1'
const TASKS_STORAGE_KEY = 'kms-todo-list-v1'
const ACTIVE_TASK_KEY = 'kms-todo-active-id-v1'

function loadStats() {
  const val = localStorage.getItem(STATS_STORAGE_KEY)
  if (!val) return { date: getTodayDateStr(), count: 0 }
  try {
    const parsed = JSON.parse(val)
    if (parsed.date !== getTodayDateStr()) {
      return { date: getTodayDateStr(), count: 0 }
    }
    return parsed
  } catch {
    return { date: getTodayDateStr(), count: 0 }
  }
}

function saveStats(stats) {
  localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats))
}

function migrateTasksIfNeeded(raw) {
  return raw.map((t) =>
    typeof t.focusCount === 'number'
      ? t
      : { ...t, focusCount: 0 }
  )
}

function loadTasks() {
  try {
    const val = localStorage.getItem(TASKS_STORAGE_KEY)
    if (!val) return []
    const parsed = JSON.parse(val)
    return Array.isArray(parsed) ? migrateTasksIfNeeded(parsed) : []
  } catch {
    return []
  }
}

function saveTasks(tasks) {
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks))
}

function loadActiveTaskId() {
  try {
    return localStorage.getItem(ACTIVE_TASK_KEY) || ''
  } catch {
    return ''
  }
}

function saveActiveTaskId(id) {
  localStorage.setItem(ACTIVE_TASK_KEY, id || '')
}

// ========== 组件 ==========
export default function App() {
  const [mode, setMode] = useState('focus')
  const [timeLeft, setTimeLeft] = useState(MODES.focus.duration)
  const [isActive, setIsActive] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isMobileTaskOpen, setIsMobileTaskOpen] = useState(false)
  const [stats, setStats] = useState(() => loadStats())
  const [tasks, setTasks] = useState(() => loadTasks())
  const [activeTaskId, setActiveTaskId] = useState(() => loadActiveTaskId())
  const [taskInput, setTaskInput] = useState('')
  const [editingTaskId, setEditingTaskId] = useState('')
  const [editingTaskText, setEditingTaskText] = useState('')
  const editingInputRef = useRef(null)

  useEffect(() => {
    if (editingTaskId && editingInputRef.current) {
      editingInputRef.current.focus()
      editingInputRef.current.select?.()
    }
  }, [editingTaskId])

  const currentDuration = MODES[mode].duration
  const drawAudioRef = useRef(null)
  const endAudioRef = useRef(null)
  const rainAudioRef = useRef(null)
  const prevIsActive = useRef(isActive)
  const prevMode = useRef(mode)
  const prevTimeLeftAudio = useRef(timeLeft)
  const prevTimeLeftStats = useRef(timeLeft)

  // == 业务逻辑同原实现（省略注释重新排列） ==
  function handleAddTask(e) {
    e.preventDefault()
    const text = taskInput.trim()
    if (!text) return
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 7)
    const newTask = { id, text, completed: false, focusCount: 0 }
    const newTasks = [...tasks, newTask]
    setTasks(newTasks)
    saveTasks(newTasks)
    setTaskInput('')
  }
  function toggleTaskCompleted(id) {
    const newTasks = tasks.map(task =>
      task.id === id ? { ...task, completed: !task.completed } : task
    )
    setTasks(newTasks)
    saveTasks(newTasks)
    if (activeTaskId === id && newTasks.find(t => t.id === id)?.completed) {
      setActiveTaskId('')
      saveActiveTaskId('')
    }
  }
  function handleSetActiveTask(id) {
    if (activeTaskId === id) return
    setActiveTaskId(id)
    saveActiveTaskId(id)
  }
  function handleDeleteTask(id) {
    setTasks(prevTasks => {
      const next = prevTasks.filter(task => task.id !== id)
      saveTasks(next)
      if (activeTaskId === id) {
        setActiveTaskId('')
        saveActiveTaskId('')
      }
      if (editingTaskId === id) {
        setEditingTaskId('')
        setEditingTaskText('')
      }
      return next
    })
  }
  function handleClearCompleted() {
    setTasks(prevTasks => {
      const next = prevTasks.filter(task => !task.completed)
      saveTasks(next)
      if (activeTaskId && !next.find(t => t.id === activeTaskId)) {
        setActiveTaskId('')
        saveActiveTaskId('')
      }
      return next
    })
  }
  function handleStartEditTask(id, text) {
    if (editingTaskId !== id) {
      setEditingTaskId(id)
      setEditingTaskText(text)
    }
  }
  function handleEditTaskChange(e) {
    setEditingTaskText(e.target.value)
  }
  function handleEditTaskSubmit(e, id) {
    if (e) e.preventDefault()
    const value = editingTaskText.trim()
    if (value === '') {
      handleDeleteTask(id)
      setEditingTaskId('')
      setEditingTaskText('')
      return
    }
    setTasks(prevTasks => {
      const next = prevTasks.map(task =>
        task.id === id ? { ...task, text: value } : task
      )
      saveTasks(next)
      return next
    })
    setEditingTaskId('')
    setEditingTaskText('')
  }
  function handleEditTaskBlur(id) {
    if (editingTaskId !== id) return
    handleEditTaskSubmit(null, id)
  }
  function handleEditTaskKeyDown(e, id) {
    if (e.key === 'Enter') {
      handleEditTaskSubmit(e, id)
    } else if (e.key === 'Escape') {
      setEditingTaskId('')
      setEditingTaskText('')
    }
  }

  useEffect(() => {
    if (!activeTaskId) return
    const exist = tasks.find(t => t.id === activeTaskId && !t.completed)
    if (!exist) {
      setActiveTaskId('')
      saveActiveTaskId('')
    }
  }, [tasks, activeTaskId])
  useEffect(() => {
    saveTasks(tasks)
  }, [tasks])
  useEffect(() => {
    saveActiveTaskId(activeTaskId)
  }, [activeTaskId])

  useEffect(() => {
    if (stats.date !== getTodayDateStr()) {
      setStats({ date: getTodayDateStr(), count: 0 })
    }
  }, [stats.date])
  useEffect(() => {
    saveStats(stats)
  }, [stats])

  const switchMode = (newMode) => {
    setMode(newMode)
    setTimeLeft(MODES[newMode].duration)
    setIsActive(false)
  }
  const startPause = () => setIsActive((prev) => !prev)
  const reset = () => {
    setTimeLeft(currentDuration)
    setIsActive(false)
  }
  useEffect(() => {
    if (!isActive) return
    if (timeLeft <= 0) {
      setIsActive(false)
      setTimeLeft(currentDuration)
      return
    }
    const id = setInterval(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearInterval(id)
  }, [isActive, timeLeft, currentDuration])

  const isFocus = mode === 'focus'

  // 音频主控：音效播放与白噪音状态管理
  useEffect(() => {
    if (
      isFocus &&
      isActive &&
      !prevIsActive.current &&
      !isMuted &&
      drawAudioRef.current
    ) {
      drawAudioRef.current.currentTime = 0
      drawAudioRef.current.volume = 0.5
      drawAudioRef.current.play().catch(() => { })
    }
    prevIsActive.current = isActive
  }, [isActive, isFocus, isMuted])

  useEffect(() => {
    if (
      prevTimeLeftAudio.current > 0 &&
      timeLeft === 0 &&
      !isMuted &&
      endAudioRef.current
    ) {
      endAudioRef.current.currentTime = 0
      endAudioRef.current.volume = 0.8
      endAudioRef.current.play().catch(() => { })
    }
    prevTimeLeftAudio.current = timeLeft
  }, [timeLeft, isMuted])

  // 【BugFix 1】：rainAudioRef 白噪音暂停直接 pause，移除 fadeOut
  useEffect(() => {
    const shouldPlay = isFocus && isActive && !isMuted
    const shouldPause =
      !shouldPlay ||
      (mode !== prevMode.current)

    const audio = rainAudioRef.current
    if (!audio) return

    if (shouldPlay && audio.paused) {
      audio.currentTime = 0
      audio.volume = 0.22
      audio.loop = true
      audio.play().catch(() => { })
    } else if (shouldPause && !audio.paused) {
      // iOS Safari 禁止渐隐/volume 递减, 直接 pause
      audio.pause()
      // volume 仍设初值，确保下次可正常播放
      audio.volume = 0.22
    }
    prevMode.current = mode
  }, [isFocus, isActive, mode, isMuted])

  useEffect(() => {
    [drawAudioRef, endAudioRef, rainAudioRef].forEach((ref) => {
      if (ref.current) {
        ref.current.muted = isMuted
        if (ref === rainAudioRef) {
          if (isMuted && !ref.current.paused) ref.current.pause()
        }
      }
    })
  }, [isMuted])

  useEffect(() => {
    if (
      prevTimeLeftStats.current > 0 &&
      timeLeft === 0 &&
      isFocus
    ) {
      const today = getTodayDateStr()
      if (stats.date !== today) {
        setStats({ date: today, count: 1 })
      } else {
        setStats(prev => {
          const next = { ...prev, count: prev.count + 1 }
          saveStats(next)
          return next
        })
      }
      if (activeTaskId) {
        setTasks(prevTasks => {
          const updated = prevTasks.map(task =>
            task.id === activeTaskId
              ? { ...task, focusCount: (task.focusCount || 0) + 1 }
              : task
          )
          saveTasks(updated)
          return updated
        })
        setActiveTaskId('')
        saveActiveTaskId('')
      }
    }
    prevTimeLeftStats.current = timeLeft
    // eslint-disable-next-line
  }, [timeLeft, isFocus])

  const gradient = MODES[mode].gradient

  const indicatorColor = {
    focus: 'bg-ds-red shadow-[0_4px_16px_rgba(139,0,0,0.42)]',
    shortBreak: 'bg-ds-blue shadow-[0_4px_16px_rgba(30,58,138,0.30)]',
    longBreak: 'bg-ds-gold shadow-[0_4px_16px_rgba(255,215,0,0.18)]'
  }[mode]

  const getTextEffect = (active) =>
    active
      ? 'text-white drop-shadow-[0_0_12px_#8b0000e8] font-black'
      : 'text-ds-accent/80 hover:text-white hover:drop-shadow-[0_0_10px_#8b000080]'

  const breathingAnimation = isActive && isFocus
    ? {
      animate: {
        scale: [1, 1.05, 1],
        textShadow: [
          '0 0 0px #8b000040, 0 0 0px #8b0000',
          '0 0 16px #8b000044, 0 0 24px #8b00004c',
          '0 0 0px #8b000040, 0 0 0px #8b0000'
        ]
      },
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
    : {}

  // 火焰印记，仅表现组件（允许作为静态小函数，不涉及输入或复杂交互）
  function FocusFlame({ count }) {
    if (!count || count < 1) return null
    return (
      <span
        className="
          flex items-center ml-2 mr-0.5 shrink-0
          rounded-full bg-black/40 border border-[#f15325]/20 px-[0.32em] py-[0.12em]
          shadow-[0_1px_5px_0_rgba(255,54,2,0.12)]
        "
        style={{
          fontSize: 12,
          lineHeight: 1,
          fontWeight: 600,
          color: '#ff8b3a',
          minWidth: 0,
          letterSpacing: 0.2,
        }}
        title={`专注修炼 ${count} 次`}
      >
        <Flame
          className="w-[1em] h-[1em] mr-[0.15em] drop-shadow-[0_0_6px_#ff60004b]"
          style={{ color: '#ff7632', filter: 'drop-shadow(0 0 4px #f19c3a44)' }}
          strokeWidth={2.2}
          fill="#ff6e1f"
        />
        <span className="text-xs font-bold" style={{
          color: '#ffb56a',
          lineHeight: 1.1,
          marginLeft: 1
        }}>
          x {count}
        </span>
      </span>
    )
  }

  // =======================
  // 主渲染
  // =======================
  // ======================= UI 元素 静态函数以外均写到这里 =======================
  return (
    <Fragment>
      {/* 音效相关的 <audio> 元素 (隐藏) */}
      <audio ref={drawAudioRef} src="/sounds/draw.mp3" preload="auto" tabIndex={-1} />
      <audio ref={endAudioRef} src="/sounds/end.mp3" preload="auto" tabIndex={-1} />
      <audio ref={rainAudioRef} src="/sounds/rain.mp3" preload="auto" tabIndex={-1} />

      {/* 右上角——灭鬼记录微标 & 静音按钮组 */}
      <div>
        {/* StatsBadge */}
        <div
          className={`
            absolute top-6 right-[94px] z-20
            flex items-center gap-1.5 px-4 py-1.5
            rounded-full bg-white/8 backdrop-blur-[7px] border border-white/8
            text-xs text-white/80 font-semibold
            select-none
            shadow-[0_2px_12px_0_rgba(139,0,0,0.10)]
            hover:bg-white/16
            transition
          `}
          style={{
            minWidth: 85,
            letterSpacing: 0.5,
            userSelect: 'none'
          }}
        >
          <Star className="w-4 h-4 text-ds-gold drop-shadow-[0_0_5px_#ffef91a5]" />
          今日全集中:
          <span className="text-ds-red font-bold ml-1">{stats.count}</span>
          <span className="ml-0.5">次</span>
        </div>
        {/* MuteButton */}
        <button
          type="button"
          aria-label={isMuted ? '取消静音' : '静音'}
          onClick={() => setIsMuted((v) => !v)}
          className={`
            absolute top-6 right-7 z-20
            w-12 h-12 flex items-center justify-center
            rounded-full
            bg-white/10 hover:bg-white/20
            backdrop-blur-md
            shadow-[0_2px_10px_0_rgba(18,18,18,0.09)]
            transition-all
            border border-white/10
            text-ds-accent
            hover:text-white
            cursor-pointer
          `}
          style={{
            boxShadow: '0 2px 14px 0 rgba(139,0,0,0.13)',
            backdropFilter: 'blur(9px)'
          }}
        >
          {isMuted ? <VolumeX className="w-7 h-7" /> : <Volume2 className="w-7 h-7" />}
        </button>
      </div>

      {/* 左上角：羁绊任务呼出 */}
      <button
        type="button"
        aria-label="打开羁绊任务"
        onClick={() => setIsMobileTaskOpen(true)}
        className={`
          absolute top-6 left-7 z-20 w-12 h-12 flex items-center justify-center
          rounded-full bg-white/10 hover:bg-white/20
          backdrop-blur-md shadow-[0_2px_10px_0_rgba(18,18,18,0.09)]
          border border-white/10 text-ds-accent lg:hidden
        `}
      >
        <ListTodo className="w-6 h-6" />
      </button>

      {/* PC侧栏 */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, x: -32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -32 }}
          transition={{ duration: 0.39, ease: 'easeOut' }}
          className={`
            hidden lg:block lg:fixed lg:left-6 lg:top-1/4 lg:w-80 lg:z-20 lg:bg-transparent lg:p-0
          `}
          style={{ pointerEvents: 'auto' }}
        >
          {/* ====== 羁绊任务面板（非组件写法，结构挂载稳定） ====== */}
          <div className="
            bg-white/5 backdrop-blur-md border border-white/10
            rounded-2xl p-5 shadow-[0_6px_40px_0_rgba(18,18,18,0.13)]
            flex flex-col gap-2 relative
            w-full max-w-md
          ">
            <form className="flex gap-2 mb-3" onSubmit={handleAddTask} autoComplete="off">
              <input
                type="text"
                placeholder="输入你的羁绊任务"
                value={taskInput}
                onChange={e => setTaskInput(e.target.value)}
                className="
                  flex-1 bg-neutral-900/80 text-white/90 px-3 py-2 rounded-lg
                  border border-white/10 shadow-inner outline-none transition
                  focus:border-ds-red
                  placeholder:text-white/50
                "
                autoFocus={false}
                maxLength={50}
              />
              <button
                type="submit"
                className="
                  bg-ds-red text-white rounded-lg px-3 py-2 flex items-center
                  hover:bg-[#b32123] transition font-bold shadow
                  focus:outline-none focus:ring-1 focus:ring-ds-red
                "
                title="添加任务"
              >
                <Plus className="w-5 h-5" />
              </button>
            </form>
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto relative">
              {tasks.length === 0 && (
                <div className="text-center text-white/40 py-7 select-none text-sm">暂无任务</div>
              )}
              {tasks.map(task => {
                const isActiveTask = activeTaskId === task.id
                const isEditing = editingTaskId === task.id
                return (
                  <div
                    key={task.id}
                    className={`
                      group flex items-center gap-3 px-2 py-2 rounded-lg
                      transition relative
                      ${isActiveTask ? 'border-2 border-ds-red bg-ds-red/10 shadow-[0_4px_16px_#8b000024]' :
                        task.completed ? 'opacity-60' : 'hover:bg-white/10'}
                      ${!task.completed ? 'cursor-pointer' : 'cursor-default'}
                    `}
                    onClick={() => (!task.completed && !isEditing ? handleSetActiveTask(task.id) : undefined)}
                    tabIndex={0}
                    style={{
                      outline: isActiveTask ? '2px solid #8b0000' : 'none',
                    }}
                  >
                    {/* 完成勾选 */}
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        toggleTaskCompleted(task.id)
                      }}
                      className={`
                        flex items-center justify-center w-6 h-6 rounded-full
                        border-2
                        ${task.completed ? 'border-ds-red bg-ds-red/80 text-white' : 'border-white/20 bg-black/40 text-white/60'}
                        transition
                      `}
                      title={task.completed ? '已完成' : '标记为完成'}
                      tabIndex={-1}
                    >
                      {task.completed
                        ? <Check className="w-4 h-4" />
                        : <span className="block w-3 h-3 rounded-full border border-white/15"></span>}
                    </button>
                    {/* 任务文本或编辑框/火焰计数 */}
                    <div className="flex-1 flex items-center min-w-0">
                      {isEditing ? (
                        <form
                          onSubmit={e => handleEditTaskSubmit(e, task.id)}
                          className="w-full"
                          style={{ margin: 0 }}
                        >
                          <input
                            ref={editingInputRef}
                            type="text"
                            className={`
                              w-full px-2 py-1 rounded-md bg-black/40 border border-white/20 text-white
                              focus:border-ds-red outline-none shadow-inner text-base font-medium
                              transition
                              placeholder:text-white/50
                            `}
                            style={{
                              background: 'rgba(0,0,0,0.24)',
                              fontWeight: 500,
                            }}
                            value={editingTaskText}
                            maxLength={50}
                            onChange={handleEditTaskChange}
                            onBlur={() => handleEditTaskBlur(task.id)}
                            onKeyDown={e => handleEditTaskKeyDown(e, task.id)}
                          />
                        </form>
                      ) : (
                        <span
                          className={`
                            block flex-1 font-medium text-base transition-colors break-all select-text
                            ${task.completed ? 'line-through text-white/45' :
                              isActiveTask ? 'text-ds-red font-bold' : 'text-white/80 group-hover:text-ds-red'}
                            truncate
                          `}
                        >
                          {task.text}
                        </span>
                      )}
                      {/* 火焰印记 */}
                      <FocusFlame count={task.focusCount} />
                      {isActiveTask && !task.completed && !isEditing && (
                        <span className="ml-1 text-xs text-white/80 px-2 py-0.5 rounded bg-ds-red/60 font-semibold tracking-wide">
                          进行中
                        </span>
                      )}
                    </div>
                    {/* 编辑与删除 */}
                    {!task.completed && !isEditing && (
                      <div className="flex items-center gap-1 ml-1">
                        <button
                          type="button"
                          aria-label="编辑"
                          onClick={e => {
                            e.stopPropagation()
                            handleStartEditTask(task.id, task.text)
                          }}
                          className={`
                            p-1 rounded hover:bg-white/15 transition
                            opacity-30 group-hover:opacity-100 focus:opacity-100
                          `}
                          tabIndex={-1}
                          title="编辑任务"
                        >
                          <Edit2 className="w-4 h-4 text-white" />
                        </button>
                        <button
                          type="button"
                          aria-label="删除"
                          onClick={e => {
                            e.stopPropagation()
                            handleDeleteTask(task.id)
                          }}
                          className={`
                            p-1 rounded hover:bg-white/15 transition
                            opacity-30 group-hover:opacity-100 focus:opacity-100
                          `}
                          tabIndex={-1}
                          title="删除任务"
                        >
                          <Trash2 className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    )}
                    {/* 已完成 hover 删除 */}
                    {task.completed && !isEditing && (
                      <div className="flex items-center gap-1 ml-1">
                        <button
                          type="button"
                          aria-label="删除"
                          onClick={e => {
                            e.stopPropagation()
                            handleDeleteTask(task.id)
                          }}
                          className={`
                            p-1 rounded hover:bg-white/15 transition
                            opacity-0 group-hover:opacity-90 focus:opacity-100
                          `}
                          tabIndex={-1}
                          title="删除任务"
                          style={{ pointerEvents: 'auto' }}
                        >
                          <Trash2 className="w-4 h-4 text-white/70" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {tasks.some(t => t.completed) && (
              <div className="flex justify-center mt-2">
                <button
                  type="button"
                  onClick={handleClearCompleted}
                  className={`
                    flex items-center gap-1 px-2 py-1 rounded
                    text-xs text-white/40
                    hover:text-white/80 hover:bg-white/8
                    transition focus:outline-none
                  `}
                  style={{ fontWeight: 500, letterSpacing: 0.05, background: 'none', minHeight: 0, boxShadow: 'none' }}
                  tabIndex={0}
                  title="一键清除所有已完成任务"
                >
                  <Trash2 className="w-3.5 h-3.5 -ml-0.5 mr-1" />
                  一键清除已完成
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* 移动端modal，保持结构稳定，不产生remount，防止输入断触 */}
      <AnimatePresence>
        <motion.div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 lg:hidden ${isMobileTaskOpen ? '' : 'pointer-events-none'}`}
          initial={false}
          animate={{ opacity: isMobileTaskOpen ? 1 : 0 }}
          style={{ display: isMobileTaskOpen ? undefined : 'none' }}
        >
          {/* 关闭按钮 */}
          <button
            type="button"
            onClick={() => setIsMobileTaskOpen(false)}
            className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white"
            aria-label="关闭面板"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="
            bg-white/5 backdrop-blur-md border border-white/10
            rounded-2xl p-5 shadow-[0_6px_40px_0_rgba(18,18,18,0.13)]
            flex flex-col gap-2 relative
            w-full max-w-md
          ">
            <form className="flex gap-2 mb-3" onSubmit={handleAddTask} autoComplete="off">
              <input
                type="text"
                placeholder="输入你的羁绊任务"
                value={taskInput}
                onChange={e => setTaskInput(e.target.value)}
                className="
                  flex-1 bg-neutral-900/80 text-white/90 px-3 py-2 rounded-lg
                  border border-white/10 shadow-inner outline-none transition
                  focus:border-ds-red
                  placeholder:text-white/50
                "
                autoFocus={false}
                maxLength={50}
              />
              <button
                type="submit"
                className="
                  bg-ds-red text-white rounded-lg px-3 py-2 flex items-center
                  hover:bg-[#b32123] transition font-bold shadow
                  focus:outline-none focus:ring-1 focus:ring-ds-red
                "
                title="添加任务"
              >
                <Plus className="w-5 h-5" />
              </button>
            </form>
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto relative">
              {tasks.length === 0 && (
                <div className="text-center text-white/40 py-7 select-none text-sm">暂无任务</div>
              )}
              {tasks.map(task => {
                const isActiveTask = activeTaskId === task.id
                const isEditing = editingTaskId === task.id
                return (
                  <div
                    key={task.id}
                    className={`
                      group flex items-center gap-3 px-2 py-2 rounded-lg
                      transition relative
                      ${isActiveTask ? 'border-2 border-ds-red bg-ds-red/10 shadow-[0_4px_16px_#8b000024]' :
                        task.completed ? 'opacity-60' : 'hover:bg-white/10'}
                      ${!task.completed ? 'cursor-pointer' : 'cursor-default'}
                    `}
                    onClick={() => (!task.completed && !isEditing ? handleSetActiveTask(task.id) : undefined)}
                    tabIndex={0}
                    style={{
                      outline: isActiveTask ? '2px solid #8b0000' : 'none',
                    }}
                  >
                    {/* 完成勾选 */}
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        toggleTaskCompleted(task.id)
                      }}
                      className={`
                        flex items-center justify-center w-6 h-6 rounded-full
                        border-2
                        ${task.completed ? 'border-ds-red bg-ds-red/80 text-white' : 'border-white/20 bg-black/40 text-white/60'}
                        transition
                      `}
                      title={task.completed ? '已完成' : '标记为完成'}
                      tabIndex={-1}
                    >
                      {task.completed
                        ? <Check className="w-4 h-4" />
                        : <span className="block w-3 h-3 rounded-full border border-white/15"></span>}
                    </button>
                    {/* 任务文本或编辑框/火焰计数 */}
                    <div className="flex-1 flex items-center min-w-0">
                      {isEditing ? (
                        <form
                          onSubmit={e => handleEditTaskSubmit(e, task.id)}
                          className="w-full"
                          style={{ margin: 0 }}
                        >
                          <input
                            ref={editingInputRef}
                            type="text"
                            className={`
                              w-full px-2 py-1 rounded-md bg-black/40 border border-white/20 text-white
                              focus:border-ds-red outline-none shadow-inner text-base font-medium
                              transition
                              placeholder:text-white/50
                            `}
                            style={{
                              background: 'rgba(0,0,0,0.24)',
                              fontWeight: 500,
                            }}
                            value={editingTaskText}
                            maxLength={50}
                            onChange={handleEditTaskChange}
                            onBlur={() => handleEditTaskBlur(task.id)}
                            onKeyDown={e => handleEditTaskKeyDown(e, task.id)}
                          />
                        </form>
                      ) : (
                        <span
                          className={`
                            block flex-1 font-medium text-base transition-colors break-all select-text
                            ${task.completed ? 'line-through text-white/45' :
                              isActiveTask ? 'text-ds-red font-bold' : 'text-white/80 group-hover:text-ds-red'}
                            truncate
                          `}
                        >
                          {task.text}
                        </span>
                      )}
                      {/* 火焰印记 */}
                      <FocusFlame count={task.focusCount} />
                      {isActiveTask && !task.completed && !isEditing && (
                        <span className="ml-1 text-xs text-white/80 px-2 py-0.5 rounded bg-ds-red/60 font-semibold tracking-wide">
                          进行中
                        </span>
                      )}
                    </div>
                    {/* 编辑与删除 */}
                    {!task.completed && !isEditing && (
                      <div className="flex items-center gap-1 ml-1">
                        <button
                          type="button"
                          aria-label="编辑"
                          onClick={e => {
                            e.stopPropagation()
                            handleStartEditTask(task.id, task.text)
                          }}
                          className={`
                            p-1 rounded hover:bg-white/15 transition
                            opacity-30 group-hover:opacity-100 focus:opacity-100
                          `}
                          tabIndex={-1}
                          title="编辑任务"
                        >
                          <Edit2 className="w-4 h-4 text-white" />
                        </button>
                        <button
                          type="button"
                          aria-label="删除"
                          onClick={e => {
                            e.stopPropagation()
                            handleDeleteTask(task.id)
                          }}
                          className={`
                            p-1 rounded hover:bg-white/15 transition
                            opacity-30 group-hover:opacity-100 focus:opacity-100
                          `}
                          tabIndex={-1}
                          title="删除任务"
                        >
                          <Trash2 className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    )}
                    {/* 已完成 hover 删除 */}
                    {task.completed && !isEditing && (
                      <div className="flex items-center gap-1 ml-1">
                        <button
                          type="button"
                          aria-label="删除"
                          onClick={e => {
                            e.stopPropagation()
                            handleDeleteTask(task.id)
                          }}
                          className={`
                            p-1 rounded hover:bg-white/15 transition
                            opacity-0 group-hover:opacity-90 focus:opacity-100
                          `}
                          tabIndex={-1}
                          title="删除任务"
                          style={{ pointerEvents: 'auto' }}
                        >
                          <Trash2 className="w-4 h-4 text-white/70" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {tasks.some(t => t.completed) && (
              <div className="flex justify-center mt-2">
                <button
                  type="button"
                  onClick={handleClearCompleted}
                  className={`
                    flex items-center gap-1 px-2 py-1 rounded
                    text-xs text-white/40
                    hover:text-white/80 hover:bg-white/8
                    transition focus:outline-none
                  `}
                  style={{ fontWeight: 500, letterSpacing: 0.05, background: 'none', minHeight: 0, boxShadow: 'none' }}
                  tabIndex={0}
                  title="一键清除所有已完成任务"
                >
                  <Trash2 className="w-3.5 h-3.5 -ml-0.5 mr-1" />
                  一键清除已完成
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* 背景与主要计时 UI */}
      <AnimatePresence mode="wait">
        {/* 背景用 motion.div + animate style 渐变 */}
        <motion.div
          key={mode}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.85, ease: "easeInOut" }}
          className="fixed inset-0 z-0"
          style={{
            background: gradient,
            transition: 'background 0.7s cubic-bezier(0.77, 0, 0.175, 1)'
          }}
        />
        <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-8 gap-10 select-none pb-32">
          {/* 人物立绘插画 */}
          <AnimatePresence mode="wait">
            {MODES[mode].image && (
              <motion.img
                key={mode}
                src={MODES[mode].image}
                initial={{ opacity: 0, x: 20 }}
                animate={{
                  opacity: 0.65,
                  x: 0,
                  y: (isActive && mode === 'focus')
                    ? [0, -12, 0]
                    : (mode === 'longBreak'
                      ? [0, -8, 0]
                      : 0),
                  scale: mode === 'shortBreak' ? [1, 1.02, 1] : 1,
                  rotate: mode === 'shortBreak' ? [0, -1, 1, 0] : 0
                }}
                exit={{ opacity: 0, x: -20 }}
                transition={{
                  opacity: { duration: 0.6 },
                  x: { duration: 0.6 },
                  y: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                  scale: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                  rotate: { duration: 4, repeat: Infinity, ease: "easeInOut" }
                }}
                className="absolute bottom-0 right-[2%] max-h-[65vh] max-w-[85vw] object-contain object-bottom pointer-events-none z-0"
                alt="character vibe"
              />
            )}
          </AnimatePresence>
          {/* 模式切换 */}
          <div className="flex gap-3 sm:gap-5 mt-2">
            {Object.entries(MODES).map(([key, { label }]) => {
              const selected = mode === key
              const indicatorColor = {
                focus: 'bg-ds-red shadow-[0_4px_16px_rgba(139,0,0,0.42)]',
                shortBreak: 'bg-ds-blue shadow-[0_4px_16px_rgba(30,58,138,0.30)]',
                longBreak: 'bg-ds-gold shadow-[0_4px_16px_rgba(255,215,0,0.18)]'
              }[key]
              return (
                <motion.button
                  layout
                  key={key}
                  type="button"
                  onClick={() => switchMode(key)}
                  className={`
                    relative px-6 py-2.5
                    rounded-t-xl rounded-b
                    text-lg font-bold transition-all
                    leading-snug
                    ${getTextEffect(selected)}
                    ${selected ? '' : 'opacity-75'}
                    outline-none
                    tracking-wide
                  `}
                  whileTap={{ scale: 0.92 }}
                >
                  <span
                    className={
                      selected
                        ? 'transition text-shadow-md'
                        : 'transition'
                    }
                  >
                    {label}
                  </span>
                  {selected && (
                    <motion.div
                      layoutId="mode-indicator"
                      className={`absolute left-2 right-2 bottom-0 h-1.5 ${indicatorColor} rounded-xl`}
                      style={{ boxShadow: '0 0 16px 3px rgba(139,0,0,0.22)' }}
                    />
                  )}
                </motion.button>
              )
            })}
          </div>
          {/* 时间数字显示  */}
          <div className="flex justify-center items-center py-2">
            <motion.span
              className={`
                text-[22vw] sm:text-[15vw] lg:text-9xl font-extrabold tabular-nums
                tracking-widest
                ${isFocus ? 'text-ds-red' : 'text-ds-accent'}
                drop-shadow-[0_2px_36px_rgba(139,0,0,0.2)]
                select-none
              `}
              {...breathingAnimation}
              style={{
                textShadow: isFocus
                  ? '0 0 10px #8b000080, 0 0 38px #8b000040'
                  : undefined
              }}
            >
              {formatTime(timeLeft)}
            </motion.span>
          </div>

          {/* 控制区 */}
          <div className="flex flex-col sm:flex-row items-center gap-5 pb-2">
            <motion.button
              type="button"
              onClick={startPause}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              className={`
                px-12 py-4 rounded-2xl text-xl font-semibold
                shadow-lg
                transition
                focus:outline-none
                bg-ds-red text-white
                shadow-[0_0_15px_rgba(139,0,0,0.52)]
                hover:bg-[#b32123] hover:shadow-[0_0_24px_rgba(139,0,0,0.75)]
                active:shadow-[0_0_10px_rgba(139,0,0,0.40)]
                tracking-wider
                border border-[#88191940]
                flex items-center justify-center
                transition-all
              `}
            >
              {isActive ? '暂停' : '开始'}
            </motion.button>
            <button
              type="button"
              onClick={reset}
              className={`
                flex items-center gap-2 px-4 py-3 rounded-xl
                bg-white/10 hover:bg-white/20 text-ds-accent text-lg
                font-normal transition-colors tracking-wide shadow
                hover:text-ds-red hover:shadow-[0_0_8px_rgba(139,0,0,0.18)]
              `}
            >
              <RotateCcw className="w-5 h-5" />
              重置
            </button>
          </div>
        </main>
      </AnimatePresence>
    </Fragment>
  )
}
