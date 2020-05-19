import { Stage, StageCrewMember } from '@serenity-js/core';
import { create } from 'xmlbuilder2';

import {
  ActivityStarts,
  ArtifactGenerated,
  DomainEvent,
  SceneFinished,
  SceneStarts,
  TestRunFinishes,
  TestSuiteFinished,
  TestSuiteStarts
} from '@serenity-js/core/lib/events';

import {
  ExecutionFailedWithAssertionError,
  ExecutionIgnored,
  ExecutionSkipped,
  ExecutionSuccessful,
  Name,
  ProblemIndication
} from '@serenity-js/core/lib/model';
import { match } from 'tiny-types';
import { XMLData } from './JUnitArchiver';

export class JUnitReporterLogger {
  static forJasmine(): JUnitReporterJasmine {
    return new JUnitReporterJasmine();
  }
}

class JUnitReporterJasmine implements StageCrewMember {
  private junitReport: JUnitReport = new JUnitReport();

  constructor(private readonly stage: Stage = null) { }

  assignedTo(stage: Stage): StageCrewMember {
    console.log('JUnitReporterJasmine: assignedTo');
    return new JUnitReporterJasmine(stage);
  }
  notifyOf(event: DomainEvent): void {
    match(event)
      .when(ActivityStarts, (e: ActivityStarts) => {
        console.log('Event: ActivityStarts: ' + e.value.name.value);
        this.junitReport.addProperty('activity', e.value.name.value);
      })

      .when(SceneStarts, (e: SceneStarts) => {
        console.log('Event: SceneStarts: ' + e.value.name.value);
        this.junitReport.addTestCase(e.value.name.value);
      })

      .when(SceneFinished, (e: SceneFinished) => {
        console.log('Event: SceneFinished: ' + e.value.name.value);
        if (e.outcome instanceof ExecutionSuccessful) this.junitReport.passTest();
        else if (e.outcome instanceof ExecutionFailedWithAssertionError) this.junitReport.failTest(e.outcome.error.name, e.outcome.error.message, e.outcome.error.stack);
        else if (e.outcome instanceof ExecutionSkipped || e.outcome instanceof ExecutionIgnored) this.junitReport.skipTest();
        else if (e.outcome instanceof ProblemIndication) this.junitReport.errorTest(e.outcome.error.name, e.outcome.error.message, e.outcome.error.stack);
      })

      .when(TestSuiteStarts, (e: TestSuiteStarts) => {
        console.log('Event: TestSuiteStarts: ' + e.value.name.value);
        this.junitReport.addTestSuite(e.value.name.value);
      })

      .when(TestSuiteFinished, (e: TestSuiteFinished) => {
        console.log('Event: TestSuiteFinished: ' + e.value.name.value);
        this.junitReport.endTestSuite();
      })

      .when(TestRunFinishes, (e: TestRunFinishes) => {
        console.log('Event: TestRunFinishes: ' + e.timestamp);
        this.broadcast();
      })

      .else((e: DomainEvent) => {
        return void 0;
      });
  }

  getReportObj() {
    return this.junitReport.getReportObj();
  }

  private broadcast(): void {
    this.stage.announce(new ArtifactGenerated(
      new Name('result'), XMLData.fromString(this.junitReport.toXML())
    ));
  }
}

class JUnitReport {
  report: {
    testsuites: {
      testsuite?: [{
        "@id": number,
        "@name": string,
        "@timestamp": string,
        "@time"?: number
        "@tests"?: number,
        "@failures"?: number,
        "@errors?": number,
        "@skipped"?: number,
        properties?: {
          property: [{ "@name": string, "@value": string }]
        },
        testcase?: [
          {
            "@name": string,
            "@time"?: number
            failure?: { "@type": string, "@message": string },
            error?: { "@type": string, "@message": string },
            skipped?: {}
          }
        ]
      }
      ]
    }
  } = { testsuites: {} };

  private currSuite;
  private suiteStartTime: number;
  private currSuiteFinished: boolean = true;
  private pass: number;
  private fail: number;
  private skip: number;
  private error: number;
  private currTest;
  private testStartTime: number;

  constructor() { }

  getReportObj() {
    return this.report;
  }

  addTestSuite(name: string): void {
    // Only add a new test suite if currSuite has ended or first time
    if (this.currSuiteFinished) {
      this.currSuiteFinished = false;
      let start = new Date();
      this.currSuite = {
        "@id": this.report.testsuites.testsuite instanceof Array ? this.report.testsuites.testsuite.length : 0,
        "@name": name,
        "@timestamp": start.toISOString(),
        "@tests": 0
      }
      this.suiteStartTime = start.getTime();
      this.pass = this.fail = this.error = this.skip = 0;

      this.report.testsuites.testsuite instanceof Array ? this.report.testsuites.testsuite.push(this.currSuite) : this.report.testsuites.testsuite = [this.currSuite];
    }
  }

  addTestSuiteAttribute(field: string, value: string | number) {
    this.currSuite[field] = value;
  }

  endTestSuite() {
    this.currSuite["@time"] = ((new Date()).getTime() - this.suiteStartTime) / 1000;
    this.currSuite['@tests'] = this.pass + this.fail + this.error + this.skip;
    this.fail ? (this.currSuite['@failures'] = this.fail) : '';
    this.error ? (this.currSuite['@errors'] = this.error) : '';
    this.skip ? (this.currSuite['@skipped'] = this.skip) : '';
    this.currSuite = undefined;
    this.currSuiteFinished = true;
  }

  addTestCase(name: string): void {
    this.currTest = { "@name": name };
    this.testStartTime = (new Date()).getTime();

    this.currSuite.testcase instanceof Array ? this.currSuite.testcase.push(this.currTest) : this.currSuite.testcase = [this.currTest];
    this.currSuite["@tests"]++;
  }

  addTestCaseAttribute(field: string, value: string) {
    this.currTest[field] = value;
  }

  endTestCase() {
    this.currTest["@time"] = ((new Date()).getTime() - this.testStartTime) / 1000;
    this.currTest = undefined;
  }

  addProperty(name: string, value: string): void {
    let property = {
      "@name": name + '_' + (this.currSuite.properties ? this.currSuite.properties.property.length : 0) + '_testcase_' + this.currTest['@name'],
      "@value": value
    }

    if (!this.currSuite.properties)
      this.currSuite.properties = { property: [property] };
    else
      this.currSuite.properties.property.push(property);
  }

  failTest(type: string, message: string, cdata?: string): void {
    let failure = {
      "@type": type,
      "@message": message
    }
    cdata ? failure["$"] = cdata : '';

    this.currTest.failure = failure;
    this.fail++;
    this.endTestCase();
  }

  passTest() {
    this.pass++;
    this.endTestCase();
  }

  errorTest(type: string, message: string, cdata?: string): void {
    let error = {
      "@type": type,
      "@message": message
    }
    cdata ? error["$"] = cdata : '';

    this.currTest.error = error;
    this.error++;
    this.endTestCase();
  }

  skipTest(): void {
    this.currTest.skipped = {};
    this.skip++;
    this.endTestCase();
  }

  toXML(): string {
    let xml = create(this.report).end({ prettyPrint: true });
    return xml;
  }
}