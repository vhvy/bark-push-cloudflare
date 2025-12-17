import * as jose from "jose";

interface Env {
    PUSH_KV: KVNamespace,
    TEAM_ID: string,
    AUTH_KEY_ID: string,
    DEVICE_TOKEN: string,
    PRIVATE_KEY: string,
    VERIFY_TOKEN: string
}

enum KV_KEY {
    TOKEN = "$TOKEN",
    CREATE_TIME = "$CREATE_TIME"
}

async function generaterToken(env: Env): Promise<string> {
    const timestamp = Math.floor(Date.now() / 1000);

    const ALG = "ES256";

    const secret = await jose.importPKCS8(env.PRIVATE_KEY, ALG);

    return new jose.SignJWT({})
        .setProtectedHeader({
            alg: ALG,
            kid: env.AUTH_KEY_ID
        })
        .setIssuer(env.TEAM_ID)
        .setIssuedAt(timestamp)
        .sign(secret);
}

async function getToken(env: Env): Promise<string> {
    let token = await env.PUSH_KV.get(KV_KEY.TOKEN);
    let create_time = await env.PUSH_KV.get(KV_KEY.CREATE_TIME);

    const expire_time = 30 * 60 * 1000;

    if (token && create_time) {
        if (Number(create_time) + expire_time >= Date.now()) {
            return token;
        }
    }

    token = await generaterToken(env);

    await env.PUSH_KV.put(KV_KEY.TOKEN, token);
    await env.PUSH_KV.put(KV_KEY.CREATE_TIME, Date.now() + "");

    return token;
}



const defaultIconName = "jinx";
const appIconMap = {
    wechat: "wechat",
    message: "message",
    weixin: "wechat",
    微信: "wechat",
    短信: "message",
    mikrotik: "mikrotik"
};

function getIconPath(url: string, appName: string) {

    appName = appName.toLowerCase();

    let iconName = appIconMap[appName] ? appIconMap[appName] : defaultIconName;

    return `${url}/assets/${iconName}.png`;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
    const { origin, searchParams } = new URL(request.url);

    const VERIFY_TOKEN = request.headers.get("verify-token");

    let appName = searchParams.get("name")?.trim();
    let body = searchParams.get("body")?.trim();
    let title = searchParams.get("title")?.trim();
    let icon = searchParams.get("icon")?.trim();

    if (appName && body && env.VERIFY_TOKEN === VERIFY_TOKEN) {
        if (!icon) {
            icon = getIconPath(origin, appName);
        }

        const token = await getToken(env);

        const DEVICE_TOKEN_LIST = env.DEVICE_TOKEN.split(",");

        const sendTitle = title ? appName + ":" + title : appName;

        const pushBody = {
            "aps": {
                "mutable-content": 1,
                "alert": {
                    "title": sendTitle,
                    "body": body
                },
                "category": "myNotificationCategory",
                "sound": "bingbong.aiff"
            },
            "icon": icon
        };

        if (DEVICE_TOKEN_LIST.length) {
            const tasks = DEVICE_TOKEN_LIST.map(DEVICE_TOKEN => {
                return fetch("https://api.push.apple.com/3/device/" + DEVICE_TOKEN, {
                    method: "POST",
                    headers: {
                        "apns-topic": "me.fin.bark",
                        "apns-push-type": "alert",
                        "authorization": "bearer " + token
                    },
                    body: JSON.stringify(pushBody)
                });
            });

            await Promise.all(tasks);
        }
    }

    return new Response(null, {
        status: 204
    });
}