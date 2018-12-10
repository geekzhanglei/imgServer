const Koa = require('koa');
const router = require('koa-router')();
const serve = require('koa-static');
const path = require('path');
const fs = require('fs');
const koaBody = require('koa-body');

const app = new Koa();

// 支持post请求并设定上传文件大小
app.use(
    koaBody({
        multipart: true,
        formidable: {
            maxFileSize: 200 * 1024 * 1024 // 设置上传文件大小最大限制，默认2M
        }
    })
);
// log request URL:
app.use(async (ctx, next) => {
    console.log(`Process ${ctx.request.method} ${ctx.request.url}...`);
    await next();
});
// 启动静态服务器
console.log('启动静态服务器');
const staticFilePath = '/static/';
const serverPath = path.join(__dirname, staticFilePath);
app.use(serve(serverPath));
console.log(`静态资源地址${serverPath}`);

// post请求路由
router.post('/upload', async function (ctx, next) {
    if (!ctx.request.files.file.size) { // 如果文件不存在，终止
        return;
    }
    // 获取上传图片
    const result = await uploadFile(ctx, {
        fileType: 'img',
        path: serverPath
    });

    // 上传到七牛
    // const qiniu = await upToQiniu(imgPath, result.imgKey);
    // 上存到七牛之后 删除原来的缓存图片
    // removeTemImage(imgPath);
    ctx.response.body = {
        message: '上传成功',
        imgUrl: `${result.imgPath}`
    };
});

app.use(router.routes());

app.listen(8081);
console.log('listening on port 8081');

// 子函数
async function uploadFile(ctx, options) {
    const file = ctx.request.files.file; // 获取上传文件
    const fileType = options.fileType;
    const filePath = path.join(options.path, fileType);
    // 创建图片上传目录
    console.log(`创建文件上传目录${filePath}中...`);
    const confirm = mkdirsSync(filePath);
    if (!confirm) {
        return;
    }
    console.log('创建文件上传目录完成');
    console.log('开始上传...');
    // console.log(ctx.request.files.img)
    const reader = fs.createReadStream(file.path); // 创建可读流
    const newFileName = Rename(file.name);
    const newFilePath = path.join(filePath, newFileName);
    const upStream = fs.createWriteStream(newFilePath); // 创建可写流
    await reader.pipe(upStream); // 可读流通过管道写入可写流
    console.log('上传成功，图片本地地址是' + newFilePath);
    removeTemImage(file.path);
    const relativePath = path.join(fileType, newFileName);
    const servePath = path.join(ctx.request.header.host, relativePath);
    console.log(`线上地址是 http://${servePath},`);

    return {
        imgPath: `http://${servePath}`
    };
}

// 写入目录
const mkdirsSync = dirname => {
    if (fs.existsSync(dirname)) {
        return true;
    } else {
        if (mkdirsSync(path.dirname(dirname))) {
            fs.mkdirSync(dirname);
            return true;
        }
    }
    return false;
};

// 获取文件名后缀
function getSuffix(fileName) {
    return fileName.split('.').pop();
}

// 重命名
function Rename(fileName) {
    return (
        Math.random()
        .toString(16)
        .substr(2) +
        '.' +
        getSuffix(fileName)
    );
}
// 清理系统临时文件
function removeTemImage(path) {
    fs.unlink(path, err => {
        if (err) {
            throw err;
        }
    });
}
