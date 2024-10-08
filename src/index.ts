import { Context, Schema } from "koishi";
import { h } from "koishi";
export const name = "shds-signin";

export interface Config {}

export const Config: Schema<Config> = Schema.object({});
declare module "koishi" {
  interface Tables {
    schedule: Schedule;
  }
}

// 这里是新增表的接口类型
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
let signinList = [
  "睡觉",
  "躺平",
  "上厕所",
  "玩手机",
  "逛街",
  "出门",
  "玩mc",
  "打瓦",
  "万事皆宜",
  "Coding",
  "刷视频",
  "吃东西",
  "发朋友圈",
  "画画",
];
let testList =
  "一写就全对 老师上课讲了什么?忘了~,随便走一走就是远古残骸 永远找不到木头~,一写就AK 容易WA,刷到宝藏视频 都是垃圾广告,吃到的都是神仙美味 比垃圾还难吃,非常有趣 听不懂思密达,以泼墨就是世界名画 我手怎么失灵了,大佬很看重你 你会被他嘲讽,躺着赚钱 排名跌落一千多,好好睡觉补身体 容易做噩梦,随便一发被人夸 会被当做卖面膜的".split(
    ","
  );

export function apply(ctx: Context) {
  ctx.model.extend("schedule", {
    // 各字段的类型声明
    id: "unsigned",
    user: "text",
    rnum: "unsigned",
    time: "text",
    res: "text",
    dateTime: "timestamp",
    fortune: "text",
    testList: "text",
  });
  ctx.command("signin").action(async (e) => {
    console.log(
      new Date(new Date().toLocaleString().split(" ")[0]).toLocaleString()
    );
    const data = await ctx.database.get("schedule", {
      time: [new Date().toLocaleString().split(" ")[0]],
    });
    if (data.length) {
      for (let i = 0; i < data.length; i++) {
        if (data[i].user === e.session.userId) {
          e.session.send(
            `<><at id="${e.session.userId}"/> 今天已经签过了! <br/> 运势为 ${
              data[i].res
            } <br/> 宜：${data[i].fortune.split("|")[0]} <br/> 忌：${
              data[i].fortune.split("|")[1]
            } <br/>  &&& ${data[i].testList} </>`
          );
          return;
        }
      }
    }
    const n = random(1, 100);
    let r = "";
    if (n > 90) {
      r = "大吉";
    } else if (n > 80) {
      r = "中吉";
    } else if (n > 60) {
      r = "小吉";
    } else if (n > 40) {
      r = "中平";
    } else if (n > 20) {
      r = "小凶";
    } else if (n > 10) {
      r = "中凶";
    } else {
      r = "大凶";
    }
    let test = testList[random(0, testList.length - 1)];
    let good = [];
    let bad = [];
    for (let i = 0; i < random(2, 6); i++) {
      if (random(0, 1) === 0) {
        if (bad.length >= 2) break;
        let itemB = signinList[random(0, signinList.length - 1)];
        if (!bad.includes(itemB) && !good.includes(itemB)) bad.push(itemB);
      } else {
        if (good.length >= 2) break;
        let itemG = signinList[random(0, signinList.length - 1)];
        if (!bad.includes(itemG) && !good.includes(itemG)) good.push(itemG);
      }
    }

    ctx.database.upsert("schedule", [
      {
        user: e.session.userId,
        time: new Date().toLocaleString().split(" ")[0],
        rnum: n,
        res: r,
        dateTime: new Date(),
        testList: test,
        fortune: good.join(",") + "|" + bad.join(","),
      },
    ]);
    e.session.send(
      `<><at id={userId}/> <br/> 运势为: ${r} <br/> 宜：${good.join(
        ","
      )} <br/> 忌：${bad.join(",")}<br/>  &&& <br/> ${test} </>`
    );
    return;
  });
}

function random(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
