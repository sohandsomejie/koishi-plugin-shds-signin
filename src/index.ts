import { Context, Schema, h } from "koishi";

export const name = "shds-signin";

const ALL_GOOD = "万事皆宜";
const ALL_BAD = "诸事不宜";
const MESSAGE_DIVIDER = "━━━━━━━━━━━━";
// QQ 会裁掉纯空白首行，零宽字符用于让自动用户提及后稳定换行。
const LEADING_BLANK_LINE = "\u200B";

/** 插件在 Koishi 控制台中暴露的配置。 */
export interface Config {
  /** 随机点数对应的运势等级。 */
  fortuneLevels: FortuneLevel[]
  /** 用于生成“宜/忌”的空白分隔事项列表。 */
  fortuneItems: string
  /** 是否将万事皆宜/诸事不宜加入随机结果。 */
  enableSpecialFortune: boolean
  /** 签到时随机抽取的空白分隔签语列表。 */
  fortuneTexts: string
}

/** 一个闭区间运势等级，例如“大吉 90-100”。 */
interface FortuneLevel {
  name: string
  min: number
  max: number
}

export interface FortuneItems {
  good: string[]
  bad: string[]
}

export type SigninResult = Pick<Schedule, 'rnum' | 'res' | 'fortune' | 'testList'>
export type RecentSignin = Pick<Schedule, 'time' | 'res' | 'rnum'> & Partial<Pick<Schedule, 'id'>>

// 配置界面定义。文本列表使用 textarea，减少逐项编辑数组的操作成本。
export const Config = Schema.object({
  fortuneLevels: Schema.array(
    Schema.object({
      name: Schema.string().description('运势等级名称').required(),
      min: Schema.number().description('最小数值').min(0).max(100).required(),
      max: Schema.number().description('最大数值').min(0).max(100).required(),
    })
  ).min(1).description('运势等级配置').default([
    { name: '大吉', min: 90, max: 100 },
    { name: '中吉', min: 80, max: 89 },
    { name: '小吉', min: 60, max: 79 },
    { name: '中平', min: 40, max: 59 },
    { name: '小凶', min: 20, max: 39 },
    { name: '中凶', min: 10, max: 19 },
    { name: '大凶', min: 0, max: 9 },
  ]),
  fortuneItems: Schema.string()
    .role('textarea')
    .description('宜忌事项，使用空格分隔（至少 4 项）')
    .default('早起 补觉 散步 出门 宅家 运动 摸鱼 学习 写代码 开黑 单排 上分 打瓦 打州 打火影 玩MC 抽卡 刷副本 看电影 听歌 追番 吃夜宵 点外卖 发朋友圈 画画 整理房间 网购 聊天'),
  enableSpecialFortune: Schema.boolean()
    .description('是否启用“万事皆宜 / 诸事不宜”特殊结果')
    .default(true),
  fortuneTexts: Schema.string()
    .role('textarea')
    .description('签语列表，使用空格分隔')
    .default('稳住自己的节奏，好结果正在靠近 今天适合大胆开局，也要记得及时收手 看似平平无奇，细节里藏着惊喜 别和运气较劲，换条路也许更顺 灵感正在路上，记得给它留个位置 先完成眼前的小事，后面的路自然会亮 手感会慢慢升温，第一局别急着下结论 冲动容易送分，冷静才能翻盘 遇到卡关先休息，回来可能一遍就过 想做的事可以开始，不必等到万事俱备 普通的一天，也可能掉落稀有惊喜 少一点犹豫，多一点行动 今天宜慢不宜急，稳稳推进就是胜利 看似绕远的路，也许正通向答案 好消息来得很轻，记得认真听 别在一次失误上停太久，下一局更重要 保持耐心，属于你的机会不会刷新掉 运气偶尔缺席，操作依然可以补回来 风来时顺势而行，风停时安心等待 今天的答案不在远处，就在下一次尝试里'),
});

// 将插件数据表注册到 Koishi 的全局 Tables 类型中。
declare module "koishi" {
  interface Tables {
    shds_signin: Schedule;
  }
}

/** 一次签到生成并持久化的完整结果。 */
export interface Schedule {
  /** 自增主键。 */
  id: number;
  /** 跨平台用户键，格式为 platform:userId。 */
  user: string;
  /** 当日随机点数，范围为 1-100。 */
  rnum: number;
  /** 上海时区的签到日期，格式为 YYYY-MM-DD。 */
  time: string;
  /** 点数对应的运势等级名称。 */
  res: string;
  /** 实际写入数据库的时间。 */
  dateTime: Date;
  /** 宜、忌项目的紧凑存储值，格式为 宜1,宜2|忌1,忌2，特殊项允许一侧为空。 */
  fortune: string;
  /** 当次签到抽中的签语。 */
  testList: string;
}

/** 生成包含首尾边界的随机整数。 */
function random(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 获取上海时区下稳定的业务日期键。 */
export function getTodayDateString(date = new Date()): string {
  // 签到日按业务所在时区计算，避免服务器时区变化导致跨日判断不一致。
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** 组合平台和用户 ID，避免不同平台的同名 ID 共享签到数据。 */
export function getUserKey(platform: string, userId: string): string {
  return `${platform}:${userId}`;
}

/** 将控制台文本配置解析为去除空项后的列表。 */
export function parseTextItems(value: string, label: string, minLength: number): string[] {
  // 同时接受空格、换行和 Tab，方便直接在控制台文本框中编辑。
  const items = value.trim().split(/\s+/).filter(Boolean);
  if (items.length < minLength) {
    throw new Error(`${label}至少需要 ${minLength} 项，请使用空格分隔`);
  }
  return items;
}

/** 将数据库中的紧凑值还原为“宜”和“忌”列表。 */
export function parseFortuneItems(value: string): FortuneItems {
  const [good = '', bad = ''] = value.split('|');
  return {
    good: good.split(',').filter(Boolean),
    bad: bad.split(',').filter(Boolean),
  };
}

/** 生成消息中的宜忌行，特殊结果只显示命中的一行。 */
export function formatFortuneLines({ good, bad }: FortuneItems): string[] {
  if (good.includes(ALL_GOOD)) return [`🌸 宜：${ALL_GOOD}`];
  if (bad.includes(ALL_BAD)) return [`🚫 忌：${ALL_BAD}`];
  return [
    `🌸 宜：${good.join('、')}`,
    `🚫 忌：${bad.join('、')}`,
  ];
}

/** 生成新签到和重复签到共用的分段结果文本。 */
export function formatSigninLines(result: SigninResult, isNew: boolean): string[] {
  // 首行占位确保标题与 QQ 用户提及分行显示。
  return [
    LEADING_BLANK_LINE,
    isNew ? '🎉 签到成功 🎉' : '✨ 今日已签到 ✨',
    MESSAGE_DIVIDER,
    `今日运势：${result.res} (${result.rnum}点)`,
    ...formatFortuneLines(parseFortuneItems(result.fortune)),
    `📜 签语：${result.testList}`,
    MESSAGE_DIVIDER,
    '(每日可签到一次)',
  ];
}

/** 生成分段展示的签到次数统计文本。 */
export function formatTotalLines(
  username: string | undefined,
  totalCount: number,
  totals: Record<string, number>,
): string[] {
  const title = username ? `${username} 的签到统计` : '你的签到统计';
  return [
    LEADING_BLANK_LINE,
    `📊 ${title}`,
    MESSAGE_DIVIDER,
    `总签到次数：${totalCount}次`,
    MESSAGE_DIVIDER,
    ...Object.entries(totals).map(([name, count]) => `▸ ${name}：${count}次`),
    MESSAGE_DIVIDER,
  ];
}

/** 生成分段展示的最近签到文本，无记录时返回明确的空状态。 */
export function formatRecentLines(username: string | undefined, records: RecentSignin[]): string[] {
  const title = username ? `${username} 的最近签到` : '你的最近签到';
  return [
    LEADING_BLANK_LINE,
    `📅 ${title}`,
    MESSAGE_DIVIDER,
    ...(records.length
      ? records.map(item => `▸ ${item.time}：${item.res} (${item.rnum}点)`)
      : ['暂无签到记录']),
    MESSAGE_DIVIDER,
  ];
}

/** 按签到日期选择最近记录，避免迁移数据的自增 ID 影响时间顺序。 */
export function selectRecentSignins(records: RecentSignin[], limit = 6): RecentSignin[] {
  return [...records]
    .sort((a, b) => b.time.localeCompare(a.time) || (b.id ?? 0) - (a.id ?? 0))
    .slice(0, limit);
}

/** 将排在前四位的活动解析为最终宜忌结果。 */
export function resolveFortuneItems(items: string[]): FortuneItems {
  const selected = items.slice(0, 4);
  const specialIndex = selected.indexOf(ALL_GOOD);
  if (specialIndex >= 0) {
    // 特殊项落在“宜”侧时为万事皆宜，落在“忌”侧时转换为诸事不宜。
    return specialIndex < 2
      ? { good: [ALL_GOOD], bad: [] }
      : { good: [], bad: [ALL_BAD] };
  }
  return { good: selected.slice(0, 2), bad: selected.slice(2, 4) };
}

/** 生成普通活动候选，并按配置决定是否加入特殊结果标记。 */
export function getFortuneCandidates(fortuneItems: string[], enableSpecialFortune: boolean): string[] {
  const ordinaryItems = [...new Set(
    fortuneItems.filter(item => item !== ALL_GOOD && item !== ALL_BAD),
  )];
  if (ordinaryItems.length < 4) {
    throw new Error('普通活动列表去重后至少需要 4 项');
  }
  return enableSpecialFortune ? [...ordinaryItems, ALL_GOOD] : ordinaryItems;
}

/** 在插件启动时验证 1-100 点均有唯一的运势等级。 */
export function validateConfig(config: Config): void {
  // 每个点数必须且只能命中一个运势等级。
  const covered = new Set<number>();
  for (const level of config.fortuneLevels) {
    if (level.min > level.max) {
      throw new Error(`运势等级“${level.name}”的最小值不能大于最大值`);
    }
    for (let value = level.min; value <= level.max; value++) {
      if (covered.has(value)) {
        throw new Error(`运势等级配置在 ${value} 点存在重叠`);
      }
      covered.add(value);
    }
  }
  for (let value = 1; value <= 100; value++) {
    if (!covered.has(value)) {
      throw new Error(`运势等级配置未覆盖 ${value} 点`);
    }
  }
}

/** 注册数据模型和签到相关命令。 */
export function apply(ctx: Context, config: Config) {
  validateConfig(config);
  const fortuneItems = parseTextItems(config.fortuneItems, '宜忌事项', 4);
  const fortuneTexts = parseTextItems(config.fortuneTexts, '签语列表', 1);

  ctx.inject(['database'], (ctx => {
    // 数据库服务就绪后再注册模型和命令，避免插件在无数据库时运行。
    ctx.model.extend("shds_signin", {
      id: "unsigned",
      user: "text",
      rnum: "unsigned",
      time: "text",
      res: "text",
      dateTime: "timestamp",
      fortune: "text",
      testList: "text",
    }, {
      primary: "id",
      autoInc: true,
      indexes: [{
        // 数据库约束负责兜底，保证同一用户每天最多生成一条记录。
        name: "shds_signin:user+time",
        keys: { user: "asc", time: "asc" },
        unique: true,
      } as { name: string; keys: { user: "asc"; time: "asc" }; unique: true } & {
        unique?: boolean
      }],
    });

    /** 根据随机点数查找对应的运势等级。 */
    function getFortuneResult(n: number): string {
      for (const level of config.fortuneLevels) {
        if (n >= level.min && n <= level.max) {
          return level.name;
        }
      }
      throw new Error(`运势等级配置未覆盖 ${n} 点`);
    }

    /** 随机生成各两项且互不重复的“宜”和“忌”。 */
    function generateFortuneItems(): FortuneItems {
      const items = getFortuneCandidates(fortuneItems, config.enableSpecialFortune);
      for (let i = items.length - 1; i > 0; i--) {
        const index = random(0, i);
        [items[i], items[index]] = [items[index], items[i]];
      }
      // 打乱后分别取两项，确保“宜”和“忌”不重复且数量稳定。
      return resolveFortuneItems(items);
    }

    // 每日签到：已有记录时返回原结果，否则生成并保存新结果。
    ctx.command("signin").action(async ({ session }) => {
      const today = getTodayDateString();
      const user = getUserKey(session.platform, session.userId);
      const [existingSignin] = await ctx.database.get("shds_signin", { user, time: today });
      if (existingSignin) {
        return [
          h.at(session.userId),
          ...formatSigninLines(existingSignin, false),
        ].join("\n");
      }

      const n = random(1, 100);
      const r = getFortuneResult(n);
      const test = fortuneTexts[random(0, fortuneTexts.length - 1)];
      const { good, bad } = generateFortuneItems();
      // 使用逗号分隔同组项目，使用竖线分隔“宜”和“忌”。
      const fortune = `${good.join(",")}|${bad.join(",")}`;

      try {
        await ctx.database.create("shds_signin", {
          user,
          time: today,
          rnum: n,
          res: r,
          dateTime: new Date(),
          testList: test,
          fortune,
        });
      } catch (error) {
        // 并发签到触发唯一索引时，返回另一请求已经写入的结果。
        const [concurrentSignin] = await ctx.database.get("shds_signin", { user, time: today });
        if (!concurrentSignin) throw error;
        return [
          h.at(session.userId),
          ...formatSigninLines(concurrentSignin, false),
        ].join("\n");
      }

      return [
        h.at(session.userId),
        ...formatSigninLines({ rnum: n, res: r, fortune, testList: test }, true),
      ].join("\n");
    });

    // 汇总当前用户各运势等级的历史次数。
    ctx.command("getTotal").action(async ({ session }) => {
      const user = getUserKey(session.platform, session.userId);
      const data = await ctx.database.get("shds_signin", { user });
      const total: Record<string, number> = {};

      config.fortuneLevels.forEach(level => {
        total[level.name] = 0;
      });

      data.forEach(item => {
        if (total.hasOwnProperty(item.res)) {
          total[item.res]++;
        }
      });

      return formatTotalLines(session.username, data.length, total).join("\n");
    });

    // 展示当前用户最近六次签到结果。
    ctx.command("getRecent").action(async ({ session }) => {
      const user = getUserKey(session.platform, session.userId);
      const data = await ctx.database.get("shds_signin", { user });
      const recent = selectRecentSignins(data);
      return formatRecentLines(session.username, recent).join("\n");
    });

  }))
}
