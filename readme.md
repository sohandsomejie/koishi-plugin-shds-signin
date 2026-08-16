# koishi-plugin-shds-signin

[![npm](https://img.shields.io/npm/v/koishi-plugin-shds-signin?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-shds-signin)

一个带每日运势、宜忌签语和历史统计的 Koishi 签到插件。

## 功能

- 每位用户每天只能签到一次，重复签到会返回当天原有结果
- 随机生成 1-100 点运势，并按配置映射为运势等级
- 随机生成两项“宜”和两项“忌”，事项不会重复
- 可独立启用“万事皆宜 / 诸事不宜”特殊结果
- 支持查看累计签到统计和最近六次签到记录
- 按平台隔离用户数据，日期统一使用 `Asia/Shanghai` 时区
- 使用数据库唯一索引避免并发请求产生重复签到

## 安装

可在 Koishi 控制台的插件市场中搜索 `shds-signin`，也可以通过包管理器安装：

```bash
yarn add koishi-plugin-shds-signin
```

插件依赖 Koishi 数据库服务。启用插件前，请先配置 SQLite、MySQL、PostgreSQL 等数据库插件。

## 命令

| 命令 | 说明 |
| --- | --- |
| `signin` | 完成今日签到或查看今日已有签到结果 |
| `getTotal` | 查看当前用户的累计签到次数和运势分布 |
| `getRecent` | 查看当前用户最近六次签到结果 |

## 配置

### `fortuneLevels`

运势等级与点数区间。所有区间必须完整覆盖 1-100，且不能重叠。

默认配置：

| 等级 | 点数 |
| --- | --- |
| 大吉 | 90-100 |
| 中吉 | 80-89 |
| 小吉 | 60-79 |
| 中平 | 40-59 |
| 小凶 | 20-39 |
| 中凶 | 10-19 |
| 大凶 | 0-9 |

### `fortuneItems`

用于生成“宜/忌”的普通事项，至少需要 4 项。事项之间使用空格、换行或 Tab 分隔，例如：

```text
早起 补觉 散步 出门 写代码 开黑 打瓦 打火影
```

单个事项中不能包含空白字符。需要停顿时可使用中文标点。

### `enableSpecialFortune`

是否启用“万事皆宜 / 诸事不宜”特殊结果，默认开启。

- 特殊项落在“宜”侧时，只显示“万事皆宜”
- 特殊项落在“忌”侧时，只显示“诸事不宜”
- 特殊结果触发后不会同时展示其他宜忌事项

### `fortuneTexts`

签到时随机抽取的签语列表。签语之间使用空格、换行或 Tab 分隔，例如：

```text
稳住自己的节奏，好结果正在靠近 少一点犹豫，多一点行动
```

单条签语中不能包含空白字符，建议使用中文逗号连接句子。

## 回复示例

```text
✅ 签到成功
🎲 今日运势：大吉 · 96 点
🌸 宜：散步、听歌
🚫 忌：熬夜、单排
📝 今日签语：稳住自己的节奏，好结果正在靠近
```

## 1.2.0 升级说明

- 配置项 `activities` 已更名为 `fortuneItems`
- 配置项 `testTexts` 已更名为 `fortuneTexts`
- 签到数据表由通用名称 `schedule` 更名为 `shds_signin`
- 旧配置和旧表数据不会自动迁移，升级前请自行备份并按需转换

## 开发

在 Koishi 工作区根目录执行：

```bash
yarn test:shds-signin
yarn build
```

## License

MIT
