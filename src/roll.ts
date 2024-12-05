// 获取每日运势值，随机4个黄历对象

export class Jrys {
  constructor() {}

  seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  // 获取随机运势，范围默认0-100，同一天中运势相同
  async getFortune(uid: number, maxRange: number = 100 ): Promise<number> {
    // get today time seed
    const etime = new Date().setHours(0,0,0,0);
    let userId = Number(uid);

    const todaySeed = (userId * etime) % 1000000001;
    const todayJrys = Math.floor(this.seededRandom(todaySeed) * maxRange);

    return todayJrys;
  }

  // 抽取四个宜不宜
  async getRandomObjects(jsonObject: Array<any>, uid: number): Promise<Array<any>> {
    if (!Array.isArray(jsonObject) || jsonObject.length < 4) {
      throw new Error("输入必须是一个包含至少四个对象的数组");
    }

    const seed = await this.getFortune(uid);
    const randomIndexes: Set<number> = new Set();

    let counter = 0;
    while (randomIndexes.size < 4) {
      const randomIndex = Math.floor(this.seededRandom(seed + counter) * jsonObject.length);
      randomIndexes.add(randomIndex);
      counter++;
    }

    return Array.from(randomIndexes).map(index => jsonObject[index]);
  }

  async random(min: number, max: number, luck: number = 50): Promise<number>  {
    let mmin = min;
    let mmax = max;
    if(max < min) {
      mmin = max;
      mmax = min;
    }
    return Math.round(Math.random()*(mmax-mmin)+mmin);
  }
}
