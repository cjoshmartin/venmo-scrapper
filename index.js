const puppeteer = require('puppeteer');
const { utils } = require("./utils");
const admin = require("firebase-admin");

require('dotenv').config();

const _admin_data = JSON.parse(process.env.SERVICE_API_KEY)

const app = admin.initializeApp({
    credential: admin.credential.cert(_admin_data),
    databaseURL:process.env.DATABASE_URL
});
const db = admin.database()

exports.getPayments = async (req, res) => {
    getData(req, res)
};

const requested_information = {
    query: { },
}


const getData = async (req, res) => {
    const userData = req.query;
    const browser = await puppeteer.launch(
        {
            args: ['--no-sandbox'],
            //headless: false,
        },
    )

    const page = await browser.newPage()
    const funcs = await new utils(browser, page)

    await funcs.page.goto('https://venmo.com/account/sign-in/')

    const form = {
        username: 'input[name="phoneEmailUsername"]',
        password: 'input[name="password"]',
        submit: 'button[type="submit"]'
    }

    await funcs.login(
        process.env.USERNAME,
        process.env.PASSWORD,
        form
    )

    const clockActionSelector = 'p.link > a'
    await funcs.waitForSelector(clockActionSelector)
    await funcs.clickButton(clockActionSelector)

    const bankAccountSelector ='input[name="bankAccountNumber"]'
    await funcs.waitForSelector(bankAccountSelector)
    await page.type('input[name="bankAccountNumber"]', process.env.BANKING_NUMBER)
    await funcs.clickButton(form.submit)

    const notNowSelector ='button.mfa-button-do-not-remember'
    await funcs.waitForSelector(notNowSelector)
    await funcs.clickButton(notNowSelector)

    const feedSelector = 'div.feed-tabs'
    await funcs.waitForSelector(feedSelector)
    await funcs.page.goto('https://venmo.com/baby-yezzus')

    const paymentsSelector = 'div#profile_feed_container > .p_twenty_r'
    await funcs.waitForSelector(paymentsSelector)

    const  paymentsDiv = await page.evaluate((selector) => {
        const payments =  document.querySelectorAll(selector)
        const values = {
            users: {},
            payments: {},
        };

        payments.forEach( (el) => {

            const item = el.querySelector("tr")
            const name_pic_selector = item.querySelector("div.relative > a.bold")

            if (item.querySelector('span.green') !== null){
                const username = name_pic_selector.attributes[0].value.substring(1)
                const date_of_transaction = el.attributes[1].value;
                const amount = parseFloat((item.querySelector('span.green').innerText).substring(2))
                const message = el.querySelector('div[style="word-wrap:break-word"]').innerText
                const profile_picture = name_pic_selector.querySelector("img").attributes["src"].value

                if (values["users"][username] !== undefined){
                    values["users"][username]["total"] += amount
                    values["users"][username]["usage"].push(date_of_transaction)
                }
                else {
                    values["users"][username] = {
                        profile_picture,
                        total: amount,
                        usage: [date_of_transaction]
                    }
                }

                values["payments"][date_of_transaction] =  {
                    username,
                    amount,
                    message,
                }

            } // end of transaction
        }
        )
        return values
    }, paymentsSelector ) 

    console.log(JSON.stringify(paymentsDiv, ' ', 4))
    await funcs.closeBrowser()

    db.ref('/').update(paymentsDiv)
    app.delete();
    //res.set('Content-Type','application/json')
    //res.send(funcs.getStatus(userData.rate))
}

getData(requested_information, null);
