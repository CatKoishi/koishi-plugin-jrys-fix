import { Context, Schema, h, Random, Logger  } from 'koishi'
import { pathToFileURL } from 'url'
import { resolve } from 'path'
import {} from "koishi-plugin-puppeteer";
import { Page } from "puppeteer-core";
import { Signin,levelInfos } from './signin';
import { jrysmax } from './jrysmax';
import {eventJson} from './event'
import fs from 'fs'
import path from 'path'


export const name = 'jrys-max'

export interface Config {
  // superuser: string[],
  imgurl: string,
  signpointmax: number,
  signpointmin: number,
  // textfont:string,
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
  // textfont: Schema.string().description("`请填写.ttf 字体文件的绝对路径`").default(path.join(__dirname, '/font/pixel.ttf')),
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
      const response = await fetch('https://v1.hitokoto.cn/?c=a&c&b&k');
      const { hitokoto: hitokotoText ,from: fromText ,from_who: fromWhoText	} = await response.json();
      // const hitokoto = [
      //   `${hitokotoText}`,
      //   `\n——`,
      //   `${fromText}`
      // ]
      // return hitokoto;
      // return (hitokotoText+`\n——`+fromText);
      let hitokoto
      if(fromWhoText !== null){
        hitokoto = `${hitokotoText}<br>  ——${fromWhoText} <br>⟪${fromText}⟫`;
      }else{
        hitokoto = `${hitokotoText}<br>  ——⟪${fromText}⟫`;
      }
      
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
    const [gooddo1, gooddo2, baddo1, baddo2] = await jrys.getRandomObjects(eventJson,session.userId? session.userId:2333);
    // console.log(constant1, constant2, constant3, constant4);
    // const userfortune = await jrys.getEvent(session.userId? session.userId:2333);
    // console.log(userfortune);
    // return
    // return jrysData
    // await session.send (jrysData)
    let jryslucky = jrysData
    let fortune_star = '';
    let fortune_text = '';
    if(jryslucky < 10){
      fortune_star = '☆'.repeat(12)
      fortune_text = '走平坦的路但会摔倒的程度'
    }else if (jryslucky < 42){
      fortune_star = '★'.repeat(1)+'☆'.repeat(11)
      fortune_text = '吃泡面偶尔没有调味包的程度'
    }else if (jryslucky < 86){
      fortune_star = '★'.repeat(2)+'☆'.repeat(10)
      fortune_text = '上厕所偶尔会忘记带纸的程度'
    }else if (jryslucky < 132){
      fortune_star = '★'.repeat(3)+'☆'.repeat(9)
      fortune_text = '上学/上班路上会堵车的程度'
    }else if (jryslucky < 178){
      fortune_star = '★'.repeat(4)+'☆'.repeat(8)
      fortune_text = '点外卖很晚才会送到的程度'
    }else if (jryslucky < 224){
      fortune_star = '★'.repeat(5)+'☆'.repeat(7)
      fortune_text = '点外卖会多给予赠品的程度'
    }else if (jryslucky < 270){
      fortune_star = '★'.repeat(6)+'☆'.repeat(6)
      fortune_text = '出门能捡到几枚硬币的程度'
    }else if (jryslucky < 316){
      fortune_star = '★'.repeat(7)+'☆'.repeat(5)
      fortune_text = '踩到香蕉皮不会滑倒的程度'
    }else if (jryslucky < 362){
      fortune_star = '★'.repeat(8)+'☆'.repeat(4)
      fortune_text = '玩滑梯能流畅滑到底的程度'
    }else if (jryslucky < 408){
      fortune_star = '★'.repeat(9)+'☆'.repeat(3)
      fortune_text = '晚上走森林不会迷路的程度'
    }else if (jryslucky < 454){
      fortune_star = '★'.repeat(10)+'☆'.repeat(2)
      fortune_text = '打游戏能够轻松过关的程度'
    }else if (jryslucky < 500){
      fortune_star = '★'.repeat(11)+'☆'.repeat(1)
      fortune_text = '在自习室能找到想要的位置的程度'
    }else{
      fortune_star = '★'.repeat(12)
      fortune_text = '天选之人'
    }
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
    let etime = (new Date().getTime()) % 25565;
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
    let level = (signin.levelJudge(Number(getSigninJson.allpoint))).level
    let LevelLines = signin.getLevelLine(Number(getSigninJson.allpoint), levelInfos);
    let levelname
    let color
    // return `${level}`
    if(level === 1){
      levelname = "群聊冒险者"
      color ="#838383"
    }else if(level === 2){
      levelname = "群聊冒险家"
      color ="#838383"
    }else if(level === 3){
      levelname = "开拓地冒险者"
      color ="#838383"
    }else if(level === 4){
      levelname = "开拓地冒险家"
      color ="#000000"
    }else if(level === 5){
      levelname = "火星开拓者"
      color ="#000000"
    }else if(level === 6){
      levelname = "火星科技"
      color ="#42bc05"
    }else if(level === 7){
      levelname = "言灵密语"
      color ="#42bc05"
    }else if(level === 8){
      levelname = "低声呢喃"
      color ="#42bc05"
    }else if(level === 9){
      levelname = "荒野的漫步者"
      color ="#2003da"
    }else if(level === 10){
      levelname = "言灵探索者"
      color ="#2003da"
    }else if(level === 11){
      levelname = "水系魔法师"
      color ="#2003da"
    }else if(level === 12){
      levelname = "水系魔导士"
      color ="#03a4da"
    }else if(level === 13){
      levelname = "绝望的呐喊"
      color ="#03a4da"
    }else if(level === 14){
      levelname = "疯狂嘶吼"
      color ="#9d03da"
    }else if(level === 15){
      levelname = "被缚的倒吊者"
      color ="#9d03da"
    }else if(level === 16){
      levelname = "崩毁世界之人"
      color ="#9d03da"
    }else if(level === 17){
      levelname = "命运眷顾者"
      color ="#f10171"
    }else if(level === 18){
      levelname = "背弃之绝望"
      color ="#f10171"
    }else if(level === 19){
      levelname = "誓约的守护者"
      color ="#c9b86d"
    }else if(level === 20){
      levelname = "天选之人"
      color ="#ffd000"
    }
    // return `${level}`
    // return `${levelname}`
    const textfont = path.join(__dirname, '/font/pixel.ttf').replace(/\\/g, '/');
    // return `${LevelLines}`
    const allpoint = getSigninJson.allpoint;
    const allpoint_LevelLines = (`${allpoint}/${LevelLines}`).toString();
    const gooddo = `${gooddo1.name}——${gooddo1.good}<br>${gooddo2.name}——${gooddo2.good}`;
    const baddo = `${baddo1.name}——${baddo1.bad}<br>${baddo2.name}——${baddo2.bad}`;
    let page: Page;
    try {
      let templateHTML = fs.readFileSync(path.resolve(__dirname, "./index/template.txt"), "utf-8");
      let template = templateHTML
      .replace("##textfont##", textfont)
      .replace("##todayExp##", getSigninJson.getpoint.toString())
      .replace("##totalExp##", getSigninJson.allpoint.toString())
      .replace("##jryslucky##", jryslucky)
      .replace("##level##", levelname)
      .replace("##color##", color)
      .replace("##pointlevel##", allpoint_LevelLines) 
      .replace("##bgUrl##", bgUrl)
      .replace("##avatarUrl##", session.platform == 'qq'? `http://q.qlogo.cn/qqapp/${session.bot.config.id}/${session.event.user?.id}/640`:session.author.avatar)
      .replace("##signinText##", getSigninJson.status? "签到成功！" : "今天已经签到过了哦~")
      .replace("##date##", (formattedDate))
      .replace("##hello##", signin.getGreeting(date.getHours()))
      .replace("##user##", name)
      .replace("##persent##", (Number(getSigninJson.allpoint)/lvline*100).toFixed(3).toString())
      .replace("##signTxt##", hitokoto)
      .replace("##fortunate##", fortune_text)
      .replace("##luckystar##", fortune_star)
      .replace("##gooddo##", gooddo)
      .replace("##baddo##", baddo)

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
