import { Context, Schema, h, Random, Logger } from 'koishi'
import { pathToFileURL } from 'url'
import { resolve } from 'path'

import {} from "koishi-plugin-puppeteer";
import { Page } from "puppeteer-core";

import * as si from './signin';
import { Jrys } from './roll';
import { RollEvent, defaultEventJson } from './event'
import fs from 'fs'
import path from 'path'

export const name = 'jrys-fix'

export interface Config {
  imgUrl: string
  signExp: number[]
  signCoin: number[]
  levelSet: si.LevelInfo[]
  fortuneSet: si.FortuneInfo[]
  event: RollEvent[]
}

export const Config: Schema<Config> = Schema.object({
  imgUrl: Schema.string().role('link').description('随机横图api或者本地路径').required(),
  signExp: Schema.tuple([Number, Number]).description('签到获得经验范围').default([1, 100]),
  signCoin: Schema.tuple([Number, Number]).description('签到获得货币范围').default([1, 100]),
  
  levelSet: Schema.array(Schema.object({
    level: Schema.number().description('等级'),
    levelExp: Schema.number().description('等级最低经验'),
    levelName: Schema.string().description('等级名称'),
    levelColor: Schema.string().role('color').description('等级颜色'),
  })).role('table').default(si.defaultLevelInfo).description('签到经验等级设置，请按升序排列！！！'),

  fortuneSet: Schema.array(Schema.object({
    luck: Schema.number().description('每级最低运势'),
    desc: Schema.string().description('运势描述'),
  })).role('table').default(si.defaultFortuneInfo).description('运势值描述信息，请按升序排列！！！'),

  event: Schema.array(Schema.object({
    name: Schema.string(),
    good: Schema.string(),
    bad: Schema.string(),
  })).role('table')

})

export const inject = {
  "required":['database','puppeteer'],
}

const logger = new Logger('[JRYS]>> ');


export function apply(ctx: Context, config: Config) {
  // write your plugin here
  si.initDatabase(ctx);
  const signin = new si.Signin(ctx, config);
  const jrys = new Jrys();

  // add custom event to eventJson
  let eventJson: RollEvent[] = [];
  config.event.forEach(item => { eventJson.push(item) })
  defaultEventJson.forEach(item => { eventJson.push(item) })

  ctx.command("jrys", "今日运势")
  .userFields(['id', 'name'])
  .action(async ({session}) => {
    const date = new Date();
    
    let name: string;
    if (ctx.database) { name = session.username }
    if (!name) { name = session.author.name }
    name = name.length>12? name.substring(0,11)+'...':name;

    const sign = await signin.callSignin(ctx, session.user.id, name)
    if( sign.status === 1 ) { return '今天已经签到过了哦~' }

    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // 确保月份为两位数
    const day = date.getDate().toString().padStart(2, '0'); // 确保日期为两位数
    const luck = await jrys.getFortune(session.user.id); //运势值
    const luckInfo = signin.getFortuneInfo(luck, config.fortuneSet); // 运势描述
    const [gooddo1, gooddo2, baddo1, baddo2] = await jrys.getRandomObjects(eventJson, session.user.id); // 4*宜/不宜
    const hitokoto = await fetchHitokoto(); // 一言
    const greeting = signin.getGreeting(date.getHours()); // 问候
    const levelinfo = signin.getLevelInfo(sign.allExp, config.levelSet); //等级信息
    const percent = typeof levelinfo.nextExp == 'string' ? '100.000':(sign.allExp/levelinfo.nextExp*100).toFixed(3).toString();

    let bgUrl;
    if(config.imgUrl.match(/http(s)?:\/\/(.*)/gi)) {
      bgUrl = config.imgUrl;
    } else {
      bgUrl = pathToFileURL(resolve(__dirname, (config.imgUrl + Random.pick(await getFolderImg(config.imgUrl))))).href
    }

    const avatarUrl = session.platform == 'qq'? `http://q.qlogo.cn/qqapp/${session.bot.config.id}/${session.event.user?.id}/640`:session.author.avatar;
    const gooddo = `${gooddo1.name}——${gooddo1.good}<br>${gooddo2.name}——${gooddo2.good}`;
    const baddo = `${baddo1.name}——${baddo1.bad}<br>${baddo2.name}——${baddo2.bad}`;


    let page: Page;
    try {
      let templateHTML = fs.readFileSync(path.resolve(__dirname, "./index/template.txt"), "utf-8");

      let pageBody = `
<body id="body">
    <div class="container">

        <img style="width: 100%;" src="${bgUrl}" alt="Top Image">

        <div class="header">
            <img class="avatar" src="${avatarUrl}" alt="Avatar">
            <div class="dateInfo">
                <span class="greeting">${greeting}</span>
                <span style="color: #666666;">${month}/${day}</span>
            </div>
        </div>
        
        <div class="hitokoto">
            <p>${hitokoto}</p>
        </div>

        <div class="content">

            <p><strong>@${name}</strong> 签到成功！🫧+${sign.getExp} 🪙+${sign.getCoin}</p>

            <div class="levelInfo">
                <span style="color: ${levelinfo.levelInfo.levelColor};">${levelinfo.levelInfo.levelName}</span>
                <span style="color: #b4b1b1;">${sign.allExp}/${levelinfo.nextExp}</span>
            </div>

            <div class="level-bar">
                <div class="bar-container">
                    <div class="progress" style="width: calc(${percent}%);"></div>
                </div>
            </div>

            <div class="fortune">
                <span style="font-size: 36px; font-weight: bold;">🍀${luck}</span>
                <span style="font-size: 28px; color: #838383;">&#9775;${luckInfo}&#9775;</span>
            </div>
            
            <hr>

            <div class="toDo">
                <div class="toDoBg" style="background-color: #D4473D;"><span>宜</span></div>
                <p style="text-shadow: 0px 0px 1px #ffbbbb;">${gooddo}</p>
            </div>

            <div class="toDo">
                <div class="toDoBg" style="background-color: #000000;"><span>忌</span></div>
                <p style="text-shadow: 0px 0px 1px #bcdbff;">${baddo}</p>
            </div>
            
        </div>
        <div class="credit">
            随机生成 请勿迷信 | NyaKoishi © 2024
        </div>
    </div>
</body>

</html>`

      await fs.writeFileSync(path.resolve(__dirname, "./index/index.html"), templateHTML+pageBody);

      page = await ctx.puppeteer.page();
      await page.setViewport({ width: 600, height: 1080 * 2 });
      await page.goto(`file:///${resolve(__dirname, "./index/index.html")}`);
      await page.waitForSelector("#body");
      const element = await page.$("#body");
      let msg;
      if (element) {
        const imgBuf = await element.screenshot({
          encoding: "binary"
        });
        msg = h.image(imgBuf, 'image/png');
      } else {
        msg = "Failed to capture screenshot.";
      }
      // 关闭页面
      await page.close();
      // 返回消息
      return h.quote(session.event.message.id) + msg
    } catch (err) {
      logger.error(`[JRYS Error]:\r\n`+err);
      return '哪里出的问题！md跟你爆了'
    }
  })

}



async function getFolderImg(folder:string) {
  let imgfilename = await readFilenames(folder);
  const filteredArr = imgfilename.filter((filename) => {
    return /\.(png|jpg|jpeg|ico|svg)$/i.test(filename);
  });
  return filteredArr;
}

// 递归获取文件夹内所有文件的文件名
async function readFilenames(dirPath:string) {
  let filenames = [];
  const files = fs.readdirSync(dirPath);
  files.forEach((filename) => {
    const fullPath = path.join(dirPath, filename);
    if (fs.statSync(fullPath).isDirectory()) {
      filenames = filenames.concat(readFilenames(fullPath));
    } else {
      filenames.push(filename);
    }
  });
  return filenames;
}

async function fetchHitokoto() {
  try {
    const response = await fetch('https://v1.hitokoto.cn/?c=a&c&b&k');
    const { hitokoto: hitokotoText ,from: fromText ,from_who: fromWhoText	} = await response.json();
  
    let hitokoto
    if(fromWhoText != null) {
      hitokoto = `『${hitokotoText}』<br>——&nbsp;${fromWhoText}「${fromText}」`;
    } else {
      hitokoto = `『${hitokotoText}』<br>——「${fromText}」`;
    }

    return hitokoto;
  } catch (error) {
    console.error('获取 hitokoto 时出错:', error);
    return('无法获取 hitokoto');
  }
}
