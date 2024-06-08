// import { jrysJson } from './jrys'
import {eventJson} from './event'
import crypto from 'crypto'
import * as fs from 'fs';
import path from 'path'

export class jrysmax {
    constructor() {}
    async getJrys(uid:string|number, debug?: boolean) {
        const md5 = crypto.createHash('md5');
        const hash = crypto.createHash('sha256');
        let etime = new Date().setHours(0, 0, 0, 0);
        let userId:any;
        if (!isNaN(Number(uid))) {
            userId = uid;
        } else {
            if (uid) {
            hash.update(uid + String(etime));
            let hashhexDigest = hash.digest('hex');
            userId = Number(parseInt(hashhexDigest, 16)) % 1000000001;
            }
            else {
            md5.update("Default Jrys"+String(etime));
            let hexDigest = md5.digest('hex');
            userId = parseInt(hexDigest, 16) % 1000000001;
            }
        }
        let todayJrys = (((etime/100000) * userId % 1000001) * 2333) % 512;
        if(debug)
            return {"jrys": todayJrys, "etime": (etime/100000) }
        else
            return todayJrys;
    }

    async generateUserRandom(uid: string | number): Promise<number> {
        const md5 = crypto.createHash('md5');
        const hash = crypto.createHash('sha256');
        let etime = new Date().setHours(0, 0, 0, 0);
        let userId;

        if (!isNaN(Number(uid))) {
            userId = uid;
        } else {
            if (uid) {
                hash.update(uid + String(etime));
                let hashhexDigest = hash.digest('hex');
                userId = Number(parseInt(hashhexDigest, 16)) % 1000000001;
            } else {
                md5.update("Default Jrys" + String(etime));
                let hexDigest = md5.digest('hex');
                userId = parseInt(hexDigest, 16) % 1000000001;
            }
        }

        let todayJrys = (((etime / 100000) * userId % 1000001) * 2333) % 512;
        return todayJrys;
    }

    async getRandomObjects(jsonObject: Array<any>, uid: string | number): Promise<Array<any>> {
        // if (!Array.isArray(jsonObject) || jsonObject.length < 4) {
        //     throw new Error("输入必须是一个包含至少四个对象的数组");
        // }
        const seed = await this.generateUserRandom(uid);
        const randomIndexes: Set<number> = new Set();

        while (randomIndexes.size < 4) {
            const randomIndex = Math.floor(((seed * randomIndexes.size) % 2333) % jsonObject.length);
            randomIndexes.add(randomIndex);
        }
        
        return Array.from(randomIndexes).map(index => jsonObject[index]);
    
    }
    

    async getFolderImg(folder:String) {
        let imgfilename:any = this.readFilenames(folder);
        const filteredArr = imgfilename.filter((filename) => {
        return /\.(png|jpg|jpeg|ico|svg)$/i.test(filename);
        });
        return filteredArr;
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