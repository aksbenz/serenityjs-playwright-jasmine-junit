import {Ability, Interaction, UsesAbilities} from '@serenity-js/core';
import {Browser, BrowserContext, BrowserType, Page, ChromiumBrowser, WebKitBrowser, FirefoxBrowser} from 'playwright';
import {Photo, Name} from '@serenity-js/core/lib/model';

export class BrowseTheWeb implements Ability {
  private instance: Browser;
  private context: BrowserContext;
  private page: Page;

  constructor(private readonly browser: BrowserType<Browser>){}

  static using(browser: BrowserType<Browser>){
    return new BrowseTheWeb(browser);
  }

  static as(actor: UsesAbilities): BrowseTheWeb {
    return actor.abilityTo(BrowseTheWeb);
  }

  async open(){
    this.instance = await this.browser.launch({headless: false});
    this.context = await this.instance.newContext();
    this.page = await this.context.newPage();
  }

  async close(){
    await this.instance.close();
  }

  async navigateTo(url: string){
    return await this.page.goto(url);
  }

  async takeScreenshot(){
    return await this.page.screenshot();
  }
}

export const OpenBrowser = () => Interaction.where(`#actor opens the browser`, async (actor) => BrowseTheWeb.as(actor).open());
export const CloseBrowser = () => Interaction.where(`#actor closes the browser`, async (actor) => BrowseTheWeb.as(actor).close());

export const TakeScreenshot = {
  of: (name: string) => 
    Interaction.where(`#actor takes a screenshot of ${name}`, async (actor) =>{
      const screenshot = await BrowseTheWeb.as(actor).takeScreenshot();

      await actor.collect(
        Photo.fromBase64(screenshot.toString('base64')),
        new Name(name)
      )
    })
}

export const Navigate = {
  to: (url: string) => Interaction.where(`#actor navigates to ${url}`, async (actor) => {
    await BrowseTheWeb.as(actor).navigateTo(url);
  })
}