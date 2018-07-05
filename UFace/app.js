const base64Img = require('base64-img');
const http = require('http');
const request = require('request-promise');
const linq = require('linq');
const querystring = require('querystring');

/**
 * 社区id
 * 一个社区就只要一个服务器中间件
 */
const commId = 20874;

/**
 * 该中间件所管人脸门口机厂商
 */
const type = 'UFace';

/**
 * 基础地址
 */
const path = 'http://www.airtu.me:3000';



/**
 * 服务器信息
 */
let service = [];

/**
 * 图片下发失败次数
 */
let isFalse = 0;


/**
 * 获取该社区所有设备信息
 */
function GetMachineInfo() {
    let data = Push(path + '/faceDoorMachine/machine/' + commId, null, 'GET');
    return data;
}



/**
* 图片转换成base64
* @param {String} url 图片地址
*/
function ImgToBase64(obj) {
    //console.log(obj)
    let newUrl = obj.url.replace('https', 'http').replace('AllWeb/', '');
    let data = base64Img.requestBase64(newUrl, function (err, res, body) {
        let base64Data = body.split('base64,')[1];
        obj.url = base64Data;
        AddImage(obj, '/face/create')
    });
}



/**
 * 推送接口
 * @param {OBJ} obj 
 */
function Push(url, obj, method) {
    var options = {
        url: url,
        method: method,
        body: obj,
    };
    return request(options);
}



/**
 * 拉取数据
 */
function Get() {
    let p = Push(path + '/userfacemq/' + commId, null, 'GET')
        .then(function (u) {
            var data = JSON.parse(u);
            if (data.Code == 200 && data.Data.length > 0) {
                data.Data.forEach(element => {
                    AddDoor(element)
                });
            }
        })
}



/**
 * 修改消息状态
 * @param {Number} id 消息id
 */
function UpdateMQStatus(id) {
    Push(path + '/userfacemq/update/' + id, null, 'GET')
        .then(function (u) {
            //console.log(u);
        })
}



/**
 * 循环门添加提娜佳用户
 * @param {Object} element 对象
 */
function AddDoor(element) {
    //console.log(element)
    element.doorIds.forEach(doorId => {
        let a = linq.from(service).firstOrDefault("x=>x.doorId=='" + doorId + "'");
        if (a != null) {
            // console.log(a,element);
            AddPeople(a, element)
            UpdateMQStatus(element._id);
        }
    });
}



/**
 * 添加人员
 * @param {Object} obj 数据
 */
function AddPeople(obja, objb) {
    let data = {
        pass: obja.pass.toString(),
        person: '{"id":"' + objb.userId + '","idcardNum":"","name":"' + objb.name + '"}'
    }
    request.post({ url: 'http://' + obja.ip + ':' + obja.port + '/person/create', form: data }).then(function (u) {
        ImgToBase64({
            ip: obja.ip,
            port: obja.port,
            pass: obja.pass.toString(),
            personId: objb.userId,
            faceId: objb.userId + 'FaceImg',
            url: objb.imageUrlPath,
            commName: obja.commName,
            doorName: obja.doorName
        })
    })
}



/**
 * 添加照片
 * @param {Object} obj 数据
 */
function AddImage(obj, status) {

    var contents = querystring.stringify({
        pass: obj.pass,
        personId: obj.personId,
        faceId: obj.faceId,
        imgBase64: obj.url
    });

    var options = {
        host: obj.ip,
        port: obj.port,
        path: status,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': contents.length
        }
    }

    var req = http.request(options, function (res) {
        res.setEncoding('utf8');
        res.on('data', function (data) {
            if (JSON.parse(data).success == false) {

                if (isFalse < 5) {
                    AddImage(obj, '/face/update')
                    isFalse++;
                } else {
                    console.log(data);
                    try {
                        let ddd = JSON.parse(data).msg.split("expDesc")[1].split(' ')[1];
                        console.log(ddd);
                    } catch (error) {
                        console.error(error);
                    }
                    let url = `${path}/userface/uploadimgpushstates/${obj.personId}?isBool=true&doorName=${querystring.escape(obj.doorName)}&commName=${querystring.escape(obj.commName)}`;
                    //console.log(url)
                    Push(url)
                }
            } else {
                let url = `${path}/userface/uploadimgpushstates/${obj.personId}?isBool=true&doorName=${querystring.escape(obj.doorName)}&commName=${querystring.escape(obj.commName)}`;
                //let url='http://www.airtu.me:3000/userface/uploadimgpushstates/11471?isBool=true&doorName=%E4%BA%91%E9%80%9A%E9%81%93&commName=%E4%BA%8C%E5%85%94%E5%AE%B6%E5%9B%AD';
                Push(url)
                //console.log(url)
                console.log({
                    userId: obj.personId,
                    faceId: obj.faceId,
                    time: new Date().toString()
                })
            }
        });
    });

    req.write(contents);
    req.end;
}



function Main() {
    GetMachineInfo().then(function (u) {
        service = [];
        let data = JSON.parse(u);
        data.Data.forEach(element => {
            let newData =
            {
                ip: element.ip,
                port: '8090',
                pass: '123456',
                doorId: element.doorId,
                doorName: element.doorName,
                commName: element.commName
            };
            service.push(newData);
        });
        Get();
    })
}


Main();

setInterval(() => {
    Main();
}, 3600000)


setInterval(() => {
    Main();
}, 10000)

