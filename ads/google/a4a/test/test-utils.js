/**
 * Copyright 2016 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  extractGoogleAdCreativeAndSignature,
  additionalDimensions,
  extractAmpAnalyticsConfig,
  injectActiveViewAmpAnalyticsElement,
} from '../utils';
import {createElementWithAttributes} from '../../../../src/dom';
import {base64UrlDecodeToBytes} from '../../../../src/utils/base64';
import {
  installExtensionsService,
} from '../../../../src/service/extensions-impl';
import {extensionsFor} from '../../../../src/extensions';
import {
  MockA4AImpl,
} from '../../../../extensions/amp-a4a/0.1/test/utils';
import '../../../../extensions/amp-ad/0.1/amp-ad-xorigin-iframe-handler';
import {installDocService} from '../../../../src/service/ampdoc-impl';
import {createIframePromise} from '../../../../testing/iframe';
import * as sinon from 'sinon';

function setupForAdTesting(fixture) {
  installDocService(fixture.win, /* isSingleDoc */ true);
  installExtensionsService(fixture.win);
  const doc = fixture.doc;
  // TODO(a4a-cam@): This is necessary in the short term, until A4A is
  // smarter about host document styling.  The issue is that it needs to
  // inherit the AMP runtime style element in order for shadow DOM-enclosed
  // elements to behave properly.  So we have to set up a minimal one here.
  const ampStyle = doc.createElement('style');
  ampStyle.setAttribute('amp-runtime', 'scratch-fortesting');
  doc.head.appendChild(ampStyle);
}

describe('Google A4A utils', () => {

  describe('#extractGoogleAdCreativeAndSignature', () => {
    it('should return body and signature', () => {
      const creative = 'some test data';
      const headerData = {
        'X-AmpAdSignature': 'AQAB',
      };
      const headers = {
        has: h => { return h in headerData; },
        get: h => { return headerData[h]; },
      };
      return expect(extractGoogleAdCreativeAndSignature(creative, headers))
          .to.eventually.deep.equal({
            creative,
            signature: base64UrlDecodeToBytes('AQAB'),
            size: null,
          });
    });

    it('should return body and signature and size', () => {
      const creative = 'some test data';
      const headerData = {
        'X-AmpAdSignature': 'AQAB',
        'X-CreativeSize': '320x50',
      };
      const headers = {
        has: h => { return h in headerData; },
        get: h => { return headerData[h]; },
      };
      return expect(extractGoogleAdCreativeAndSignature(creative, headers))
          .to.eventually.deep.equal({
            creative,
            signature: base64UrlDecodeToBytes('AQAB'),
            size: [320, 50],
          });
    });

    it('should return null when no signature header is present', () => {
      const creative = 'some test data';
      const headers = {
        has: unused => { return false; },
        get: h => { throw new Error('Tried to get ' + h); },
      };
      return expect(extractGoogleAdCreativeAndSignature(creative, headers))
          .to.eventually.deep.equal({
            creative,
            signature: null,
            size: null,
          });
    });
  });

  //TODO: Add tests for other utils functions.

  describe('#additionalDimensions', () => {
    it('should return the right value when fed mocked inputs', () => {
      const fakeWin = {
        screenX: 1,
        screenY: 2,
        screenLeft: 3,
        screenTop: 4,
        outerWidth: 5,
        outerHeight: 6,
        screen: {
          availWidth: 11,
          availTop: 12,
        },
      };
      const fakeSize = {
        width: '100px',
        height: '101px',
      };
      return expect(additionalDimensions(fakeWin, fakeSize)).to.equal(
        '3,4,1,2,11,12,5,6,100px,101px');
    });
  });

  describe('#ActiveView AmpAnalytics integration', () => {
    let sandbox;
    beforeEach(() => {
      sandbox = sinon.sandbox.create();
    });

    it('should extract config from headers', () => {
      return createIframePromise().then(fixture => {
        setupForAdTesting(fixture);
        const extensions = extensionsFor(fixture.win);
        const loadExtensionSpy = sandbox.spy(extensions, 'loadExtension');
        let url = ['https://foo.com?a=b', 'https://bar.com?d=f'];
        const headers = {
          get: function(name) {
            expect(name).to.equal('X-AmpAnalytics');
            return JSON.stringify({url});
          },
          has: function(name) {
            expect(name).to.equal('X-AmpAnalytics');
            return true;
          },
        };
        expect(extractAmpAnalyticsConfig(headers, extensions))
          .to.deep.equal({urls: url});
        url = 'not an array';
        expect(extractAmpAnalyticsConfig(headers, extensions)).to.not.be.ok;
        url = ['https://foo.com?a=b', 'https://bar.com?d=f'];
        headers.has = function(name) {
          expect(name).to.equal('X-AmpAnalytics');
          return false;
        };
        expect(extractAmpAnalyticsConfig(headers, extensions)).to.not.be.ok;
        expect(loadExtensionSpy.withArgs('amp-analytics')).to.be.called.once;
      });
    });

    it('should not create amp-analytics element if no urls', () => {
      return createIframePromise().then(fixture => {
        setupForAdTesting(fixture);
        const doc = fixture.doc;
        const element = createElementWithAttributes(doc, 'amp-a4a', {
          'width': '200',
          'height': '50',
          'type': 'adsense',
        });
        const config = {urls: []};
        injectActiveViewAmpAnalyticsElement(new MockA4AImpl(element), config);
        const ampAnalyticsElements = element.querySelectorAll('amp-analytics');
        expect(ampAnalyticsElements.length).to.equal(0);
      });
    });
    it('should load extension and create amp-analytics element', () => {
      return createIframePromise().then(fixture => {
        setupForAdTesting(fixture);
        const doc = fixture.doc;
        const element = createElementWithAttributes(doc, 'amp-a4a', {
          'width': '200',
          'height': '50',
          'type': 'adsense',
        });
        const urls = ['https://foo.com?hello=world', 'https://bar.com?a=b'];
        const config = {urls};
        const responseHeaders = {get: () => 'qqid_string'};
        injectActiveViewAmpAnalyticsElement(
            new MockA4AImpl(element), config, responseHeaders);
        const ampAnalyticsElements = element.querySelectorAll('amp-analytics');
        expect(ampAnalyticsElements.length).to.equal(1);
        const ampAnalyticsElement = ampAnalyticsElements[0];
        expect(ampAnalyticsElement.getAttribute('scoped')).to.equal('');
        const scriptElements = ampAnalyticsElement.querySelectorAll('script');
        expect(scriptElements.length).to.equal(1);
        const scriptElement = scriptElements[0];
        expect(scriptElement.getAttribute('type')).to.equal('application/json');
        const ampAnalyticsObj = JSON.parse(scriptElement.textContent);
        const csiRequest = ampAnalyticsObj.requests.visibilityCsi;
        expect(csiRequest).to.not.be.null;
        // We expect slotId == null, since no real element is created, and so
        // no slot index is ever set.
        expect(csiRequest).to.match(new RegExp(
            '^https://csi\\.gstatic\\.com/csi\\?' +
            'fromAnalytics=1&c=[0-9]+&slotId=null&qqid\\.0=[a-zA-Z_]+$'));
        // Need to remove this request as it will vary in test execution.
        delete ampAnalyticsObj.requests.visibilityCsi;
        expect(ampAnalyticsObj).to.deep.equal(
          {
            transport: {beacon: false, xhrpost: false},
            requests: {
              visibility1: urls[0],
              visibility2: urls[1],
            },
            triggers: {
              continuousVisible: {
                on: 'visible',
                request: ['visibility1', 'visibility2'],
                visibilitySpec: {
                  selector: 'amp-ad',
                  selectionMethod: 'closest',
                  visiblePercentageMin: 50,
                  continuousTimeMin: 1000,
                },
              },
              continuousVisibleIniLoad: {
                on: 'ini-load',
                request: 'visibilityCsi',
                visibilitySpec: {
                  selector: 'amp-ad',
                  selectionMethod: 'closest',
                  visiblePercentageMin: 50,
                  continuousTimeMin: 1000,
                },
              },
              continuousVisibleRenderStart: {
                on: 'render-start',
                request: 'visibilityCsi',
                visibilitySpec: {
                  selector: 'amp-ad',
                  selectionMethod: 'closest',
                  visiblePercentageMin: 50,
                  continuousTimeMin: 1000,
                },
              },
            },
          });
      });
    });
  });
});
