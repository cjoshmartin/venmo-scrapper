import { LaunchOptions } from 'puppeteer';

const config: LaunchOptions = {
  args: ['--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--window-size=1920x1080'],
  headless: false,
  slowMo: 10,
};

export default  config;