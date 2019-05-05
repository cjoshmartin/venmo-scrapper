const fill_field = (selector, val) => { document.querySelector(selector).value = val }
const _clickButton = (selector) => { document.querySelector(selector).click() }

class utils {
    constructor(browser, page) {
        this.browser = browser;
        this.page = page;
    }
    async clickButton(field){
        await this.page.evaluate(_clickButton, field);
    }
    async login(username, password, form) {
        await this.page.type(form.username, username);
        await this.page.type(form.password, password);
        this.clickButton(form.submit);
    }
    async waitForSelector(selector) {
        await this.page.waitForSelector(selector)
            .then(() => console.log(`Saw '${selector}'`))
            .catch(this.closeBrowser)
    }
    async navigateTo(url){
        this.page.goto(url)
    }
    async closeBrowser() {
        await this.browser.close();
    }

    parseBool(val) {
        return val === true || val === "true"
    }
}

exports.utils = utils;
