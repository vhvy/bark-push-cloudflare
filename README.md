## BARK-PUSH-CF-PAGE


灵感来自：https://day.app/2018/06/bark-server-document/ ，看了作者的文章后我发现原来实现调用苹果的推送接口还是挺简单的，我不想维护 Docker ，于是打算找个免费的平台来实现 Bark Push Server。

本来打算使用 Vercel 的 Edge Function，因为它有香港的节点，速度比较快；但是写完之后才发现 Edge Function 内置的 fetch 不支持 http2，网上搜了一圈发现 Cloudflare 的 Worker 似乎是支持 http2 的。经过测试之后的确是支持 http2 的，但是本地测试环境不支持。

Bark 支持自定义推送图标，但 Worker 不能返回图片，而 Cloudflare Pages 支持集成 Worker，于是乎就用 Cloudflare Pages 完成了这个小工具。

### 如何使用

0. 在 Cloudflare Dashboard 中创建一个 `Workers KV`。

1. 克隆本项目到本地，修改`wrangler.jsonc`中`kv_namespaces[0]`的 ID 为上一步创建的`KV` ID。

2. 如果你准备绑定自己的域名，则跳过本步骤，进行下一步。
   + 修改修改`wrangler.jsonc`中`workers_dev`为 true, 这样可以使用 Cloudflare 提供的子域名。

3. 提交 commit && push。
   
4. 在 Cloudflare Workers 中选择`Create application`，通过`Continue with Github`创建项目。

5. 创建过程中的构建设置保持默认，选择 Deploy
    ![create-example](/examples/create-example.png)

6. 打开本地项目，复制 `.env.example` 为 `.env` 文件，并修改其中的内容
    + AUTH_KEY_ID： 见灵感来源文章
    + TEAM_ID:      同上
    + DEVICE_TOKEN： 从 iOS Bark App 中获取
    + VERIFY_TOKEN:  自行设置，调用接口时携带在 header 中鉴权用
    + PRIVATE_KEY： 填写 https://github.com/Finb/bark-server/releases 中`AuthKey_LH4T9V5U4R_5U8LBRXG3A.p8` 的内容。

7. 在项目根目录执行 `pnpm install`安装依赖，然后执行`pnpm run dev`, 此时会自动拉起浏览器进行给命令行工具`wrangler`的授权。
   
8. 授权完成后，在项目根目录执行`pnpm run set-env`，上传环境变量到项目中，上传完成后项目会自动触发重部署。
   
9.  如何调用：
    + 请求方法: GET
    + 请求路径: /api/push
    + 携带Url参数(不带*的为可选)
      + *name: App名称
      + *body: 通知正文
      + title: 副标题
      + icon: 自定义图标网络地址

![5](/examples/5.png)
![6](/examples/6.png)

8. 如何增加内置图标

将`png`格式的图片放到项目`/public/images/`文件夹下，并将图片名称加入`src/index.ts`中的`appIconMap`对象，然后推送到`Github`，`Cloudflare Workers`会自动触发部署。