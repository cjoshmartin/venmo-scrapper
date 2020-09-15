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

function promisedBasedSleep(milliseconds) {
    console.log(`sleeping for ${milliseconds}ms`);
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

const getData = async (req, res) => {

    const userData = req.query;
    const browser = await puppeteer.launch(
        {
            args: ['--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920x1080'],
            headless: true,
            slowMo: 10,
        },
    )

    const page = (await browser.pages())[0]
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
    
    promisedBasedSleep(3000)

    // Confirm using my card instead
    await funcs.waitForSelector(clockActionSelector)
    await funcs.clickButton(clockActionSelector)

    await promisedBasedSleep(1000)
    const bankAccountSelector ='input[name="cardNumber"]'
    await funcs.waitForSelector(bankAccountSelector)
    await page.type(bankAccountSelector, process.env.CARD_NUMBER)
    await promisedBasedSleep(1000)
    await page.type('input[name="expirationDate"]', process.env.CARD_NUMBER_EXP)
    await promisedBasedSleep(1000)
    await funcs.clickButton(form.submit)

    promisedBasedSleep(3000)

    const notNowSelector ='button.mfa-button-do-not-remember'
    await funcs.waitForSelector(notNowSelector)
    await funcs.clickButton(notNowSelector)

    const feedSelector = 'div.feed-tabs'
    await funcs.waitForSelector(feedSelector)
    await funcs.page.goto('https://venmo.com/baby-yezzus')

    const paymentsSelector = 'div#profile_feed_container > .p_twenty_r'
    await funcs.waitForSelector(paymentsSelector)

    const moreButtonSelector = ".moreButton"
    await funcs.waitForSelector(moreButtonSelector)

    await page.evaluate(async (selector) => {
        const sleep = (milliseconds) => {
            return new Promise(resolve => setTimeout(resolve, milliseconds))
        }
        await sleep(1000)
        while (document.querySelector(selector).innerText !== "No more payments"){
            console.log(document.querySelector(".moreButton").innerText)
            venmo.feed.loadMoreStories('profile_feed');    
            await sleep(1000)
        }
    }, moreButtonSelector)

    const refs = db.ref("/")
    const fir_data = await refs.once('value', (snapshot) => {}).then((data) => data.toJSON()); // I want a global var here
    const  paymentsDiv = await page.evaluate((selector, fir_data) => {
        const payments =  document.querySelectorAll(selector)
        const values =   (
            fir_data !== null 
            && fir_data !== undefined 
            && fir_data["payments"] !== null 
            && fir_data["payments"] !== undefined 
        ) 
            ? fir_data 
            : {
                "past-payment": [], 
                users: {},
                payments: {},
            };

        payments.forEach((el) => {

            const item = el.querySelector("tr")
            const name_pic_selector = item.querySelector("div.relative > a.bold")
            const date_of_transaction = el.attributes[1].value;
            const is_past_payments_empty = values["past-payments"] !== null && values["past-payments"] !== undefined 
            const payments_set = new Set(
                (
                    Array.isArray(values["past-payments"]) 
                    ? values["past-payments"] 
                    : Object.values(values["past-payments"])
                ) // end of tur
            ) // end of set

            const is_past_payment = is_past_payments_empty && payments_set.has(date_of_transaction) 

            if (is_past_payment) {
                return values;
            }	

            if (item.querySelector('span.green') !== null){
                const username = name_pic_selector.attributes[0].value.substring(1)
                const amount = parseFloat((item.querySelector('span.green').innerText).substring(2))
                const message = el.querySelector('div[style="word-wrap:break-word"]').innerText
                const profile_picture = name_pic_selector.querySelector("img").attributes["src"].value

                if (values["users"][username] !== undefined){
                    values["users"][username]["total"] += amount
                    values["users"][username]["usage"] = Object.values(values["users"][username]["usage"])
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
        } // end of ForEach
        ) // end of ForEach
        return values
    }, paymentsSelector, fir_data )  //end of ForEach

    console.log(JSON.stringify(paymentsDiv, ' ', 4))

    console.log("DONE SCRAPPING!")
    await funcs.closeBrowser()

    // db.ref('/').update(paymentsDiv)
    app.delete();
    return;
}

getData(requested_information, null);
