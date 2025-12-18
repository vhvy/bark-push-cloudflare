import * as jose from "jose";

const KV_KEY = {
	TOKEN: "$TOKEN",
	CREATE_TIME: "$CREATE_TIME"
} as const;


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
	let token = await env.BARK_PUSH_KEY.get(KV_KEY.TOKEN);
	let create_time = await env.BARK_PUSH_KEY.get(KV_KEY.CREATE_TIME);

	const expire_time = 30 * 60 * 1000;

	if (token && create_time) {
		if (Number(create_time) + expire_time >= Date.now()) {
			return token;
		}
	}

	token = await generaterToken(env);

	await env.BARK_PUSH_KEY.put(KV_KEY.TOKEN, token);
	await env.BARK_PUSH_KEY.put(KV_KEY.CREATE_TIME, Date.now() + "");

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
} as const;

type AppNameKey = keyof typeof appIconMap;

function getIconPath(url: string, appName: string) {

	const lowcaseAppName = appName.toLowerCase() as AppNameKey;

	let iconName = appIconMap[lowcaseAppName] ? appIconMap[lowcaseAppName] : defaultIconName;

	return `${url}/images/${iconName}.png`;
}

const generateEmptyResponse = () => new Response(null, {
	status: 204
});

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const { pathname, origin, searchParams } = new URL(request.url);
		if (pathname !== "/api/push") return env.ASSETS.fetch(request);

		const VERIFY_TOKEN = request.headers.get("verify-token");
		const appName = searchParams.get("name")?.trim();
		const body = searchParams.get("body")?.trim();

		if (!appName || !body || env.VERIFY_TOKEN !== VERIFY_TOKEN) return generateEmptyResponse();

		const title = searchParams.get("title")?.trim();
		const icon = searchParams.get("icon")?.trim() || getIconPath(origin, appName);

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

		return generateEmptyResponse();
	},
} satisfies ExportedHandler<Env>;
