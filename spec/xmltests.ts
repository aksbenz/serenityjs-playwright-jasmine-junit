import { XMLData } from '../src/JUnitArchiver';
import { expect } from 'chai';
import { Artifact } from '@serenity-js/core/lib/model';

describe('Artifact', () => {
  describe('XMLData', () => {

    const xml = XMLData.fromString('<root><a id="1">Test 1</a><a id="2">Test 2</a></root>');

    /** @test {XMLData#toJSON} */
    it('can be serialised', () => {
      const serialised = xml.toJSON();

      expect(serialised.type).to.equal('XMLData');
      expect(serialised.base64EncodedValue).to.equal(xml.base64EncodedValue);
    });

    /**
     * @test {XMLData#toJSON}
     * @test {Artifact.fromJSON}
     */
    it('can be de-serialised', () => {
      const
        serialised = xml.toJSON(),
        deserialised = Artifact.fromJSON(serialised);

      expect(deserialised).to.equal(xml);
    });

    /**
     * @test {XMLData#map}
     * @test {XMLData#base64EncodedValue}
     */
    it('allows for its value to be extracted as a Buffer', () => {
      xml.map(value => expect(value).to.be.instanceOf(Buffer));
      xml.map(value => expect(value.toString('base64')).to.equal(xml.base64EncodedValue));
    });

    /**
     * @test {XMLData.fromBuffer}
     */
    it('can be instantiated from a Buffer', () => {
      expect(XMLData.fromBuffer(Buffer.from(xml.base64EncodedValue, 'base64'))).to.equal(xml);
    });
  });
})