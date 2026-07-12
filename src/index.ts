import { Context, Schema, h } from "koishi";

export const name = "shds-signin";

export interface Config {
  fortuneLevels: FortuneLevel[]
  activities: string[]
  testTexts: string[]
  fortressInitTime: string
}

interface FortuneLevel {
  name: string
  min: number
  max: number
}

export const Config = Schema.object({
  fortuneLevels: Schema.array(
    Schema.object({
      name: Schema.string().description('运势等级名称').required(),
      min: Schema.number().description('最小数值').min(0).max(100).required(),
      max: Schema.number().description('最大数值').min(0).max(100).required(),
    })
  ).description('运势等级配置').default([
    { name: '大吉', min: 90, max: 100 },
    { name: '中吉', min: 80, max: 89 },
    { name: '小吉', min: 60, max: 79 },
    { name: '中平', min: 40, max: 59 },
    { name: '小凶', min: 20, max: 39 },
    { name: '中凶', min: 10, max: 19 },
    { name: '大凶', min: 0, max: 9 },
  ]),
  activities: Schema.array(
    Schema.string().description('活动项目')
  ).description('活动列表').default([
    "睡觉", "躺平", "上厕所", "玩手机", "逛街", "出门",
    "玩mc", "打瓦", "万事皆宜", "Coding", "刷视频",
    "吃东西", "发朋友圈", "画画"
  ]),
  testTexts: Schema.array(
    Schema.string().description('测试文本')
  ).description('测试文本列表').default([
    "一写就全对 老师上课讲了什么?忘了~",
    "随便走一走就是远古残骸 永远找不到木头~",
    "一写就AK 容易WA",
    "刷到宝藏视频 都是垃圾广告",
    "吃到的都是神仙美味 比垃圾还难吃",
    "非常有趣 听不懂思密达",
    "以泼墨就是世界名画 我手怎么失灵了",
    "大佬很看重你 你会被他嘲讽",
    "躺着赚钱 排名跌落一千多",
    "好好睡觉补身体 容易做噩梦",
    "随便一发被人夸 会被当做卖面膜的"
  ]),
  fortressInitTime: Schema.string()
    .description('跨服要塞初始化时间 (格式: YYYY-MM-DD)')
    .default('2025-6-7')
    .required(),
});

declare module "koishi" {
  interface Tables {
    schedule: Schedule;
  }
}

export interface Schedule {
  id: number;
  user: string;
  rnum: number;
  time: string;
  res: string;
  dateTime: Date;
  fortune: string;
  testList: string;
}

function random(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getTodayDateString(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toLocaleString();
}

// 计算跨服要塞相关信息的函数
function calculateFortressInfo(initTime: string) {
  const initDate = new Date(initTime);
  const now = new Date();

  // 计算从初始化时间到现在的总周数
  const diffTime = now.getTime() - initDate.getTime();
  const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));

  // 计算当前是第几轮 (每5周一轮)
  const currentRound = Math.floor(diffWeeks / 5);
  const weekInRound = diffWeeks % 5;

  // 判断下周是否是跨服要塞周
  const isNextWeekCrossServer = weekInRound === 4;
  // 计算上次跨服要塞时间
  let lastCrossServerTime: Date | null = null;
  lastCrossServerTime = new Date(initDate);
  lastCrossServerTime.setDate(initDate.getDate() + (currentRound-1) * 7 * 5);
  if(currentRound<=0){
    lastCrossServerTime = null;
  }
  return {
    isNextWeekCrossServer,
    lastCrossServerTime,
    currentRound,
    weekInRound: weekInRound +1, // 转换为1-5的周数
  };
}

export function apply(ctx: Context, config: Config) {
  ctx.inject(['database'], (ctx => {
    ctx.model.extend("schedule", {
      id: "unsigned",
      user: "text",
      rnum: "unsigned",
      time: "text",
      res: "text",
      dateTime: "timestamp",
      fortune: "text",
      testList: "text",
    });

    function getFortuneResult(n: number): string {
      for (const level of config.fortuneLevels) {
        if (n >= level.min && n <= level.max) {
          return level.name;
        }
      }
      return config.fortuneLevels[config.fortuneLevels.length - 1].name;
    }

    function generateFortuneItems(): { good: string[], bad: string[] } {
      const good: string[] = [];
      const bad: string[] = [];
      const maxItems = random(2, 6);

      for (let i = 0; i < maxItems && (good.length < 2 || bad.length < 2); i++) {
        const item = config.activities[random(0, config.activities.length - 1)];
        const isGood = random(0, 1) === 1;

        if (isGood && good.length < 2 && !bad.includes(item)) {
          good.push(item);
        } else if (!isGood && bad.length < 2 && !good.includes(item)) {
          bad.push(item);
        }
      }

      return { good, bad };
    }

    ctx.command("signin").action(async ({ session }) => {
      const today = getTodayDateString();
      const data = await ctx.database.get("schedule", { time: [today] });

      const existingSignin = data.find(item => item.user === session.userId);
      if (existingSignin) {
        const [good, bad] = existingSignin.fortune.split("|");
        return [
          h.at(session.userId),
          `✨ 今日已签到 ✨`,
          `━━━━━━━━━━━━`,
          `今日运势：${existingSignin.res} (${existingSignin.rnum}点)`,
          `🌸 宜：${good.replace(/,/g, "、")}`,
          `🚫 忌：${bad.replace(/,/g, "、")}`,
          `📜 签语：${existingSignin.testList}`,
          `━━━━━━━━━━━━`,
          `(每日可签到一次)`
        ].join("\n");
      }

      const n = random(1, 100);
      const r = getFortuneResult(n);
      const test = config.testTexts[random(0, config.testTexts.length - 1)];
      const { good, bad } = generateFortuneItems();
      const fortune = `${good.join(",")}|${bad.join(",")}`;

      await ctx.database.upsert("schedule", [{
        user: session.userId,
        time: today,
        rnum: n,
        res: r,
        dateTime: new Date(),
        testList: test,
        fortune,
      }]);

      return [
        h.at(session.userId),
        `🎉 签到成功 🎉`,
        `━━━━━━━━━━━━`,
        `今日运势：${r} (${n}点)`,
        `🌸 宜：${good.join("、")}`,
        `🚫 忌：${bad.join("、")}`,
        `📜 签语：${test}`,
        `━━━━━━━━━━━━`,
        `(每日可签到一次)`
      ].join("\n");
    });

    ctx.command("getTotal").action(async ({ session }) => {
      const data = await ctx.database.get("schedule", { user: session.userId });
      const total: Record<string, number> = {};

      config.fortuneLevels.forEach(level => {
        total[level.name] = 0;
      });

      data.forEach(item => {
        if (total.hasOwnProperty(item.res)) {
          total[item.res]++;
        }
      });

      const totalText = Object.entries(total)
        .map(([name, count]) => `▸ ${name}：${count}次`)
        .join('\n');

      return [
        `📊 ${session.username} 的签到统计`,
        `━━━━━━━━━━━━`,
        `总签到次数：${data.length}次`,
        `━━━━━━━━━━━━`,
        totalText,
        `━━━━━━━━━━━━`
      ].join("\n");
    });

    ctx.command("getRecent").action(async ({ session }) => {
      const data = await ctx.database.get("schedule", { user: session.userId });
      const recent = data
        .sort((a, b) => b.id - a.id)
        .slice(0, 6)
        .map(item => `▸ ${item.time.split(" ")[0]}：${item.res}`)
        .join('\n');

      return [
        `📅 ${session.username} 的最近签到`,
        `━━━━━━━━━━━━`,
        recent,
        `━━━━━━━━━━━━`
      ].join("\n");
    });

    // 新增跨服要塞相关命令
    ctx.command("fortress")
      .alias("要塞")
      .action(() => {
        const fortressInfo = calculateFortressInfo(config.fortressInitTime);
        let response = [
          `🏰 跨服要塞信息 🏰`,
          `━━━━━━━━━━━━`,
        ];
        if (fortressInfo.isNextWeekCrossServer) {
          response.push(
            `🔥 本周六(20:00-20:30)抢是跨服要塞！`,
            `🚨 请务必准时参加抢跨服！`,
            `━━━━━━━━━━━━`,
          );
        } else {
          response.push(`本周是常规要塞战`,`━━━━━━━━━━━━`,);
        }

        response.push(
           `当前是第 ${fortressInfo.currentRound + 1} 轮的第 ${fortressInfo.weekInRound} 周`,
          `下周${fortressInfo.isNextWeekCrossServer ? '是' : '不是'}跨服要塞周`,
        )
        if (fortressInfo.lastCrossServerTime) {
          response.push(`上次跨服要塞时间: ${fortressInfo.lastCrossServerTime.toLocaleDateString()}`);
        } else {
          response.push(`上次跨服要塞时间: 暂无记录`);
        }

        response.push(
          `跨服要塞规则: 在四次常规的本服要塞战后，第五周周六20:00-20:30`,
          `初始化时间: ${config.fortressInitTime}`,
          `━━━━━━━━━━━━`
        );

        return response.join("\n");
      });

    // 单独查询下周是否是跨服要塞周
    ctx.command("fortress.next")
      .alias("下周要塞")
      .action(() => {
        const { isNextWeekCrossServer } = calculateFortressInfo(config.fortressInitTime);
        return `下周${isNextWeekCrossServer ? '是' : '不是'}跨服要塞周`;
      });

    // 单独查询上次跨服要塞时间
    ctx.command("fortress.last")
      .alias("上次要塞")
      .action(() => {
        const { lastCrossServerTime } = calculateFortressInfo(config.fortressInitTime);
        return lastCrossServerTime
          ? `上次跨服要塞时间: ${lastCrossServerTime.toLocaleDateString()}`
          : `暂无上次跨服要塞记录`;
      });
  }))
}
