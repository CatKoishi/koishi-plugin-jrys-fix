// import { jrysJson } from './jrys'
import * as fs from 'fs';
import path from 'path'

function fnv1aHash(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

export class jrysmax {
    constructor() {}
  async getJrys(uid: string | number): Promise<number> {
    const etime = new Date().setHours(0, 0, 0, 0).toString();
    let userId: number;

    if (typeof uid === 'number' || !isNaN(Number(uid))) {
      userId = Number(uid);
    } else {
      if (uid) {
        const hashInput = uid + etime;
        userId = fnv1aHash(hashInput) % 1000000001;
      } else {
        const defaultInput = "Default Jrys" + etime;
        userId = fnv1aHash(defaultInput) % 1000000001;
      }
    }

    const todaySeed = (userId * parseInt(etime)) % 1000000001;
    const randomFactor = Math.sin(todaySeed) * 10000;
    const todayJrys = Math.floor((randomFactor - Math.floor(randomFactor)) * 512);

    return todayJrys;
  }

  seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  // 抽取四个宜不宜
  async getRandomObjects(jsonObject: Array<any>, uid: string | number): Promise<Array<any>> {
    if (!Array.isArray(jsonObject) || jsonObject.length < 4) {
      throw new Error("输入必须是一个包含至少四个对象的数组");
    }

    const seed = await this.getJrys(uid);
    const randomIndexes: Set<number> = new Set();

    let counter = 0;
    while (randomIndexes.size < 4) {
      const randomIndex = Math.floor(this.seededRandom(seed + counter) * jsonObject.length);
      randomIndexes.add(randomIndex);
      counter++;
    }

    return Array.from(randomIndexes).map(index => jsonObject[index]);
  }

    // 递归获取文件夹内所有文件的文件名
    async readFilenames(dirPath:any) {
        let filenames = [];
        const files = fs.readdirSync(dirPath);
        files.forEach((filename) => {
        const fullPath = path.join(dirPath, filename);
        if (fs.statSync(fullPath).isDirectory()) {
            filenames = filenames.concat(this.readFilenames(fullPath));
        } else {
            filenames.push(filename);
        }
        });
        return filenames;
    }
}
