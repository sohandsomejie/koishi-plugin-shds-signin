import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  Config,
  formatFortuneLines,
  formatRecentLines,
  formatSigninLines,
  formatTotalLines,
  getFortuneCandidates,
  getTodayDateString,
  getUserKey,
  parseFortuneItems,
  parseTextItems,
  resolveFortuneItems,
  validateConfig,
} from '../src/index'

const defaultConfig = Config({})

test('文本列表支持多种空白字符', () => {
  assert.deepEqual(
    parseTextItems('睡觉  躺平\n玩手机\t出门', '活动列表', 4),
    ['睡觉', '躺平', '玩手机', '出门'],
  )
})

test('文本列表少于最小项数时拒绝启动', () => {
  assert.throws(
    () => parseTextItems('睡觉 躺平', '活动列表', 4),
    /活动列表至少需要 4 项/,
  )
})

test('默认签语可以按空格解析为完整列表', () => {
  const fortuneTexts = parseTextItems(defaultConfig.fortuneTexts, '签语列表', 1)
  assert.equal(fortuneTexts.length, 20)
  assert.ok(fortuneTexts.every(text => text.length > 0))
})

test('默认宜忌事项可以按空格解析且不包含特殊项', () => {
  const fortuneItems = parseTextItems(defaultConfig.fortuneItems, '宜忌事项', 4)
  assert.equal(fortuneItems.length, 28)
  assert.ok(!fortuneItems.includes('万事皆宜'))
  assert.ok(!fortuneItems.includes('诸事不宜'))
})

test('签到日期固定使用上海时区', () => {
  const date = new Date('2026-08-15T16:30:00.000Z')
  assert.equal(getTodayDateString(date), '2026-08-16')
})

test('用户键包含平台以隔离同名用户', () => {
  assert.equal(getUserKey('qq', '10001'), 'qq:10001')
})

test('默认运势等级完整覆盖点数区间', () => {
  assert.doesNotThrow(() => validateConfig(defaultConfig))
})

test('重叠的运势区间会被拒绝', () => {
  assert.throws(
    () => validateConfig({
      ...defaultConfig,
      fortuneLevels: [
        { name: '甲', min: 1, max: 60 },
        { name: '乙', min: 60, max: 100 },
      ],
    }),
    /在 60 点存在重叠/,
  )
})

test('未完整覆盖的运势区间会被拒绝', () => {
  assert.throws(
    () => validateConfig({
      ...defaultConfig,
      fortuneLevels: [{ name: '甲', min: 1, max: 99 }],
    }),
    /未覆盖 100 点/,
  )
})

test('普通宜忌结果显示两行', () => {
  assert.deepEqual(
    formatFortuneLines({ good: ['睡觉', '出门'], bad: ['熬夜', '加班'] }),
    ['🌸 宜：睡觉、出门', '🚫 忌：熬夜、加班'],
  )
})

test('特殊结果开启时作为独立候选加入', () => {
  assert.deepEqual(
    getFortuneCandidates(['睡觉', '出门', '加班', '熬夜'], true),
    ['睡觉', '出门', '加班', '熬夜', '万事皆宜'],
  )
})

test('特殊结果关闭时只保留普通活动', () => {
  assert.deepEqual(
    getFortuneCandidates(['睡觉', '万事皆宜', '出门', '诸事不宜', '加班', '熬夜'], false),
    ['睡觉', '出门', '加班', '熬夜'],
  )
})

test('万事皆宜落在宜侧时清空其他事项', () => {
  assert.deepEqual(
    resolveFortuneItems(['睡觉', '万事皆宜', '熬夜', '加班']),
    { good: ['万事皆宜'], bad: [] },
  )
})

test('万事皆宜落在忌侧时转换为诸事不宜', () => {
  assert.deepEqual(
    resolveFortuneItems(['睡觉', '出门', '万事皆宜', '加班']),
    { good: [], bad: ['诸事不宜'] },
  )
})

test('万事皆宜只显示宜这一行', () => {
  assert.deepEqual(
    formatFortuneLines({ good: ['万事皆宜'], bad: [] }),
    ['🌸 宜：万事皆宜'],
  )
})

test('诸事不宜只显示忌这一行', () => {
  assert.deepEqual(
    formatFortuneLines({ good: [], bad: ['诸事不宜'] }),
    ['🚫 忌：诸事不宜'],
  )
})

test('特殊宜忌的数据库格式可以正确还原', () => {
  assert.deepEqual(parseFortuneItems('万事皆宜|'), {
    good: ['万事皆宜'],
    bad: [],
  })
  assert.deepEqual(parseFortuneItems('|诸事不宜'), {
    good: [],
    bad: ['诸事不宜'],
  })
})

test('新签到结果使用分段展示格式', () => {
  assert.deepEqual(formatSigninLines({
    rnum: 96,
    res: '大吉',
    fortune: '散步,听歌|熬夜,单排',
    testList: '稳住自己的节奏，好结果正在靠近',
  }, true), [
    '',
    '🎉 签到成功 🎉',
    '━━━━━━━━━━━━',
    '今日运势：大吉 (96点)',
    '🌸 宜：散步、听歌',
    '🚫 忌：熬夜、单排',
    '📜 签语：稳住自己的节奏，好结果正在靠近',
    '━━━━━━━━━━━━',
    '(每日可签到一次)',
  ])
})

test('重复签到沿用原结果并显示状态', () => {
  assert.deepEqual(formatSigninLines({
    rnum: 20,
    res: '小凶',
    fortune: '|诸事不宜',
    testList: '今天宜慢不宜急，稳稳推进就是胜利',
  }, false), [
    '',
    '✨ 今日已签到 ✨',
    '━━━━━━━━━━━━',
    '今日运势：小凶 (20点)',
    '🚫 忌：诸事不宜',
    '📜 签语：今天宜慢不宜急，稳稳推进就是胜利',
    '━━━━━━━━━━━━',
    '(每日可签到一次)',
  ])
})

test('签到统计展示累计天数和等级明细', () => {
  assert.deepEqual(formatTotalLines('小明', 3, { 大吉: 2, 中平: 1 }), [
    '📊 小明的签到统计',
    '累计签到：3 天',
    '• 大吉：2 次',
    '• 中平：1 次',
  ])
})

test('最近签到展示点数并支持空状态', () => {
  assert.deepEqual(formatRecentLines('小明', [
    { time: '2026-08-16', res: '大吉', rnum: 96 },
  ]), [
    '📅 小明的最近签到',
    '• 2026-08-16｜大吉 · 96 点',
  ])
  assert.deepEqual(formatRecentLines(undefined, []), [
    '📅 你的最近签到',
    '暂无签到记录',
  ])
})
