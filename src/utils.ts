import  puppeteer, { Page, Browser, ElementHandle, Serializable } from  'puppeteer';
import { blockedResourceTypes, skippedResources } from './blockRequestContent';

// @ts-ignore
const clickButton = (selector: string) => { document.querySelector(selector).click(); };

export interface LoginForm {
  readonly username: string;
  readonly password: string;
  readonly submit: string;
}

class Utils {
  public browser: Browser;
  public page: Page;

  public  constructor(browser: Browser, page: Page) { // don't call this directly
    this.browser = browser;
    this.page = page;
  }

  public static async builder(config) {
      // https://stackoverflow.com/questions/43431550/async-await-class-constructor
    const browser = await puppeteer.launch(config);

    const pages = await browser.pages();
    const page = pages[0];
    page.setViewport({ width: 1366, height: 768 });
    await page.setRequestInterception(true);

    await page.setRequestInterception(true);

    page.on('request', request => {
      const requestUrl = request.url().split('?')[0].split('#')[0];
      const shouldBlockResources: boolean =
       blockedResourceTypes.indexOf(request.resourceType()) !== -1 ||
        skippedResources.some(resource => requestUrl.indexOf(resource) !== -1);

      if (shouldBlockResources) {
        request.abort();
      } else {
        request.continue();
      }
    });

    page.on('error', _ => {
      page.screenshot({path: 'fail_point.png'});
    });
    return new Utils(browser, page);
  }

  public static promisedBasedSleep(milliseconds: number): Promise<any> {
    console.log(`sleeping for ${milliseconds}ms`);
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  async clickButton(field: string) {
    await this.page.evaluate(clickButton, field);
  }
  async clickSubmit() {
    await this.clickButton('button[type="submit"]');
  }
  getArrayOf(items) { // todo: what is the type of `items`
    return Array.from(items);
  }
  getArrayOfSelectors(selectors, document) {
    return this.getArrayOf(document.querySelectorAll(selectors) as any);
  }

  getSelectorFromArrayOfSelectors(selectors, searchValue, document) {
    const listOfSelectors = this.getArrayOfSelectors(selectors, document) as any;
    // @ts-ignore
    return listOfSelectors.find(e => e.text === searchValue) as any;
  }

  async getSelectorFromArrayAndClick(selectors: string, searchValue: string, sleepTime: number = 0, parent = this.page) {

    const listOfSelectors: ElementHandle[] = await parent.$$(selectors);

    for (let i = 0; i < listOfSelectors.length; i += 1) {
      const selector: ElementHandle = listOfSelectors[i];
      const elementText = await selector.evaluate(node => node['innerText']);
      console.log(elementText);
      const isSearchElement: boolean = elementText === searchValue;

      if (isSearchElement) {
        await Utils.promisedBasedSleep(sleepTime);
        selector.click();
        return selector;
      }
    }
  }

  async getInnerTextOfSelector(selector) {
    await this.waitForSelector(selector);

    return await this.page.evaluate((elementSelector) => {
      return document.querySelector(elementSelector).innerText;
    },                              selector);
  }

  async login(username: string, password: string, form: LoginForm) {
    await this.page.type(form.username, username);
    await this.page.type(form.password, password);
    await this.clickButton(form.submit);
  }

  async waitForSelector(selector: string) {
    await this.page.waitForSelector(selector)
            .then(() => console.log(`Saw '${selector}'`));
  }

  async isSelectorPresent(selector, timeOut = 5000) {
    try {
      await Utils.promisedBasedSleep(timeOut);
      await this.waitForSelector(selector);
      return true;

    } catch (error) {
      console.log(error); // might be an error because of a bad selector
      return false;
    }
  }

  async waitAndClick(selector: string) {
    this.waitForSelector(selector);
    this.clickButton(selector);
  }
  async navigateTo(url: string) {
    this.page.goto(url);
  }
  async closeBrowser() {
    await this.browser.close();
  }

  parseBool(val: boolean | string) {
    return val === true || val === 'true';
  }
}

export default Utils;