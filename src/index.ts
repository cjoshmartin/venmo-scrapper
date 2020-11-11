import utils, { LoginForm } from './utils';
import firebaseAdmin from 'firebase-admin';

require('dotenv').config();

interface Payment {
  amount: number;
  message: string;
  username: string;
}

interface User {
  profile_picture: URL;
  total: number;
  usages: string[];

}
interface UniqueKeyObject<T> {
  [key: string]: T;
}

interface DatabaseSchema {
  'past-payments'?: string[]; // ISO Formatted Dates
  payments?: UniqueKeyObject<Payment>[]; // ISO Formated Key Value
  users?: UniqueKeyObject<User>[]; // Username Key Value
}

class Venmo extends utils {
  private firebaseApp: firebaseAdmin.app.App;
  private db: firebaseAdmin.database.Database;

  constructor(browser, page) { // don't call this directly
    super(browser, page);

    const firebaseAdminConfig = JSON.parse(process.env.SERVICE_API_KEY);

    this.firebaseApp = firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(firebaseAdminConfig),
      databaseURL:process.env.DATABASE_URL,
    });
    this.db = firebaseAdmin.database();
  }

  public static async builder(config) {
    const superClassBuilder = await utils.builder(config);

    return new Venmo(superClassBuilder.browser, superClassBuilder.page);
  }

  // ------------------------------------------------------------------

  private async waitForHomePage() {
    const feedSelector = 'div.feed-tabs';
    await this.waitForSelector(feedSelector);
  }

  public async loginIntoVenmo() {
    const form: LoginForm = {
      username: 'input[name="phoneEmailUsername"]',
      password: 'input[name="password"]',
      submit: 'button[type="submit"]',
    };

    await this.navigateTo('https://venmo.com/account/sign-in/');
    await Venmo.promisedBasedSleep(3000);
    await this.login(
        process.env.VENMO_USERNAME,
        process.env.PASSWORD,
        form,
    );

    // TODO: add check for verification
    await this.verification();

    // await this.waitForHomePage();
  }

  // ----------------------------------------------------------------
  private async enterCreditCardForVerification(creditCardNumber: string, expDate: string) {

    const creditCardNumberSelector = 'input[name="cardNumber"]';
    await this.waitForSelector(creditCardNumberSelector);
    await this.page.type(creditCardNumberSelector, creditCardNumber);

    await Venmo.promisedBasedSleep(1000);

    await this.page.type('input[name="expirationDate"]', expDate);
    await Venmo.promisedBasedSleep(1000);
    await this.clickSubmit();

  }
  private async dontRememberThisDevice() {
    const notNowSelector = 'button.mfa-button-do-not-remember';
    await this.waitAndClick(notNowSelector);
  }

  public async verification() {
    await Venmo.promisedBasedSleep(3000);

    // Confirm using my card instead
    const IDontHaveAccessLink = "p.link > a"
    await this.waitAndClick(IDontHaveAccessLink);

    await Venmo.promisedBasedSleep(3000);

    const confirmUsingMyCardInsteadLink = "p.link > a"
    await this.waitAndClick(confirmUsingMyCardInsteadLink);

    await Venmo.promisedBasedSleep(3000);

    await this.enterCreditCardForVerification(process.env.CARD_NUMBER, process.env.CARD_NUMBER_EXP);

    await Venmo.promisedBasedSleep(3000);

    await this.dontRememberThisDevice();

  }

  // ----------------------------------------------------------------

  public async goToUserPage() {

    await this.page.goto('https://venmo.com/baby-yezzus');

    const paymentsSelector = 'div#profile_feed_container > .p_twenty_r';
    await this.waitForSelector(paymentsSelector);

  }

  // ----------------------------------------------------------------

  public async loadAllTransactions() {

    const moreButtonSelector = '.moreButton';
    await this.waitForSelector(moreButtonSelector);

    await this.page.evaluate(async (selector, sleep) => {
      await Venmo.promisedBasedSleep(1000);
      while (document.querySelector(selector).innerText !== 'No more payments') {
      // @ts-ignore
        venmo.feed.loadMoreStories('profile_feed');
        await sleep(1000);
      }
    },
                             moreButtonSelector);
  }
  // ----------------------------------------------------------------

  public async getData(): Promise<DatabaseSchema> {
    const dataDump = await this.db.ref('/').once('value', (snapshot) => {});
    // tslint:disable-next-line: max-line-length
    let data: (DatabaseSchema | undefined) = dataDump.toJSON() as unknown as DatabaseSchema | undefined;

    if (data?.payments === undefined || data?.payments === null) {
      data = {
        'past-payment': [],
        users: {},
        payments: {},
      } as unknown as DatabaseSchema;
    }

    return  data;
  }

  public async setUserInformation(user: UniqueKeyObject<User>) {
    // // NEEDS TESTS
    // const databaseRef = await this.db.ref('/users').once('value', (snapshot) => {});
    // const data: UniqueKeyObject<User>[] = databaseRef.toJSON() as UniqueKeyObject<User>[];
    // const userNames = new Set(data.map(value => value.key));

    // if (userNames.has(user.key)) {
    //   const key = user.key;
    //   const usages = user[key].usages; // SHRUG
    // } else {
    //   data.push(user);
    // }

    // TODO: sync to database
  }

  public async setPaymentInformation(payment: UniqueKeyObject<Payment>) {
    await this.db.ref('/payments').set(payment);
  }

  public async getPayments() {

    const data: DatabaseSchema = await this.getData();
    const setOfPastPayments: Set<string>  = new Set(data['past-payments']);

    const paymentsSelector = 'div#profile_feed_container > .p_twenty_r';
    // tslint:disable-next-line: max-line-length
    const payments: any = await this.page.evaluate((selector) => document.querySelectorAll(selector), paymentsSelector);

    payments.forEach((el) => {
      const paymentItem = el.querySelector('tr');
      const nameAndProfilePictureSelector = paymentItem.querySelector('div.relative > a.bold');
      const dateOfTransactionSelector = el.attributes[1].value;

      const hasProcessedPaymentBefore = setOfPastPayments.size > 0
       && setOfPastPayments.has(dateOfTransactionSelector);

      if (hasProcessedPaymentBefore || this.isSelectorPresent('span.red', 500)) {
        return data;
      }

      if (paymentItem.querySelector('span.green') !== null) {
        const username: string = nameAndProfilePictureSelector.attributes[0].value.substring(1);
        const amount = parseFloat((paymentItem.querySelector('span.green').innerText).substring(2));
        const message = el.querySelector('div[style="word-wrap:break-word"]').innerText;
        // tslint:disable-next-line: variable-name
        const profile_picture = nameAndProfilePictureSelector
        .querySelector('img')
        .attributes['src']
        .value;

        const user: UniqueKeyObject<User> = {
          [username]: {
            profile_picture,
            total: amount,
            usages: [dateOfTransactionSelector],
          },
        };

        this.setUserInformation(user);

        const payment: UniqueKeyObject<Payment> = {
          [dateOfTransactionSelector]: {
            username,
            amount,
            message,
          },
        };

        this.setPaymentInformation(payment);

      } // end of transaction
    }, // end of ForEach
    ); // end of ForEach

    return data;
  }

}

// ------------------------------------------

import puppeteerConfiguation from './puppeteerConfiguation';

(async () => {

  const venmo = await Venmo.builder(puppeteerConfiguation);

  await venmo.loginIntoVenmo();

  // await venmo.goToUserPage();

  // await venmo.loadAllTransactions();

  // await venmo.getPayments();

  // // @ts-ignore
  // console.log(JSON.stringify(await venmo.getData(), ' ', 4));

  // console.log('DONE SCRAPPING!');

  // await venmo.closeBrowser();
    // db.ref('/').update(paymentsDiv)
  return;
})();
