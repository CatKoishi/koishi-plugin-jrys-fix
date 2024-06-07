import { Context, Schema, h, Random, Logger  } from 'koishi'
import { pathToFileURL } from 'url'
import { resolve } from 'path'
import {} from "koishi-plugin-puppeteer";
import { Page } from "puppeteer-core";
import { Signin,levelInfos } from './signin';
import { jrysmax } from './jrysmax';
import fs from 'fs'
import path from 'path'


export const name = 'jrys-max'

export interface Config {
  // superuser: string[],
  imgurl: string,
  signpointmax: number,
  signpointmin: number,
  // lotteryOdds: number,
  // callme: boolean,
  // waittip: boolean,
}

export const Config: Schema<Config> = Schema.object({
  // superuser: Schema.array(String)
  // .description('超级用户id'),
  imgurl: Schema.string().role('link')
  .description('随机横图api'),
  signpointmin: Schema.number().default(1)
  .description('签到积分随机最小值'),
  signpointmax: Schema.number().default(100)
  .description('签到积分随机最大值'),
  // lotteryOdds: Schema.percent().default(0.6)
  // .description('抽奖指令中倍率的概率(默认0.6)'),
  // callme: Schema.boolean().default(false)
  // .description("启用callme(需要安装callme插件)"),
  // waittip: Schema.boolean().default(false)
  // .description("启用渲染提示"),
})

export const inject = ['database','puppeteer']

const logger = new Logger('[jrys-max]>> ');

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

async function fetchHitokoto(ctx: Context) {
  try {
      const response = await fetch('https://v1.hitokoto.cn/?c=a&c=c&c=d&c=b&c=k');
      const { hitokoto: hitokotoText , from: fromText} = await response.json();
      // const hitokoto = [
      //   `${hitokotoText}`,
      //   `\n——`,
      //   `${fromText}`
      // ]
      // return hitokoto;
      // return (hitokotoText+`\n——`+fromText);
      const hitokoto = `${hitokotoText}<br>  ——${fromText}`;
      return hitokoto;
  } catch (error) {
      console.error('An error occurred while fetching hitokoto:', error);
      return('Failed to fetch hitokoto');
  }
}

export function apply(ctx: Context, config: Config) {
  // write your plugin here
  const signin = new Signin(ctx, config);

  ctx.command("jrysmax", "今日运势")
  // .alias("签到")
  // .option('text','-t 纯文本输出')
  .userFields(['name'])
  .action(async ({session, options}) => {
    const jrys = new jrysmax();
    const date = new Date();
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // 确保月份为两位数
    const day = date.getDate().toString().padStart(2, '0'); // 确保日期为两位数
    const formattedDate = `${month}/${day}`;
    const jrysData:any = await jrys.getJrys(session.userId? session.userId:2333);

    // return await fetchHitokoto(ctx)
    let name:any;
    if (ctx.database){ 
      name = session.username
    }
    if (!name){ 
      name = session.author.name
    }
    // if (ctx.database && config.callme) name = session.username;
    // if (!name && config.callme) name = session.author.name;
    // else name = session.username;
    name = name.length>12? name.substring(0,12):name;
    
    let bgUrl;
    let etime = (new Date().getTime())%25565;
    let filePath = resolve(__dirname, "./index/defaultImg/").replaceAll("\\", '/');
    if (!config.imgurl) bgUrl = pathToFileURL(resolve(__dirname, filePath+"/"+(Random.pick(await getFolderImg(filePath))))).href;
    else if(config.imgurl.match(/http(s)?:\/\/(.*)/gi))  bgUrl = (config.imgurl.match(/^http(s)?:\/\/(.*)#e#$/gi))? config.imgurl.replace('#e#',etime.toString()) : config.imgurl;
    else bgUrl = pathToFileURL(resolve(__dirname, (config.imgurl + Random.pick(await getFolderImg(config.imgurl))))).href;

    // 数据结构 { "cmd":"get", "status": 1, "getpoint": signpoint, "signTime": signTime, "allpoint": signpoint, "count": 1 };
    const getSigninJson = await signin.callSignin(session);
    let lvline = signin.levelJudge(Number(getSigninJson.allpoint)).level_line;

    // if (options.text) return <><at id={session.userId} />{getSigninJson.status? "签到成功！" : "今天已经签到过啦！"},本次签到获得积分:{getSigninJson.getpoint}</>

    // if (config.waittip) await session.send("请稍等，正在渲染……");
    const hitokoto = await fetchHitokoto(ctx);
    const LevelLines = signin.getLevelLine(Number(getSigninJson.allpoint), levelInfos);
    // return `${LevelLines}`
    const allpoint = getSigninJson.allpoint;
    const allpoint_LevelLines = (`${allpoint}/${LevelLines}`).toString();
    let page: Page;
    try {
      let templateHTML = fs.readFileSync(path.resolve(__dirname, "./index/template.txt"), "utf-8");
      let template = templateHTML
      .replace("##todayExp##", getSigninJson.getpoint.toString())
      .replace("##totalExp##", getSigninJson.allpoint.toString())
      .replace("##level##", (signin.levelJudge(Number(getSigninJson.allpoint))).level.toString())
      .replace("##pointlevel##", allpoint_LevelLines) 
      .replace("##bgUrl##", bgUrl)
      .replace("##avatarUrl##", session.platform == 'qq'? `http://q.qlogo.cn/qqapp/${session.bot.config.id}/${session.event.user?.id}/640`:session.author.avatar)
      .replace("##signinText##", getSigninJson.status? "签到成功！" : "今天已经签到过了哦~")
      .replace("##date##", (formattedDate))
      .replace("##hello##", signin.getGreeting(date.getHours()))
      .replace("##user##", name)
      .replace("##persent##", (Number(getSigninJson.allpoint)/lvline*100).toFixed(3).toString())
      .replace("##signTxt##", hitokoto)
      .replace("##fortunate##", jrysData.fortuneSummary)
      .replace("##luckystar##", jrysData.luckyStar)

      await fs.writeFileSync(path.resolve(__dirname, "./index/index.html"), template);

      page = await ctx.puppeteer.page();
      await page.setViewport({ width: 600, height: 1080 * 2 });
      await page.goto(`file:///${resolve(__dirname, "./index/index.html")}`);
      await page.waitForSelector("#body");
      const element = await page.$("#body");
      return h.image(await element.screenshot({
              encoding: "binary"
            }), "image/png")
    } catch (err) {
      logger.error(`[jrysmax Error]:\r\n`+err);
      return '哪里出的问题！md跟你爆了'
    }
  })


}
