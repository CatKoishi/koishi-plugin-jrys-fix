import { Context, Schema, h, Random, Logger } from 'koishi'
import { pathToFileURL } from 'url'
import fs from 'fs'
import path from 'path'
import lunisolar from 'lunisolar'

import { } from "koishi-plugin-puppeteer";
import { Page } from "puppeteer-core";

import * as si from './signin';
import { Jrys } from './roll';
import { RollEvent, defaultEventJson } from './event'
import { Session } from 'inspector/promises'

export const name = 'jrys-fix'

// Query API

export interface Config {
  imgUrl: string
  posterType: 'picture' | 'markdown'
  signExp: number[]
  signCoin: number[]
  currency: string
  levelSet: si.LevelInfo[]
  fortuneSet: si.FortuneInfo[]
  event: RollEvent[]
}

export const Config: Schema<Config> = Schema.object({
  imgUrl: Schema.string().role('link').description('随机横图api或者本地路径').required(),
  posterType: Schema.union([
    Schema.const('picture').description('默认图片'),
    Schema.const('markdown').description('Markdown格式'),
  ]).default('picture'),
  signExp: Schema.tuple([Number, Number]).description('签到获得经验范围').default([1, 100]),
  currency: Schema.string().description('Monetary货币名称').default('coin'),
  signCoin: Schema.tuple([Number, Number]).description('签到获得货币范围').default([1, 100]),

  levelSet: Schema.array(Schema.object({
    level: Schema.number().description('等级'),
    levelExp: Schema.number().description('等级最低经验'),
    levelName: Schema.string().description('等级名称'),
    levelColor: Schema.string().role('color').description('等级颜色'),
  })).role('table').default(si.defaultLevelInfo).description('经验等级设置: 升序排列 | 最低等级经验必须为0'),

  fortuneSet: Schema.array(Schema.object({
    luck: Schema.number().description('每级最低运势'),
    desc: Schema.string().description('运势描述'),
  })).role('table').default(si.defaultFortuneInfo).description('运势值描述信息: 升序排列 | 运势取值0~100, 最低一级必须为0 | 描述信息最长14个中文字符'),

  event: Schema.array(Schema.object({
    name: Schema.string().description('事件名称'),
    good: Schema.string().description('好的结局'),
    bad: Schema.string().description('坏的结局'),
  })).role('table').default([{ name: '网购', good: '买到超值好物', bad: '会被坑' }]).description('自定义黄历事件')

})

export const inject = {
  "required": ['database', 'puppeteer', 'monetary'],
}

const logger = new Logger('[JRYS]>> ');

// Other constants
  const weekList = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

export function apply(ctx: Context, config: Config) {
  // write your plugin here
  si.initDatabase(ctx);
  const signin = new si.Signin(ctx, config);
  const jrys = new Jrys();

  // add custom event to eventJson
  let eventJson: RollEvent[] = [];
  defaultEventJson.forEach(item => { eventJson.push(item) })
  config.event.forEach(item => { eventJson.push(item) })

  // Update ImgUrl only when plugin reload
  let bgUrl: string | string[]
  if (config.imgUrl.match(/http(s)?:\/\/(.*)/gi)) {
    bgUrl = config.imgUrl
  } else {
    bgUrl = readFolderImg(config.imgUrl)
  }

  ctx.command("jrys", "今日运势")
    .userFields(['id', 'name'])
    .action(async ({ session }) => {
      const user = session?.user;
      const authorId = session?.author?.id;
      if (!user || !user.id || !authorId) {
        return '会话信息错误，无法签到';
      }

      let name: string = '';
      if (user.name) {
        name = `@${user.name}`;
      }
      name = name.length > 13 ? name.substring(0, 12) + '...' : name;

      const luck = await jrys.getFortune(user.id); //运势值
      const sign = await signin.callSignin(user.id, authorId, luck)
      if (sign.status === 1) { return '今天已经签到过了哦~' }

      const date = new Date()
      const lunard = lunisolar(date)
      
      const formatLunarDate = `${lunard.lunar.getMonthName()}${lunard.lunar.getDayName()}`

      const luckInfo = signin.getFortuneInfo(luck, config.fortuneSet); // 运势描述
      const [gooddo1, gooddo2, baddo1, baddo2] = await jrys.getRandomObjects(eventJson, user.id); // 4*宜/不宜
      let hitokoto = await fetchHitokoto(); // 一言
      const greeting = signin.getGreeting(date.getHours()); // 问候
      const levelinfo = signin.getLevelInfo(sign.allExp, config.levelSet); //等级信息
      const percent = typeof levelinfo.nextExp == 'string' ? '100.000' : (sign.allExp / levelinfo.nextExp * 100).toFixed(3).toString();

      if (config.posterType === 'markdown') {
        const markdown = `# <@${session.userId}> ${greeting}

### ${date.toLocaleDateString()} ${weekList[date.getDay()]} ${formatLunarDate} 

> ${hitokoto.replace(/<br>/g, '\n> ')}

* 签到成功🎉&nbsp;\`🫧↑ ${sign.allExp}/${levelinfo.nextExp}\`&nbsp;\`🪙↑ ${sign.getCoin}\`

* 等级⏫:&nbsp;\`「${levelinfo.levelInfo.levelName}」\`

### **运势🍀**:&nbsp;\`${luck} 🌠 ${luckInfo}\`

\`\`\`html
<🉑> ${gooddo1.name} —— ${gooddo1.good}
<🉑> ${gooddo2.name} —— ${gooddo2.good}

<🈲> ${baddo1.name} —— ${baddo1.bad}
<🈲> ${baddo2.name} —— ${baddo2.bad}
\`\`\`

---

随机生成 请勿迷信 | NyaKoishi © 2026
`
        sendMarkdown(session, markdown)

      } else if (config.posterType === 'picture') {

        // 获取头图地址
        let headerUri: string;
        if ( typeof bgUrl === 'string' ) { headerUri = bgUrl; }
        else { headerUri = Random.pick(bgUrl); }

        // 获取头像地址
        let avatarUrl: string | undefined = session.author.avatar;
        if (avatarUrl == undefined) { avatarUrl = 'avatar.png' };

        let page: Page;
        try {
          let templateHTML = fs.readFileSync(path.resolve(__dirname, "./index/template.txt"), "utf-8");

          let pageBody = `
<body id="body">
    <div class="container">

        <img style="width: 100%;" src="${headerUri}" alt="Top Image">

        <div class="header">
            <img class="avatar" src="${avatarUrl}" alt="Avatar">
            <div class="dateInfo">
                <span class="greeting">${greeting}</span>
                <span style="color: #666666;">${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}</span>
            </div>
        </div>
        
        <div class="hitokoto">
            <p>${hitokoto}</p>
        </div>

        <div class="content">

            <div class="signin"><strong>${name}</strong> 签到成功！🫧+${sign.getExp} 🪙+${sign.getCoin}</div>

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
                <span style="font-size: 28px; color: #838383;">🌠${luckInfo}</span>
            </div>
            
            <hr>

            <div class="toDo">
                <div class="toDoBg" style="background-color: #D4473D;"><span>宜</span></div>
                <p style="text-shadow: 0px 0px 1px #ffbbbb;">${gooddo1.name}——${gooddo1.good}<br>${gooddo2.name}——${gooddo2.good}</p>
            </div>

            <div class="toDo">
                <div class="toDoBg" style="background-color: #000000;"><span>忌</span></div>
                <p style="text-shadow: 0px 0px 1px #bcdbff;">${baddo1.name}——${baddo1.bad}<br>${baddo2.name}——${baddo2.bad}</p>
            </div>
            
        </div>
        <div class="credit">
            随机生成 请勿迷信 | NyaKoishi © 2026
        </div>
    </div>
</body>

</html>`

          await fs.writeFileSync(path.resolve(__dirname, "./index/index.html"), templateHTML + pageBody);

          page = await ctx.puppeteer.page();
          await page.setViewport({ width: 600, height: 1080 * 2 });
          await page.goto(`file:///${path.resolve(__dirname, "./index/index.html")}`);
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
          logger.error(`[JRYS Error]:\r\n` + err);
          return '哪里出的问题！md跟你爆了'
        }
      }
    })
}

// 递归获取文件夹内所有文件的文件名
function readFolderImg(dirPath: string) {
  let filenames:string[] = [];
  const files = fs.readdirSync(dirPath);
  for (const filename of files) {
    const fullPath = path.join(dirPath, filename);
    if (fs.statSync(fullPath).isDirectory()) {
      filenames = filenames.concat(readFolderImg(fullPath));
    } else {
      if(filename.match(/\.(png|jpg|jpeg|ico|svg|webp)$/i)) {
        filenames.push(pathToFileURL(path.resolve(__dirname, fullPath)).href);
      }
    }
  }
  return filenames;
}

async function fetchHitokoto() {
  try {
    const response = await fetch('https://v1.hitokoto.cn/?c=a&c&b&k');
    const { hitokoto: hitokotoText, from: fromText, from_who: fromWhoText } = await response.json();

    let hitokoto
    if (fromWhoText != null) {
      hitokoto = `『${hitokotoText}』<br>——&nbsp;${fromWhoText}「${fromText}」`;
    } else {
      hitokoto = `『${hitokotoText}』<br>——「${fromText}」`;
    }

    return hitokoto;
  } catch (error) {
    console.error('获取 hitokoto 时出错:', error);
    return ('无法获取 hitokoto');
  }
}

async function sendMarkdown(session: any, content: string) {
  if (session.platform !== "qq") {
    await session.send('当前会话不支持Markdown格式，请切换到支持Markdown的频道或使用图片海报模式');
    return;
  }
  try {
    if (session?.isDirect || false) {
      await session.bot.internal.sendPrivateMessage(session.channelId, {
        msg_id: session.messageId,
        msg_type: 2,
        markdown: {
          content
        }
      });
    } else {
      await session.bot.internal.sendMessage(session.channelId, {
        msg_id: session.messageId,
        msg_type: 2,
        markdown: {
          content
        }
      });
    }
  } catch (err) {
    logger.error(`[JRYS Error]:\r\n` + err)
    return `发送失败，请确认是否已开通原生 MD 权限`
  }
}
