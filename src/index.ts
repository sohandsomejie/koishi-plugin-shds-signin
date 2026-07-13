import { Context, Schema, h } from "koishi";

export const name = "shds-signin";

export interface Config {
  fortuneLevels: FortuneLevel[]
  activities: string[]
  testTexts: string[]
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

  }))
}
