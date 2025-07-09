import express from 'express';
import axios from 'axios';
import { google } from 'googleapis';

import bodyParser from 'body-parser';
import { URLSearchParams } from 'url';

const app = express();
const port = 8080;

app.use(bodyParser.urlencoded({ extended: true }));

// AMO constants
const AMO_CLIENT_ID = '24fde476-f20b-4f32-a70a-954db7ee720f';
const AMO_CLIENT_SECRET = 'ASnHLkgZxDiBwJeYVtKT4BGHDNCHgyeCJfV4epzlk40QQr6HirfQEQh9eGcKy5yA';
const AMO_REDIRECT_URI = 'http://localhost:8080';
const AMO_SUBDOMAIN = 'ayjobtest';
const AMO_AUTHORIZATION_CODE = 'def50200aaeb678804a892657c3137791c07e90fd61ad3ea274880ca869b8f781321d6bf600d77281a6c12e6ac66ad7bc37572b208c0a275e5b7783893d99bc16f517c37c0dc221bcdf37139e54ebf15d7574a620e242357ebfb5c0e5bbc1d28ee9f0a448cf84ddf296741a909355c5028f8a1224f5de6c4e5eb784f77aa220f702e7ca4aff44f822edc69e1ad9590768bb0ec64bac69459d9f202a8dd0190f6ebb5e46bc67767d41fd082a6de83306646dea11ca996b41d14368a19b912a84fcda5d51c37982a532435cee9ad5de25a1f7c8d9c7cdc862eef496df425124aa8de554a477a9ea505f662d27e9cbff58ed75493de8a30540f197ed73aaf5eb455c2f428520683aecb1ca634bd73c2db85c42c964782f8f146ee20ec7d6639500c1230c5f4080e2cd92a95987bc16a362972208411e94cd34b5e29cb6c12f62c83d8a85c45becfef81ca8edf8ba485939ea9fa323fde4b2bc7b74421ee736911cc6aa68c39aece561ad25f444583c36b2d8257475092abc18a93876741baa7920d757d742035e0084d55fa703680ccf8b1ed3943379371ce94da9bf2decf3b842877931a7413378d78c073984ce3073c3bf906d65459c1cdb847dd0fa5a75aa6271cab704abcb1c4a950cfd6f1da0e8c0e1f6bf3aa2bd636d9ad4ee84e222ae59c35f2bc0c2d83';

let ACCESS_TOKEN = '';
let REFRESH_TOKEN = '';

const { accessToken, refreshToken } = await getAccessToken(AMO_AUTHORIZATION_CODE);

ACCESS_TOKEN = accessToken;
REFRESH_TOKEN = refreshToken;

// Receive access and refresh tokens
async function getAccessToken(AMO_AUTHORIZATION_CODE) {
	try {
		const params = new URLSearchParams();
		params.append('client_id', AMO_CLIENT_ID);
		params.append('client_secret', AMO_CLIENT_SECRET);
		params.append('grant_type', 'authorization_code');
		params.append('code', AMO_AUTHORIZATION_CODE);
		params.append('redirect_uri', AMO_REDIRECT_URI);

		const response = await axios.post(`https://${AMO_SUBDOMAIN}.amocrm.ru/oauth2/access_token`, params, {
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			}
		});

		const accessToken = response.data.access_token;
		const refreshToken = response.data.refresh_token;

		// console.info('Токен доступа:', accessToken);
		// console.info('Токен обновления:', refreshToken);
		return { accessToken, refreshToken };
	} catch (error) {
		console.error('Ошибка при получении токена:', error.response ? error.response.data : error.message);

		return null;
	}
}

// Update access and refresh tokens
async function refreshAccessToken(refreshToken) {
	try {
		const params = new URLSearchParams();
		params.append('client_id', AMO_CLIENT_ID);
		params.append('client_secret', AMO_CLIENT_SECRET);
		params.append('grant_type', 'refresh_token');
		params.append('refresh_token', refreshToken);
		params.append('redirect_uri', AMO_REDIRECT_URI);

		const response = await axios.post(`https://${AMO_SUBDOMAIN}.amocrm.ru/oauth2/access_token`, params, {
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			}
		});

		const accessToken = response.data.access_token;
		const newRefreshToken = response.data.refresh_token;

		// console.info('Обновленный токен доступа:', accessToken);
		// console.info('Обновленный токен обновления:', newRefreshToken);
		return { accessToken, newRefreshToken };
	} catch (error) {
		console.error('Ошибка при обновлении токена:', error.response ? error.response.data : error.message);

		return null;
	}
}


// Update lead
async function updateLead(accessToken, lead) {
	try {
		const response = await axios.patch(`https://${AMO_SUBDOMAIN}.amocrm.ru/api/v4/leads/${lead.id}`,
			{
			'price': lead.price
			},
			{
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json'
				}
		});
		console.info('Обновлённая сделка:', response.data);

		return response.data.id;
	} catch (error) {
		console.error('Ошибка при изменении сделки:', error.response ? error.response.data : error.message);

		return null;
	}
}

async function amoApi(accessToken, refreshToken, lead) {
	const res = await updateLead(accessToken, lead);

	if (!res) {
		const { accessToken, newRefreshToken } = await refreshAccessToken(refreshToken);

		ACCESS_TOKEN = accessToken;
		REFRESH_TOKEN = newRefreshToken;

		await updateLead(accessToken, lead);
	}
}

const GOOGLE_KEY_FILE = 'google_file.json';
const GOOGLE_SHEET_ID = '14bCkIiH1UkqVPU66b2zsS5DwN6SzeDtXEgzDPAO-2GI';
const STATUS_LEAD_SUCCESSFUL = 142;
const STATUS_LEAD_INITIAL = 78104390;

app.post('', (req, res) => {
	const payload = req.body;

	if (req.body.sheetName) {
		googleSheetsFunc(GOOGLE_KEY_FILE, GOOGLE_SHEET_ID, { values: `Сделки!A${+payload.row}:A${+payload.row}` }, (res) => {
			const leadId = res.data.values?.[0][0];
			const leadPrice = +payload.values.slice(2, -2);

			amoApi(ACCESS_TOKEN, REFRESH_TOKEN, {
				id: leadId,
				price: leadPrice
			});
		});
	} else if (payload.leads.add) {
		const newLead = payload.leads.add[0];

		googleSheetsFunc(GOOGLE_KEY_FILE, GOOGLE_SHEET_ID, { append: 'Сделки', 
			change: [
				[
					newLead.id,
					convertDate(newLead.date_create),
					newLead.custom_fields[0].values[0].value,
					newLead.custom_fields[1].values[0].value,
					newLead.custom_fields[2].values[0].value,
					newLead.responsible_user_id,
					newLead.price,
					+newLead.status_id === STATUS_LEAD_SUCCESSFUL ? 'Успешно реализовано'
						: +newLead.status_id === STATUS_LEAD_INITIAL ? 'Первичный контакт'
						: 'Неизвестный статус'
				]
			]}, (data) => {
				if (data.status === 200) {
					console.info('Сделка успешно сохранена');
				} else {
					console.info('Что то пошло не так');
				}
		})
	} else {
		const updateLead = payload.leads.status[0];
		let valueRange = 0;

		googleSheetsFunc(GOOGLE_KEY_FILE, GOOGLE_SHEET_ID, { values: 'Сделки!A:A' }, (res) => {
			res.data.values.forEach((el, index) => {
				if (el[0] === updateLead.id) {
					return valueRange = index + 1;
				}
			});

			if (valueRange) {
				googleSheetsFunc(GOOGLE_KEY_FILE, GOOGLE_SHEET_ID, { update: `Сделки!A${valueRange}:H${valueRange}`,
					change: [
						[
							updateLead.id,
							convertDate(updateLead.date_create),
							updateLead.custom_fields[0].values[0].value,
							updateLead.custom_fields[1].values[0].value,
							updateLead.custom_fields[2].values[0].value,
							updateLead.responsible_user_id,
							updateLead.price,
							+updateLead.status_id === STATUS_LEAD_SUCCESSFUL ? 'Успешно реализовано'
								: +updateLead.status_id === STATUS_LEAD_INITIAL ? 'Первичный контакт'
								: 'Неизвестный статус'
						]
					]}, (data) => {
						if (data.status === 200) {
							console.info('Статус сделки обновлён');
						} else {
							console.info('Что то пошло не так');
						}
				})
			}
		})
	}

	res.status(200).send('Webhook received successfully!');
});

function googleSheetsFunc(file, sheetId, keyMass, fun) {
	const auth = new google.auth.GoogleAuth({
		keyFile: file,
		scopes: 'https://www.googleapis.com/auth/spreadsheets',
	});

	(async () => {
		const client = await auth.getClient();

		const googleSheets = google.sheets({ version: 'v4', auth: client });

		const spreadsheetId = sheetId;

		const metaData = await googleSheets.spreadsheets.get({
			auth,
			spreadsheetId,
		});

		const data = {
			auth,
			spreadsheetId,
			valueInputOption: 'USER_ENTERED',
			resource: {
				values: keyMass.change,
			},
		}

		if(keyMass.append) {
			data['range'] = keyMass.append;

			const append = await googleSheets.spreadsheets.values.append(data);

			fun(append);
		} else if(keyMass.values) {
			data['range'] = keyMass.values;

			delete data.valueInputOption; delete data.resource;

			const values = await googleSheets.spreadsheets.values.get(data);

			fun(values); 
		} else if(keyMass.update) {
			data['range'] = keyMass.update;

			const update = await googleSheets.spreadsheets.values.update(data);

			fun(update);
		}
	})();
}

function convertDate(date) {
	const leadCreate = new Date(+date);
	const day = leadCreate.getDate();
	const month = leadCreate.getMonth() + 1;
	const year = leadCreate.getFullYear();

	return `${day}.${month}.${year}`;
}

app.listen(port, () => {
	console.info(`Webhook listener app listening at http://localhost:${port}`);
});
