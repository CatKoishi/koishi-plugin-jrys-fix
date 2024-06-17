import { Context, Schema, Time, Random } from 'koishi'
import { } from "koishi-plugin-rate-limit"

declare module 'koishi' {
    interface Tables {
        jrys_max: Jrys_max;
    }
}

export interface Jrys_max {
    id: string
    name: string
    time: string
    point: number
    count: number
    current_point: number
    }

interface TimeGreeting {
    range: [number, number];
    message: string;
}

const timeGreetings: TimeGreeting[] = [
    { range: [ 0,  5], message: '晚安' },
    { range: [ 5, 11], message: '上午好' },
    { range: [11, 14], message: '中午好' },
    { range: [14, 18], message: '下午好' },
    { range: [18, 20], message: '傍晚好' },
    { range: [20, 24], message: '晚上好' },
];

interface LevelInfo {
    level: number;
    level_line: number;
}

export const levelInfos: LevelInfo[] = [
    { level: 1, level_line:      10000 },
    { level: 2, level_line:      15000 },
    { level: 3, level_line:      32000 },
    { level: 4, level_line:      76000 },
    { level: 5, level_line:     328000 },
    { level: 6, level_line:     676000 },
    { level: 7, level_line:    1372000 },
    { level: 8, level_line:    2944000 },
    { level: 9, level_line:    6088000 },
    { level:10, level_line:   12376000 },
    { level:11, level_line:   26752000 },
    { level:12, level_line:   55504000 },
    { level:13, level_line:  113008000 },
    { level:14, level_line:  246016000 },
    { level:15, level_line:  512032000 },
    { level:16, level_line: 1044064000 },
    { level:17, level_line: 2108128000 },
    { level:18, level_line: 4416256000 },
    { level:19, level_line: 9032512000 },
    { level:20, level_line:18265024000 },
];

export const inject = ['database']

// 参数: ctx:Context, config?:Config
export class Signin {
    public ctx:Context;
    public cfg:any;
    constructor(context:Context, config:any) {
    this.ctx = context;
    this.cfg = config;
    this.ctx.database.extend("jrys_max", {
        id: "string",
        name: "string",
        time: "string",
        point: "unsigned",
        count: "unsigned",
        current_point: "unsigned",
    })
    }

  //                  0:已签到, 1:签到成功, 2:未签到, 3:抽奖
  // { "status": 1, "getpoint": signpoint, "signTime": signTime, "allpoint": signpoint, "count": 1 };
  // 参数：session， 返回：json
    async callSignin(session) {
        let name:any;
        if (this.ctx.database && this.cfg.callme) name = session.username;
        if (!name && this.cfg.callme) name = session.author.name;
        else name = session.username;
        name = name.length>12? name.substring(0,12):name;

        let signTime =  Time.template('yyyy-MM-dd hh:mm:ss', new Date());
        let all_point = (await this.ctx.database.get('jrys_max', { id: String(session.userId) }))[0]?.point;
        let time = (await this.ctx.database.get('jrys_max', { id: String(session.userId) }))[0]?.time;
        let count = (await this.ctx.database.get('jrys_max', { id: String(session.userId) }))[0]?.count;
        let dbname = (await this.ctx.database.get('jrys_max', { id: String(session.userId) }))[0]?.name;
        let signpoint = Random.int(this.cfg.signpointmin,this.cfg.signpointmax);
        let nowPoint = (await this.ctx.database.get('jrys_max', { id: String(session.userId) }))[0]?.current_point;
        if (!dbname) await this.ctx.database.upsert('jrys_max', [{ id: (String(session.userId)), name: name }]);
        if (!all_point && !time) {
            await this.ctx.database.upsert('jrys_max', [{ id: (String(session.userId)), name: name, time: signTime, point: Number(signpoint), count: 1, current_point: Number(signpoint) }]);
            // logger.info(`${name}(${session.userId}) 第一次签到成功，写入数据库！`)
            return {
              "cmd":"get",
              "status": 1,
              "getpoint": signpoint,
              "signTime": signTime,
              "allpoint": signpoint,
              "count": 1 };
        }
        if (Number(time.slice(8,10)) - Number(signTime.slice(8,10))) {
            // 如果日期不同（即今天还没有签到）
            await this.ctx.database.upsert('jrys_max', [{
                id: String(session.userId),
                name: name,
                time: signTime,
                point: Number(all_point + signpoint),
                count: count + 1,
                current_point: Number(signpoint)
            }]);
            // 记录签到成功的信息
            return {
                // "cmd": "get",
                "status": 1, // 签到成功
                "getpoint": signpoint, // 本次签到获得的积分
                "signTime": signTime, // 当前签到时间
                "allpoint": all_point + signpoint, // 总积分
                "count": count + 1 // 签到次数
            };
        }
        // 如果日期相同（即今天已经签到过）
        return {
            // "cmd": "get",
            "status": 0, // 签到失败
            "getpoint": nowPoint, // 本次签到获得的积分
            "signTime": signTime, // 当前签到时间
            "allpoint": all_point, // 总积分
            "count": count // 签到次数
        };
    }

  // // 参数：session， 返回：json
  //   async signQuery(session) {
  //       let all_point = (await this.ctx.database.get('jrys_max', { id: String(session.userId) }))[0]?.point;
  //       let time = (await this.ctx.database.get('jrys_max', { id: String(session.userId) }))[0]?.time;
  //       let count = (await this.ctx.database.get('jrys_max', { id: String(session.userId) }))[0]?.count;
  //       let current_point = (await this.ctx.database.get('jrys_max', { id: String(session.userId) }))[0]?.current_point;
  //       let nowTime =  Time.template('yyyy-MM-dd hh:mm:ss', new Date());
  //       if (Number(time.slice(8,10)) - Number(nowTime.slice(8,10))) {
  //           return { "cmd":"query", "status": 2, "getpoint": current_point? current_point:0, "signTime": time? time:"暂无数据", "allpoint": all_point? all_point:0, "count": count? count:0 };
  //       }
  //       return { "cmd":"query", "status": 0, "getpoint": current_point? current_point:0, "signTime": time? time:"暂无数据", "allpoint": all_point? all_point:0, "count": count? count:0 };
  //   }

    levelJudge(all_point: number): LevelInfo {
            for (const levelInfo of levelInfos) {
            if (all_point <= levelInfo.level_line) {
                return levelInfo;
            }}
            return levelInfos[levelInfos.length - 1]; // Default to the last level
        }

    getGreeting(hour: number): string {
            const greeting = timeGreetings.find((timeGreeting) =>
                hour >= timeGreeting.range[0] && hour < timeGreeting.range[1]
            );

            return greeting ? greeting.message : '你好';
        }

    getLevelLine(all_point: number, levelInfos: LevelInfo[]): number {
            for (const levelInfo of levelInfos) {
                if (all_point <= levelInfo.level_line) {
                    return levelInfo.level_line;
                }
            }
            return levelInfos[levelInfos.length - 1].level_line; // 默认返回最后一个级别线
        }
}
