const puppeteer = require('puppeteer');
const { utils } = require("./utils");
const admin = require("firebase-admin");

require('dotenv').config();

const _admin_data = JSON.parse(process.env.SERVICE_API_KEY)

admin.initializeApp({
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
        }
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
        const values = {}
        payments.forEach((el)=>{
            const item = el.querySelector("tr")
            const name_pic_selector = item.querySelector("div.relative > a.bold")
            if (item.querySelector('span.green') !== null){
                const data = {
                    date: el.attributes[1].value,
                    name: (name_pic_selector.attributes[1].value).toLowerCase().replace(' ', '-'), 
                    img: name_pic_selector.querySelector("img").attributes["src"].value,
                    amount: parseFloat((item.querySelector('span.green').innerText).substring(2)), // need to make this only if it is `.green`
                    message: el.querySelector('div[style="word-wrap:break-word"]').innerText
                }
                if (values[data.name] !== undefined){
                    values[data.name].total += data.amount
                }
                else {
                    values[data.name] = {
                        profile_picture: data.img,
                        total: data.amount,
                        payments: {},
                    }
                }

                values[data.name].payments[data.date] =  { amount: data.amount, message: data.message }
            }
        })
        return values
    }, paymentsSelector ) 

    console.log(JSON.stringify(paymentsDiv, ' ', 4))
    db.ref('/').set(paymentsDiv)
    await funcs.closeBrowser()
    //res.set('Content-Type','application/json')
    //res.send(funcs.getStatus(userData.rate))
}

getData(requested_information, null);
