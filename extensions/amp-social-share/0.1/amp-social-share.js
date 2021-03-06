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

import {addParamsToUrl, parseUrl, parseQueryString} from '../../../src/url';
import {setStyle} from '../../../src/style';
import {getDataParamsFromAttributes} from '../../../src/dom';
import {getSocialConfig} from './amp-social-share-config';
import {isLayoutSizeDefined} from '../../../src/layout';
import {dev, user} from '../../../src/log';
import {openWindowDialog} from '../../../src/dom';
import {urlReplacementsForDoc} from '../../../src/url-replacements';
import {CSS} from '../../../build/amp-social-share-0.1.css';
import {platformFor} from '../../../src/platform';


class AmpSocialShare extends AMP.BaseElement {

  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);
    /** @private {?string} */
    this.shareEndpoint_ = null;

    /** @private {!Object} */
    this.params_ = {};

    /** @private {?../../../src/service/platform-impl.Platform} */
    this.platform_ = null;

    /** @private {?string} */
    this.href_ = null;

    /** @private {?string} */
    this.target_ = null;
  }

  /** @override */
  isLayoutSupported() {
    return true;
  }

  /** @override */
  buildCallback() {
    const typeAttr = user().assert(this.element.getAttribute('type'),
        'The type attribute is required. %s', this.element);
    user().assert(!/\s/.test(typeAttr),
        'Space characters are not allowed in type attribute value. %s',
        this.element);
    if (typeAttr === 'system') {
      // Hide/ignore system component if navigator.share unavailable
      if (!('share' in navigator)) {
        setStyle(this.element, 'display', 'none');
        return;
      }
    } else {
      // Hide/ignore non-system component if system share wants to be unique
      const systemOnly = ('share' in navigator) &&
        !!this.win.document.querySelectorAll(
          'amp-social-share[type=system][data-mode=replace]').length;
      if (systemOnly) {
        setStyle(this.element, 'display', 'none');
        return;
      }
    }
    const typeConfig = getSocialConfig(typeAttr) || {};
    this.shareEndpoint_ = user().assert(
        this.element.getAttribute('data-share-endpoint') ||
        typeConfig.shareEndpoint,
        'The data-share-endpoint attribute is required. %s', this.element);
    this.params_ = Object.assign({}, typeConfig.defaultParams,
        getDataParamsFromAttributes(this.element));
    this.platform_ = platformFor(this.win);

    const hrefWithVars = addParamsToUrl(this.shareEndpoint_, this.params_);
    const urlReplacements = urlReplacementsForDoc(this.getAmpDoc());
    urlReplacements.expandAsync(hrefWithVars).then(href => {
      this.href_ = href;
      // mailto:, whatsapp: protocols breaks when opened in _blank on iOS Safari
      const isMailTo = /^mailto:$/.test(parseUrl(href).protocol);
      const isWhatsApp = /^whatsapp:$/.test(parseUrl(href).protocol);
      const isIosSafari = this.platform_.isIos() && this.platform_.isSafari();
      this.target_ = (isIosSafari && (isMailTo || isWhatsApp))
          ? '_top' : '_blank';
    });

    this.element.setAttribute('role', 'link');
    this.element.addEventListener('click', () => this.handleClick_());
    this.element.classList.add(`amp-social-share-${typeAttr}`);
  }

  /** @private */
  handleClick_() {
    user().assert(this.href_ && this.target_, 'Clicked before href is set.');
    const href = dev().assertString(this.href_);
    const target = dev().assertString(this.target_);
    if (this.shareEndpoint_ === 'navigator-share:') {
      dev().assert(navigator.share !== undefined,
          'navigator.share disappeared.');
      // navigator.share() fails 'gulp check-types' validation on Travis
      navigator['share'](parseQueryString(href.substr(href.indexOf('?'))));
    } else {
      const windowFeatures = 'resizable,scrollbars,width=640,height=480';
      openWindowDialog(this.win, href, target, windowFeatures);
    }
  }

};

AMP.registerElement('amp-social-share', AmpSocialShare, CSS);
