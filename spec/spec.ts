import * as playwright from 'playwright';
import { Ensure, equals } from '@serenity-js/assertions';
import { actorCalled, actorInTheSpotlight, ArtifactArchiver, configure as serenityConfig, serenity } from '@serenity-js/core';
import { ConsoleReporter } from '@serenity-js/console-reporter';
import { JUnitReporter } from '../src/JUnitReporter';
import { JUnitArchiver } from '../src/JUnitArchiver';
import { configure, getLogger } from 'log4js';
import { BrowseTheWeb, CloseBrowser, OpenBrowser, Navigate, TakeScreenshot } from '../src/playwright-serenity';
import { JUnitReporterLogger } from '../src/JUnitReporterLogger';


configure({
  appenders: { file: { type: 'file', filename: '../logs/logs.log', flags: 'w' }, out: { type: 'stdout' } },
  categories: { default: { appenders: ['file', 'out'], level: 'debug' } }
});

const logger = getLogger();
logger.level = 'debug';

let url: string = 'https://en.wikipedia.org/wiki/Main_Page';

serenityConfig({
  crew: [
    ConsoleReporter.forDarkTerminals(),
    ArtifactArchiver.storingArtifactsAt('./serenity'),
    JUnitArchiver.storingArtifactsAt('./serenity'),
    JUnitReporterLogger.forJasmine()
  ]
});

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

afterEach(() => actorInTheSpotlight().attemptsTo(CloseBrowser()))

describe('integrated with Serenity/JS', () => {
  
  describe('chromium', () => {
    it('works with screenplay (chromium)', () =>
      actorCalled('William')
        .whoCan(BrowseTheWeb.using(playwright['chromium']))
        .attemptsTo(
          OpenBrowser(),
          Navigate.to(url),
          TakeScreenshot.of('homepage'),
        ),
    );

    it('homepage with error', () => {
      actorCalled('William')
        .whoCan(BrowseTheWeb.using(playwright['chromium']))
        .attemptsTo(
          OpenBrowser(),
          Navigate.to(url),
          TakeScreenshot.of('homepage'),
          Ensure.that(1, equals(2))
        )
    }
    );
  })
});

// describe('2nd suite', () => {
//   it('homepage with error', () =>
//     actorCalled('William')
//       .whoCan(BrowseTheWeb.using(playwright['chromium']))
//       .attemptsTo(
//         OpenBrowser(),
//         Navigate.to(url),
//         TakeScreenshot.of('homepage'),
//         Ensure.that(1, equals(2))
//       )
//   );
// });